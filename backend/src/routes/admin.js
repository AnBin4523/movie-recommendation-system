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
    poster_path,
    trailer_key,
  } = req.body;

  if (!movie_id || !title) {
    return res.status(400).json({ message: "movie_id and title are required" });
  }

  const toInt = (val) =>
    val !== "" && val !== undefined ? parseInt(val) : null;
  const toStr = (val) => (val !== "" && val !== undefined ? val : null);

  try {
    // Check movie_id exists
    const [existingId] = await pool.execute(
      "SELECT movie_id FROM movies WHERE movie_id = ?",
      [toInt(movie_id)],
    );
    if (existingId.length > 0) {
      return res.status(409).json({
        message: `Movie ID ${movie_id} already exists!`,
      });
    }

    // Check title exists
    const [existingTitle] = await pool.execute(
      "SELECT movie_id FROM movies WHERE title = ?",
      [title],
    );
    if (existingTitle.length > 0) {
      return res.status(409).json({
        message: `Movie "${title}" already exists in database!`,
      });
    }

    // Check year_published
    if (
      year_published &&
      (isNaN(year_published) ||
        year_published < 1888 ||
        year_published > new Date().getFullYear() + 5)
    ) {
      return res.status(400).json({
        message: "Please enter a valid release year",
      });
    }

    // Check duration
    if (duration && (isNaN(duration) || duration < 1 || duration > 600)) {
      return res.status(400).json({
        message: "Please enter a valid duration in minutes",
      });
    }

    await pool.execute(
      `INSERT INTO movies
       (movie_id, title, original_title, year_published, duration,
        country_name, original_language, genres, actors, directors,
        plot, poster_path, trailer_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        poster_path,
        trailer_key,
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
    poster_path,
    trailer_key,
  } = req.body;

  const toInt = (val) =>
    val !== "" && val !== undefined ? parseInt(val) : null;
  const toStr = (val) => (val !== "" && val !== undefined ? val : null);

  // Check title required
  if (!title) {
    return res.status(400).json({ message: "Title is required" });
  }

  // Check title exists (exclude current movie)
  const [existingTitle] = await pool.execute(
    "SELECT movie_id FROM movies WHERE title = ? AND movie_id != ?",
    [title, req.params.id],
  );
  if (existingTitle.length > 0) {
    return res.status(409).json({
      message: `Movie "${title}" already exists in database!`,
    });
  }

  // Check year_published
  if (
    year_published &&
    (isNaN(year_published) ||
      year_published < 1888 ||
      year_published > new Date().getFullYear() + 5)
  ) {
    return res
      .status(400)
      .json({ message: "Please enter a valid release year" });
  }

  // Check duration 
  if (duration && (isNaN(duration) || duration < 1 || duration > 600)) {
    return res
      .status(400)
      .json({ message: "Please enter a valid duration in minutes" });
  }

  try {
    await pool.execute(
      `UPDATE movies SET
        title=?, original_title=?, year_published=?, duration=?,
        country_name=?, original_language=?, genres=?, actors=?,
        directors=?, plot=?, poster_path=?, trailer_key=?
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
        poster_path,
        trailer_key,
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

// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  try {
    const [[users], [movies], [ratings]] = await Promise.all([
      pool.execute("SELECT COUNT(*) as total FROM users WHERE role = 'user'"),
      pool.execute("SELECT COUNT(*) as total FROM movies"),
      pool.execute("SELECT COUNT(*) as total FROM ratings"),
    ]);

    res.json({
      total_users: users[0].total,
      total_movies: movies[0].total,
      total_ratings: ratings[0].total,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
