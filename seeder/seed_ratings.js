require("dotenv").config();
const mysql = require("mysql2/promise");
const { faker } = require("@faker-js/faker");

const DB = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

// Realistic rating distribution — weighted toward 6-8
function realisticRating() {
  const weights = [1, 1, 2, 3, 5, 8, 13, 12, 8, 5]; // index 0 = rating 1
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return i + 1;
  }
  return 7;
}

async function main() {
  const conn = await mysql.createConnection(DB);
  console.log("Connected to DB");

  // Get all users with role 'user'
  const [users] = await conn.execute(
    `SELECT user_id FROM users WHERE role = 'user'`,
  );

  // Get all movie IDs
  const [movies] = await conn.execute(`SELECT movie_id FROM movies`);

  const movieIds = movies.map((m) => m.movie_id);
  console.log(`Users: ${users.length}, Movies: ${movieIds.length}`);

  // Get existing ratings to avoid duplicates
  const [existingRatings] = await conn.execute(
    `SELECT user_id, movie_id FROM ratings`,
  );
  const existingSet = new Set(
    existingRatings.map((r) => `${r.user_id}_${r.movie_id}`),
  );
  console.log(`Existing ratings: ${existingSet.size}`);

  let inserted = 0;
  let skipped = 0;

  for (const user of users) {
    // Each user rates 25-50 movies randomly
    const numRatings = faker.number.int({ min: 25, max: 50 });
    const shuffled = [...movieIds].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, numRatings);

    for (const movie_id of selected) {
      const key = `${user.user_id}_${movie_id}`;

      // Skip if rating already exists
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      const score = realisticRating();
      const ratedAt = faker.date.between({
        from: "2023-01-01",
        to: "2025-12-31",
      });

      try {
        await conn.execute(
          `INSERT IGNORE INTO ratings
           (user_id, movie_id, rating_score, rated_at)
           VALUES (?, ?, ?, ?)`,
          [user.user_id, movie_id, score, ratedAt],
        );
        existingSet.add(key);
        inserted++;
      } catch (err) {
        console.log(`Skip: ${err.message}`);
      }
    }

    if (user.user_id % 50 === 0) {
      console.log(
        `Processed user ${user.user_id} — total inserted: ${inserted}`,
      );
    }
  }

  await conn.end();
  console.log(`\nDone!`);
  console.log(`Inserted: ${inserted} new ratings`);
  console.log(`Skipped:  ${skipped} existing ratings`);
}

main().catch(console.error);
