require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const { faker } = require("@faker-js/faker");

const DB = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
];

function randomGenres() {
  const shuffled = [...GENRES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, faker.number.int({ min: 1, max: 3 })).join(", ");
}

async function main() {
  const conn = await mysql.createConnection(DB);
  console.log("Connected to DB");

  // Check existing user count
  const [[{ count }]] = await conn.execute(
    `SELECT COUNT(*) as count FROM users WHERE role = 'user'`,
  );
  console.log(`Existing users: ${count}`);

  // Add 400 more users (total ~500 users for better CF)
  const ADD_USERS = 400;
  let created = 0;

  for (let i = 1; i <= ADD_USERS; i++) {
    const email = faker.internet.email().toLowerCase();
    const password = await bcrypt.hash("user123", 10);
    const name = faker.person.fullName();
    const genres = randomGenres();

    try {
      await conn.execute(
        `INSERT IGNORE INTO users
         (email, password_hash, role, display_name, preferred_genres, is_active)
         VALUES (?, ?, 'user', ?, ?, 1)`,
        [email, password, name, genres],
      );
      created++;
      console.log(`[${created}/${ADD_USERS}] ${name} - ${email}`);
    } catch (err) {
      console.log(`Skip: ${err.message}`);
    }
  }

  await conn.end();
  console.log(`\nDone! Created ${created} new users`);
  console.log("All new users password: user123");
}

main().catch(console.error);
