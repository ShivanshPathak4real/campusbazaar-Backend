import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, (req, res) => {
  const { targetType, targetId, reason, details } = req.body;
  if (!targetType || !targetId || !reason) {
    return res.status(400).json({ error: 'targetType, targetId and reason are required' });
  }
  const id = nanoid();
  db.prepare(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, targetType, targetId, reason, details || null);
  res.status(201).json({ id });
});

router.get('/', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
  res.json({ reports: rows });
});

router.patch('/:id/status', requireAuth, requireAdmin, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

export default router;
