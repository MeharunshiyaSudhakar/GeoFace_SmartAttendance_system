// routes/profile.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Attendance from '../models/Attendance.js';
import { protect } from '../middleware/authMiddleware.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/avatars/'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Get complete user profile with stats
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('enrolledCourses', 'name code description')
      .populate('createdCourses', 'name code description');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get attendance stats
    const attendanceStats = await Attendance.aggregate([
      {
        $match: { student: user._id }
      },
      {
        $group: {
          _id: null,
          totalClasses: { $sum: 1 },
          attendedClasses: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = attendanceStats[0] || { totalClasses: 0, attendedClasses: 0 };
    const attendancePercentage = stats.totalClasses > 0 
      ? (stats.attendedClasses / stats.totalClasses) * 100 
      : 0;

    res.json({
      ...user.toObject(),
      stats: {
        totalCourses: user.enrolledCourses?.length || 0,
        createdCourses: user.createdCourses?.length || 0,
        attendancePercentage: Math.round(attendancePercentage),
        totalClasses: stats.totalClasses,
        attendedClasses: stats.attendedClasses,
        memberSince: user.createdAt.getFullYear()
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/me', protect, upload.single('avatar'), async (req, res) => {
  try {
    const { name, email, phone, department, bio, dateOfBirth, address } = req.body;
    
    const updateData = {
      name,
      email,
      phone,
      department,
      bio,
      dateOfBirth,
      address,
      updatedAt: new Date()
    };

    // If avatar is uploaded
    if (req.file) {
      updateData.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password')
     .populate('enrolledCourses', 'name code description')
     .populate('createdCourses', 'name code description');

    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user activity (recent actions)
router.get('/activity', protect, async (req, res) => {
  try {
    // Mock activity data - you can integrate with your Activity model
    const activities = [
      {
        _id: '1',
        action: 'attendance_marked',
        description: 'Marked attendance for Mathematics 101',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        course: { name: 'Mathematics 101' }
      },
      {
        _id: '2',
        action: 'assignment_submitted',
        description: 'Submitted assignment "Linear Algebra Problems"',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        course: { name: 'Mathematics 101' }
      },
      {
        _id: '3',
        action: 'course_joined',
        description: 'Joined course "Computer Science Fundamentals"',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        course: { name: 'Computer Science' }
      }
    ];

    res.json(activities);
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;