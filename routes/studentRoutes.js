// server/routes/studentRoutes.js
import express from "express";
import Student from "../models/Student.js";
import Course from "../models/Course.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { protect } from "../middleware/authMiddleware.js";
import { saveDescriptorForStudent } from "../utils/faceVerification.js";

const router = express.Router();

// ================= MULTER CONFIGURATION =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/photos"; // store registration photos here
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
});

// ================= STUDENT REGISTER =================
// ================= STUDENT REGISTER =================
router.post("/register", upload.single("photo"), async (req, res) => {
  try {
    console.log("Incoming BODY:", req.body);
    console.log("Incoming FILE:", req.file);

    const { name, email, password, department, rollNumber, year } = req.body;

    // Check if student already exists
    const exists = await Student.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Student already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newStudent = new Student({
      name,
      email,
      password: hashedPassword,
      department,
      rollNumber,
      year,
      photo: req.file ? req.file.filename : null
    });

    await newStudent.save();

    res.status(201).json({ message: "Student registered successfully!" });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// ================= STUDENT LOGIN =================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🔹 Find student
    const student = await Student.findOne({ email });
    if (!student)
      return res.status(400).json({ message: "Invalid email or password" });

    // 🔹 Validate password
    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    // 🔹 Create JWT token
    const token = jwt.sign(
      { id: student._id, role: "student" },
      process.env.JWT_SECRET || "secret123",
      { expiresIn: "1h" }
    );

    res.json({
      message: "✅ Student login successful",
      token,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        department: student.department,
        rollNumber: student.rollNumber,
        year: student.year,
        photo: student.photo,
      },
    });
  } catch (err) {
    console.error("Student login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================= GET CURRENT STUDENT =================
router.get("/me", protect, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select("-password");
    if (!student) return res.status(404).json({ message: "Student not found" });

    res.json({ student });
  } catch (err) {
    console.error("Get student error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});
router.post("/courses/join", protect, async (req, res) => {
  try {
    const { courseCode } = req.body;

    if (!courseCode) {
      return res.status(400).json({ message: "Course code is required" });
    }

    const course = await Course.findOne({
      code: courseCode.toUpperCase()
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check if student already joined
    if (course.students.includes(req.user.id)) {
      return res.status(400).json({ message: "Already joined this course" });
    }

    course.students.push(req.user.id);
    await course.save();

    return res.json({ message: "Course joined successfully" });
  } catch (error) {
    console.error("Join course backend error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});


// ================= GET STUDENT COURSES =================
router.get("/my-courses", protect, async (req, res) => {
  try {
    const courses = await Course.find({ students: req.user.id })
      .populate("staff", "name email")
      .lean();

    res.json({ courses });
  } catch (err) {
    console.error("Get student courses error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
