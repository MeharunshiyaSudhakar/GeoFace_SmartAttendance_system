// routes/assignments.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Course from '../models/Course.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/assignments/'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'assignment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Create assignment (Teacher only)
router.post('/', protect, upload.array('attachments', 5), async (req, res) => {
  try {
    const {
      title,
      description,
      courseId,
      dueDate,
      maxPoints,
      submissionType,
      allowedFormats
    } = req.body;

    // Check if user is teacher of this course
    const course = await Course.findOne({
      _id: courseId,
      teacher: req.user.id
    });

    if (!course) {
      return res.status(403).json({ message: 'Not authorized to create assignments for this course' });
    }

    const assignment = new Assignment({
      title,
      description,
      course: courseId,
      createdBy: req.user.id,
      dueDate,
      maxPoints: maxPoints || 100,
      submissionType: submissionType || 'any',
      allowedFormats: allowedFormats ? allowedFormats.split(',') : [],
      status: 'published'
    });

    // Handle attachments
    if (req.files && req.files.length > 0) {
      assignment.attachments = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: `/uploads/assignments/${file.filename}`
      }));
    }

    await assignment.save();
    await assignment.populate('course', 'name code');
    await assignment.populate('createdBy', 'name');

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get assignments for a course
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if user is enrolled in or teaching the course
    const course = await Course.findOne({
      _id: courseId,
      $or: [
        { teacher: req.user.id },
        { students: req.user.id }
      ]
    });

    if (!course) {
      return res.status(403).json({ message: 'Not authorized to view assignments for this course' });
    }

    const assignments = await Assignment.find({ course: courseId })
      .populate('course', 'name code')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json(assignments);
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit assignment (Student only)
router.post('/:assignmentId/submit', protect, upload.array('files', 5), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { submissionType, text, link } = req.body;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Check if student is enrolled in the course
    const isEnrolled = await Course.findOne({
      _id: assignment.course,
      students: req.user.id
    });

    if (!isEnrolled) {
      return res.status(403).json({ message: 'Not enrolled in this course' });
    }

    // Check if already submitted
    const existingSubmission = await Submission.findOne({
      assignment: assignmentId,
      student: req.user.id
    });

    if (existingSubmission) {
      return res.status(400).json({ message: 'Assignment already submitted' });
    }

    const submission = new Submission({
      assignment: assignmentId,
      student: req.user.id,
      course: assignment.course,
      submissionType,
      content: {
        text,
        link,
        files: []
      },
      status: new Date() > new Date(assignment.dueDate) ? 'late' : 'submitted'
    });

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      submission.content.files = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: `/uploads/assignments/${file.filename}`,
        mimetype: file.mimetype
      }));
    }

    await submission.save();
    await submission.populate('assignment', 'title dueDate');
    await submission.populate('student', 'name email');

    res.status(201).json(submission);
  } catch (error) {
    console.error('Submit assignment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student's submissions
router.get('/submissions/student', protect, async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user.id })
      .populate('assignment', 'title dueDate maxPoints')
      .populate('course', 'name code')
      .sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get submissions for an assignment (Teacher only)
router.get('/:assignmentId/submissions', protect, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      createdBy: req.user.id
    });

    if (!assignment) {
      return res.status(403).json({ message: 'Not authorized to view submissions for this assignment' });
    }

    const submissions = await Submission.find({ assignment: assignmentId })
      .populate('student', 'name email studentId')
      .sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    console.error('Get assignment submissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;