import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const categories = db
    .prepare(
      `SELECT c.*, COUNT(l.id) as listing_count
       FROM categories c
       LEFT JOIN listings l ON l.category_id = c.id AND l.status = 'active'
       GROUP BY c.id
       ORDER BY c.name`
    )
    .all();
  res.json({ categories });
});

export default router;
