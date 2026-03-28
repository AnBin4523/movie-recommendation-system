import pandas as pd
from database import get_connection

def get_cbf_recommendations(user_id: int, limit: int = 10):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT preferred_genres FROM users WHERE user_id = %s",
            (user_id,)
        )
        user = cursor.fetchone()

        if not user or not user['preferred_genres']:
            return {"error": "No preferred genres found."}

        cursor.execute(
            "SELECT movie_id FROM ratings WHERE user_id = %s",
            (user_id,)
        )
        rated_ids = [r['movie_id'] for r in cursor.fetchall()]

        genres = [g.strip() for g in user['preferred_genres'].split(',')]
        genre_conditions = ' OR '.join(['genres LIKE %s'] * len(genres))
        params = [f'%{g}%' for g in genres]

        exclude_clause = ''
        if rated_ids:
            placeholders = ','.join(['%s'] * len(rated_ids))
            exclude_clause = f'AND m.movie_id NOT IN ({placeholders})'
            params += rated_ids

        # JOIN với ratings để lấy avg rating thật
        cursor.execute(
            f"""SELECT m.movie_id, m.title, m.genres, m.actors, m.directors,
                       m.plot, m.popularity, m.year_published, 
                       m.poster_path, m.trailer_key,
                       ROUND(AVG(r.rating_score), 1) as avg_rating,
                       COUNT(r.rating_score) as total_ratings
                FROM movies m
                LEFT JOIN ratings r ON m.movie_id = r.movie_id
                WHERE ({genre_conditions}) {exclude_clause}
                GROUP BY m.movie_id
                ORDER BY avg_rating DESC, m.popularity DESC
                LIMIT %s""",
            params + [limit]
        )
        movies = cursor.fetchall()

        for movie in movies:
            movie_genres = movie['genres'].split(',') if movie['genres'] else []
            matches = sum(
                1 for mg in movie_genres
                if any(g.lower() in mg.lower() for g in genres)
            )
            movie['similarity_score'] = round(matches / max(len(genres), 1), 2)

        movies.sort(key=lambda x: (
            x['similarity_score'],
            float(x['avg_rating'] or 0),
            x['popularity'] or 0
        ), reverse=True)

        return {
            "type":     "content-based",
            "based_on": user['preferred_genres'],
            "total":    len(movies),
            "data":     movies
        }

    finally:
        cursor.close()
        conn.close()