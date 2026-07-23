import "dotenv/config";
import express from "express";
import cors from "cors";
import { runMigrations } from "./db.js";
import { router as authRouter } from "./auth.js";
import { router as roomsRouter } from "./rooms.js";
import { router as judge0Router } from "./judge0.js";
import { startCollabServer } from "./collabServer.js";

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET env var is required");
  process.exit(1);
}

await runMigrations();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
app.use("/rooms", roomsRouter);
app.use("/", judge0Router);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API listening on :${port}`));

startCollabServer();
