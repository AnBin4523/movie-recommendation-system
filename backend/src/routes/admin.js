const express = require("express");
const pool = require("../config/db");
const auth = require("../middleware/auth");
const router = express.Router();

// Middleware check admin cho tất cả routes trong file này
router.use(auth);
router.use((req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
});

//  MOVIES 

// POST /api/admin/movies
router.post("/movies", async (req, res) => {
  const {
    movie_id,
    title,
    original_title,
    year_published,
    duration,
    country_name,
    original_language,
    genres,
    actors,
    directors,
    plot,
    rate,
    vote_count,
    popularity,
  } = req.body;

  if (!movie_id || !title) {
    return res.status(400).json({ message: "movie_id and title are required" });
  }

  try {
    await pool.execute(
      `INSERT INTO movies
       (movie_id, title, original_title, year_published, duration,
        country_name, original_language, genres, actors, directors,
        plot, rate, vote_count, popularity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movie_id,
        title,
        original_title,
        year_published,
        duration,
        country_name,
        original_language,
        genres,
        actors,
        directors,
        plot,
        rate,
        vote_count,
        popularity,
      ],
    );

    res.status(201).json({ message: "Movie created successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admin/movies/:id
router.put("/movies/:id", async (req, res) => {
  const {
    title,
    original_title,
    year_published,
    duration,
    country_name,
    original_language,
    genres,
    actors,
    directors,
    plot,
    rate,
    vote_count,
    popularity,
  } = req.body;

  try {
    await pool.execute(
      `UPDATE movies SET
        title=?, original_title=?, year_published=?, duration=?,
        country_name=?, original_language=?, genres=?, actors=?,
        directors=?, plot=?, rate=?, vote_count=?, popularity=?
       WHERE movie_id=?`,
      [
        title,
        original_title,
        year_published,
        duration,
        country_name,
        original_language,
        genres,
        actors,
        directors,
        plot,
        rate,
        vote_count,
        popularity,
        req.params.id,
      ],
    );

    res.json({ message: "Movie updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/movies/:id
router.delete("/movies/:id", async (req, res) => {
  try {
    await pool.execute("DELETE FROM movies WHERE movie_id = ?", [
      req.params.id,
    ]);

    res.json({ message: "Movie deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//  USERS

// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT user_id, email, display_name, role, 
              preferred_genres, is_active, created_at
       FROM users ORDER BY created_at DESC`,
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admin/users/:id/toggle   (turn on/ off active)
router.put("/users/:id/toggle", async (req, res) => {
  try {
    await pool.execute(
      `UPDATE users SET is_active = NOT is_active WHERE user_id = ?`,
      [req.params.id],
    );
    res.json({ message: "User status updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req, res) => {
  try {
    await pool.execute("DELETE FROM users WHERE user_id = ?", [req.params.id]);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
