import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, (req, res) => {
  const { revieweeId, listingId, rating, comment } = req.body;
  if (!revieweeId || !rating) return res.status(400).json({ error: 'revieweeId and rating are required' });
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be between 1 and 5' });

  const id = nanoid();
  db.prepare(
    `INSERT INTO reviews (id, reviewer_id, reviewee_id, listing_id, rating, comment)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, revieweeId, listingId || null, rating, comment || null);

  const agg = db
    .prepare('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE reviewee_id = ?')
    .get(revieweeId);
  db.prepare('UPDATE users SET rating_avg = ?, rating_count = ? WHERE id = ?').run(
    Math.round(agg.avg * 10) / 10, agg.count, revieweeId
  );

  res.status(201).json({ id });
});

router.get('/user/:userId', (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, u.name as reviewer_name FROM reviews r
       JOIN users u ON u.id = r.reviewer_id
       WHERE r.reviewee_id = ? ORDER BY r.created_at DESC`
    )
    .all(req.params.userId);
  res.json({ reviews: rows });
});

export default router;
