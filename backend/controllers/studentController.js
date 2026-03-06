const Student = require('../models/Student');
const { v4: uuidv4 } = require('uuid');

// @route  POST /api/students
// @desc   Create new student or find by name
const createStudent = async (req, res) => {
  try {
    const { name, classLevel, class: classParam, language } = req.body;
    const finalClass = classLevel || classParam;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    // Check if student with same name exists (case-insensitive)
    let student = await Student.findOne({ name: new RegExp(`^${name}$`, 'i') });

    if (student) {
      // Return existing student
      return res.json({ student, isNew: false, message: `Welcome back, ${student.name}! 🎉` });
    }

    // Create new student
    const studentId = uuidv4();
    student = await Student.create({
      studentId,
      name: name.trim(),
      class: finalClass || '',
      language: language || 'english',
    });

    res.status(201).json({ student, isNew: true, message: `Hello ${student.name}! I am Akka, your AI teacher! 🌟` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/students/:id
// @desc   Get student profile by studentId
const getStudent = async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.id });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ student });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  PUT /api/students/:id
// @desc   Update student profile / memory
const updateStudent = async (req, res) => {
  try {
    const { name, classLevel, class: classParam, language, weakTopics, masteredTopics } = req.body;
    const finalClass = classLevel || classParam;
    const student = await Student.findOne({ studentId: req.params.id });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    if (name) student.name = name;
    if (finalClass) student.class = finalClass;
    if (language) student.language = language;
    if (weakTopics) student.weakTopics = weakTopics;
    if (masteredTopics) student.masteredTopics = masteredTopics;
    student.lastActiveAt = new Date();

    await student.save();
    res.json({ student });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/students/:id/progress
// @desc   Get student progress summary
const getProgress = async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.id });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const progress = {
      name: student.name,
      class: student.class,
      totalSessions: student.sessionHistory.length,
      weakTopics: student.weakTopics,
      masteredTopics: student.masteredTopics,
      lastSession: student.sessionHistory[student.sessionHistory.length - 1] || null,
      recentSessions: student.sessionHistory.slice(-5),
    };

    res.json({ progress });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  POST /api/students/:id/notes
// @desc   Save a voice-notes session for a student
const saveNotes = async (req, res) => {
  try {
    const { topic, points } = req.body;
    if (!points || !Array.isArray(points) || points.length === 0) {
      return res.status(400).json({ error: 'Points array is required' });
    }
    const student = await Student.findOneAndUpdate(
      { studentId: req.params.id },
      { $push: { notes: { topic: topic || 'GENERAL', points, savedAt: new Date() } } },
      { new: true }
    );
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Notes saved!', notes: student.notes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addFeedback = async (req, res) => {
  try {
    const { message, teacherId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const student = await Student.findOneAndUpdate(
      { studentId: req.params.id },
      { $push: { feedback: { message, teacherId: teacherId || 'T001', date: new Date() } } },
      { new: true }
    );
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Feedback sent!', feedback: student.feedback });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const markFeedbackAsRead = async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.id });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    student.feedback.forEach(f => { f.read = true; });
    await student.save();
    
    res.json({ message: 'Feedback marked as read', feedback: student.feedback });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createStudent, getStudent, updateStudent, getProgress, saveNotes, addFeedback, markFeedbackAsRead };
