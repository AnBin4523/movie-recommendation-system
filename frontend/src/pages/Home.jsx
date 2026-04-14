import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import {
  getPopular,
  getRecommendations,
  getMovies,
  getRatingsByMovies,
} from "../services/api";
import MovieCard from "../components/MovieCard";
import Navbar from "../components/Navbar";

const GENRES = [
  "All",
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

export default function Home() {
  const { user } = useAuth();
  const [popular, setPopular] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("search") || "";
  const [searchResults, setSearchResults] = useState([]);
  const [ratingsMap, setRatingsMap] = useState({});
  const [selectedGenre, setSelectedGenre] = useState("All"); // Genre filter state
  const [genreMovies, setGenreMovies] = useState([]); // Movies filtered by genre

  useEffect(() => {
    if (searchQuery) {
      fetchSearchResults();
    } else if (selectedGenre !== "All") {
      fetchGenreMovies();
    } else {
      fetchData();
    }
  }, [searchQuery, selectedGenre]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const popRes = await getPopular();
      setPopular(popRes.data.data);

      const recRes = await getRecommendations();
      setRecommended(recRes.data.data);

      const allMovies = [...popRes.data.data, ...(recRes.data.data || [])];
      const allIds = [...new Set(allMovies.map((m) => m.movie_id))];
      if (allIds.length > 0) {
        const ratingsRes = await getRatingsByMovies(allIds);
        setRatingsMap(ratingsRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSearchResults = async () => {
    setLoading(true);
    try {
      const res = await getMovies({ search: searchQuery, limit: 50 });
      setSearchResults(res.data.data);

      const ids = res.data.data.map((m) => m.movie_id);
      if (ids.length > 0) {
        const ratingsRes = await getRatingsByMovies(ids);
        setRatingsMap(ratingsRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGenreMovies = async () => {
    setLoading(true);
    try {
      const res = await getMovies({ genre: selectedGenre, limit: 50 });
      setGenreMovies(res.data.data);

      const ids = res.data.data.map((m) => m.movie_id);
      if (ids.length > 0) {
        const ratingsRes = await getRatingsByMovies(ids);
        setRatingsMap(ratingsRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="px-8 py-6">
        {/* Genre Filter Bar */}
        {!searchQuery && (
          <div className="flex flex-wrap gap-2 mb-6">
            {GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  selectedGenre === genre
                    ? "bg-red-600 text-white"
                    : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-zinc-700"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-zinc-400 text-lg">Loading...</p>
          </div>
        ) : searchQuery ? (
          // Search Results
          <section>
            <h3 className="text-xl font-semibold mb-4">
              Search results for &quot;{searchQuery}&quot;
              <span className="text-zinc-400 text-base font-normal ml-2">
                ({searchResults.length} found)
              </span>
            </h3>
            {searchResults.length === 0 ? (
              <p className="text-zinc-400">
                No movies found for &quot;{searchQuery}&quot;
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {searchResults.map((movie) => (
                  <MovieCard
                    key={movie.movie_id}
                    movie={movie}
                    rating={ratingsMap[movie.movie_id]}
                  />
                ))}
              </div>
            )}
          </section>
        ) : selectedGenre !== "All" ? (
          // Genre Filter Results
          <section>
            <h3 className="text-xl font-semibold mb-4">
              {selectedGenre}
              <span className="text-zinc-400 text-base font-normal ml-2">
                ({genreMovies.length} movies)
              </span>
            </h3>
            {genreMovies.length === 0 ? (
              <p className="text-zinc-400">
                No movies found for &quot;{selectedGenre}&quot;
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {genreMovies.map((movie) => (
                  <MovieCard
                    key={movie.movie_id}
                    movie={movie}
                    rating={ratingsMap[movie.movie_id]}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Welcome */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold">
                Welcome back,{" "}
                <span className="text-red-500">{user?.display_name}</span>
              </h2>
            </div>

            {/* Recommendations */}
            {recommended?.length > 0 && (
              <section className="mb-10">
                <h3 className="text-xl font-semibold mb-4">
                  Recommended For You
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {recommended.map((movie) => (
                    <MovieCard
                      key={movie.movie_id}
                      movie={movie}
                      rating={ratingsMap[movie.movie_id]}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Popular */}
            <section className="mb-10">
              <h3 className="text-xl font-semibold mb-4">Trending Now</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {popular.map((movie) => (
                  <MovieCard
                    key={movie.movie_id}
                    movie={movie}
                    rating={ratingsMap[movie.movie_id]}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
