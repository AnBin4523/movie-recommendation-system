import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  getMovieById,
  getTrailer,
  rateMovie,
  getRatingByMovie,
} from "../services/api";
import Navbar from "../components/Navbar";

const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";

export default function MovieDetail() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [trailer, setTrailer] = useState(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [rateMessage, setRateMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [movieRating, setMovieRating] = useState(null);

  useEffect(() => {
    const fetchMovie = async () => {
      setLoading(true);
      try {
        const res = await getMovieById(id);
        setMovie(res.data);
        // fetch trailer
        try {
          const trailerRes = await getTrailer(id);
          setTrailer(trailerRes.data);
        } catch {
          setTrailer(null);
        }
        // fetch rating stars
        try {
          const ratingRes = await getRatingByMovie(id);
          setMovieRating(ratingRes.data);
        } catch {
          setMovieRating(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMovie();
  }, [id]);

  const handleRate = async (score) => {
    try {
      await rateMovie({ movie_id: Number(id), rating_score: score });
      setUserRating(score);
      setRateMessage(`You rated this movie ${score}/10!`);

      // Force fetch rating
      const ratingRes = await getRatingByMovie(id);
      console.log("New rating data:", ratingRes.data);
      setMovieRating({ ...ratingRes.data });

      setTimeout(() => setRateMessage(""), 3000);
    } catch (err) {
      console.error("Rate error:", err);
      setRateMessage(err.response?.data?.message || "Failed to rate");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-lg">Loading...</p>
      </div>
    );

  if (!movie)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white">Movie not found</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      {/* Trailer Modal */}
      {showTrailer && trailer && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowTrailer(false)}
        >
          <div
            className="w-full max-w-4xl aspect-video"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`${trailer.embed_url}?autoplay=1`}
              className="w-full h-full rounded-xl"
              allowFullScreen
              allow="autoplay"
            />
          </div>
          <button
            onClick={() => setShowTrailer(false)}
            className="absolute top-4 right-4 text-white text-3xl hover:text-red-500"
          >
            ✕
          </button>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Poster */}
          <div className="w-full md:w-72 shrink-0">
            {movie.poster_path ? (
              <img
                src={`${TMDB_IMAGE_URL}${movie.poster_path}`}
                alt={movie.title}
                className="w-full rounded-xl"
              />
            ) : (
              <div className="w-full aspect-2/3 bg-zinc-800 rounded-xl flex items-center justify-center">
                <span className="text-6xl">🎬</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2">{movie.title}</h1>

            {movie.original_title !== movie.title && (
              <p className="text-zinc-400 mb-2">
                Original: {movie.original_title}
              </p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap gap-3 mb-4">
              {movie.year_published && (
                <span className="bg-zinc-800 px-3 py-1 rounded-full text-sm">
                  📅 {movie.year_published}
                </span>
              )}
              {movie.duration && (
                <span className="bg-zinc-800 px-3 py-1 rounded-full text-sm">
                  ⏱ {movie.duration} min
                </span>
              )}
              {movie.country_name && (
                <span className="bg-zinc-800 px-3 py-1 rounded-full text-sm">
                  🌍 {movie.country_name}
                </span>
              )}
              <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-semibold">
                ⭐{" "}
                {movieRating?.total > 0
                  ? `${parseFloat(movieRating.average).toFixed(1)} (${movieRating.total} votes)`
                  : "No ratings yet"}
              </span>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2 mb-4">
              {movie.genres?.split(", ").map((g) => (
                <span
                  key={g}
                  className="bg-red-600/20 text-red-400 px-3 py-1 rounded-full text-sm"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Plot */}
            {movie.plot && (
              <p className="text-zinc-300 leading-relaxed mb-6">{movie.plot}</p>
            )}

            {/* Cast & Crew */}
            <div className="space-y-2 mb-6">
              {movie.directors && (
                <p className="text-sm">
                  <span className="text-zinc-400">Director: </span>
                  <span className="text-white">{movie.directors}</span>
                </p>
              )}
              {movie.actors && (
                <p className="text-sm">
                  <span className="text-zinc-400">Cast: </span>
                  <span className="text-white">{movie.actors}</span>
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mb-8">
              {trailer && (
                <button
                  onClick={() => setShowTrailer(true)}
                  className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition"
                >
                  Watch Trailer
                </button>
              )}
            </div>

            {/* Rate */}
            <div>
              <p className="text-zinc-400 mb-3 font-semibold">
                Rate this movie:
              </p>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <button
                    key={score}
                    onClick={() => handleRate(score)}
                    onMouseEnter={() => setHoverRating(score)}
                    onMouseLeave={() => setHoverRating(0)}
                    className={`w-9 h-9 rounded-lg font-semibold text-sm transition ${
                      score <= (hoverRating || userRating)
                        ? "bg-yellow-500 text-black"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
              {rateMessage && (
                <p className="text-green-400 text-sm">{rateMessage}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
