import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'campusbazaar', resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

const router = Router();

function serialize(row, userId) {
  const saved = userId
    ? !!db.prepare('SELECT 1 FROM saved_items WHERE user_id = ? AND listing_id = ?').get(userId, row.id)
    : false;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    images: JSON.parse(row.images || '[]'),
    condition: row.condition,
    listingType: row.listing_type,
    price: row.price,
    rentalPrice: row.rental_price,
    rentalPeriod: row.rental_period,
    securityDeposit: row.security_deposit,
    originalPrice: row.original_price,
    purchaseYear: row.purchase_year,
    exchangeFor: row.exchange_for,
    campus: row.campus,
    status: row.status,
    views: row.views,
    saves: row.saves,
    createdAt: row.created_at,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    // Travel ticket fields
    ticketType: row.ticket_type,
    travelDate: row.travel_date,
    departureLocation: row.departure_location,
    destinationLocation: row.destination_location,
    departureTime: row.departure_time,
    arrivalTime: row.arrival_time,
    ticketQuantity: row.ticket_quantity != null ? row.ticket_quantity : 1,
    // Rental property fields
    propertyType: row.property_type,
    locality: row.locality,
    city: row.city,
    address: row.address,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    furnishing: row.furnishing,
    availableFrom: row.available_from,
    contactInfo: row.contact_info,
    metadata: JSON.parse(row.metadata || '{}'),
    seller: {
      id: row.seller_id,
      name: row.seller_name,
      avatarUrl: row.seller_avatar,
      isVerified: !!row.seller_verified,
      ratingAvg: row.seller_rating_avg,
      ratingCount: row.seller_rating_count,
    },
    isSaved: saved,
  };
}

const BASE_SELECT = `
  SELECT l.*, c.name as category_name, c.slug as category_slug,
         u.name as seller_name, u.avatar_url as seller_avatar,
         u.is_verified as seller_verified, u.rating_avg as seller_rating_avg,
         u.rating_count as seller_rating_count
  FROM listings l
  LEFT JOIN categories c ON c.id = l.category_id
  LEFT JOIN users u ON u.id = l.seller_id
`;

// GET /api/listings - browse/search/filter
router.get('/', optionalAuth, (req, res) => {
  const {
    q, category, listingType, minPrice, maxPrice, condition, campus,
    ticketType, destination, travelDate,
    propertyType, bedrooms, furnishing, city,
    sort = 'newest', page = 1, limit = 20,
  } = req.query;

  const where = [`l.status = 'active'`];
  const params = [];

  if (q) {
    where.push(`(
      l.title LIKE ? OR l.description LIKE ? OR
      l.departure_location LIKE ? OR l.destination_location LIKE ? OR
      l.locality LIKE ? OR l.city LIKE ? OR
      l.ticket_type LIKE ? OR l.property_type LIKE ?
    )`);
    params.push(
      `%${q}%`, `%${q}%`,
      `%${q}%`, `%${q}%`,
      `%${q}%`, `%${q}%`,
      `%${q}%`, `%${q}%`
    );
  }
  if (category) { where.push(`c.slug = ?`); params.push(category); }
  if (listingType) { where.push(`l.listing_type = ?`); params.push(listingType); }
  if (condition) { where.push(`l.condition = ?`); params.push(condition); }
  if (campus) { where.push(`l.campus = ?`); params.push(campus); }
  if (minPrice) { where.push(`COALESCE(l.price, l.rental_price) >= ?`); params.push(Number(minPrice)); }
  if (maxPrice) { where.push(`COALESCE(l.price, l.rental_price) <= ?`); params.push(Number(maxPrice)); }

  // Travel Ticket filters
  if (ticketType) { where.push(`l.ticket_type = ?`); params.push(ticketType); }
  if (destination) {
    where.push(`(l.destination_location LIKE ? OR l.title LIKE ?)`);
    params.push(`%${destination}%`, `%${destination}%`);
  }
  if (travelDate) { where.push(`l.travel_date >= ?`); params.push(travelDate); }

  // Rental Property filters
  if (propertyType) { where.push(`l.property_type = ?`); params.push(propertyType); }
  if (bedrooms) { where.push(`l.bedrooms >= ?`); params.push(Number(bedrooms)); }
  if (furnishing) { where.push(`l.furnishing = ?`); params.push(furnishing); }
  if (city) {
    where.push(`(l.city LIKE ? OR l.locality LIKE ?)`);
    params.push(`%${city}%`, `%${city}%`);
  }

  let orderBy = 'l.created_at DESC';
  if (sort === 'price_low') orderBy = 'COALESCE(l.price, l.rental_price) ASC';
  if (sort === 'price_high') orderBy = 'COALESCE(l.price, l.rental_price) DESC';
  if (sort === 'popular') orderBy = 'l.views DESC';

  const offset = (Number(page) - 1) * Number(limit);
  const sql = `${BASE_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...params, Number(limit), offset);

  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM listings l LEFT JOIN categories c ON c.id = l.category_id WHERE ${where.join(' AND ')}`)
    .get(...params);

  res.json({
    listings: rows.map((r) => serialize(r, req.user?.id)),
    total: countRow.total,
    page: Number(page),
    limit: Number(limit),
  });
});

// GET /api/listings/:id
router.get('/:id', optionalAuth, (req, res) => {
  const row = db.prepare(`${BASE_SELECT} WHERE l.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Listing not found' });

  db.prepare('UPDATE listings SET views = views + 1 WHERE id = ?').run(row.id);
  row.views += 1;

  const similar = db
    .prepare(
      `${BASE_SELECT} WHERE l.category_id = ? AND l.id != ? AND l.status = 'active' LIMIT 4`
    )
    .all(row.category_id, row.id);

  res.json({
    listing: serialize(row, req.user?.id),
    similar: similar.map((r) => serialize(r, req.user?.id)),
  });
});

// POST /api/listings/upload-images - upload images (Cloudinary with local storage fallback)
router.post('/upload-images', requireAuth, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    try {
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
        const uploadPromises = req.files.map((file) => uploadToCloudinary(file.buffer));
        const urls = await Promise.all(uploadPromises);
        return res.json({ urls });
      }
    } catch (cloudErr) {
      console.warn('Cloudinary upload failed, falling back to local static uploads:', cloudErr.message);
    }

    // Local file fallback
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const urls = [];
    for (const file of req.files) {
      const ext = path.extname(file.originalname) || '.jpg';
      const filename = `${nanoid()}${ext}`;
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, file.buffer);
      urls.push(`http://localhost:${process.env.PORT || 4000}/uploads/${filename}`);
    }
    return res.json({ urls });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload images' });
  }
});

// POST /api/listings - create
router.post('/', requireAuth, (req, res) => {
  const {
    title, description, images = [], condition, listingType,
    price, rentalPrice, rentalPeriod, securityDeposit,
    originalPrice, purchaseYear, exchangeFor, campus, categoryId,
    ticketType, travelDate, departureLocation, destinationLocation,
    departureTime, arrivalTime, ticketQuantity,
    propertyType, locality, city, address, bedrooms, bathrooms,
    furnishing, availableFrom, contactInfo, metadata,
    status = 'active',
  } = req.body;

  let category = null;
  if (categoryId) {
    category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  }

  const isTicket = category?.slug === 'travel-tickets';
  const isProperty = category?.slug === 'rent-accommodation';

  let effectiveListingType = listingType;
  let effectiveCondition = condition;
  let effectiveDescription = description;
  let effectivePrice = price;
  let effectiveRentalPrice = rentalPrice;
  let effectiveRentalPeriod = rentalPeriod;

  if (isTicket) {
    effectiveListingType = 'sell';
    effectiveCondition = condition || 'good';
    if (!title || !title.trim()) return res.status(400).json({ error: 'Ticket title is required' });
    if (!ticketType) return res.status(400).json({ error: 'Ticket type is required (Train, Bus, Flight, or Other)' });
    if (!travelDate) return res.status(400).json({ error: 'Travel date is required' });
    if (!departureLocation || !departureLocation.trim()) return res.status(400).json({ error: 'Departure / Boarding location is required' });
    if (!destinationLocation || !destinationLocation.trim()) return res.status(400).json({ error: 'Destination location is required' });
    if (!price || Number(price) <= 0) return res.status(400).json({ error: 'Ticket price must be greater than 0' });

    if (!effectiveDescription || !effectiveDescription.trim()) {
      effectiveDescription = `Transferable ${ticketType} from ${departureLocation.trim()} to ${destinationLocation.trim()} on ${travelDate}.`;
    }
  } else if (isProperty) {
    effectiveListingType = 'rent';
    effectiveCondition = condition || 'good';
    effectiveRentalPeriod = rentalPeriod || 'per-month';
    effectiveRentalPrice = rentalPrice || price;

    if (!title || !title.trim()) return res.status(400).json({ error: 'Property title is required' });
    if (!propertyType) return res.status(400).json({ error: 'Property type is required (e.g. Single Room, 1 BHK, 2 BHK)' });
    if (!effectiveRentalPrice || Number(effectiveRentalPrice) <= 0) return res.status(400).json({ error: 'Monthly rent must be greater than 0' });
    if (!locality || !locality.trim()) return res.status(400).json({ error: 'Locality / Area is required' });
    if (!city || !city.trim()) return res.status(400).json({ error: 'City is required' });
    if (!contactInfo || !contactInfo.trim()) return res.status(400).json({ error: 'Contact information is required' });
    if (!effectiveDescription || !effectiveDescription.trim()) return res.status(400).json({ error: 'Property description is required' });
  } else {
    if (!title || !effectiveDescription || !effectiveCondition || !effectiveListingType) {
      return res.status(400).json({ error: 'title, description, condition and listingType are required' });
    }
    if (effectiveListingType === 'sell' && !effectivePrice) {
      return res.status(400).json({ error: 'price is required for sell listings' });
    }
    if (effectiveListingType === 'rent' && !effectiveRentalPrice) {
      return res.status(400).json({ error: 'rentalPrice is required for rent listings' });
    }
  }

  const id = nanoid();
  db.prepare(
    `INSERT INTO listings
      (id, seller_id, category_id, title, description, images, condition, listing_type,
       price, rental_price, rental_period, security_deposit, original_price, purchase_year,
       exchange_for, campus, status,
       ticket_type, travel_date, departure_location, destination_location, departure_time, arrival_time, ticket_quantity,
       property_type, locality, city, address, bedrooms, bathrooms, furnishing, available_from, contact_info, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, req.user.id, categoryId || null, title.trim(), effectiveDescription.trim(), JSON.stringify(images),
    effectiveCondition, effectiveListingType,
    effectivePrice ? Number(effectivePrice) : null,
    effectiveRentalPrice ? Number(effectiveRentalPrice) : null,
    effectiveRentalPeriod || null,
    securityDeposit ? Number(securityDeposit) : null,
    originalPrice ? Number(originalPrice) : null,
    purchaseYear ? Number(purchaseYear) : null,
    exchangeFor || null,
    campus || locality || city || req.user.campus || null,
    status,
    ticketType || null,
    travelDate || null,
    departureLocation ? departureLocation.trim() : null,
    destinationLocation ? destinationLocation.trim() : null,
    departureTime ? departureTime.trim() : null,
    arrivalTime ? arrivalTime.trim() : null,
    ticketQuantity ? Number(ticketQuantity) : 1,
    propertyType || null,
    locality ? locality.trim() : null,
    city ? city.trim() : null,
    address ? address.trim() : null,
    bedrooms ? Number(bedrooms) : null,
    bathrooms ? Number(bathrooms) : null,
    furnishing || null,
    availableFrom || null,
    contactInfo ? contactInfo.trim() : null,
    metadata ? JSON.stringify(metadata) : '{}'
  );

  const row = db.prepare(`${BASE_SELECT} WHERE l.id = ?`).get(id);
  res.status(201).json({ listing: serialize(row, req.user.id) });
});

// PATCH /api/listings/:id - update (owner or admin)
router.patch('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Listing not found' });
  if (existing.seller_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not your listing' });
  }

  if (req.body.title !== undefined && (!req.body.title || !req.body.title.trim())) {
    return res.status(400).json({ error: 'Title cannot be empty' });
  }
  if (req.body.description !== undefined && (!req.body.description || !req.body.description.trim())) {
    return res.status(400).json({ error: 'Description cannot be empty' });
  }

  const parseNum = (val) => {
    if (val === undefined) return undefined;
    if (val === null || val === '') return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  };

  const parseImages = (imgs) => {
    if (imgs === undefined) return undefined;
    if (Array.isArray(imgs)) return JSON.stringify(imgs);
    return JSON.stringify([]);
  };

  const fields = {
    title: req.body.title !== undefined ? req.body.title.trim() : undefined,
    description: req.body.description !== undefined ? req.body.description.trim() : undefined,
    images: parseImages(req.body.images),
    condition: req.body.condition !== undefined ? req.body.condition : undefined,
    listing_type: req.body.listingType,
    price: parseNum(req.body.price),
    rental_price: parseNum(req.body.rentalPrice),
    rental_period: req.body.rentalPeriod,
    security_deposit: parseNum(req.body.securityDeposit),
    original_price: parseNum(req.body.originalPrice),
    purchase_year: parseNum(req.body.purchaseYear),
    exchange_for: req.body.exchangeFor !== undefined ? req.body.exchangeFor : undefined,
    campus: req.body.campus !== undefined ? req.body.campus.trim() : undefined,
    category_id: req.body.categoryId,
    status: req.body.status,
    // Travel ticket fields
    ticket_type: req.body.ticketType !== undefined ? req.body.ticketType : undefined,
    travel_date: req.body.travelDate !== undefined ? req.body.travelDate : undefined,
    departure_location: req.body.departureLocation !== undefined ? req.body.departureLocation.trim() : undefined,
    destination_location: req.body.destinationLocation !== undefined ? req.body.destinationLocation.trim() : undefined,
    departure_time: req.body.departureTime !== undefined ? req.body.departureTime.trim() : undefined,
    arrival_time: req.body.arrivalTime !== undefined ? req.body.arrivalTime.trim() : undefined,
    ticket_quantity: parseNum(req.body.ticketQuantity),
    // Rental property fields
    property_type: req.body.propertyType !== undefined ? req.body.propertyType : undefined,
    locality: req.body.locality !== undefined ? req.body.locality.trim() : undefined,
    city: req.body.city !== undefined ? req.body.city.trim() : undefined,
    address: req.body.address !== undefined ? req.body.address.trim() : undefined,
    bedrooms: parseNum(req.body.bedrooms),
    bathrooms: parseNum(req.body.bathrooms),
    furnishing: req.body.furnishing !== undefined ? req.body.furnishing : undefined,
    available_from: req.body.availableFrom !== undefined ? req.body.availableFrom : undefined,
    contact_info: req.body.contactInfo !== undefined ? req.body.contactInfo.trim() : undefined,
    metadata: req.body.metadata !== undefined ? JSON.stringify(req.body.metadata) : undefined,
  };

  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) {
      sets.push(`${k} = ?`);
      params.push(v);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  sets.push(`updated_at = datetime('now')`);
  params.push(req.params.id);
  db.prepare(`UPDATE listings SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const row = db.prepare(`${BASE_SELECT} WHERE l.id = ?`).get(req.params.id);
  res.json({ listing: serialize(row, req.user.id) });
});

// DELETE /api/listings/:id
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Listing not found' });
  if (existing.seller_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not your listing' });
  }
  db.prepare('DELETE FROM listings WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/listings/:id/save - toggle save
router.post('/:id/save', requireAuth, (req, res) => {
  const listing = db.prepare('SELECT id FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const existing = db.prepare('SELECT 1 FROM saved_items WHERE user_id = ? AND listing_id = ?').get(req.user.id, req.params.id);
  if (existing) {
    db.prepare('DELETE FROM saved_items WHERE user_id = ? AND listing_id = ?').run(req.user.id, req.params.id);
    db.prepare('UPDATE listings SET saves = MAX(0, saves - 1) WHERE id = ?').run(req.params.id);
    return res.json({ saved: false });
  }
  db.prepare('INSERT INTO saved_items (user_id, listing_id) VALUES (?, ?)').run(req.user.id, req.params.id);
  db.prepare('UPDATE listings SET saves = saves + 1 WHERE id = ?').run(req.params.id);
  res.json({ saved: true });
});

export default router;
