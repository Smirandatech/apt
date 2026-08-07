import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import applicationRoutes from "./routes/applications";
import resumeRoutes from "./routes/resume";
import developerRoutes from "./routes/developer";
import managerRoutes from "./routes/manager";
import adminRoutes from "./routes/admin";
import interviewRoutes from "./routes/interview";
import bidderRoutes from "./routes/bidder";
import path from "path";
import { errorHandler } from "./middleware/errorHandler";

dotenv.config();

const app = express();

const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
  "https://apt-tan-alpha.vercel.app",
];

const envOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([...defaultOrigins, ...envOrigins]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      try {
        const { hostname } = new URL(origin);
        const isVercelPreview = hostname.endsWith(".vercel.app");
        if (allowedOrigins.has(origin) || isVercelPreview) {
          callback(null, true);
          return;
        }
      } catch {
        // Fall through to rejection.
      }

      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

app.use(express.json());
app.use("/resumes", express.static(path.join(__dirname, "../resumes")));

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/developer", developerRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/bidder", bidderRoutes);

app.use(errorHandler);

export default app;
