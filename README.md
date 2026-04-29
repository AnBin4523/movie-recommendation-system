# CineAI — Movie Recommendation System with AI Chatbot

A full-stack web application that combines a hybrid movie recommendation engine (Collaborative Filtering + Content-Based Filtering) with an AI-powered chatbot using Llama 3.1 via Ollama.

> **Capstone Project** — International University HCMC, 2026
> Student: Ngo Le Thien An | ITITWE21117

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, TailwindCSS |
| Backend | Node.js, Express.js |
| AI Service | Python, FastAPI |
| Database | MySQL 8.0 |
| Language Model | Llama 3.1 (8B) via Ollama |

---

## Prerequisites

Make sure the following are installed before starting:

- [Node.js](https://nodejs.org/) v18+
- [Python](https://www.python.org/) 3.10+
- [Docker](https://www.docker.com/) (for MySQL)
- [Ollama](https://ollama.com/) (for running Llama 3.1 locally)

---

## Project Structure

```
movie-recommendation-system/
├── frontend/               # React.js SPA
│   └── src/
│       ├── pages/          # Login, Home, MovieDetail, Profile, Admin
│       ├── components/     # Navbar, MovieCard, ChatBot, Rating
│       └── services/       # API call functions
│
├── backend/                # Node.js + Express.js API
│   └── src/
│       ├── routes/         # auth, movies, ratings, recommendations, chat, admin, users
│       ├── middleware/      # auth.js (JWT verification)
│       └── config/         # db.js (MySQL connection pool)
│
├── ai_service/             # Python FastAPI AI Service
│   └── src/
│       ├── main.py         # API endpoints
│       ├── cf.py           # Collaborative Filtering
│       ├── cbf.py          # Content-Based Filtering
│       ├── chat.py         # Chatbot logic
│       └── database.py     # DB connection
│
├── seeder/                 # Database seeding scripts
│   ├── fetch_movies.js     # Fetch movies from TMDB API
│   ├── seed_users.js       # Generate test users
│   └── seed_ratings.js     # Generate synthetic ratings
│
├── database/
│   └── cineai_dump.sql     # Full database dump (592 movies, 504 users, 21,601 ratings)
│
└── README.md
```

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/AnBin4523/movie-recommendation-system.git
cd movie-recommendation-system
```

---

### 2. Database Setup

**Start MySQL using Docker:**

```bash
docker run --name cineai-mysql \
  -e MYSQL_ROOT_PASSWORD=your_password \
  -e MYSQL_DATABASE=movie_recommendation \
  -p 3306:3306 \
  -d mysql:8.0
```

**Import the provided database dump:**

```bash
docker exec -i cineai-mysql mysql \
  -u root -pyour_password \
  movie_recommendation < database/cineai_dump.sql
```

> This dump includes all 592 movies, 504 users, and 21,601 ratings
> used in the evaluation reported in Chapter 5 of the project report.

---

### 3. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend/` directory:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=movie_recommendation
JWT_SECRET=your_jwt_secret_key
PORT=5000
AI_SERVICE_URL=http://localhost:8000
```

**Start the backend server:**

```bash
npm run dev
```

The backend runs at `http://localhost:5000`

---

### 4. AI Service Setup

```bash
cd ai_service
pip install -r requirements.txt
```

Create a `.env` file inside the `ai_service/` directory:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=movie_recommendation
OLLAMA_URL=http://localhost:11434
```

**Pull Llama 3.1 and start Ollama:**

```bash
ollama pull llama3.1
ollama serve
```

**Start the AI service:**

```bash
uvicorn src.main:app --reload --port 8000
```

The AI service runs at `http://localhost:8000`

---

### 5. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file inside the `frontend/` directory:

```env
VITE_API_URL=http://localhost:5000
```

**Start the frontend:**

```bash
npm run dev
```

The frontend runs at `http://localhost:5173`

---

## Running the Full System

Open **4 terminals** and run each service:

```bash
# Terminal 1 — Ollama
ollama serve

# Terminal 2 — Backend
cd backend && npm run dev

# Terminal 3 — AI Service
cd ai_service && uvicorn src.main:app --reload --port 8000

# Terminal 4 — Frontend
cd frontend && npm run dev
```

Open your browser at `http://localhost:5173`

---

## Default Admin Account

```
Email:    admin@movie.com
Password: admin123
```

---

## Features

- **Hybrid Recommendation** — Collaborative Filtering (cosine similarity) with automatic fallback to Content-Based Filtering for new users (zero cold-start failures)
- **AI Chatbot** — Natural language movie recommendations powered by Llama 3.1, supports English and Vietnamese
- **User Onboarding** — Genre preference selection to address the cold-start problem
- **Admin Dashboard** — Movie and user management with real-time statistics
- **JWT Authentication** — Secure role-based access control

---