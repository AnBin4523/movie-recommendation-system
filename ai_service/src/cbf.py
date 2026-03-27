import pandas as pd
from database import get_connection

def get_cbf_recommendations(user_id: int, limit: int = 10):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # Take user's preferred genres
        cursor.execute(
            "SELECT preferred_genres FROM users WHERE user_id = %s",
            (user_id,)
        )
        user = cursor.fetchone()

        if not user or not user['preferred_genres']:
            return {
                "error": "No preferred genres found. Please update your profile."
            }

        # Take movies user has rated (for exclusion)
        cursor.execute(
            "SELECT movie_id FROM ratings WHERE user_id = %s",
            (user_id,)
        )
        rated_ids = [r['movie_id'] for r in cursor.fetchall()]

        # Parse genres
        genres = [g.strip() for g in user['preferred_genres'].split(',')]

        # Build query
        genre_conditions = ' OR '.join(['genres LIKE %s'] * len(genres))
        params = [f'%{g}%' for g in genres]

        exclude_clause = ''
        if rated_ids:
            placeholders = ','.join(['%s'] * len(rated_ids))
            exclude_clause = f'AND movie_id NOT IN ({placeholders})'
            params += rated_ids

        cursor.execute(
            f"""SELECT movie_id, title, genres, actors, directors,
                       plot, rate, vote_count, popularity, year_published
                FROM movies
                WHERE ({genre_conditions}) {exclude_clause}
                ORDER BY rate DESC, popularity DESC
                LIMIT %s""",
            params + [limit]
        )
        movies = cursor.fetchall()

        # Calculate similarity score 
        # Count genre match with preferred_genres
        for movie in movies:
            movie_genres = movie['genres'].split(',') if movie['genres'] else []
            matches = sum(
                1 for mg in movie_genres
                if any(g.lower() in mg.lower() for g in genres)
            )
            movie['similarity_score'] = round(matches / max(len(genres), 1), 2)

        # Sort based on similarity_score
        movies.sort(key=lambda x: (
            x['similarity_score'],
            x['rate'] or 0,
            x['popularity'] or 0
        ), reverse=True)

        return {
            "type":      "content-based",
            "based_on":  user['preferred_genres'],
            "total":     len(movies),
            "data":      movies
        }

    finally:
        cursor.close()
        conn.close()