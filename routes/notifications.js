// routes/notifications.js
import express from 'express';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Attendance from '../models/Attendance.js';
// import Assignment from '../models/Assignment.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get notifications for student
router.get('/student', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.id,
      isRead: false
    })
    .populate('sender', 'name avatar')
    .populate('course', 'name code')
    .sort({ createdAt: -1 })
    .limit(50);

    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete notification
router.delete('/:id', protect, async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create notification (for teachers/staff)
router.post('/', protect, async (req, res) => {
  try {
    const { type, title, message, courseId, recipientId } = req.body;

    const notification = new Notification({
      type,
      title,
      message,
      course: courseId,
      sender: req.user.id,
      recipient: recipientId
    });

    await notification.save();
    await notification.populate('sender', 'name avatar');
    await notification.populate('course', 'name code');

    res.status(201).json(notification);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;