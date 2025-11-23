import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: { type: String, required: true, unique: true }, 
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  department: { type: String },
  year: { type: String },
  photo: { type: String },  // passport photo
});

export default mongoose.model("Student", studentSchema);
