const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getTeacherProfile,
  uploadAssessment,
  getAssessments,
  deleteAssessment,
  getClassAnalytics,
  submitFeedback,
  exportReports
} = require('../controllers/teacherController');

// Set up multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// GET /api/teachers/:teacherId
router.get('/:teacherId', getTeacherProfile);

// GET /api/teachers/:teacherId/assessments
router.get('/:teacherId/assessments', getAssessments);

// POST /api/teachers/:teacherId/assessments
router.post('/:teacherId/assessments', upload.single('assessmentPdf'), uploadAssessment);

// DELETE /api/teachers/:teacherId/assessments/:assessmentId
router.delete('/:teacherId/assessments/:assessmentId', deleteAssessment);

// GET /api/teachers/:teacherId/analytics
router.get('/:teacherId/analytics', getClassAnalytics);

// POST /api/teachers/:teacherId/feedback
router.post('/:teacherId/feedback', submitFeedback);

// GET /api/teachers/:teacherId/export
router.get('/:teacherId/export', exportReports);

module.exports = router;
