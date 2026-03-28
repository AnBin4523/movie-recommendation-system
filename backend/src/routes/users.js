const express = require("express");
const pool = require("../config/db");
const auth = require("../middleware/auth");
const router = express.Router();

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

module.exports = router;
