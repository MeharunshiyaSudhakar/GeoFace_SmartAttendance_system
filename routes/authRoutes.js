import express from "express";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { generateAccessToken, generateRefreshToken } from "../utils/generateToken.js";

const router = express.Router();

// Store refresh tokens in-memory (⚠️ use DB/Redis in production)
let refreshTokens = [];

// Register
router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields required" });

  const userExists = await User.findOne({ email });
  if (userExists) return res.status(400).json({ message: "User already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashedPassword, role });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  refreshTokens.push(refreshToken);

  res.status(201).json({
    accessToken,
    refreshToken,
    user: { name: user.name, email: user.email, role: user.role },
  });
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  refreshTokens.push(refreshToken);

  res.json({
    accessToken,
    refreshToken,
    user: { name: user.name, email: user.email, role: user.role },
  });
});

// Refresh Token endpoint
router.post("/refresh", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ message: "No token provided" });
  if (!refreshTokens.includes(token)) return res.status(403).json({ message: "Invalid refresh token" });

  jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid or expired refresh token" });

    const newAccessToken = generateAccessToken({ _id: user.id, role: user.role });
    res.json({ accessToken: newAccessToken });
  });
});

// Logout (invalidate refresh token)
router.post("/logout", (req, res) => {
  const { token } = req.body;
  refreshTokens = refreshTokens.filter(t => t !== token);
  res.json({ message: "Logged out" });
});

export default router;
