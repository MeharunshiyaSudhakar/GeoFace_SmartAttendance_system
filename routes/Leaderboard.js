// routes/leaderboard.js (Simplified version without Activity model)
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Attendance from '../models/Attendance.js';

const router = express.Router();

// Get leaderboard data
router.get('/', protect, async (req, res) => {
  try {
    const { timeframe, courseId } = req.query;
    const userId = req.user.id;

    // Get current user to find their courses
    const currentUser = await User.findById(userId).populate('enrolledCourses');
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    let targetCourseIds = currentUser.enrolledCourses.map(course => course._id);
    
    // Filter by specific course if provided
    if (courseId && courseId !== 'all') {
      targetCourseIds = [courseId];
    }

    // Get all students in the same courses
    const students = await User.find({
      enrolledCourses: { $in: targetCourseIds },
      role: 'student'
    }).select('name email avatar studentId');

    const leaderboardData = await Promise.all(
      students.map(async (student) => {
        // Calculate attendance percentage
        const attendanceRecords = await Attendance.find({
          student: student._id,
          course: { $in: targetCourseIds }
        });
        
        const attendancePercentage = attendanceRecords.length > 0 
          ? (attendanceRecords.filter(record => record.status === 'present').length / attendanceRecords.length) * 100
          : 0;

        // Mock data for assignments and activity
        const assignmentScore = Math.floor(Math.random() * 30) + 70; // 70-100
        const assignmentCompletion = Math.floor(Math.random() * 30) + 70; // 70-100
        const activityScore = Math.floor(Math.random() * 30) + 70; // 70-100

        // Calculate overall performance score
        const performanceScore = 
          (attendancePercentage * 0.4) +
          (assignmentScore * 0.3) +
          (assignmentCompletion * 0.1) +
          (activityScore * 0.2);

        return {
          _id: student._id,
          name: student.name,
          studentId: student.studentId,
          avatar: student.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=4a6fa5`,
          performanceScore: Math.round(performanceScore),
          attendancePercentage: Math.round(attendancePercentage),
          assignmentScore: Math.round(assignmentScore),
          activityScore: Math.round(activityScore),
          assignmentCompletion: Math.round(assignmentCompletion)
        };
      })
    );

    // Sort by performance score
    leaderboardData.sort((a, b) => b.performanceScore - a.performanceScore);

    res.json(leaderboardData);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get performance statistics
router.get('/stats', protect, async (req, res) => {
  try {
    const { timeframe, courseId } = req.query;
    const userId = req.user.id;

    // Get leaderboard data
    const leaderboardData = await getLeaderboardData(userId, timeframe, courseId);
    
    if (leaderboardData.length === 0) {
      return res.json({
        topScore: 0,
        averageScore: 0,
        totalStudents: 0,
        scoreDistribution: { excellent: 0, good: 0, average: 0, needsImprovement: 0 },
        userRank: 0
      });
    }

    const stats = {
      topScore: Math.max(...leaderboardData.map(item => item.performanceScore)),
      averageScore: leaderboardData.reduce((sum, item) => sum + item.performanceScore, 0) / leaderboardData.length,
      totalStudents: leaderboardData.length,
      scoreDistribution: {
        excellent: leaderboardData.filter(item => item.performanceScore >= 90).length,
        good: leaderboardData.filter(item => item.performanceScore >= 80 && item.performanceScore < 90).length,
        average: leaderboardData.filter(item => item.performanceScore >= 70 && item.performanceScore < 80).length,
        needsImprovement: leaderboardData.filter(item => item.performanceScore < 70).length,
      },
      userRank: leaderboardData.findIndex(item => item._id === userId) + 1
    };

    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function (simplified without timeframe filter)
async function getLeaderboardData(userId, timeframe, courseId) {
  const currentUser = await User.findById(userId).populate('enrolledCourses');
  if (!currentUser) return [];

  let targetCourseIds = currentUser.enrolledCourses.map(course => course._id);
  if (courseId && courseId !== 'all') {
    targetCourseIds = [courseId];
  }

  const students = await User.find({
    enrolledCourses: { $in: targetCourseIds },
    role: 'student'
  }).select('name email avatar studentId');

  const leaderboardData = await Promise.all(
    students.map(async (student) => {
      const attendanceRecords = await Attendance.find({
        student: student._id,
        course: { $in: targetCourseIds }
      });
      
      const attendancePercentage = attendanceRecords.length > 0 
        ? (attendanceRecords.filter(record => record.status === 'present').length / attendanceRecords.length) * 100
        : 0;

      const assignmentScore = Math.floor(Math.random() * 30) + 70;
      const assignmentCompletion = Math.floor(Math.random() * 30) + 70;
      const activityScore = Math.floor(Math.random() * 30) + 70;

      const performanceScore = 
        (attendancePercentage * 0.4) +
        (assignmentScore * 0.3) +
        (assignmentCompletion * 0.1) +
        (activityScore * 0.2);

      return {
        _id: student._id,
        name: student.name,
        studentId: student.studentId,
        avatar: student.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=4a6fa5`,
        performanceScore: Math.round(performanceScore),
        attendancePercentage: Math.round(attendancePercentage),
        assignmentScore: Math.round(assignmentScore),
        activityScore: Math.round(activityScore),
        assignmentCompletion: Math.round(assignmentCompletion)
      };
    })
  );

  leaderboardData.sort((a, b) => b.performanceScore - a.performanceScore);
  return leaderboardData;
}

export default router;