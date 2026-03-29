import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import { useAuth } from "./context/useAuth";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import MovieDetail from "./pages/MovieDetail";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import ChatBot from "./components/ChatBot";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function OnboardingRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.preferred_genres) return <Navigate to="/onboarding" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (user) {
    // Admin → redirect admin
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    // User have genres → home
    if (user.preferred_genres) return <Navigate to="/" replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute>
                <Register />
              </GuestRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <PrivateRoute>
                <Onboarding />
              </PrivateRoute>
            }
          />
          <Route
            path="/"
            element={
              <OnboardingRoute>
                <Home />
              </OnboardingRoute>
            }
          />
          <Route
            path="/movies/:id"
            element={
              <OnboardingRoute>
                <MovieDetail />
              </OnboardingRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
        </Routes>
        <ChatBot />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
