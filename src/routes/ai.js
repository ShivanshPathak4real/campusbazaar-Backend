import { Router } from 'express';
import db from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { analyzePricing, buddyReplyForListing, cleanupDescription, generateBuddyChatReply } from '../utils/ai.js';

const router = Router();

// POST /api/ai/price-check - used during listing creation (step 4) and on product pages
router.post('/price-check', optionalAuth, (req, res) => {
  const { categoryId, condition, price, excludeListingId } = req.body;
  if (!categoryId || !condition) {
    return res.status(400).json({ error: 'categoryId and condition are required' });
  }
  const analysis = analyzePricing({ categoryId, condition, price, excludeListingId });
  res.json({ analysis });
});

// POST /api/ai/improve-description - never invents facts, only tightens wording
router.post('/improve-description', (req, res) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'description is required' });
  res.json({ improved: cleanupDescription(description) });
});

// POST /api/ai/buddy - BazaarBuddy interactive chat and contextual listing assistant
router.post('/buddy', optionalAuth, (req, res) => {
  const { message, listingId, history } = req.body;

  // If a chat message is sent, generate an intelligent conversational reply
  if (message !== undefined && message !== null) {
    const result = generateBuddyChatReply({
      message,
      listingId,
      history,
      user: req.user,
    });
    return res.json(result);
  }

  // Legacy auto-check when opening a specific listing
  if (!listingId) {
    return res.status(400).json({ error: 'message or listingId is required' });
  }

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const analysis = analyzePricing({
    categoryId: listing.category_id,
    condition: listing.condition,
    price: listing.price,
    excludeListingId: listing.id,
  });
  const reply = buddyReplyForListing(listing, analysis);
  const suggestedPrompts = ['Is this price fair?', 'Tell me about this item', 'Safety checklist', 'How to buy?'];
  res.json({ reply, analysis, suggestedPrompts });
});

// POST /api/ai/chat - alias for chat
router.post('/chat', optionalAuth, (req, res) => {
  const { message, listingId, history } = req.body;
  const result = generateBuddyChatReply({
    message: message || '',
    listingId,
    history,
    user: req.user,
  });
  res.json(result);
});

export default router;
