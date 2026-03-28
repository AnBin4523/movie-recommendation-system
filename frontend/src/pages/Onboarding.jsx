import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import api from "../services/api";

const GENRES = [
  { name: "Action" },
  { name: "Adventure" },
  { name: "Animation" },
  { name: "Comedy" },
  { name: "Crime" },
  { name: "Documentary" },
  { name: "Drama" },
  { name: "Family" },
  { name: "Fantasy" },
  { name: "History" },
  { name: "Horror" },
  { name: "Music" },
  { name: "Mystery" },
  { name: "Romance" },
  { name: "Science Fiction" },
  { name: "Thriller" },
  { name: "War" },
  { name: "Western" },
];

export default function Onboarding() {
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user, login, token } = useAuth();
  const navigate = useNavigate();

  const toggleGenre = (genre) => {
    setSelected((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0) {
      return setError("Please select at least 1 genre");
    }

    setLoading(true);
    setError("");

    try {
      await api.put("/users/me/genres", {
        preferred_genres: selected.join(", "),
      });

      // Update user in AuthContext
      const updatedUser = {
        ...user,
        preferred_genres: selected.join(", "),
      };
      login(updatedUser, token);

      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-red-600 text-4xl font-bold mb-3">MOVIEFLIX</h1>
          <h2 className="text-white text-2xl font-semibold">
            What do you like to watch?
          </h2>
          <p className="text-zinc-400 mt-2">
            Select your favorite genres to get personalized recommendations
          </p>
        </div>

        {/* Genres Grid */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {GENRES.map((genre) => (
            <button
              key={genre.name}
              onClick={() => toggleGenre(genre.name)}
              className={`py-4 px-3 rounded-xl text-center font-semibold transition-all border-2 ${
                selected.includes(genre.name)
                  ? "bg-red-600 border-red-600 text-white scale-105"
                  : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-red-600"
              }`}
            >
              <div className="text-2xl mb-1">{genre.emoji}</div>
              <div className="text-sm">{genre.name}</div>
            </button>
          ))}
        </div>

        {/* Selected count */}
        <p className="text-zinc-400 text-center mb-4">
          {selected.length} genre{selected.length !== 1 ? "s" : ""} selected
        </p>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded mb-4 text-center">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || selected.length === 0}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-4 rounded-xl transition disabled:opacity-40 text-lg"
        >
          {loading ? "Saving..." : "Let's Go! 🎬"}
        </button>
      </div>
    </div>
  );
}
