// models/Submission.js
import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  submissionType: {
    type: String,
    enum: ['file', 'text', 'link'],
    required: true
  },
  content: {
    text: String,
    link: String,
    files: [{
      filename: String,
      originalName: String,
      path: String,
      mimetype: String
    }]
  },
  status: {
    type: String,
    enum: ['submitted', 'graded', 'late'],
    default: 'submitted'
  },
  score: {
    type: Number,
    min: 0
  },
  feedback: {
    type: String
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  gradedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Ensure one submission per student per assignment
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

export default mongoose.model('Submission', submissionSchema);