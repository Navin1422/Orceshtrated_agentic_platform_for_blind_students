const Teacher = require('../models/Teacher');
const Assessment = require('../models/Assessment');
const Student = require('../models/Student');
const mongoose = require('mongoose');
const { Readable } = require('stream');

// @route  GET /api/teachers/:teacherId
// @desc   Get teacher profile and their assigned students
const getTeacherProfile = async (req, res) => {
  try {
    const teacherId = req.params.teacherId;
    let teacher = await Teacher.findOne({ teacherId });
    if (!teacher) {
      // For mock purposes if teacher does not exist, let's create a default one
      teacher = new Teacher({
        teacherId: teacherId || 'T001',
        name: 'Mrs. Sharma',
        email: 'sharma@stmarys.edu',
        school: "St. Mary's High School",
        classes: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
        subjects: ['English', 'Science', 'Maths', 'History', 'Tamil']
      });
      await teacher.save();
    }

    // Get students matching teacher's classes
    const classNumbers = teacher.classes.map(c => c.replace('Class ', ''));
    const students = await Student.find({ class: { $in: classNumbers } });

    res.json({ teacher, students });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  POST /api/teachers/:teacherId/assessments
// @desc   Upload a new assessment
const uploadAssessment = async (req, res) => {
  try {
    const { title, class: assessmentClass, subject, target, targetStudentId } = req.body;
    const teacherId = req.params.teacherId;

    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    const teacher = await Teacher.findOne({ teacherId });
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'assessments' });

    const readableTrackStream = new Readable();
    readableTrackStream.push(req.file.buffer);
    readableTrackStream.push(null);

    const uploadStream = bucket.openUploadStream(req.file.originalname);
    readableTrackStream.pipe(uploadStream);

    uploadStream.on('error', (error) => {
      console.error('GridFS Upload Error:', error);
      return res.status(500).json({ error: 'Failed to upload file to GridFS' });
    });

    uploadStream.on('finish', async () => {
      const assessment = new Assessment({
        title,
        class: assessmentClass,
        subject,
        target,
        targetStudentId: target === 'individual' ? targetStudentId : undefined,
        pdfFileId: uploadStream.id,
        teacherId: teacher._id
      });
      await assessment.save();

      res.status(201).json({ message: 'Assessment uploaded successfully', assessment });
    });

  } catch (error) {
    console.error('Upload Assessment Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/teachers/:teacherId/assessments
// @desc   Get all assessments uploaded by the teacher
const getAssessments = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ teacherId: req.params.teacherId });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const assessments = await Assessment.find({ teacherId: teacher._id }).sort({ date: -1 });
    res.json({ assessments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  DELETE /api/teachers/:teacherId/assessments/:assessmentId
// @desc   Delete an assessment
const deleteAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'assessments' });

    // Delete file from GridFS
    try {
      await bucket.delete(assessment.pdfFileId);
    } catch (err) {
      console.log('File not found in GridFS, continuing to delete assessment record...');
    }

    await Assessment.findByIdAndDelete(req.params.assessmentId);

    res.json({ message: 'Assessment deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/teachers/:teacherId/analytics
// @desc   Get class analytics data
const getClassAnalytics = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ teacherId: req.params.teacherId });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const classNumbers = teacher.classes.map(c => c.replace('Class ', ''));
    const students = await Student.find({ class: { $in: classNumbers } });

    // Aggregating analytics
    let totalSessions = 0;
    const subjectAveraged = {};
    const weakTopicFrequency = {};
    const masteredTopicFrequency = {};

    students.forEach(student => {
      student.sessionHistory.forEach(session => {
        totalSessions++;
        if (!subjectAveraged[session.subject]) subjectAveraged[session.subject] = { sum: 0, count: 0 };
        subjectAveraged[session.subject].sum += session.score || 0;
        subjectAveraged[session.subject].count++;
      });

      student.weakTopics.forEach(t => { weakTopicFrequency[t] = (weakTopicFrequency[t] || 0) + 1; });
      student.masteredTopics.forEach(t => { masteredTopicFrequency[t] = (masteredTopicFrequency[t] || 0) + 1; });
    });

    const analytics = {
      totalStudents: students.length,
      totalSessions,
      subjectPerformance: Object.keys(subjectAveraged).map(sub => ({
        subject: sub,
        avg: Math.round(subjectAveraged[sub].sum / subjectAveraged[sub].count)
      })),
      topWeakTopics: Object.entries(weakTopicFrequency).sort((a,b) => b[1] - a[1]).slice(0, 5).map(x => x[0]),
      topMasteredTopics: Object.entries(masteredTopicFrequency).sort((a,b) => b[1] - a[1]).slice(0, 5).map(x => x[0]),
    };

    res.json({ message: 'Analytics generated', status: 'success', analytics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  POST /api/teachers/:teacherId/feedback
// @desc   Submit voice feedback or general feedback (broadcast)
const submitFeedback = async (req, res) => {
  try {
    const { message, targetClass, targetStudentId } = req.body;
    const teacher = await Teacher.findOne({ teacherId: req.params.teacherId });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    if (targetClass) {
        // Broadcast feedback to all students in a class
        const classNum = targetClass.replace('Class ', '');
        await Student.updateMany(
            { class: classNum },
            { $push: { feedback: { message, teacherId: teacher.teacherId, date: new Date(), read: false } } }
        );
    } else if (targetStudentId) {
        // Send feedback to a specific student (by studentId or _id)
        const student = await Student.findOne({ 
            $or: [
                { studentId: targetStudentId },
                { _id: mongoose.isValidObjectId(targetStudentId) ? targetStudentId : undefined }
            ].filter(q => Object.values(q)[0] !== undefined)
        });
        
        if (student) {
            student.feedback.push({ message, teacherId: teacher.teacherId, date: new Date(), read: false });
            await student.save();
        } else {
            return res.status(404).json({ error: 'Target student not found' });
        }
    }

    res.json({ message: 'Feedback recorded successfully', status: 'success' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/teachers/:teacherId/export
// @desc   Export notes/reports
const exportReports = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ teacherId: req.params.teacherId });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const classNumbers = teacher.classes.map(c => c.replace('Class ', ''));
    const students = await Student.find({ class: { $in: classNumbers } });

    const reportData = students.map(s => ({
        name: s.name,
        studentId: s.studentId,
        class: s.class,
        avgScore: s.sessionHistory.length > 0 
            ? Math.round(s.sessionHistory.reduce((a,b) => a + (b.score || 0), 0) / s.sessionHistory.length) 
            : 0,
        sessionsCount: s.sessionHistory.length,
        weakTopics: s.weakTopics.join(', '),
        masteredTopics: s.masteredTopics.join(', ')
    }));

    res.json({ message: 'Reports generated', status: 'success', reports: reportData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getTeacherProfile,
  uploadAssessment,
  getAssessments,
  deleteAssessment,
  getClassAnalytics,
  submitFeedback,
  exportReports
};
