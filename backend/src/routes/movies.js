const express = require("express");
const pool = require("../config/db");
const router = express.Router();

// GET /api/movies?search=&genre=&year=&language=&page=&limit=  (search bar + homepage)
router.get("/", async (req, res) => {
  const { search, genre, year, language, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let conditions = [];
  let params = [];

  if (search) {
    conditions.push("(title LIKE ? OR original_title LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (genre) {
    conditions.push("genres LIKE ?");
    params.push(`%${genre}%`);
  }
  if (year) {
    conditions.push("year_published = ?");
    params.push(year);
  }
  if (language) {
    conditions.push("original_language = ?");
    params.push(language);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM movies ${where}`,
      params,
    );
    const total = countResult[0].total;

    const [movies] = await pool.execute(
      `SELECT * FROM movies ${where}
       ORDER BY popularity DESC
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

// GET /api/movies/:id   (detail page movies)
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

module.exports = router;
