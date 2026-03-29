const express = require('express');
const axios   = require('axios');
const pool    = require('../config/db');
const auth    = require('../middleware/auth');
const router  = express.Router();

const AI_SERVICE_URL = 'http://localhost:8000';

// POST /api/chat
router.post('/', auth, async (req, res) => {
  const { message, history = [] } = req.body;
  const user_id = req.user.user_id;

  if (req.user.role === 'admin') {
    return res.status(403).json({ 
      message: 'Admin accounts cannot use the chatbot' 
    });
  }

  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    // Forward to Python AI service
    const aiRes = await axios.post(`${AI_SERVICE_URL}/chat`, {
      message,
      user_id,
      history
    });

    const { response, db_context_used, intent } = aiRes.data;

    // Save messages to DB
    const [sessionResult] = await pool.execute(
      `INSERT INTO chat_sessions (user_id, title, started_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE started_at = started_at`,
      [user_id, message.substring(0, 50)]
    );

    res.json({
      response,
      db_context_used,
      intent
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

module.exports = router;