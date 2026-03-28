import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { getPopular, getRecommendations, getMovies, getRatingsByMovies } from "../services/api";
import MovieCard from "../components/MovieCard";
import Navbar from "../components/Navbar";

export default function Home() {
  const { user } = useAuth();
  const [popular, setPopular] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("search") || "";
  const [searchResults, setSearchResults] = useState([]);
  const [ratingsMap, setRatingsMap] = useState({});

  useEffect(() => {
    if (searchQuery) {
      fetchSearchResults();
    } else {
      fetchData();
    }
  }, [searchQuery]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // take popular movies
      const popRes = await getPopular();
      setPopular(popRes.data.data);

      // take recommendations
      const recRes = await getRecommendations();
      setRecommended(recRes.data.data);

      // fetch ratings all movies
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
      const res = await getMovies({ search: searchQuery });
      setSearchResults(res.data.data);

      // Fetch ratings search results
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
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-zinc-400 text-lg">Loading...</p>
          </div>
        ) : searchQuery ? (
          // Search Results
          <section>
            <h3 className="text-xl font-semibold mb-4">
              Search results for "{searchQuery}"
              <span className="text-zinc-400 text-base font-normal ml-2">
                ({searchResults.length} found)
              </span>
            </h3>
            {searchResults.length === 0 ? (
              <p className="text-zinc-400">
                No movies found for "{searchQuery}"
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
