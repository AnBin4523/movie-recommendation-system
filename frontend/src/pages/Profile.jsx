import { useState, useEffect } from "react";
import { useAuth } from "../context/useAuth";
import { getMe, updateMe, updatePassword, getMyRatings } from "../services/api";
import Navbar from "../components/Navbar";
import MovieCard from "../components/MovieCard";

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

export default function Profile() {
  const { user, login, token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("info");

  // Info form
  const [displayName, setDisplayName] = useState("");
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [infoMessage, setInfoMessage] = useState("");
  const [infoError, setInfoError] = useState("");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passMessage, setPassMessage] = useState("");
  const [passError, setPassError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileRes, ratingsRes] = await Promise.all([
        getMe(),
        getMyRatings(),
      ]);
      setProfile(profileRes.data);
      setDisplayName(profileRes.data.display_name || "");
      setSelectedGenres(
        profileRes.data.preferred_genres
          ? profileRes.data.preferred_genres.split(", ")
          : [],
      );
      setRatings(ratingsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleGenre = (genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  };

  const handleUpdateInfo = async () => {
    setInfoError("");
    setInfoMessage("");
    try {
      await updateMe({
        display_name: displayName,
        preferred_genres: selectedGenres.join(", "),
      });

      // Update AuthContext
      const updatedUser = {
        ...user,
        display_name: displayName,
        preferred_genres: selectedGenres.join(", "),
      };
      login(updatedUser, token);
      setInfoMessage("Profile updated successfully!");
      setTimeout(() => setInfoMessage(""), 3000);
    } catch (err) {
      setInfoError(err.response?.data?.message || "Update failed");
    }
  };

  const handleUpdatePassword = async () => {
    setPassError("");
    setPassMessage("");

    if (newPassword !== confirmPassword) {
      return setPassError("Passwords do not match");
    }
    if (newPassword.length < 6) {
      return setPassError("Password must be at least 6 characters");
    }

    try {
      await updatePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPassMessage("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPassMessage(""), 3000);
    } catch (err) {
      setPassError(err.response?.data?.message || "Update failed");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-2xl font-bold">
            {profile?.display_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{profile?.display_name}</h1>
            <p className="text-zinc-400">{profile?.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-zinc-800">
          {[
            { key: "info", label: "👤 Profile" },
            { key: "genres", label: "🎬 Genres" },
            { key: "ratings", label: `⭐ My Ratings (${ratings.length})` },
            { key: "password", label: "🔒 Password" },
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

        {/* Tab: Profile Info */}
        {activeTab === "info" && (
          <div className="max-w-md space-y-4">
            <div>
              <label className="text-zinc-400 text-sm mb-1 block">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-sm mb-1 block">Email</label>
              <input
                type="text"
                value={profile?.email || ""}
                disabled
                className="w-full bg-zinc-900 text-zinc-500 px-4 py-3 rounded-lg cursor-not-allowed"
              />
            </div>

            {infoError && <p className="text-red-400 text-sm">{infoError}</p>}
            {infoMessage && (
              <p className="text-green-400 text-sm">{infoMessage}</p>
            )}

            <button
              onClick={handleUpdateInfo}
              className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition"
            >
              Save Changes
            </button>
          </div>
        )}

        {/* Tab: Genres */}
        {activeTab === "genres" && (
          <div>
            <p className="text-zinc-400 mb-4">
              Select your favorite genres to improve recommendations
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {GENRES.map((genre) => (
                <button
                  key={genre.name}
                  onClick={() => toggleGenre(genre.name)}
                  className={`py-3 px-3 rounded-xl text-center font-semibold transition-all border-2 ${
                    selectedGenres.includes(genre.name)
                      ? "bg-red-600 border-red-600 text-white scale-105"
                      : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-red-600"
                  }`}
                >
                  <div className="text-xl mb-1">{genre.emoji}</div>
                  <div className="text-xs">{genre.name}</div>
                </button>
              ))}
            </div>

            <p className="text-zinc-400 text-sm mb-4">
              {selectedGenres.length} genres selected
            </p>

            {infoError && (
              <p className="text-red-400 text-sm mb-3">{infoError}</p>
            )}
            {infoMessage && (
              <p className="text-green-400 text-sm mb-3">{infoMessage}</p>
            )}

            <button
              onClick={handleUpdateInfo}
              disabled={selectedGenres.length === 0}
              className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition disabled:opacity-40"
            >
              Save Genres
            </button>
          </div>
        )}

        {/* Tab: My Ratings */}
        {activeTab === "ratings" && (
          <div>
            {ratings.length === 0 ? (
              <p className="text-zinc-400">You haven't rated any movies yet.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {ratings.map((item) => (
                  <div key={item.movie_id} className="relative">
                    <MovieCard movie={item} />
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                      You: {item.rating_score}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Password */}
        {activeTab === "password" && (
          <div className="max-w-md space-y-4">
            <div>
              <label className="text-zinc-400 text-sm mb-1 block">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-sm mb-1 block">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-sm mb-1 block">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            {passError && <p className="text-red-400 text-sm">{passError}</p>}
            {passMessage && (
              <p className="text-green-400 text-sm">{passMessage}</p>
            )}

            <button
              onClick={handleUpdatePassword}
              className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition"
            >
              Update Password
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
