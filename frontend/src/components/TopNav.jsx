import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { api, clearSession, getUser, saveSession } from "../lib/api.js";

// The interviewer surface has two first-class areas - live sessions and the
// problem bank - so they get equal weight here instead of the bank hiding
// behind a text link in the corner.
export default function TopNav() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getUser);

  // The stored session object is written at login, so a promotion or demotion
  // would otherwise not show up until the next one. Ask who I am now.
  useEffect(() => {
    api
      .get("/auth/me")
      .then(({ data }) => {
        setUser(data);
        saveSession(localStorage.getItem("token"), data);
      })
      .catch(() => {});
  }, []);

  function logout() {
    clearSession();
    navigate("/login");
  }

  return (
    <header className="top-nav">
      <img className="logo" src="/signalstage-logo.png" alt="SignalStage" />
      <nav className="top-nav-tabs">
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
          Sessions
        </NavLink>
        <NavLink to="/problems" className={({ isActive }) => (isActive ? "active" : "")}>
          Problem bank
        </NavLink>
        {user?.isAdmin && (
          <NavLink to="/users" className={({ isActive }) => (isActive ? "active" : "")}>
            Users
          </NavLink>
        )}
      </nav>
      <div className="top-nav-user">
        <span className="muted">{user?.name}</span>
        <button className="link" onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
