const express = require('express');
const axios   = require('axios');
const pool    = require('../config/db');
const auth    = require('../middleware/auth');
const router  = express.Router();

const AI_SERVICE_URL = 'http://localhost:8000';

// POST /api/chat
router.post('/', auth, async (req, res) => {
  const { message, history = [], session_id } = req.body;
  const user_id = req.user.user_id;

  // Block admin from using chatbot
  if (req.user.role === 'admin') {
    return res.status(403).json({
      message: 'Admin accounts cannot use the chatbot'
    });
  }

  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    // Forward message to Python AI service
    const aiRes = await axios.post(`${AI_SERVICE_URL}/chat`, {
      message,
      user_id,
      history
    });

    const { response, db_context_used, intent, recommended_movies } = aiRes.data;

    let current_session_id = session_id;

    // Create new session only if no session_id provided (first message)
    if (!current_session_id) {
      const [sessionResult] = await pool.execute(
        `INSERT INTO chat_sessions (user_id, title, started_at)
         VALUES (?, ?, NOW())`,
        [user_id, message.substring(0, 50)]
      );
      current_session_id = sessionResult.insertId;
    }

    // Save user message to chat_messages
    await pool.execute(
      `INSERT INTO chat_messages (session_id, role, content, created_at)
       VALUES (?, 'user', ?, NOW())`,
      [current_session_id, message]
    );

    // Save assistant response to chat_messages
    await pool.execute(
      `INSERT INTO chat_messages (session_id, role, content, created_at)
       VALUES (?, 'assistant', ?, NOW())`,
      [current_session_id, response]
    );

    res.json({
      response,
      db_context_used,
      intent,
      session_id: current_session_id,
      recommended_movies: recommended_movies || []
    });
  } catch (err) {
    const msg = err.response?.data?.detail || err.message;
    res.status(500).json({ message: msg });
  }
});

// GET /api/chat/sessions
router.get('/sessions', auth, async (req, res) => {
  try {
    const [sessions] = await pool.execute(
      `SELECT * FROM chat_sessions
       WHERE user_id = ?
       ORDER BY started_at DESC
       LIMIT 20`,
      [req.user.user_id]
    );
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/chat/sessions/:id/end
router.put('/sessions/:id/end', auth, async (req, res) => {
  try {
    await pool.execute(
      'UPDATE chat_sessions SET ended_at = NOW() WHERE session_id = ? AND user_id = ?',
      [req.params.id, req.user.user_id]
    );
    res.json({ message: 'Session ended' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/chat/sessions/:id/messages
router.get('/sessions/:id/messages', auth, async (req, res) => {
  try {
    const [messages] = await pool.execute(
      `SELECT * FROM chat_messages 
       WHERE session_id = ?
       ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;