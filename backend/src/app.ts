import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";

import movieRoutes from "./routes/movie.route";
import authRoutes from "./routes/auth.route";
import watchPartyRoutes from "./routes/watchParty.route";

const app = express();

export const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim());

app.use(cors({
  origin(origin, callback) {
    // Requests from tools such as curl have no Origin header. Browser requests
    // must come from the configured frontend origin so session cookies remain safe.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/watch-parties", watchPartyRoutes);

export default app;
