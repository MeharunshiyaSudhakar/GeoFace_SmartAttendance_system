import mongoose from "mongoose";

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  department: { type: String },
  role: { type: String, default: "staff" }, // ✅ important
}, { timestamps: true });

export default mongoose.model("Staff", staffSchema);
