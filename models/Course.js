import mongoose from "mongoose";

const attendanceRecordSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ["present", "absent"], default: "absent" },
  timestamp: { type: Date, default: Date.now },
  photoURL: String,
  location: { lat: Number, lng: Number },
});

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  code: { type: String, required: true, unique: true },

staff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],


  attendanceEnabled: { type: Boolean, default: false },
  locationEnabled: { type: Boolean, default: false },
  location: { lat: Number, lng: Number },

  attendanceRecords: [attendanceRecordSchema],
}, { timestamps: true });

export default mongoose.model("Course", courseSchema);
