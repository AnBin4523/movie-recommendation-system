import { useNavigate } from "react-router-dom";

const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";

export default function MovieCard({ movie }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/movies/${movie.movie_id}`)}
      className="cursor-pointer group"
    >
      {/* Poster */}
      <div className="rounded-lg overflow-hidden aspect-2/3 relative group-hover:ring-2 group-hover:ring-red-600 transition">
        {movie.poster_path ? (
          <img
            src={`${TMDB_IMAGE_URL}${movie.poster_path}`}
            alt={movie.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <div className="text-center p-4">
              <div className="text-4xl mb-2">🎬</div>
              <p className="text-white text-sm font-semibold line-clamp-2">
                {movie.title}
              </p>
            </div>
          </div>
        )}

        {/* Rate badge */}
        <div className="absolute top-2 right-2 bg-black/70 text-yellow-400 text-xs px-2 py-1 rounded-full font-semibold">
          ⭐ {movie.rate ? parseFloat(movie.rate).toFixed(1) : "N/A"}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 font-semibold text-sm transition">
            View Details
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="mt-2">
        <p className="text-white text-sm font-semibold truncate">
          {movie.title}
        </p>
        <p className="text-zinc-400 text-xs truncate">{movie.genres}</p>
      </div>
    </div>
  );
}
