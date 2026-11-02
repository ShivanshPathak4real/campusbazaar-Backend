import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, (req, res) => {
  const { transactionId, startDate, endDate } = req.body;
  const t = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!t) return res.status(404).json({ error: 'Transaction not found' });
  if (t.type !== 'rental') return res.status(400).json({ error: 'Transaction is not a rental' });

  const id = nanoid();
  db.prepare(
    `INSERT INTO rentals (id, transaction_id, start_date, end_date) VALUES (?, ?, ?, ?)`
  ).run(id, transactionId, startDate || null, endDate || null);
  res.status(201).json({ id });
});

router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, t.buyer_id, t.seller_id, l.title as listing_title
       FROM rentals r
       JOIN transactions t ON t.id = r.transaction_id
       JOIN listings l ON l.id = t.listing_id
       WHERE t.buyer_id = ? OR t.seller_id = ?
       ORDER BY r.start_date DESC`
    )
    .all(req.user.id, req.user.id);
  res.json({ rentals: rows });
});

router.patch('/:id/return', requireAuth, (req, res) => {
  db.prepare('UPDATE rentals SET returned = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
