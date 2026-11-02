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

router.post('/', requireAuth, (req, res) => {
  const { listingId, offeredItem, message } = req.body;
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.listing_type !== 'exchange') return res.status(400).json({ error: 'This listing is not open to exchange' });
  if (!offeredItem) return res.status(400).json({ error: 'offeredItem is required' });

  const id = nanoid();
  db.prepare(
    `INSERT INTO exchange_requests (id, listing_id, requester_id, offered_item, message)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, listingId, req.user.id, offeredItem, message || null);

  notify(listing.seller_id, 'exchange', 'New exchange request', `${req.user.name} wants to swap for "${listing.title}".`, `/dashboard/exchanges`);
  res.status(201).json({ id });
});

router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT e.*, l.title as listing_title, l.seller_id, l.images as listing_images
       FROM exchange_requests e JOIN listings l ON l.id = e.listing_id
       WHERE e.requester_id = ? OR l.seller_id = ?
       ORDER BY e.created_at DESC`
    )
    .all(req.user.id, req.user.id);
  res.json({
    exchanges: rows.map((r) => ({
      id: r.id, listingId: r.listing_id, listingTitle: r.listing_title,
      listingImage: JSON.parse(r.listing_images || '[]')[0] || null,
      offeredItem: r.offered_item, message: r.message, status: r.status,
      role: r.seller_id === req.user.id ? 'seller' : 'requester', createdAt: r.created_at,
    })),
  });
});

router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body; // accepted | rejected | cancelled
  const ex = db.prepare('SELECT * FROM exchange_requests WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Exchange request not found' });
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(ex.listing_id);
  if (listing.seller_id !== req.user.id && ex.requester_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  db.prepare('UPDATE exchange_requests SET status = ? WHERE id = ?').run(status, req.params.id);
  if (status === 'accepted') {
    db.prepare(`UPDATE listings SET status = 'sold' WHERE id = ?`).run(ex.listing_id);
    notify(ex.requester_id, 'exchange', 'Exchange accepted', `Your exchange offer for "${listing.title}" was accepted!`, `/dashboard/exchanges`);
  }
  res.json({ ok: true });
});

export default router;
