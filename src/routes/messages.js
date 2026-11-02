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

function getOrCreateConversation(listingId, userA, userB) {
  const [a, b] = [userA, userB].sort();
  let convo = db
    .prepare(`SELECT * FROM conversations WHERE listing_id IS ? AND user_a = ? AND user_b = ?`)
    .get(listingId || null, a, b);
  if (!convo) {
    const id = nanoid();
    db.prepare(
      `INSERT INTO conversations (id, listing_id, user_a, user_b) VALUES (?, ?, ?, ?)`
    ).run(id, listingId || null, a, b);
    convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  }
  return convo;
}

// GET /api/messages - list conversations for current user
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*, l.title as listing_title,
        (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.read = 0 AND m.sender_id != ?) as unread_count
       FROM conversations c
       LEFT JOIN listings l ON l.id = c.listing_id
       WHERE c.user_a = ? OR c.user_b = ?
       ORDER BY last_message_at DESC`
    )
    .all(req.user.id, req.user.id, req.user.id);

  const conversations = rows.map((r) => {
    const otherId = r.user_a === req.user.id ? r.user_b : r.user_a;
    const other = db.prepare('SELECT id, name, avatar_url FROM users WHERE id = ?').get(otherId);
    return {
      id: r.id, listingId: r.listing_id, listingTitle: r.listing_title,
      otherUser: other ? { id: other.id, name: other.name, avatarUrl: other.avatar_url } : null,
      lastMessage: r.last_message, lastMessageAt: r.last_message_at, unreadCount: r.unread_count,
    };
  });
  res.json({ conversations });
});

// GET /api/messages/:conversationId - message history
router.get('/:conversationId', requireAuth, (req, res) => {
  const convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.conversationId);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  if (convo.user_a !== req.user.id && convo.user_b !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  db.prepare(`UPDATE messages SET read = 1 WHERE conversation_id = ? AND sender_id != ?`).run(
    req.params.conversationId, req.user.id
  );
  const messages = db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(req.params.conversationId);
  res.json({ messages });
});

// POST /api/messages - start/continue conversation
router.post('/', requireAuth, (req, res) => {
  const { toUserId, listingId, body } = req.body;
  if (!toUserId || !body) return res.status(400).json({ error: 'toUserId and body are required' });
  if (toUserId === req.user.id) return res.status(400).json({ error: "You can't message yourself" });

  const convo = getOrCreateConversation(listingId, req.user.id, toUserId);
  const id = nanoid();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)`
  ).run(id, convo.id, req.user.id, body);

  notify(toUserId, 'message', 'New message', `${req.user.name}: ${body.slice(0, 60)}`, `/dashboard/messages/${convo.id}`);

  res.status(201).json({ conversationId: convo.id, messageId: id });
});

export default router;
