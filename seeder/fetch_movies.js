require("dotenv").config();
const axios = require("axios");
const mysql = require("mysql2/promise");

const DB = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

async function fetchPage(page) {
  const res = await axios.get("https://api.themoviedb.org/3/movie/popular", {
    headers: { Authorization: process.env.TMDB_TOKEN },
    params: { language: "en-US", page },
  });
  return res.data.results;
}

async function fetchDetail(id) {
  const [detail, credits] = await Promise.all([
    axios.get(`https://api.themoviedb.org/3/movie/${id}`, {
      headers: { Authorization: process.env.TMDB_TOKEN },
    }),
    axios.get(`https://api.themoviedb.org/3/movie/${id}/credits`, {
      headers: { Authorization: process.env.TMDB_TOKEN },
    }),
  ]);

  return {
    movie_id: detail.data.id,
    title: detail.data.title,
    original_title: detail.data.original_title,
    year_published: detail.data.release_date?.split("-")[0] || null,
    duration: detail.data.runtime || null,
    country_name: detail.data.production_countries?.[0]?.name || null,
    original_language: detail.data.original_language || null,
    genres: detail.data.genres.map((g) => g.name).join(", "),
    actors: credits.data.cast
      .slice(0, 5)
      .map((a) => a.name)
      .join(", "),
    directors: credits.data.crew
      .filter((c) => c.job === "Director")
      .map((d) => d.name)
      .join(", "),
    plot: detail.data.overview || null,
    rate: detail.data.vote_average || 0,
    vote_count: detail.data.vote_count || 0,
    popularity: detail.data.popularity || 0,
  };
}

async function main() {
  const conn = await mysql.createConnection(DB);
  console.log(" Connected to DB");

  let inserted = 0;

  for (let page = 1; page <= 10; page++) {
    console.log(`\n Fetching page ${page}/10...`);
    const movies = await fetchPage(page);

    for (const m of movies) {
      try {
        const d = await fetchDetail(m.id);
        await conn.execute(
          `INSERT IGNORE INTO movies
           (movie_id, title, original_title, year_published, duration,
            country_name, original_language, genres, actors, directors,
            plot, rate, vote_count, popularity)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            d.movie_id,
            d.title,
            d.original_title,
            d.year_published,
            d.duration,
            d.country_name,
            d.original_language,
            d.genres,
            d.actors,
            d.directors,
            d.plot,
            d.rate,
            d.vote_count,
            d.popularity,
          ],
        );
        inserted++;
        console.log(` [${inserted}] ${d.title}`);
      } catch (err) {
        console.log(` Skip ${m.id}: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  await conn.end();
  console.log(`\nDone! Inserted ${inserted} movies`);
}

main().catch(console.error);
