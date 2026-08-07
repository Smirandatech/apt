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
app.use(cors());
app.use(express.json());
app.use("/resumes", express.static(path.join(__dirname, "../resumes")));

app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/developer", developerRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/bidder", bidderRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
