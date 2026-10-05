const express = require('express');
const router = express.Router();
const { pool, BASE_URL, MSG_MAX_LEN, mapMessageRow, authenticateToken } = require('./_shared');

// ══════════════════════════════════════════════════════════
// MESSAGING — citizen ↔ resort owner
// Uses the existing `conversations` + `messages` tables.
// "counterpart" = the OWNER side of a conversation.
// ══════════════════════════════════════════════════════════

// ── Citizen: list my resort conversations ──
router.get('/messages/conversations', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.id, c.hotel_id, c.user_read_at, c.created_at,
              h.name AS hotel_name, h.location AS hotel_location, h.image AS hotel_image,
              (SELECT COUNT(*) FROM messages m
                WHERE m.conversation_id = c.id AND m.sender_type = 'owner'
                  AND (c.user_read_at IS NULL OR m.created_at > c.user_read_at)) AS unread,
              (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
              COALESCE((SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1), c.created_at) AS last_at
       FROM conversations c
       JOIN hotels h ON c.hotel_id = h.id
       WHERE c.user_id = ?
       ORDER BY last_at DESC, c.id DESC`,
      [req.user.id]
    );
    res.json(rows.map(r => ({
      id: r.id,
      hotelId: r.hotel_id,
      name: r.hotel_name,
      location: r.hotel_location || 'Baco, Oriental Mindoro',
      image: r.hotel_image ? `${BASE_URL}/uploads/${r.hotel_image}` : null,
      unread: Number(r.unread) || 0,
      lastMessage: r.last_body || '',
      lastAt: r.last_at
    })));
  } catch (e) {
    console.error('User conversations error:', e.message);
    res.status(500).json({ message: 'Failed to load conversations.' });
  }
});

// ── Citizen: one thread (fetching marks it read) ──
router.get('/messages/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const [convs] = await pool.execute(
      'SELECT * FROM conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]
    );
    if (convs.length === 0) return res.status(404).json({ message: 'Conversation not found.' });
    const conv = convs[0];
    const [msgs] = await pool.execute(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 500', [conv.id]
    );
    await pool.execute('UPDATE conversations SET user_read_at = NOW() WHERE id = ?', [conv.id]);
    res.json({ conversationId: conv.id, hotelId: conv.hotel_id, messages: msgs.map(m => mapMessageRow(m, 'user')) });
  } catch (e) {
    console.error('User thread error:', e.message);
    res.status(500).json({ message: 'Failed to load messages.' });
  }
});

// ── Citizen: send in an existing thread ──
router.post('/messages/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ message: 'Message cannot be empty.' });
    if (body.length > MSG_MAX_LEN) return res.status(400).json({ message: `Message is too long (max ${MSG_MAX_LEN} characters).` });

    const [convs] = await pool.execute(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]
    );
    if (convs.length === 0) return res.status(404).json({ message: 'Conversation not found.' });

    await pool.execute(
      "INSERT INTO messages (conversation_id, sender_type, sender_id, body) VALUES (?, 'user', ?, ?)",
      [convs[0].id, req.user.id, body]
    );
    await pool.execute('UPDATE conversations SET user_read_at = NOW() WHERE id = ?', [convs[0].id]);

    const [msgs] = await pool.execute(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 500', [convs[0].id]
    );
    res.status(201).json({ conversationId: convs[0].id, messages: msgs.map(m => mapMessageRow(m, 'user')) });
  } catch (e) {
    console.error('User send error:', e.message);
    res.status(500).json({ message: 'Failed to send message.' });
  }
});

// ── Citizen: total unread count (for badges) ──
router.get('/messages/unread-count', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.user_id = ? AND m.sender_type = 'owner'
         AND (c.user_read_at IS NULL OR m.created_at > c.user_read_at)`,
      [req.user.id]
    );
    res.json({ unread: Number(rows[0].total) || 0 });
  } catch (e) { res.status(500).json({ unread: 0 }); }
});

// ── Citizen: toggle ❤️ on a message in my conversation ──
router.put('/messages/conversations/:id/messages/:msgId/reaction', authenticateToken, async (req, res) => {
    try {
        const [convs] = await pool.execute(
            'SELECT id FROM conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]
        );
        if (convs.length === 0) return res.status(404).json({ message: 'Conversation not found.' });

        const reaction = req.body.reaction ? String(req.body.reaction).slice(0, 32) : null;
        const [result] = await pool.execute(
            'UPDATE messages SET reaction = ? WHERE id = ? AND conversation_id = ?',
            [reaction, req.params.msgId, convs[0].id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Message not found.' });
        res.json({ id: Number(req.params.msgId), reaction });
    } catch (e) {
        console.error('User reaction error:', e.message);
        res.status(500).json({ message: 'Failed to update reaction.' });
    }
});

module.exports = router;