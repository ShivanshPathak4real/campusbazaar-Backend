import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function notify(userId, type, title, body, link) {
  db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(nanoid(), userId, type, title, body || null, link || null);
}

// POST /api/transactions - buy or start a rental
router.post('/', requireAuth, (req, res) => {
  const { listingId, type = 'purchase' } = req.body;
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.seller_id === req.user.id) return res.status(400).json({ error: "You can't buy your own listing" });
  if (listing.status !== 'active') return res.status(400).json({ error: 'Listing is no longer available' });

  const amount = type === 'rental' ? listing.rental_price : listing.price;
  const id = nanoid();
  db.prepare(
    `INSERT INTO transactions (id, listing_id, buyer_id, seller_id, type, amount, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`
  ).run(id, listingId, req.user.id, listing.seller_id, type, amount || null);

  db.prepare(`UPDATE listings SET status = ? WHERE id = ?`).run(
    type === 'rental' ? 'rented' : 'sold',
    listingId
  );

  notify(
    listing.seller_id,
    'transaction',
    type === 'rental' ? 'New rental request' : 'Your item sold',
    `${req.user.name} wants to ${type === 'rental' ? 'rent' : 'buy'} "${listing.title}".`,
    `/dashboard/transactions/${id}`
  );

  res.status(201).json({ transactionId: id, status: 'pending' });
});

router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*, l.title as listing_title, l.images as listing_images
       FROM transactions t JOIN listings l ON l.id = t.listing_id
       WHERE t.buyer_id = ? OR t.seller_id = ?
       ORDER BY t.created_at DESC`
    )
    .all(req.user.id, req.user.id);
  res.json({
    transactions: rows.map((r) => ({
      id: r.id, listingId: r.listing_id, listingTitle: r.listing_title,
      listingImage: JSON.parse(r.listing_images || '[]')[0] || null,
      type: r.type, amount: r.amount, status: r.status,
      role: r.buyer_id === req.user.id ? 'buyer' : 'seller',
      createdAt: r.created_at,
    })),
  });
});

router.get('/:id', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Transaction not found' });
  if (t.buyer_id !== req.user.id && t.seller_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(t.listing_id);
  res.json({ transaction: t, listing });
});

router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body; // confirmed | completed | cancelled
  const t = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Transaction not found' });
  if (t.seller_id !== req.user.id && t.buyer_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run(status, req.params.id);
  if (status === 'cancelled') {
    db.prepare(`UPDATE listings SET status = 'active' WHERE id = ?`).run(t.listing_id);
  }
  res.json({ ok: true });
});

export default router;
