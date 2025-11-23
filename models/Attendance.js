import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "AttendanceSession", required: true },
  status: { type: String, enum: ["Present", "Absent"], default: "Present" },
  locationVerified: { type: Boolean, default: false },
  faceVerified: { type: Boolean, default: false },
  markedAt: { type: Date, default: Date.now }
});

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
