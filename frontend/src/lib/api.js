import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

// Not `Authorization`: nginx's site-wide Basic Auth gate already owns that
// header (see server/src/auth.js), and a request can only carry one value
// for it.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers["X-SignalStage-Token"] = token;
  return config;
});

// The JWT expires (server/src/auth.js: 12h TTL) well before the browser tab
// closes. Without this, an expired token makes every /api/* call 401 forever
// while the UI still looks logged in - no redirect, no explanation, just
// every action silently failing. Outside the React tree, so a hard redirect
// rather than react-router's navigate().
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== "/login") {
      clearSession();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export function collabUrl() {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/collab`;
}

export function lspUrl(language) {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/lsp/${language}`;
}

// navigator.clipboard requires a secure context (HTTPS or localhost) - it's
// unavailable/rejects silently when the app is served over plain HTTP, so
// fall back to the legacy execCommand("copy") path via a hidden textarea.
export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("copy failed");
}
