import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { login as loginApi } from "../services/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await loginApi({ email, password });
      login(res.data.user, res.data.token);

      if (res.data.user.role === "admin") {
        navigate("/admin"); // admin → dashboard
      } else if (!res.data.user.preferred_genres) {
        // if preferred_genres is not set → onboarding
        navigate("/onboarding");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="bg-zinc-900 p-10 rounded-xl w-full max-w-md">
        {/* Logo */}
        <h1 className="text-red-600 text-4xl font-bold text-center mb-8">
          CINEAI
        </h1>

        <h2 className="text-white text-2xl font-semibold mb-6">Sign In</h2>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Register link */}
        <p className="text-zinc-400 text-center mt-6">
          New to CINEAI?{" "}
          <Link
            to="/register"
            className="text-white hover:underline font-semibold"
          >
            Sign up now
          </Link>
        </p>
      </div>
    </div>
  );
}
