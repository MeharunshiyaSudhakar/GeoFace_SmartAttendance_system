// server/routes/studentCourseRoutes.js
import express from "express";
import Course from "../models/Course.js";
import { protect } from "../middleware/authMiddleware.js"; // your auth middleware
import Student from "../models/Student.js";
import multer from "multer";
const router = express.Router();

/**
 * @route   POST /api/courses/join
 * @desc    Enroll student in a course using join code
 * @access  Private (student)
 */
router.post("/join", protect, async (req, res) => {
  try {
    // Ensure student role
    if (req.user.role !== "student") {  
      return res.status(403).json({ message: "Only students can join courses" });
    }

    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Course code is required" });

    // Find course by code (normalize uppercase)
const course = await Course.findOne({
  $or: [
    { code: code.toUpperCase() },
    { joinCode: code.toUpperCase() }
  ]
});
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Check if student already enrolled
    if (course.students.includes(req.user.id)) {
      return res.status(400).json({ message: "Already enrolled in this course" });
    }

    // Enroll student
    course.students.push(req.user.id);
    await course.save();

    return res.json({ message: "Enrolled successfully", course });
  } catch (err) {
    console.error("❌ Join course error:", err);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

/**
 * @route   GET /api/students/courses
 * @desc    Get all courses the student is enrolled in
 * @access  Private (student)
 */
router.get("/", protect, async (req, res) => {
  try {
    const courses = await Course.find({ students: req.user.id }).sort({ createdAt: -1 });
    res.json({ courses });
  } catch (err) {
    console.error("❌ Fetch student courses error:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

export default router;
