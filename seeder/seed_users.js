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
  const shuffled = GENRES.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, faker.number.int({ min: 1, max: 3 })).join(", ");
}

async function main() {
  const conn = await mysql.createConnection(DB);
  console.log(" Connected to DB");

  // Create 1 admin
  const adminHash = await bcrypt.hash("admin123", 10);
  await conn.execute(
    `INSERT IGNORE INTO users
     (email, password_hash, role, display_name, preferred_genres, is_active)
     VALUES (?, ?, 'admin', ?, ?, 1)`,
    ["admin@movie.com", adminHash, "Admin", GENRES.join(", ")],
  );
  console.log(" Admin created: admin@movie.com / admin123");

  // Create 100 users
  for (let i = 1; i <= 100; i++) {
    const email = faker.internet.email().toLowerCase();
    const password = await bcrypt.hash("user123", 10);
    const display_name = faker.person.fullName();
    const genres = randomGenres();

    await conn.execute(
      `INSERT IGNORE INTO users
       (email, password_hash, role, display_name, preferred_genres, is_active)
       VALUES (?, ?, 'user', ?, ?, 1)`,
      [email, password, display_name, genres],
    );
    console.log(`  [${i}] ${display_name} - ${email}`);
  }

  await conn.end();
  console.log("\n Created 1 admin + 100 users");
  console.log(" All users password: user123");
  console.log(" Admin password: admin123");
}

main().catch(console.error);
