import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Problems from "./pages/Problems.jsx";
import Users from "./pages/Users.jsx";
import Settings from "./pages/Settings.jsx";
import Room from "./pages/Room.jsx";
import Playback from "./pages/Playback.jsx";

function RequireAuth({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/problems"
        element={
          <RequireAuth>
            <Problems />
          </RequireAuth>
        }
      />
      <Route
        path="/users"
        element={
          <RequireAuth>
            <Users />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <Settings />
          </RequireAuth>
        }
      />
      <Route path="/room/:id" element={<Room />} />
      {/* Deliberately OUTSIDE /room/: nginx exempts /room/* from Basic Auth
          for candidates, while /playback/* falls through to location / and
          stays behind the gate - interviewer-only, like /dashboard. */}
      <Route
        path="/playback/:id"
        element={
          <RequireAuth>
            <Playback />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
