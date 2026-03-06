const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  subject: String,
  chapter: String,
  summary: String,
  questionsAsked: [String],
  score: Number,
});

const noteSchema = new mongoose.Schema({
  topic: { type: String, default: 'GENERAL' },
  points: [String],
  savedAt: { type: Date, default: Date.now },
});

const studentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  class: { type: String, default: '' },
  language: { type: String, default: 'english', enum: ['english', 'tamil'] },
  weakTopics: [String],
  masteredTopics: [String],
  sessionHistory: [sessionSchema],
  notes: [noteSchema],
  lastSubject: { type: String, default: '' },
  lastChapter: { type: String, default: '' },
  feedback: [{
    message: String,
    teacherId: String,
    read: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
  phoneNumber: { type: String, default: '' },
});

module.exports = mongoose.model('Student', studentSchema);
