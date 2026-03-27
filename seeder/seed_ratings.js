require('dotenv').config();
const mysql = require('mysql2/promise');
const { faker } = require('@faker-js/faker');

const DB = {
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

// Distribution rating 
function realisticRating() {
  const weights = [1, 1, 2, 3, 5, 8, 13, 12, 8, 5]; // 1-10
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
  console.log(' Connected to DB');

  // Take all user_id of role 'user'
  const [users] = await conn.execute(
    `SELECT user_id FROM users WHERE role = 'user'`
  );

  // Take all movie_id
  const [movies] = await conn.execute(
    `SELECT movie_id FROM movies`
  );

  const movieIds = movies.map(m => m.movie_id);
  let inserted = 0;

  for (const user of users) {
    // Each user rates 20-40 movies randomly
    const numRatings = faker.number.int({ min: 20, max: 40 });
    const shuffled = [...movieIds].sort(() => 0.5 - Math.random());
    const selectedMovies = shuffled.slice(0, numRatings);

    for (const movie_id of selectedMovies) {
      const score = realisticRating();
      const ratedAt = faker.date.between({
        from: '2023-01-01',
        to:   '2025-12-31'
      });

      try {
        await conn.execute(
          `INSERT IGNORE INTO ratings
           (user_id, movie_id, rating_score, rated_at)
           VALUES (?, ?, ?, ?)`,
          [user.user_id, movie_id, score, ratedAt]
        );
        inserted++;
      } catch (err) {
        console.log(` Skip: ${err.message}`);
      }
    }
    console.log(`User ${user.user_id}: ${numRatings} ratings`);
  }

  await conn.end();
  console.log(`\n Inserted ${inserted} ratings`);
}

main().catch(console.error);