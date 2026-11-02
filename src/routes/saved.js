import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Kept separate from listings/:id/save for REST clarity per spec (/api/saved).
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.id, l.title, l.price, l.rental_price, l.images, l.status, l.listing_type
       FROM saved_items s JOIN listings l ON l.id = s.listing_id
       WHERE s.user_id = ? ORDER BY s.created_at DESC`
    )
    .all(req.user.id);
  res.json({
    saved: rows.map((r) => ({
      id: r.id, title: r.title, price: r.price, rentalPrice: r.rental_price,
      images: JSON.parse(r.images || '[]'), status: r.status, listingType: r.listing_type,
    })),
  });
});

router.delete('/:listingId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM saved_items WHERE user_id = ? AND listing_id = ?').run(req.user.id, req.params.listingId);
  db.prepare('UPDATE listings SET saves = MAX(0, saves - 1) WHERE id = ?').run(req.params.listingId);
  res.json({ ok: true });
});

export default router;
