import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  subject: { type: String, required: true },
  latitude: { type: Number, default: 0 },
  longitude: { type: Number, default: 0 },
  radius: { type: Number, default: 100 },
  active: { type: Boolean, default: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  attendance: [
    {
      student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
      status: { type: String, default: "Present" },
      markedAt: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });



export default mongoose.model("AttendanceSession", attendanceSchema);

