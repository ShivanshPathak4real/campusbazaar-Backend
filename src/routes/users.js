import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.patch('/me', requireAuth, (req, res) => {
  const { name, campus, bio, avatarUrl } = req.body;
  const sets = [];
  const params = [];
  if (name !== undefined) { sets.push('name = ?'); params.push(name); }
  if (campus !== undefined) { sets.push('campus = ?'); params.push(campus); }
  if (bio !== undefined) { sets.push('bio = ?'); params.push(bio); }
  if (avatarUrl !== undefined) { sets.push('avatar_url = ?'); params.push(avatarUrl); }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.user.id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({
    user: {
      id: user.id, name: user.name, email: user.email, campus: user.campus,
      avatarUrl: user.avatar_url, bio: user.bio, role: user.role,
      isVerified: !!user.is_verified, ratingAvg: user.rating_avg, ratingCount: user.rating_count,
    },
  });
});

router.get('/me/listings', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.*, c.name as category_name, c.slug as category_slug FROM listings l
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE l.seller_id = ? ORDER BY l.created_at DESC`
    )
    .all(req.user.id);
  res.json({
    listings: rows.map((r) => ({
      id: r.id, title: r.title, price: r.price, rentalPrice: r.rental_price,
      images: JSON.parse(r.images || '[]'), status: r.status, listingType: r.listing_type,
      views: r.views, saves: r.saves, categoryName: r.category_name, categorySlug: r.category_slug,
      ticketType: r.ticket_type, travelDate: r.travel_date,
      departureLocation: r.departure_location, destinationLocation: r.destination_location,
      propertyType: r.property_type, locality: r.locality, city: r.city,
      createdAt: r.created_at,
    })),
  });
});

router.get('/me/saved', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.*, c.name as category_name, c.slug as category_slug, u.name as seller_name FROM saved_items s
       JOIN listings l ON l.id = s.listing_id
       LEFT JOIN categories c ON c.id = l.category_id
       LEFT JOIN users u ON u.id = l.seller_id
       WHERE s.user_id = ? ORDER BY s.created_at DESC`
    )
    .all(req.user.id);
  res.json({
    listings: rows.map((r) => ({
      id: r.id, title: r.title, price: r.price, rentalPrice: r.rental_price,
      images: JSON.parse(r.images || '[]'), status: r.status, listingType: r.listing_type,
      categoryName: r.category_name, categorySlug: r.category_slug, sellerName: r.seller_name,
      ticketType: r.ticket_type, travelDate: r.travel_date,
      departureLocation: r.departure_location, destinationLocation: r.destination_location,
      propertyType: r.property_type, locality: r.locality, city: r.city,
    })),
  });
});

router.get('/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({
    user: {
      id: u.id, name: u.name, campus: u.campus, avatarUrl: u.avatar_url, bio: u.bio,
      isVerified: !!u.is_verified, ratingAvg: u.rating_avg, ratingCount: u.rating_count,
      memberSince: u.created_at,
    },
  });
});

export default router;
