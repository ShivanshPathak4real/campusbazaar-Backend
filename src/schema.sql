CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  campus TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT NOT NULL DEFAULT 'student', -- student | admin
  is_verified INTEGER NOT NULL DEFAULT 0,
  rating_avg REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  images TEXT NOT NULL DEFAULT '[]', -- JSON array of urls
  condition TEXT NOT NULL, -- new | like-new | good | fair | worn
  listing_type TEXT NOT NULL, -- sell | rent | exchange
  price REAL,
  rental_price REAL,
  rental_period TEXT, -- per-day | per-week | per-month
  security_deposit REAL,
  original_price REAL,
  purchase_year INTEGER,
  exchange_for TEXT,
  campus TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- draft | pending | active | sold | rented | removed
  views INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  -- Travel tickets fields
  ticket_type TEXT, -- Train Ticket | Bus Ticket | Flight Ticket | Other
  travel_date TEXT, -- YYYY-MM-DD
  departure_location TEXT,
  destination_location TEXT,
  departure_time TEXT,
  arrival_time TEXT,
  ticket_quantity INTEGER DEFAULT 1,
  -- Room / Property rentals fields
  property_type TEXT, -- Single Room | Shared Room | 1 BHK | 2 BHK | 3 BHK | Other
  locality TEXT,
  city TEXT,
  address TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  furnishing TEXT, -- Furnished | Semi-furnished | Unfurnished
  available_from TEXT,
  contact_info TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL REFERENCES users(id),
  seller_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL, -- purchase | rental | exchange
  amount REAL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | completed | cancelled
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rentals (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  start_date TEXT,
  end_date TEXT,
  deposit_paid REAL DEFAULT 0,
  returned INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exchange_requests (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users(id),
  offered_item TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | cancelled
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
  user_a TEXT NOT NULL REFERENCES users(id),
  user_b TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(listing_id, user_a, user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL, -- listing | user
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open | reviewed | dismissed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  reviewee_id TEXT NOT NULL REFERENCES users(id),
  listing_id TEXT REFERENCES listings(id),
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
