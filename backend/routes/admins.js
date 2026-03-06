const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
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
} = require('../controllers/adminController');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/:adminId', getAdminProfile);
router.get('/:adminId/students', getAllStudents);
router.delete('/:adminId/students/:studentId', deleteStudent);

router.post('/:adminId/books', upload.single('bookPdf'), uploadBook);
router.get('/:adminId/books', getAllBooks);
router.delete('/:adminId/books/:bookId', deleteBook);

router.post('/:adminId/trigger-call', triggerManualCall);

router.get('/:adminId/export-reports', exportStudentReports);
router.get('/:adminId/audit-sessions', auditAiSessions);
router.get('/:adminId/teachers', getAllTeachers);
router.delete('/:adminId/teachers/:teacherId', deleteTeacher);
router.get('/:adminId/backup', backupData);

module.exports = router;
