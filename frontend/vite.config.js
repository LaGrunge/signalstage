import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
      // No path rewrite: the provider connects to exactly "/collab" (room
      // name travels over the websocket protocol, not the URL path), and
      // Hocuspocus's server doesn't route by path anyway.
      "/collab": { target: "ws://localhost:1234", ws: true },
    },
  },
});
