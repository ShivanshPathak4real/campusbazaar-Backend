import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import db from './db.js';

const CATEGORIES = [
  { name: 'Books', slug: 'books', icon: 'book' },
  { name: 'Electronics', slug: 'electronics', icon: 'laptop' },
  { name: 'Furniture', slug: 'furniture', icon: 'armchair' },
  { name: 'Hostel Essentials', slug: 'hostel-essentials', icon: 'lamp' },
  { name: 'Fashion', slug: 'fashion', icon: 'shirt' },
  { name: 'Accessories', slug: 'accessories', icon: 'watch' },
  { name: 'Sports', slug: 'sports', icon: 'dumbbell' },
  { name: 'Miscellaneous', slug: 'miscellaneous', icon: 'box' },
];

const CAMPUSES = ['North Campus', 'South Campus', 'Hostel Block C', 'Hostel Block D', 'City Campus'];

const USERS = [
  { name: 'Ananya Sharma', email: 'ananya@campus.edu' },
  { name: 'Rohan Mehta', email: 'rohan@campus.edu' },
  { name: 'Priya Nair', email: 'priya@campus.edu' },
  { name: 'Karan Verma', email: 'karan@campus.edu' },
  { name: 'Sneha Iyer', email: 'sneha@campus.edu' },
  { name: 'Aditya Rao', email: 'aditya@campus.edu' },
  { name: 'Meera Joshi', email: 'meera@campus.edu' },
  { name: 'Vikram Singh', email: 'vikram@campus.edu' },
];

const LISTINGS = [
  // Books
  { cat: 'books', title: 'Introduction to Algorithms (CLRS), 3rd Edition', desc: 'Used for one semester, all pages intact, minor highlighting in chapters 1-4. Great for DSA courses.', condition: 'good', type: 'sell', price: 650, original: 1200, year: 2023 },
  { cat: 'books', title: 'Engineering Mathematics Vol 1 & 2 (set)', desc: 'Both volumes, no torn pages, some pencil notes that can be erased.', condition: 'fair', type: 'sell', price: 300, original: 900, year: 2022 },
  { cat: 'books', title: 'Organic Chemistry Reference Set', desc: 'Barely used, bought for elective that got cancelled. Like new.', condition: 'like-new', type: 'sell', price: 800, original: 1500, year: 2024 },
  { cat: 'books', title: 'GATE CS Preparation Bundle', desc: '5 books covering all core subjects, some are marked with important questions.', condition: 'good', type: 'sell', price: 950, original: 2200, year: 2023 },
  { cat: 'books', title: 'Database Management Systems - Navathe', desc: 'Clean copy, no markings, used for one semester only.', condition: 'like-new', type: 'exchange', exchangeFor: 'Operating Systems textbook or similar CS text' },
  // Electronics
  { cat: 'electronics', title: 'Casio FX-991ES Scientific Calculator', desc: 'Works perfectly, all functions tested, comes with cover.', condition: 'good', type: 'sell', price: 450, original: 900, year: 2023 },
  { cat: 'electronics', title: 'Dell Inspiron 15 Laptop (i5, 8GB RAM)', desc: 'Used throughout college, battery health ~80%, no major scratches, includes charger.', condition: 'good', type: 'sell', price: 22000, original: 45000, year: 2022 },
  { cat: 'electronics', title: 'boAt Rockerz 450 Headphones', desc: 'Bluetooth headphones, good battery life, minor scuff on the band.', condition: 'fair', type: 'sell', price: 700, original: 1600, year: 2023 },
  { cat: 'electronics', title: 'Portable Laptop Stand (Aluminium)', desc: 'Adjustable height, sturdy, barely used.', condition: 'like-new', type: 'rent', rentalPrice: 40, rentalPeriod: 'per-week', deposit: 200 },
  { cat: 'electronics', title: 'HP DeskJet Printer', desc: 'Works fine, occasionally used for assignments, ink cartridge included.', condition: 'good', type: 'rent', rentalPrice: 150, rentalPeriod: 'per-month', deposit: 500 },
  { cat: 'electronics', title: 'Logitech Wireless Mouse', desc: 'Smooth scroll, new batteries included.', condition: 'like-new', type: 'sell', price: 250, original: 500, year: 2024 },
  { cat: 'electronics', title: 'Power Bank 20000mAh', desc: 'Fast charging, tested working, slight wear on casing.', condition: 'fair', type: 'sell', price: 500, original: 1400, year: 2022 },
  { cat: 'electronics', title: 'Study Lamp with USB Charging Port', desc: 'LED lamp, 3 brightness modes, works great for late night study.', condition: 'good', type: 'sell', price: 350, original: 700, year: 2023 },
  // Furniture
  { cat: 'furniture', title: 'Folding Study Table', desc: 'Compact, foldable for storage, sturdy for laptop + books.', condition: 'good', type: 'sell', price: 900, original: 1800, year: 2022 },
  { cat: 'furniture', title: 'Ergonomic Study Chair', desc: 'Adjustable height, cushioned seat, some wear on armrests.', condition: 'fair', type: 'sell', price: 1200, original: 3000, year: 2021 },
  { cat: 'furniture', title: 'Bookshelf - 3 Tier Wooden', desc: 'Solid wood, good condition, moving out sale.', condition: 'good', type: 'sell', price: 700, original: 1500, year: 2022 },
  { cat: 'furniture', title: 'Bean Bag (Large, Grey)', desc: 'Comfortable, recently refilled beans, minor fading.', condition: 'fair', type: 'sell', price: 500, original: 1400, year: 2023 },
  { cat: 'furniture', title: 'Folding Table for Semester', desc: 'Perfect for hostel room, available for rent this semester.', condition: 'good', type: 'rent', rentalPrice: 100, rentalPeriod: 'per-month', deposit: 300 },
  // Hostel Essentials
  { cat: 'hostel-essentials', title: 'Steel Almirah (Single Door)', desc: 'Sturdy, lockable, minor rust spots on the back (not visible).', condition: 'fair', type: 'sell', price: 1500, original: 4000, year: 2021 },
  { cat: 'hostel-essentials', title: 'Electric Kettle 1.5L', desc: 'Works perfectly, auto shut-off feature.', condition: 'good', type: 'sell', price: 400, original: 900, year: 2023 },
  { cat: 'hostel-essentials', title: 'Mattress (Single, 4 inch)', desc: 'Comfortable, no stains, using for 1 year only.', condition: 'good', type: 'sell', price: 1200, original: 2500, year: 2023 },
  { cat: 'hostel-essentials', title: 'Iron Box', desc: 'Non-stick sole plate, tested and working fine.', condition: 'good', type: 'rent', rentalPrice: 30, rentalPeriod: 'per-week', deposit: 150 },
  { cat: 'hostel-essentials', title: 'Bucket + Mug Set', desc: 'Basic hostel essentials, lightly used.', condition: 'good', type: 'sell', price: 150, original: 300, year: 2024 },
  { cat: 'hostel-essentials', title: 'Wall Clock', desc: 'Silent movement, working battery included.', condition: 'like-new', type: 'sell', price: 100, original: 250, year: 2024 },
  // Fashion
  { cat: 'fashion', title: 'Formal Blazer (Size M)', desc: 'Worn twice for interviews, dry cleaned, excellent condition.', condition: 'like-new', type: 'rent', rentalPrice: 200, rentalPeriod: 'per-day', deposit: 500 },
  { cat: 'fashion', title: 'Winter Jacket (Size L)', desc: 'Warm, water resistant, used for one winter.', condition: 'good', type: 'sell', price: 800, original: 2000, year: 2023 },
  { cat: 'fashion', title: 'College Fest T-Shirts (Set of 3)', desc: 'Worn once, various sizes M-L available.', condition: 'like-new', type: 'sell', price: 300, original: 600, year: 2024 },
  // Accessories
  { cat: 'accessories', title: 'Fossil Analog Watch', desc: 'Gifted, barely worn, comes with original box.', condition: 'like-new', type: 'sell', price: 1800, original: 4500, year: 2024 },
  { cat: 'accessories', title: 'Laptop Backpack (Waterproof)', desc: 'Multiple compartments, minor wear on straps.', condition: 'good', type: 'sell', price: 550, original: 1300, year: 2022 },
  { cat: 'accessories', title: 'Sunglasses (UV Protected)', desc: 'Barely used, no scratches on lens.', condition: 'like-new', type: 'sell', price: 250, original: 700, year: 2024 },
  // Sports
  { cat: 'sports', title: 'Badminton Racket (Yonex)', desc: 'Good grip, restrung once, ready to play.', condition: 'good', type: 'sell', price: 600, original: 1500, year: 2022 },
  { cat: 'sports', title: 'Yoga Mat (6mm)', desc: 'Non-slip, cleaned regularly, minor edge wear.', condition: 'fair', type: 'sell', price: 200, original: 500, year: 2023 },
  { cat: 'sports', title: 'Cricket Kit Bag (Full Set)', desc: 'Bat, pads, gloves included, used for intramurals.', condition: 'fair', type: 'rent', rentalPrice: 100, rentalPeriod: 'per-week', deposit: 800 },
  { cat: 'sports', title: 'Football (Size 5)', desc: 'Good bounce, no punctures, lightly used.', condition: 'good', type: 'sell', price: 300, original: 800, year: 2023 },
  { cat: 'sports', title: 'Cycle - Hero Sprint (Gear)', desc: 'Well maintained, recently serviced, great for campus commute.', condition: 'good', type: 'sell', price: 3500, original: 8000, year: 2022 },
  // Misc
  { cat: 'miscellaneous', title: 'Guitar (Acoustic, Yamaha)', desc: 'Good sound quality, comes with bag and extra strings.', condition: 'good', type: 'sell', price: 3200, original: 7000, year: 2021 },
  { cat: 'miscellaneous', title: 'Board Games Bundle (Monopoly, UNO, Chess)', desc: 'All pieces complete, great for hostel evenings.', condition: 'good', type: 'sell', price: 400, original: 1000, year: 2023 },
  { cat: 'miscellaneous', title: 'Drafter/Drawing Kit', desc: 'Complete engineering drawing set, used for one semester.', condition: 'good', type: 'exchange', exchangeFor: 'Scientific calculator or lab coat' },
  { cat: 'miscellaneous', title: 'Lab Coat (Size L)', desc: 'Clean, no stains, used for chemistry lab.', condition: 'good', type: 'sell', price: 150, original: 400, year: 2023 },
];

function run() {
  const existing = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  if (existing > 0) {
    console.log('Database already has data. Skipping seed. Delete the .db file to reseed.');
    return;
  }

  const categoryIds = {};
  const insertCategory = db.prepare('INSERT INTO categories (id, name, slug, icon) VALUES (?, ?, ?, ?)');
  for (const c of CATEGORIES) {
    const id = nanoid();
    insertCategory.run(id, c.name, c.slug, c.icon);
    categoryIds[c.slug] = id;
  }

  const passwordHash = bcrypt.hashSync('password123', 10);
  const insertUser = db.prepare(
    `INSERT INTO users (id, name, email, password_hash, campus, role, is_verified, rating_avg, rating_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const userIds = [];
  USERS.forEach((u, i) => {
    const id = nanoid();
    const campus = CAMPUSES[i % CAMPUSES.length];
    const verified = i % 3 === 0 ? 1 : 0;
    insertUser.run(id, u.name, u.email, passwordHash, campus, 'student', verified, 4 + (i % 2) * 0.5, 3 + i);
    userIds.push(id);
  });

  // Admin account
  const adminId = nanoid();
  insertUser.run(adminId, 'Campus Admin', 'admin@campus.edu', passwordHash, 'North Campus', 'admin', 1, 5, 1);

  const insertListing = db.prepare(
    `INSERT INTO listings
      (id, seller_id, category_id, title, description, images, condition, listing_type,
       price, rental_price, rental_period, security_deposit, original_price, purchase_year,
       exchange_for, campus, status)
     VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
  );

  LISTINGS.forEach((l, i) => {
    const id = nanoid();
    const sellerId = userIds[i % userIds.length];
    const campus = CAMPUSES[i % CAMPUSES.length];
    insertListing.run(
      id, sellerId, categoryIds[l.cat], l.title, l.desc, l.condition, l.type,
      l.price || null, l.rentalPrice || null, l.rentalPeriod || null, l.deposit || null,
      l.original || null, l.year || null, l.exchangeFor || null, campus
    );
  });

  console.log(`Seeded ${CATEGORIES.length} categories, ${USERS.length + 1} users, ${LISTINGS.length} listings.`);
  console.log('Demo login: ananya@campus.edu / password123');
  console.log('Admin login: admin@campus.edu / password123');
}

run();
