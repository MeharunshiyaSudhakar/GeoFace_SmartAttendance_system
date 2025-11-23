// routes/courseRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import Course from "../models/Course.js";

const router = express.Router();

/**
 * ============================
 *  STAFF CREATE COURSE
 * ============================
 */
router.post("/create", protect, async (req, res) => {
  try {
    // Only staff can create
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Only staff can create courses" });
    }

    const { name, description, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({ message: "Name and Code are required" });
    }

    // Ensure unique course code
    const exists = await Course.findOne({ code });
    if (exists)
      return res.status(400).json({ message: "Course code already exists" });

    const course = await Course.create({
      name,
      description,
      code: code.toUpperCase(),
      staff: req.user.id,   // staff ID from JWT
      students: [],
      attendanceEnabled: false,
      locationEnabled: false,
    });

    res.status(201).json({
      message: "Course created successfully",
      course,
    });

  } catch (err) {
    console.error("Create course error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * ============================
 *  STAFF GET ALL CREATED COURSES
 * ============================
 */
router.get("/staff", protect, async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({ message: "Only staff can view courses" });
    }

    const courses = await Course.find({ staff: req.user.id })
      .populate("students", "name email");

    res.json({ courses });
  } catch (err) {
    console.error("Staff fetch courses error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ============================
 *  STUDENT JOINS COURSE
 * ============================
 */
router.post("/join", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can join courses" });
    }

    const { code } = req.body;

    const course = await Course.findOne({ code: code.toUpperCase() });
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (course.students.includes(req.user.id)) {
      return res.status(400).json({ message: "Already joined this course" });
    }

    course.students.push(req.user.id);
    await course.save();

    res.json({ message: "Joined course successfully", course });
  } catch (err) {
    console.error("Join course error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ====================================================
 *  STUDENT JOINS COURSE USING JOIN CODE
 * ====================================================
 */
router.post("/join", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can join courses" });
    }

    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Course code is required" });
    }

    // Find course by join code
    const course = await Course.findOne({ code: code.toUpperCase() });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Prevent duplicate join
    if (course.students.includes(req.user.id)) {
      return res.status(400).json({ message: "Already joined this course" });
    }

    course.students.push(req.user.id);
    await course.save();

    res.json({ message: "Joined course successfully", course });

  } catch (err) {
    console.error("Join course error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ====================================================
 *  STUDENT – GET ALL JOINED COURSES
 * ====================================================
 */
router.get("/student", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students allowed" });
    }

    const courses = await Course.find({ students: req.user.id })
      .populate("staff", "name email");

    res.json({ courses });

  } catch (err) {
    console.error("Student courses error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ====================================================
 *  GET ALL STUDENTS IN A SPECIFIC COURSE
 * ====================================================
 */
router.get("/:courseId/students", protect, async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId)
      .populate("students", "name email");

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json({ students: course.students });

  } catch (err) {
    console.error("Get course students error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
