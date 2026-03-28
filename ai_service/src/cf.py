import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from database import get_connection

def get_cf_recommendations(user_id: int, limit: int = 10):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # Take all ratings data
        cursor.execute(
            """SELECT user_id, movie_id, rating_score 
               FROM ratings"""
        )
        ratings = cursor.fetchall()

        if not ratings:
            return {"error": "No ratings data available"}

        # Create user-item matrix
        df = pd.DataFrame(ratings)
        matrix = df.pivot_table(
            index='user_id',
            columns='movie_id',
            values='rating_score',
            fill_value=0
        )

        # Check if user_id exists in the matrix
        if user_id not in matrix.index:
            return {"error": "User has no ratings yet"}

        # Calculate cosine similarity between users
        similarity = cosine_similarity(matrix)
        similarity_df = pd.DataFrame(
            similarity,
            index=matrix.index,
            columns=matrix.index
        )

        # Take top 10 similar users (excluding self)
        similar_users = similarity_df[user_id].drop(user_id)
        top_similar = similar_users.nlargest(10).index.tolist()

        # Take movies user currently has rated
        rated_by_user = set(
            df[df['user_id'] == user_id]['movie_id'].tolist()
        )

        # Take movies similar users have rated highly (>= 7)
        similar_ratings = df[
            (df['user_id'].isin(top_similar)) &
            (df['rating_score'] >= 7) &
            (~df['movie_id'].isin(rated_by_user))
        ]

        if similar_ratings.empty:
            return {"error": "Not enough data for CF recommendations"}

        # Calculate average predicted score for each movie
        movie_scores = similar_ratings.groupby('movie_id').agg(
            predicted_score=('rating_score', 'mean'),
            rated_by=('user_id', 'count')
        ).reset_index()

        # Sort based on rated_by + predicted_score
        movie_scores = movie_scores.sort_values(
            ['rated_by', 'predicted_score'],
            ascending=False
        ).head(limit)

        # Take movie information from DB
        movie_ids = movie_scores['movie_id'].tolist()
        if not movie_ids:
            return {"error": "No recommendations found"}

        placeholders = ','.join(['%s'] * len(movie_ids))
        cursor.execute(
            f"""SELECT m.movie_id, m.title, m.genres, m.actors, m.directors,
               m.plot, m.popularity, m.year_published,
               m.poster_path, m.trailer_key,
               ROUND(AVG(r.rating_score), 1) as avg_rating,
               COUNT(r.rating_score) as total_ratings
        FROM movies m
        LEFT JOIN ratings r ON m.movie_id = r.movie_id
        WHERE m.movie_id IN ({placeholders})
        GROUP BY m.movie_id""",
            movie_ids
        )
        movies = cursor.fetchall()

        # Attach predicted_score into each movie
        score_map = dict(zip(
            movie_scores['movie_id'],
            movie_scores['predicted_score']
        ))
        for movie in movies:
            movie['predicted_score'] = round(
                float(score_map.get(movie['movie_id'], 0)), 2
            )

        # Sort based on predicted_score
        movies.sort(key=lambda x: x['predicted_score'], reverse=True)

        return {
            "type":  "collaborative-filtering",
            "total": len(movies),
            "data":  movies
        }

    finally:
        cursor.close()
        conn.close()