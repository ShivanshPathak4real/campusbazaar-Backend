import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import listingRoutes from './routes/listings.js';
import categoryRoutes from './routes/categories.js';
import transactionRoutes from './routes/transactions.js';
import rentalRoutes from './routes/rentals.js';
import exchangeRoutes from './routes/exchanges.js';
import messageRoutes from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import savedRoutes from './routes/saved.js';
import reviewRoutes from './routes/reviews.js';
import reportRoutes from './routes/reports.js';
import aiRoutes from './routes/ai.js';
import adminRoutes from './routes/admin.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'campusbazaar-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/saved', savedRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`CampusBazaar backend running on http://localhost:${PORT}`);
});
