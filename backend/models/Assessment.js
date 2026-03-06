const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  class: { type: String, required: true },
  subject: { type: String, required: true },
  target: { type: String, required: true, enum: ['class', 'individual'] },
  targetStudentId: { type: String }, // Optional, used if target is 'individual'
  date: { type: Date, default: Date.now },
  pdfFileId: { type: mongoose.Schema.Types.ObjectId, required: true }, // GridFS file id for the PDF
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  completedBy: { type: Number, default: 0 },
  avgScore: { type: Number, default: 0 }
});

module.exports = mongoose.model('Assessment', assessmentSchema);
