import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useState } from "react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSearch = (e) => {
    if (e.key === "Enter" && search.trim()) {
      navigate(`/?search=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <nav className="bg-zinc-900 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
      {/* Logo */}
      <Link to="/" className="text-red-600 text-2xl font-bold">
        MOVIEFLIX
      </Link>

      {/* Search */}
      <div className="flex-1 max-w-md mx-8">
        <input
          type="text"
          placeholder="Search movies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearch}
          className="w-full bg-zinc-800 text-white px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        {user?.role === "admin" && (
          <Link
            to="/admin"
            className="text-zinc-300 hover:text-white"
          >
            Dashboard
          </Link>
        )}
        <Link to="/profile" className="text-zinc-300 hover:text-white">
          {user?.display_name}
        </Link>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
