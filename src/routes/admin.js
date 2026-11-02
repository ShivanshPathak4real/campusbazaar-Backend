import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/stats', (req, res) => {
  const users = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  const listings = db.prepare('SELECT COUNT(*) as n FROM listings').get().n;
  const activeListings = db.prepare(`SELECT COUNT(*) as n FROM listings WHERE status = 'active'`).get().n;
  const sales = db.prepare(`SELECT COUNT(*) as n FROM transactions WHERE type = 'purchase'`).get().n;
  const rentals = db.prepare(`SELECT COUNT(*) as n FROM transactions WHERE type = 'rental'`).get().n;
  const exchanges = db.prepare(`SELECT COUNT(*) as n FROM exchange_requests WHERE status = 'accepted'`).get().n;
  const openReports = db.prepare(`SELECT COUNT(*) as n FROM reports WHERE status = 'open'`).get().n;
  const byCategory = db
    .prepare(
      `SELECT c.name, COUNT(l.id) as count FROM categories c
       LEFT JOIN listings l ON l.category_id = c.id
       GROUP BY c.id ORDER BY count DESC`
    )
    .all();
  res.json({ users, listings, activeListings, sales, rentals, exchanges, openReports, byCategory });
});

router.get('/users', (req, res) => {
  const rows = db.prepare('SELECT id, name, email, role, is_verified, rating_avg, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users: rows });
});

router.patch('/users/:id/verify', (req, res) => {
  db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/listings', (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.id, l.title, l.status, l.listing_type, l.price, u.name as seller_name, l.created_at
       FROM listings l JOIN users u ON u.id = l.seller_id ORDER BY l.created_at DESC`
    )
    .all();
  res.json({ listings: rows });
});

router.patch('/listings/:id/status', (req, res) => {
  const { status } = req.body; // active | removed | pending
  db.prepare('UPDATE listings SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

router.get('/reports', (req, res) => {
  const rows = db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
  res.json({ reports: rows });
});

export default router;
