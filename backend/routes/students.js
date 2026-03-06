const express = require('express');
const router = express.Router();
const {
  createStudent,
  getStudent,
  updateStudent,
  getProgress,
    saveNotes,
    addFeedback,
    markFeedbackAsRead,
  } = require('../controllers/studentController');
  
  // POST /api/students - Create or find student
  router.post('/', createStudent);
  
  // GET /api/students/:id - Get student by studentId
  router.get('/:id', getStudent);
  
  // PUT /api/students/:id - Update student profile
  router.put('/:id', updateStudent);
  
  // GET /api/students/:id/progress - Get progress summary
  router.get('/:id/progress', getProgress);
  
  // POST /api/students/:id/notes - Save voice notes
  router.post('/:id/notes', saveNotes);
  
  // POST /api/students/:id/feedback - Add feedback
  router.post('/:id/feedback', addFeedback);
  
  // PUT /api/students/:id/feedback/read - Mark feedback as read
  router.put('/:id/feedback/read', markFeedbackAsRead);
  
  module.exports = router;
