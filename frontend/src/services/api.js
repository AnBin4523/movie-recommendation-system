import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

// auto attach token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = (data) => api.post("/auth/login", data);
export const register = (data) => api.post("/auth/register", data);

// Movies
export const getMovies = (params) => api.get("/movies", { params });
export const getMovieById = (id) => api.get(`/movies/${id}`);
export const getTrailer = (id) => api.get(`/movies/${id}/trailer`);

// Ratings
export const rateMovie = (data) => api.post("/ratings", data);
export const getMyRatings = () => api.get("/ratings/me");
export const getRatingByMovie = (id) => api.get(`/ratings/movie/${id}`);
export const getRatingsByMovies = (ids) =>
  api.get(`/ratings/movies?ids=${ids.join(",")}`);

// Recommendations
export const getRecommendations = () => api.get("/recommendations");
export const getCBF = () => api.get("/recommendations/cbf");
export const getCF = () => api.get("/recommendations/cf");
export const getPopular = () => api.get("/recommendations/popular");

// Chat
export const sendMessage = (data) => api.post("/chat", data);
export const getChatSessions = () => api.get("/chat/sessions");

export default api;
