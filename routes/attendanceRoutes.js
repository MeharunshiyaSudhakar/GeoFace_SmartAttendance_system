// routes/attendanceRoutes.js
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import AttendanceSession from "../models/AttendanceSession.js";
import Student from "../models/Student.js";
import Course from "../models/Course.js";
import { protect } from "../middleware/authMiddleware.js";
import { matchAgainstAll } from "../utils/faceVerification.js";
  
const router = express.Router();

// ================= MULTER SETUP =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads/attendance_photos";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = file.originalname.split(".").pop();
    cb(null, `${req.user.id}_${Date.now()}.${ext}`);
  },
});
const upload = multer({ storage });

// ================= FACE RECOGNITION ATTENDANCE =================
// @route   POST /api/attendance/mark-with-face
// @access  Private (student)
// ================= FACE RECOGNITION ATTENDANCE =================
// @route   POST /api/attendance/mark-with-face
// @access  Private (student)
router.post("/mark-with-face", protect, async (req, res) => {
  try {
    const { sessionId, latitude, longitude, photo } = req.body;
    const studentId = req.user.id;

    if (!sessionId || !photo) {
      return res.status(400).json({ message: "Session ID and captured photo required" });
    }

    const session = await AttendanceSession.findById(sessionId);
    if (!session || !session.active) {
      return res.status(400).json({ message: "No active attendance session found" });
    }

    // Prevent duplicate marking
    if (session.attendance.some((att) => att.student.toString() === studentId)) {
      return res.status(400).json({ message: "Attendance already marked" });
    }

    const student = await Student.findById(studentId);
    if (!student || !student.photo) {
      return res.status(400).json({ message: "No registered photo found for this student" });
    }

    // ✅ Save captured image temporarily
    const base64Data = photo.replace(/^data:image\/\w+;base64,/, "");
    const tempPath = path.join("uploads", `captured_${Date.now()}.jpg`);
    fs.writeFileSync(tempPath, base64Data, "base64");

    // ✅ Compare faces (registered photo is stored as student.photo)
    const registeredPhotoPath = path.join(process.cwd(), student.photo);
    const isMatch = await verifyFace(tempPath, registeredPhotoPath);

    // ✅ Cleanup temp file safely
    try {
      fs.unlinkSync(tempPath);
    } catch (cleanupErr) {
      console.warn("Temporary image cleanup failed:", cleanupErr);
    }

    if (!isMatch) {
      return res.status(400).json({
        message: "❌ Face verification failed. Please ensure proper lighting and angle.",
      });
    }

    // ✅ Location validation
    let distance = null;
    if (latitude && longitude) {
      distance = getDistance(
        session.latitude,
        session.longitude,
        parseFloat(latitude),
        parseFloat(longitude)
      );

      if (distance > session.radius) {
        return res.status(400).json({
          message: `❌ Outside attendance radius (${Math.round(distance)}m away)`,
          distance,
        });
      }
    }

    // ✅ Mark attendance
    session.attendance.push({
      student: studentId,
      status: "Present",
      markedAt: new Date(),
      latitude: latitude || null,
      longitude: longitude || null,
    });
    await session.save();

    res.status(200).json({
      message: "✅ Attendance marked successfully (Face & location verified)",
      distance,
    });
  } catch (err) {
    console.error("❌ Error in /mark-with-face:", err);
    res.status(500).json({ message: "Server error during face attendance", error: err.message });
  }
});


// ================= HELPER FUNCTION =================
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // meters
  const φ1 = lat1 * (Math.PI / 180);
  const φ2 = lat2 * (Math.PI / 180);
  const Δφ = (lat2 - lat1) * (Math.PI / 180);
  const Δλ = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in meters
}

// ================= EXISTING ROUTES (UNCHANGED) =================

// ✅ Start attendance session (staff)
router.post("/start", protect, async (req, res) => {
  try {
    const { courseId, subject, latitude, longitude, radius } = req.body;

    if (req.user.role !== "staff")
      return res.status(403).json({ message: "Only staff can start sessions" });

    if (!courseId || !subject)
      return res.status(400).json({ message: "CourseId and subject required" });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (course.staff.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized for this course" });

    const existing = await AttendanceSession.findOne({ courseId, active: true });
    if (existing)
      return res.status(400).json({ message: "There is already an active session for this course" });

    const newSession = new AttendanceSession({
      courseId,
      staffId: req.user.id,
      subject,
      latitude: latitude || 0,
      longitude: longitude || 0,
      radius: radius || 100,
      active: true,
      startedAt: new Date(),
    });

    await newSession.save();

    res.status(201).json({ message: "Attendance session started", session: newSession });
  } catch (err) {
    console.error("Error starting session:", err);
    res.status(500).json({ message: "Server error starting attendance", error: err.message });
  }
});

// ✅ End attendance session
router.post("/end/:sessionId", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await AttendanceSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    session.active = false;
    session.endedAt = new Date();
    await session.save();

    res.status(200).json({
      message: "Attendance session ended",
      session,
      notification: `Staff ended attendance for course ${session.courseId}`,
    });
  } catch (err) {
    console.error("Error ending session", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// ✅ Get all active sessions (for staff & students)
router.get("/active-sessions", protect, async (req, res) => {
  try {
    const sessions = await AttendanceSession.find({ active: true })
      .populate("courseId")
      .populate("staffId");
    res.status(200).json({ sessions });
  } catch (err) {
    console.error("Error fetching active sessions:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get all sessions for a specific course
router.get("/sessions/:courseId", protect, async (req, res) => {
  try {
    const { courseId } = req.params;
    const sessions = await AttendanceSession.find({ courseId })
      .populate("attendance.student", "name rollNumber")
      .populate("courseId", "name");
    res.json(sessions);
  } catch (err) {
    console.error("Error fetching sessions:", err);
    res.status(500).json({ message: "Error fetching sessions" });
  }
});

// ✅ Get active sessions for a student
router.get("/active-student-sessions/:studentId", protect, async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId))
      return res.status(400).json({ message: "Invalid student ID" });

    const student = await Student.findById(studentId).populate("courses");
    if (!student) return res.status(404).json({ message: "Student not found" });

    const enrolledCourseIds = student.courses.map((c) => c._id);

    const sessions = await AttendanceSession.find({
      courseId: { $in: enrolledCourseIds },
      active: true,
    }).populate("courseId", "name description");

    res.json(sessions);
  } catch (err) {
    console.error("Error fetching active-student-sessions:", err);
    res.status(500).json({ message: "Error fetching sessions", error: err.message });
  }
});

// ✅ Simple attendance marking
router.post("/mark", protect, async (req, res) => {
  try {
    const { sessionId, studentId } = req.body;
    if (!sessionId || !studentId)
      return res.status(400).json({ message: "Session ID and student ID required" });

    const session = await AttendanceSession.findById(sessionId);
    if (!session || !session.active)
      return res.status(400).json({ message: "No active session" });

    if (session.attendance.find((att) => att.student.toString() === studentId))
      return res.status(400).json({ message: "Attendance already marked" });

    session.attendance.push({ student: studentId, status: "Present", markedAt: new Date() });
    await session.save();

    res.status(200).json({ message: "Attendance marked", studentId, sessionId });
  } catch (err) {
    console.error("Error marking attendance:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// ✅ Get attendance for specific session
router.get("/session/:sessionId/attendance", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await AttendanceSession.findById(sessionId).populate("attendance.student");
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.status(200).json(session.attendance);
  } catch (err) {
    console.error("Error fetching session attendance:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Fetch active sessions (student courses)
router.post("/student-active-sessions", protect, async (req, res) => {
  try {
    const { courseIds } = req.body;
    if (!courseIds || !courseIds.length) return res.json([]);

    const activeSessions = await AttendanceSession.find({
      courseId: { $in: courseIds },
      active: true,
    }).populate("courseId", "name description");

    res.json(activeSessions);
  } catch (err) {
    console.error("Error fetching active sessions:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Generate Attendance PDF
router.get("/session/:sessionId/pdf", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await AttendanceSession.findById(sessionId)
      .populate("attendance.student", "name rollNumber")
      .populate("courseId", "name description");

    if (!session) return res.status(404).json({ message: "Session not found" });

    const pdfPath = path.join("uploads", `attendance_${sessionId}.pdf`);
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    doc.fontSize(20).text(`Attendance Report - ${session.courseId.name}`, { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Subject: ${session.subject}`);
    doc.text(`Date: ${new Date(session.startedAt).toLocaleString()}`);
    doc.text(`Status: ${session.active ? "Active" : "Closed"}`);
    doc.moveDown();

    doc.text("Name".padEnd(25) + "Roll No".padEnd(15) + "Status", { underline: true });
    doc.moveDown();

    session.attendance.forEach((a) => {
      doc.text(`${a.student?.name?.padEnd(25)} ${a.student?.rollNumber?.padEnd(15)} ${a.status}`);
    });

    doc.end();

    writeStream.on("finish", () => {
      res.download(pdfPath, `attendance_${sessionId}.pdf`, (err) => {
        if (err) console.error("Download error:", err);
        fs.unlinkSync(pdfPath);
      });
    });
  } catch (err) {
    console.error("Error generating PDF:", err);
    res.status(500).json({ message: "Error generating PDF" });
  }
});

export default router;
