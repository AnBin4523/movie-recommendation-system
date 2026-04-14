import requests
import json
import re
from database import get_connection

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "llama3.1"


def search_movies_by_description(description: str, limit: int = 5):
    """Search movies in DB based on description keywords"""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        stop_words = {
            'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to',
            'for', 'of', 'and', 'or', 'but', 'with', 'about', 'i',
            'me', 'my', 'want', 'like', 'movie', 'film', 'watch',
            'tôi', 'muốn', 'xem', 'phim', 'về', 'có', 'một', 'và',
            'là', 'của', 'cho', 'với', 'này', 'đó', 'bộ', 'tìm'
        }
        keywords = [
            k for k in description.lower().split()
            if k not in stop_words and len(k) > 2
        ]

        if not keywords:
            return []

        conditions = ' OR '.join(
            ['title LIKE %s OR plot LIKE %s OR genres LIKE %s OR actors LIKE %s']
            * len(keywords)
        )
        params = []
        for kw in keywords:
            params += [f'%{kw}%', f'%{kw}%', f'%{kw}%', f'%{kw}%']

        cursor.execute(
            f"""SELECT m.movie_id, m.title, m.genres, m.year_published,
                       m.directors, m.actors, m.plot, m.poster_path,
                       m.trailer_key, m.popularity,
                       ROUND(AVG(r.rating_score), 1) as avg_rating,
                       COUNT(r.rating_score) as total_ratings
                FROM movies m
                LEFT JOIN ratings r ON m.movie_id = r.movie_id
                WHERE {conditions}
                GROUP BY m.movie_id
                ORDER BY m.popularity DESC
                LIMIT %s""",
            params + [limit]
        )
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()


def get_recommended_movies(genres: list, limit: int = 5):
    """Get recommended movies from DB based on genres list"""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        conditions = ' OR '.join(['genres LIKE %s'] * len(genres))
        params = [f'%{g}%' for g in genres]

        cursor.execute(
            f"""SELECT m.movie_id, m.title, m.genres, m.year_published,
                       m.directors, m.actors, m.plot, m.poster_path,
                       m.trailer_key, m.popularity,
                       ROUND(AVG(r.rating_score), 1) as avg_rating,
                       COUNT(r.rating_score) as total_ratings
                FROM movies m
                LEFT JOIN ratings r ON m.movie_id = r.movie_id
                WHERE {conditions}
                GROUP BY m.movie_id
                ORDER BY avg_rating DESC, m.popularity DESC
                LIMIT %s""",
            params + [limit]
        )
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()


def format_movies_for_context(movies: list) -> str:
    """Format movie list into readable text for LLM context"""
    if not movies:
        return "No movies found in database."

    result = []
    for m in movies:
        rating = (
            f"{m['avg_rating']}/10 ({m['total_ratings']} votes)"
            if m['avg_rating']
            else "No ratings yet"
        )
        result.append(
            f"- {m['title']} ({m['year_published']}) | "
            f"Genres: {m['genres']} | "
            f"Rating: {rating} | "
            f"Directors: {m['directors']} | "
            f"Plot: {m['plot'][:150] if m['plot'] else 'N/A'}..."
        )
    return '\n'.join(result)


def detect_intent(message: str) -> dict:
    """Use Ollama to detect user intent, genres and keywords from message.
    Works with any language including Vietnamese.
    Returns dict with intent, genres and keywords.
    """
    prompt = f"""Analyze this message and return a JSON response only, no explanation, no markdown.

Message: "{message}"

Return JSON with these fields:
- intent: "recommend" | "find" | "general"
  * Use "recommend" when user wants movie suggestions — including mood-based like "I'm sad", "I'm bored", "feeling happy tonight"
  * Use "find" when user is trying to remember or find a specific forgotten movie
  * Use "general" ONLY for non-movie questions
- genres: list of genres (use exact: Action, Comedy, Drama, Horror, Science Fiction, Thriller, Romance, Animation, Documentary, Fantasy, Crime, Adventure, Mystery, History, War, Western, Music, Family)
- keywords: list of keywords IN ENGLISH for searching movies (translate to English if needed)

Example 1 - mood based "I'm sad want comedy":
{{"intent": "recommend", "genres": ["Comedy"], "keywords": ["funny", "comedy", "lighthearted"]}}

Example 2 - mood based "I'm bored tonight":
{{"intent": "recommend", "genres": ["Comedy", "Action"], "keywords": ["fun", "entertaining", "exciting"]}}

Example 3 - Vietnamese "phim về người nhện":
{{"intent": "find", "genres": ["Action"], "keywords": ["spider", "spider-man", "superhero"]}}

Example 4 - English "recommend sci-fi like Interstellar":
{{"intent": "recommend", "genres": ["Science Fiction"], "keywords": ["space", "time travel", "epic"]}}"""

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"temperature": 0.1}
            },
            timeout=30
        )

        if response.status_code == 200:
            content = response.json()['message']['content']
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
    except Exception:
        pass

    return {"intent": "general", "genres": [], "keywords": []}

# Filter only movies that AI actually mentioned in response
def filter_mentioned_movies(movies: list, response: str) -> list:
    """Return only movies that are mentioned in AI response"""
    mentioned = []
    for movie in movies:
        if movie['title'].lower() in response.lower():
            mentioned.append(movie)
    return mentioned

def chat_with_ai(message: str, user_id: int = None, conversation_history: list = None):
    """Main chat function that handles movie recommendations, movie finding, and general queries.
    Supports multiple languages including Vietnamese.
    Uses Ollama for intent detection and response generation.
    """

    if conversation_history is None:
        conversation_history = []

    # Detect language by checking Vietnamese special characters
    is_vietnamese = any(c in message for c in 'àáạảãăắặẳẵấầậẩẫâêếệểễôốộổỗơớợởỡùúụủũưứựửữìíịỉĩòóọỏõđ')
    language_instruction = "Vietnamese" if is_vietnamese else "English"

    # Use Ollama to detect intent
    intent_data = detect_intent(message)
    intent = intent_data.get("intent", "general")
    genres = intent_data.get("genres", [])
    keywords = intent_data.get("keywords", [])

    # Build DB context based on detected intent
    db_context = ""

    if intent == "find" and keywords:
        # User trying to find a forgotten movie
        search_query = " ".join(keywords)
        movies = search_movies_by_description(search_query, limit=5)
        if movies:
            db_context = (
                f"\n\nMovies from our database that might match the description:\n"
                f"{format_movies_for_context(movies)}"
            )

    elif intent == "recommend":
        if genres:
            movies = get_recommended_movies(genres, limit=5)
            if movies:
                db_context = (
                    f"\n\nMovies from our database matching your preferences:\n"
                    f"{format_movies_for_context(movies)}"
                )
        elif keywords:
            search_query = " ".join(keywords)
            movies = search_movies_by_description(search_query, limit=5)
            if movies:
                db_context = (
                    f"\n\nMovies from our database you might enjoy:\n"
                    f"{format_movies_for_context(movies)}"
                )

    # Fix: fallback for mood-based requests misclassified as "general"
    # If intent is general but genres were detected, still query DB
    elif intent == "general" and genres:
        movies = get_recommended_movies(genres, limit=5)
        if movies:
            db_context = (
                f"\n\nMovies from our database you might enjoy:\n"
                f"{format_movies_for_context(movies)}"
            )

    # Build system prompt using f-string to inject language_instruction
    system_prompt = f"""You are a helpful movie recommendation assistant for CINEAI platform.

MANDATORY LANGUAGE RULE:
- You MUST respond in {language_instruction} ONLY
- Do NOT translate your response to any other language
- Do NOT add "(Translation: ...)" or any translation notes
- Do NOT include text in multiple languages
- Current detected language: {language_instruction}

Your capabilities:
1. Recommend movies based on user preferences, mood, or genre
2. Help users find movies they have forgotten the name of
3. Answer general questions about movies

Rules:
- Respond in {language_instruction} ONLY, no translation needed
- If movies from database are provided below, ONLY recommend movies from that list — do NOT mix with movies outside the database
- Do NOT recommend any movie that is not explicitly listed in the database context
- Recommend ALL movies from the database list (2-3 movies if available, 1 if only 1 found)
- If no movies are found in database, honestly tell the user: "I couldn't find matching movies in our database, but here are some suggestions based on my knowledge:" then recommend from your own knowledge
- Be friendly, enthusiastic, and concise
- Keep responses under 200 words"""

    # Inject DB context into system prompt if available
    if db_context:
        movie_titles = [m['title'] for m in movies]
    titles_str = ', '.join([f'"{t}"' for t in movie_titles])
    
    system_prompt += f"""

STRICT RULE: You can ONLY recommend these exact movies from our database:
{titles_str}
Do NOT recommend any other movie under any circumstances."""

    # Build full message history for multi-turn conversation
    messages = [{"role": "system", "content": system_prompt}]

    # Include last 6 messages for conversation context
    if conversation_history:
        messages.extend(conversation_history[-6:])

    # Add current user message
    messages.append({"role": "user", "content": message})

    # Call Ollama to generate response
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "num_predict": 500
                }
            },
            timeout=60
        )

        if response.status_code == 200:
            data = response.json()
            ai_message = data['message']['content']
            mentioned_movies = filter_mentioned_movies(movies, ai_message) if movies else []

            return {
                "response":        ai_message,
                "db_context_used": bool(db_context),
                "db_movies":       db_context,
                "intent":          intent,
                "genres":          genres,
                "recommended_movies":  mentioned_movies
            }
        else:
            return {"error": f"Ollama error: {response.status_code}"}

    except requests.exceptions.ConnectionError:
        return {"error": "Cannot connect to Ollama. Please make sure Ollama is running."}
    except requests.exceptions.Timeout:
        return {"error": "Ollama response timeout. Please try again."}
    except Exception as e:
        return {"error": str(e)}