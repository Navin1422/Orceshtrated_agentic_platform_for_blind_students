const Admin = require('../models/Admin');
const Student = require('../models/Student');
const BookFile = require('../models/BookFile');
const mongoose = require('mongoose');
const { Readable } = require('stream');
const { makeInactivityCall } = require('../services/twilioService');

// @route  GET /api/admins/:adminId
// @desc   Get admin profile
const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.params.adminId;
    let admin = await Admin.findOne({ adminId });
    if (!admin) {
      admin = new Admin({
        adminId: adminId || 'A001',
        name: 'Administrator',
        email: 'admin@eduvoice.com'
      });
      await admin.save();
    }
    res.json({ admin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/admins/:adminId/students
// @desc   Get all students
const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find({}).sort({ createdAt: -1 });
    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  DELETE /api/admins/:adminId/students/:studentId
// @desc   Delete a student
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ studentId: req.params.studentId });
    if (!student) {
      // Also try by Mongo _id if needed
      await Student.findByIdAndDelete(req.params.studentId);
    }
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  POST /api/admins/:adminId/books
// @desc   Upload a book PDF
const uploadBook = async (req, res) => {
  try {
    const { title, subject, class: bookClass } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    const admin = await Admin.findOne({ adminId: req.params.adminId });

    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'textbooks' });

    const readableTrackStream = new Readable();
    readableTrackStream.push(req.file.buffer);
    readableTrackStream.push(null);

    const uploadStream = bucket.openUploadStream(req.file.originalname);
    readableTrackStream.pipe(uploadStream);

    uploadStream.on('error', (error) => {
      console.error('GridFS Upload Error:', error);
      return res.status(500).json({ error: 'Failed to upload book to GridFS' });
    });

    uploadStream.on('finish', async () => {
      const book = new BookFile({
        filename: title || req.file.originalname,
        subject: subject || 'General',
        class: bookClass || 'All',
        gridFsId: uploadStream.id,
        uploadedBy: admin ? admin.name : 'Admin'
      });
      await book.save();

      res.status(201).json({ message: 'Book uploaded successfully', book });
    });
  } catch (error) {
    console.error('Upload Book Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/admins/:adminId/books
// @desc   Get all uploaded books
const getAllBooks = async (req, res) => {
  try {
    const books = await BookFile.find({}).sort({ uploadDate: -1 });
    res.json({ books });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  DELETE /api/admins/:adminId/books/:bookId
// @desc   Delete a book
const deleteBook = async (req, res) => {
  try {
    const book = await BookFile.findById(req.params.bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'textbooks' });

    if (book.gridFsId) {
      try {
        await bucket.delete(book.gridFsId);
      } catch (err) {
        console.log('File not found in GridFS, continuing to delete book record...');
      }
    }

    await BookFile.findByIdAndDelete(req.params.bookId);
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const triggerManualCall = async (req, res) => {
  try {
    const targetNumber = process.env.TWILIO_TARGET_NUMBER || '+917708566849';
    console.log(`Admin ${req.params.adminId} triggered a manual call to ${targetNumber}`);
    
    await makeInactivityCall(targetNumber);
    
    res.json({ message: `Call initiated to ${targetNumber}` });
  } catch (error) {
    console.error('Manual trigger call error:', error);
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/admins/:adminId/export-reports
// @desc   Export all student reports
const exportStudentReports = async (req, res) => {
  try {
    const students = await Student.find({});
    const reports = students.map(s => {
        const scores = s.sessionHistory?.map(sh => sh.score).filter(sc => sc !== undefined) || [];
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : 0;
        return {
            name: s.name,
            studentId: s.studentId,
            class: s.class,
            avgScore,
            sessionsCount: s.sessionHistory?.length || 0,
            weakTopics: s.weakTopics?.join(', ') || 'None',
            masteredTopics: s.masteredTopics?.join(', ') || 'None'
        };
    });
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/admins/:adminId/audit-sessions
// @desc   Audit all AI sessions
const auditAiSessions = async (req, res) => {
  try {
    const BrixbeeLog = require('../models/BrixbeeLog');
    const logs = await BrixbeeLog.find({}).sort({ timestamp: -1 }).limit(500);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/admins/:adminId/teachers
// @desc   Get all teachers
const getAllTeachers = async (req, res) => {
  try {
    const Teacher = require('../models/Teacher');
    const teachers = await Teacher.find({}).sort({ createdAt: -1 });
    res.json({ teachers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  DELETE /api/admins/:adminId/teachers/:teacherId
// @desc   Delete a teacher
const deleteTeacher = async (req, res) => {
  try {
    const Teacher = require('../models/Teacher');
    await Teacher.findOneAndDelete({ teacherId: req.params.teacherId });
    res.json({ message: 'Teacher removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/admins/:adminId/backup
// @desc   Backup all critical system data
const backupData = async (req, res) => {
  try {
    const Teacher = require('../models/Teacher');
    const Assessment = require('../models/Assessment');
    
    const data = {
        students: await Student.find({}),
        teachers: await Teacher.find({}),
        books: await BookFile.find({}),
        assessments: await Assessment.find({}),
        backupDate: new Date()
    };
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAdminProfile,
  getAllStudents,
  deleteStudent,
  uploadBook,
  getAllBooks,
  deleteBook,
  triggerManualCall,
  exportStudentReports,
  auditAiSessions,
  getAllTeachers,
  deleteTeacher,
  backupData
};
