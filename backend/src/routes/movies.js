const express = require("express");
const pool = require("../config/db");
const router = express.Router();
const axios = require("axios");

// GET /api/movies?search=&genre=&year=&language=&page=&limit=
router.get("/", async (req, res) => {
  const { search, genre, year, language, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let conditions = [];
  let params = [];

  if (search) {
    conditions.push("(m.title LIKE ? OR m.original_title LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (genre) {
    conditions.push("m.genres LIKE ?");
    params.push(`%${genre}%`);
  }
  if (year) {
    conditions.push("m.year_published = ?");
    params.push(year);
  }
  if (language) {
    conditions.push("m.original_language = ?");
    params.push(language);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    // Count total with rating threshold applied
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM (
        SELECT m.movie_id,
               ROUND(AVG(r.rating_score), 1) as avg_rating,
               COUNT(r.rating_score) as total_ratings
        FROM movies m
        LEFT JOIN ratings r ON m.movie_id = r.movie_id
        ${where}
        GROUP BY m.movie_id
        HAVING (avg_rating IS NULL)
            OR (total_ratings < 3)
            OR (avg_rating >= 5)
      ) as filtered`,
      params,
    );
    const total = countResult[0].total;

    // Fetch movies with avg_rating and rating threshold
    const [movies] = await pool.execute(
      `SELECT m.*,
              ROUND(AVG(r.rating_score), 1) as avg_rating,
              COUNT(r.rating_score) as total_ratings
       FROM movies m
       LEFT JOIN ratings r ON m.movie_id = r.movie_id
       ${where}
       GROUP BY m.movie_id
       HAVING (avg_rating IS NULL)
           OR (total_ratings < 3)
           OR (avg_rating >= 5)
       ORDER BY m.popularity DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params,
    );

    res.json({
      data: movies,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/movies/:id
router.get("/:id", async (req, res) => {
  try {
    const [movies] = await pool.execute(
      "SELECT * FROM movies WHERE movie_id = ?",
      [req.params.id],
    );

    if (movies.length === 0) {
      return res.status(404).json({ message: "Movie not found" });
    }

    res.json(movies[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/movies/:id/trailer
router.get("/:id/trailer", async (req, res) => {
  try {
    const [movies] = await pool.execute(
      "SELECT trailer_key FROM movies WHERE movie_id = ?",
      [req.params.id],
    );

    if (movies.length === 0 || !movies[0].trailer_key) {
      return res.status(404).json({ message: "No trailer found" });
    }

    const key = movies[0].trailer_key;
    res.json({
      trailer_key: key,
      trailer_url: `https://www.youtube.com/watch?v=${key}`,
      embed_url: `https://www.youtube.com/embed/${key}`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
