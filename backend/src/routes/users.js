const express = require("express");
const pool = require("../config/db");
const auth = require("../middleware/auth");
const router = express.Router();
const bcrypt = require('bcryptjs');

// PUT /api/users/me/genres
router.put("/me/genres", auth, async (req, res) => {
  const { preferred_genres } = req.body;
  const user_id = req.user.user_id;

  if (!preferred_genres) {
    return res.status(400).json({ message: "preferred_genres is required" });
  }

  try {
    await pool.execute(
      "UPDATE users SET preferred_genres = ? WHERE user_id = ?",
      [preferred_genres, user_id],
    );

    res.json({ message: "Genres updated successfully", preferred_genres });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/me
router.get('/me', auth, async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT user_id, email, display_name, preferred_genres, created_at
       FROM users WHERE user_id = ?`,
      [req.user.user_id]
    );
    res.json(users[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/me — update display_name + preferred_genres
router.put('/me', auth, async (req, res) => {
  const { display_name, preferred_genres } = req.body;
  try {
    await pool.execute(
      `UPDATE users SET display_name = ?, preferred_genres = ?
       WHERE user_id = ?`,
      [display_name, preferred_genres, req.user.user_id]
    );
    res.json({ message: 'Profile updated', display_name, preferred_genres });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/me/password change password
router.put('/me/password', auth, async (req, res) => {
  const { current_password, new_password } = req.body;

  try {
    const [users] = await pool.execute(
      'SELECT password_hash FROM users WHERE user_id = ?',
      [req.user.user_id]
    );

    const valid = await bcrypt.compare(current_password, users[0].password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE user_id = ?',
      [hash, req.user.user_id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
