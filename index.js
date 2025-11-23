import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import User from "./models/User.js";   // 👈 import user model
import studentRoutes from "./routes/studentRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import AttendanceSession from "./models/AttendanceSession.js";
import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import studentCourseRoutes from "./routes/studentCourseRoutes.js";
// import profileRoutes from "./routes/profile.js";
import notificationRoutes from './routes/notifications.js';
import leaderboardRoutes from './routes/Leaderboard.js';
import { profile } from "console";
// In your index.js or server.js
import assignmentRoutes from './routes/assignments.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();  // load env first

const app = express();

// CORS configuration
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173"], // Vite default port
  credentials: true
}));

app.use(express.json({ limit: '10mb' })); // Increase limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = process.env.PORT || 5000;
app.use("/api/students", studentRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/students/courses", studentCourseRoutes);
app.use("/uploads", express.static("uploads"));
// app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Add to your routes
app.use('/api/assignments', assignmentRoutes);

// Connect MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Atlas Connected"))
  .catch(err => console.log("❌ DB Connection Error:", err));

// ---------- ROUTES ----------

// Test route
app.get("/", (req, res) => {
  res.send("Backend is running...");
});

// ➕ Create new user
app.post("/api/users", async (req, res) => {
  try {
    const { name, email } = req.body;   // expecting JSON body {name, email}
    const newUser = new User({ name, email });
    await newUser.save();
    res.status(201).json(newUser);
  } catch (err) {
    console.error("❌ Error saving user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 📦 Get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
