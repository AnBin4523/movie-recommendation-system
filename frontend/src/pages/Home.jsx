import { useState, useEffect } from "react";
import { useAuth } from "../context/useAuth";
import { getPopular, getRecommendations } from "../services/api";
import MovieCard from "../components/MovieCard";
import Navbar from "../components/Navbar";

export default function Home() {
  const { user } = useAuth();
  const [popular, setPopular] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // take popular movies
      const popRes = await getPopular();
      setPopular(popRes.data.data);

      // take recommendations
      const recRes = await getRecommendations();
      setRecommended(recRes.data.data);
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
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold">
            Welcome back,{" "}
            <span className="text-red-500">{user?.display_name}</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-zinc-400 text-lg">Loading movies...</div>
          </div>
        ) : (
          <>
            {/* Recommendations */}
            {recommended.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-semibold">Recommended For You</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {recommended.map((movie) => (
                    <MovieCard key={movie.movie_id} movie={movie} />
                  ))}
                </div>
              </section>
            )}

            {/* Popular */}
            <section className="mb-10">
              <h3 className="text-xl font-semibold mb-4"> Trending Now</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {popular.map((movie) => (
                  <MovieCard key={movie.movie_id} movie={movie} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
