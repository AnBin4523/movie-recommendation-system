const express = require("express");
const pool = require("../config/db");
const auth = require("../middleware/auth");
const router = express.Router();

// POST /api/ratings (user rate movies)
router.post("/", auth, async (req, res) => {
  const { movie_id, rating_score } = req.body;
  const user_id = req.user.user_id;

  if (req.user.role === "admin") {
    return res.status(403).json({ message: "Admin cannot rate movies" });
  }

  if (!movie_id || !rating_score) {
    return res
      .status(400)
      .json({ message: "movie_id and rating_score are required" });
  }

  if (rating_score < 1 || rating_score > 10) {
    return res
      .status(400)
      .json({ message: "rating_score must be between 1 and 10" });
  }

  try {
    // Check movie exists
    const [movies] = await pool.execute(
      "SELECT movie_id FROM movies WHERE movie_id = ?",
      [movie_id],
    );
    if (movies.length === 0) {
      return res.status(404).json({ message: "Movie not found" });
    }

    // Insert or Update rating
    await pool.execute(
      `INSERT INTO ratings (user_id, movie_id, rating_score)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE rating_score = ?, rated_at = NOW()`,
      [user_id, movie_id, rating_score, rating_score],
    );

    res.status(201).json({
      message: "Rating saved successfully",
      user_id,
      movie_id,
      rating_score,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/ratings/me  (watch ratings of user logged in)
router.get("/me", auth, async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const [ratings] = await pool.execute(
      `SELECT r.movie_id, r.rating_score, r.rated_at,
              m.title, m.genres, m.rate, m.popularity, m.poster_path, m.trailer_key
       FROM ratings r
       JOIN movies m ON r.movie_id = m.movie_id
       WHERE r.user_id = ?
       ORDER BY r.rated_at DESC`,
      [user_id],
    );

    res.json(ratings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/ratings/movies?ids=1,2,3,4,5
router.get("/movies", async (req, res) => {
  const { ids } = req.query;
  if (!ids) return res.status(400).json({ message: "ids required" });

  const idArray = ids.split(",").map(Number);
  const placeholders = idArray.map(() => "?").join(",");

  try {
    const [results] = await pool.execute(
      `SELECT movie_id,
              ROUND(AVG(rating_score), 1) as average,
              COUNT(*) as total
       FROM ratings
       WHERE movie_id IN (${placeholders})
       GROUP BY movie_id`,
      idArray,
    );

    const ratingsMap = {};
    results.forEach((r) => {
      ratingsMap[r.movie_id] = {
        average: r.average,
        total: r.total,
      };
    });

    res.json(ratingsMap);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/ratings/movie/:id  (watch detail rating)
router.get("/movie/:id", async (req, res) => {
  try {
    const [ratings] = await pool.execute(
      `SELECT ROUND(AVG(rating_score), 1) as average, 
              COUNT(*) as total
       FROM ratings WHERE movie_id = ?`,
      [req.params.id],
    );

    res.json(ratings[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
