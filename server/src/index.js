import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import { runMigrations } from "./db.js";
import { router as authRouter } from "./auth.js";
import { router as roomsRouter } from "./rooms.js";
import { router as templatesRouter } from "./templates.js";
import { router as problemsRouter } from "./problems.js";
import { router as usersRouter } from "./users.js";
import { router as settingsRouter } from "./settings.js";
import { router as judge0Router } from "./judge0.js";
import { startCollabServer } from "./collabServer.js";

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET env var is required");
  process.exit(1);
}

await runMigrations();

const app = express();
app.use(cors());
// Mostly for GET /rooms/:id/playback, whose base64 update log compresses
// ~3x - but every JSON endpoint benefits.
app.use(compression());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
app.use("/rooms", roomsRouter);
app.use("/templates", templatesRouter);
app.use("/problems", problemsRouter);
app.use("/users", usersRouter);
app.use("/settings", settingsRouter);
app.use("/", judge0Router);

// Last resort for anything a handler threw or rejected with (the routers are
// asyncRouter()s, so a rejected promise lands here instead of killing the
// process). Nothing about the error goes to the client - the log is where it
// belongs, and a stack trace in a JSON body is a gift to nobody.
app.use((err, req, res, next) => {
  console.error(`${req.method} ${req.originalUrl} failed:`, err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "internal error" });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API listening on :${port}`));

startCollabServer();
