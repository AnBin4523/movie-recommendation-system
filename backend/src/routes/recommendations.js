const express = require("express");
const axios = require("axios");
const auth = require("../middleware/auth");
const pool = require("../config/db");
const router = express.Router();

const AI_SERVICE_URL = "http://localhost:8000";

// GET /api/recommendations/cbf
router.get("/cbf", auth, async (req, res) => {
  try {
    const response = await axios.get(
      `${AI_SERVICE_URL}/recommend/cbf/${req.user.user_id}`,
    );
    res.json(response.data);
  } catch (err) {
    const msg = err.response?.data?.detail || err.message;
    res.status(400).json({ message: msg });
  }
});

// GET /api/recommendations/cf
router.get("/cf", auth, async (req, res) => {
  try {
    const response = await axios.get(
      `${AI_SERVICE_URL}/recommend/cf/${req.user.user_id}`,
    );
    res.json(response.data);
  } catch (err) {
    const msg = err.response?.data?.detail || err.message;
    res.status(400).json({ message: msg });
  }
});

// GET /api/recommendations — hybrid
router.get("/", auth, async (req, res) => {
  try {
    const response = await axios.get(
      `${AI_SERVICE_URL}/recommend/hybrid/${req.user.user_id}`,
    );
    res.json(response.data);
  } catch (err) {
    const msg = err.response?.data?.detail || err.message;
    res.status(400).json({ message: msg });
  }
});

// GET /api/recommendations/popular — don't require auth, show popular movies to unauthenticated users
router.get("/popular", async (req, res) => {
  try {
    const [movies] = await pool.execute(
      `SELECT * FROM movies
       WHERE vote_count > 100
       ORDER BY popularity DESC
       LIMIT 10`,
    );
    res.json({ type: "popular", data: movies });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
