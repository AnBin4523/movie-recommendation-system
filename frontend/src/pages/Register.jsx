import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register as registerApi } from "../services/api";

export default function Register() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    display_name: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      return setError("Passwords do not match");
    }

    if (form.password.length < 6) {
      return setError("Password must be at least 6 characters");
    }

    setLoading(true);
    try {
      await registerApi({
        email: form.email,
        password: form.password,
        display_name: form.display_name,
      });

      // sign up successful → redirect to login
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Register failed");
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

        <h2 className="text-white text-2xl font-semibold mb-6">
          Create Account
        </h2>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="display_name"
            placeholder="Display Name"
            value={form.display_name}
            onChange={handleChange}
            required
            className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
            className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        {/* Login link */}
        <p className="text-zinc-400 text-center mt-6">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-white hover:underline font-semibold"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
