import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import {
  getAdminStats,
  getAdminUsers,
  getAdminMovies,
  toggleUser,
  deleteUser,
  deleteMovie,
  createMovie,
  updateMovie,
} from "../services/api";

export default function AdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("stats");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [movieSearch, setMovieSearch] = useState("");
  const [editMovie, setEditMovie] = useState(null);
  const [showAddMovie, setShowAddMovie] = useState(false);
  const [movieForm, setMovieForm] = useState({
    movie_id: "",
    title: "",
    original_title: "",
    year_published: "",
    duration: "",
    country_name: "",
    original_language: "",
    genres: "",
    actors: "",
    directors: "",
    plot: "",
    poster_path: "",
    trailer_key: "",
  });
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, moviesRes] = await Promise.all([
        getAdminStats(),
        getAdminUsers(),
        getAdminMovies({ limit: 300 }),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setMovies(moviesRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = async (id) => {
    await toggleUser(id);
    fetchData();
  };

  const handleDeleteUser = async (id) => {
    if (!confirm("Delete this user?")) return;
    await deleteUser(id);
    fetchData();
  };

  const handleDeleteMovie = async (id) => {
    if (!confirm("Delete this movie?")) return;
    await deleteMovie(id);
    fetchData();
  };

  const handleMovieFormChange = (e) => {
    setMovieForm({ ...movieForm, [e.target.name]: e.target.value });
  };

  const handleSaveMovie = async () => {
    try {
      if (editMovie) {
        await updateMovie(editMovie.movie_id, movieForm);
        setMessage("Movie updated!");
      } else {
        await createMovie(movieForm);
        setMessage("Movie created!");
      }
      setEditMovie(null);
      setShowAddMovie(false);
      setMovieForm({
        movie_id: "",
        title: "",
        original_title: "",
        year_published: "",
        duration: "",
        country_name: "",
        original_language: "",
        genres: "",
        actors: "",
        directors: "",
        plot: "",
        poster_path: "",
        trailer_key: "",
      });
      setFormError("");
      fetchData();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setFormError(err.response?.data?.message || "Error");
    }
  };

  const openEdit = (movie) => {
    setEditMovie(movie);
    setMovieForm({
      movie_id: movie.movie_id,
      title: movie.title || "",
      original_title: movie.original_title || "",
      year_published: movie.year_published || "",
      duration: movie.duration || "",
      country_name: movie.country_name || "",
      original_language: movie.original_language || "",
      genres: movie.genres || "",
      actors: movie.actors || "",
      directors: movie.directors || "",
      plot: movie.plot || "",
      poster_path: movie.poster_path || "",
      trailer_key: movie.trailer_key || "",
    });
    setShowAddMovie(true);
  };

  const filteredMovies = movies.filter((m) =>
    m.title?.toLowerCase().includes(movieSearch.toLowerCase()),
  );

  if (loading)
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navbar */}
      <nav className="bg-zinc-900 px-8 py-4 flex justify-between items-center">
        <h1 className="text-red-600 text-xl font-bold">CineAI ADMIN</h1>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-zinc-400 hover:text-white text-sm"
          >
            ← Back to Site
          </button>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-zinc-800">
          {[
            { key: "stats", label: "📊 Statistics" },
            { key: "users", label: `👥 Users (${users.length})` },
            { key: "movies", label: `🎬 Movies (${movies.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 font-semibold text-sm transition border-b-2 ${
                activeTab === tab.key
                  ? "border-red-600 text-white"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {message && (
          <div className="bg-green-500/20 border border-green-500 text-green-400 px-4 py-3 rounded mb-4">
            {message}
          </div>
        )}

        {/* Stats */}
        {activeTab === "stats" && stats && (
          <div className="grid grid-cols-3 gap-6">
            {[
              {
                label: "Total Users",
                value: stats.total_users,
                icon: "👥",
                color: "blue",
              },
              {
                label: "Total Movies",
                value: stats.total_movies,
                icon: "🎬",
                color: "red",
              },
              {
                label: "Total Ratings",
                value: stats.total_ratings,
                icon: "⭐",
                color: "yellow",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-zinc-900 rounded-xl p-6 text-center"
              >
                <div className="text-4xl mb-3">{stat.icon}</div>
                <div className="text-3xl font-bold mb-1">{stat.value}</div>
                <div className="text-zinc-400">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Users */}
        {activeTab === "users" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-800">
                  <th className="text-left py-3 px-4">ID</th>
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Email</th>
                  <th className="text-left py-3 px-4">Role</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.user_id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-900"
                  >
                    <td className="py-3 px-4 text-zinc-400">{user.user_id}</td>
                    <td className="py-3 px-4">{user.display_name}</td>
                    <td className="py-3 px-4 text-zinc-400">{user.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          user.role === "admin"
                            ? "bg-red-600/20 text-red-400"
                            : "bg-zinc-700 text-zinc-300"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          user.is_active
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {user.role !== "admin" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleUser(user.user_id)}
                            className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded text-xs"
                          >
                            {user.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.user_id)}
                            className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-1 rounded text-xs transition"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Movies */}
        {activeTab === "movies" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <input
                type="text"
                placeholder="Search movies..."
                value={movieSearch}
                onChange={(e) => setMovieSearch(e.target.value)}
                className="bg-zinc-800 text-white px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-red-600 w-72"
              />
              <button
                onClick={() => {
                  setEditMovie(null);
                  setShowAddMovie(true);
                  setMovieForm({
                    movie_id: "",
                    title: "",
                    original_title: "",
                    year_published: "",
                    duration: "",
                    country_name: "",
                    original_language: "",
                    genres: "",
                    actors: "",
                    directors: "",
                    plot: "",
                    poster_path: "",
                    trailer_key: "",
                  });
                }}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                + Add Movie
              </button>
            </div>

            {/* Movie Form Modal */}
            {showAddMovie && (
              <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <h2 className="text-xl font-bold mb-4">
                    {editMovie ? "Edit Movie" : "Add Movie"}
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        name: "movie_id",
                        label: "Movie ID",
                        disabled: !!editMovie,
                      },
                      { name: "title", label: "Title" },
                      { name: "original_title", label: "Original Title" },
                      { name: "year_published", label: "Year" },
                      { name: "duration", label: "Duration (min)" },
                      { name: "country_name", label: "Country" },
                      { name: "original_language", label: "Language" },
                      { name: "genres", label: "Genres" },
                      { name: "actors", label: "Actors" },
                      { name: "directors", label: "Directors" },
                      { name: "poster_path", label: "Poster Path" },
                      { name: "trailer_key", label: "YouTube Trailer Key" },
                    ].map((field) => (
                      <div
                        key={field.name}
                        className={
                          field.name === "actors" || field.name === "directors"
                            ? "col-span-2"
                            : ""
                        }
                      >
                        <label className="text-zinc-400 text-xs mb-1 block">
                          {field.label}
                        </label>
                        <input
                          type="text"
                          name={field.name}
                          value={movieForm[field.name]}
                          onChange={handleMovieFormChange}
                          disabled={field.disabled}
                          className="w-full bg-zinc-800 text-white px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50"
                        />
                      </div>
                    ))}
                    <div className="col-span-2">
                      <label className="text-zinc-400 text-xs mb-1 block">
                        Plot
                      </label>
                      <textarea
                        name="plot"
                        value={movieForm.plot}
                        onChange={handleMovieFormChange}
                        rows={3}
                        className="w-full bg-zinc-800 text-white px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-600"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    {formError && (
                      <p className="text-red-400 text-sm w-full mb-2">
                        {formError}
                      </p>
                    )}
                    <button
                      onClick={handleSaveMovie}
                      className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold"
                    >
                      {editMovie ? "Update" : "Create"}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddMovie(false);
                        setEditMovie(null);
                        setFormError("");
                      }}
                      className="bg-zinc-700 hover:bg-zinc-600 px-6 py-2 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Movie Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-400 border-b border-zinc-800">
                    <th className="text-left py-3 px-4">ID</th>
                    <th className="text-left py-3 px-4">Title</th>
                    <th className="text-left py-3 px-4">Year</th>
                    <th className="text-left py-3 px-4">Genres</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovies.map((movie) => (
                    <tr
                      key={movie.movie_id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-900"
                    >
                      <td className="py-3 px-4 text-zinc-400">
                        {movie.movie_id}
                      </td>
                      <td className="py-3 px-4 font-semibold">{movie.title}</td>
                      <td className="py-3 px-4 text-zinc-400">
                        {movie.year_published}
                      </td>
                      <td className="py-3 px-4 text-zinc-400 text-xs">
                        {movie.genres}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(movie)}
                            className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMovie(movie.movie_id)}
                            className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-1 rounded text-xs transition"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
