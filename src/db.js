import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.DATABASE_FILE || './data/campusbazaar.db';
const resolvedPath = path.resolve(process.cwd(), dbFile);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

export const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

// Migration: Ensure new columns exist on listings table
try {
  const listingCols = db.pragma('table_info(listings)');
  const colNames = new Set(listingCols.map((c) => c.name));

  const colsToAdd = [
    { name: 'ticket_type', type: 'TEXT' },
    { name: 'travel_date', type: 'TEXT' },
    { name: 'departure_location', type: 'TEXT' },
    { name: 'destination_location', type: 'TEXT' },
    { name: 'departure_time', type: 'TEXT' },
    { name: 'arrival_time', type: 'TEXT' },
    { name: 'ticket_quantity', type: 'INTEGER DEFAULT 1' },
    { name: 'property_type', type: 'TEXT' },
    { name: 'locality', type: 'TEXT' },
    { name: 'city', type: 'TEXT' },
    { name: 'address', type: 'TEXT' },
    { name: 'bedrooms', type: 'INTEGER' },
    { name: 'bathrooms', type: 'INTEGER' },
    { name: 'furnishing', type: 'TEXT' },
    { name: 'available_from', type: 'TEXT' },
    { name: 'contact_info', type: 'TEXT' },
    { name: 'metadata', type: "TEXT DEFAULT '{}'" },
  ];

  for (const col of colsToAdd) {
    if (!colNames.has(col.name)) {
      db.exec(`ALTER TABLE listings ADD COLUMN ${col.name} ${col.type}`);
    }
  }

  // Ensure Travel Tickets and Rent & Accommodation categories exist
  const ensureCategory = (name, slug, icon) => {
    const existing = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
    if (!existing) {
      db.prepare('INSERT INTO categories (id, name, slug, icon) VALUES (?, ?, ?, ?)').run(
        nanoid(),
        name,
        slug,
        icon
      );
    }
  };

  ensureCategory('Travel Tickets', 'travel-tickets', 'ticket');
  ensureCategory('Rent & Accommodation', 'rent-accommodation', 'home');
} catch (migErr) {
  console.error('Migration error in db.js:', migErr);
}

export default db;
