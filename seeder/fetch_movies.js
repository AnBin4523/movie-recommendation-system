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

// Fetch from multiple TMDB endpoints for more diverse movies
const ENDPOINTS = [
  { url: "https://api.themoviedb.org/3/movie/popular", pages: 10 },
  { url: "https://api.themoviedb.org/3/movie/top_rated", pages: 10 },
  { url: "https://api.themoviedb.org/3/movie/now_playing", pages: 5 },
  { url: "https://api.themoviedb.org/3/movie/upcoming", pages: 5 },
];

async function fetchPage(url, page) {
  const res = await axios.get(url, {
    headers: { Authorization: process.env.TMDB_TOKEN },
    params: { language: "en-US", page },
  });
  return res.data.results;
}

async function fetchDetail(id) {
  const [detail, credits, videos] = await Promise.all([
    axios.get(`https://api.themoviedb.org/3/movie/${id}`, {
      headers: { Authorization: process.env.TMDB_TOKEN },
    }),
    axios.get(`https://api.themoviedb.org/3/movie/${id}/credits`, {
      headers: { Authorization: process.env.TMDB_TOKEN },
    }),
    axios.get(`https://api.themoviedb.org/3/movie/${id}/videos`, {
      headers: { Authorization: process.env.TMDB_TOKEN },
    }),
  ]);

  const trailer = videos.data.results.find(
    (v) => v.type === "Trailer" && v.site === "YouTube",
  );

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
    trailer_key: trailer?.key || null,
    poster_path: detail.data.poster_path || null,
  };
}

async function main() {
  const conn = await mysql.createConnection(DB);
  console.log("Connected to DB");

  let inserted = 0;
  let skipped = 0;
  const seenIds = new Set(); // Track processed IDs to avoid duplicate API calls

  for (const endpoint of ENDPOINTS) {
    console.log(`\nFetching from: ${endpoint.url}`);

    for (let page = 1; page <= endpoint.pages; page++) {
      console.log(`  Page ${page}/${endpoint.pages}...`);

      try {
        const movies = await fetchPage(endpoint.url, page);

        for (const m of movies) {
          // Skip if already processed this movie_id
          if (seenIds.has(m.id)) {
            skipped++;
            continue;
          }
          seenIds.add(m.id);

          try {
            const d = await fetchDetail(m.id);
            await conn.execute(
              `INSERT INTO movies
                (movie_id, title, original_title, year_published, duration,
                country_name, original_language, genres, actors, directors,
                plot, rate, vote_count, popularity, trailer_key, poster_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  title        = VALUES(title),
                  rate         = VALUES(rate),
                  vote_count   = VALUES(vote_count),
                  popularity   = VALUES(popularity),
                  trailer_key  = VALUES(trailer_key),
                  poster_path  = VALUES(poster_path)`,
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
                d.trailer_key,
                d.poster_path,
              ],
            );
            inserted++;
            console.log(`  [${inserted}] ${d.title}`);
          } catch (err) {
            console.log(`  Skip ${m.id}: ${err.message}`);
          }

          // Delay to avoid TMDB rate limit
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch (err) {
        console.log(`  Failed page ${page}: ${err.message}`);
      }
    }
  }

  await conn.end();
  console.log(
    `\nDone! Processed ${inserted} movies (${skipped} duplicates skipped)`,
  );
}

main().catch(console.error);
