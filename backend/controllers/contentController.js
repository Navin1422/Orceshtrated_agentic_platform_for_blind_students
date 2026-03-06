const Textbook = require('../models/Textbook');
const mongoose = require('mongoose');

const normalizeClass = (raw = '') => {
  const lower = raw.toString().toLowerCase().trim();
  const wordsToNumbers = {
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
    'first': '1', 'second': '2', 'third': '3', 'fourth': '4', 'fifth': '5',
    'sixth': '6', 'seventh': '7', 'eighth': '8', 'ninth': '9', 'tenth': '10'
  };
  
  for (const [word, num] of Object.entries(wordsToNumbers)) {
    if (lower.includes(word)) return num;
  }

  const match = lower.match(/\d+/);
  return match ? match[0] : lower;
};

// @route  GET /api/content/classes
// @desc   Get all available classes
const getClasses = async (req, res) => {
  try {
    const classes = await Textbook.distinct('class');
    res.json({ classes: classes.sort((a, b) => parseInt(a) - parseInt(b)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/content/:class/subjects
// @desc   Get subjects for a class
const getSubjects = async (req, res) => {
  try {
    const classVal = normalizeClass(req.params.class);
    console.log('Querying subjects for class:', classVal, '(raw:', req.params.class, ')');
    const subjects = await Textbook.distinct('subject', { class: classVal });
    console.log('Found subjects:', subjects);
    res.json({ class: classVal, subjects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/content/:class/:subject/chapters
// @desc   Get chapters list for class + subject
const getChapters = async (req, res) => {
  try {
    const classVal = normalizeClass(req.params.class);
    const chapters = await Textbook.find(
      { class: classVal, subject: req.params.subject.toLowerCase() },
      { chapterNumber: 1, title: 1, _id: 1 }
    ).sort({ chapterNumber: 1 });
    res.json({ class: req.params.class, subject: req.params.subject, chapters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/content/:class/:subject/:chapter
// @desc   Get full chapter content
const getChapter = async (req, res) => {
  try {
    const classVal = normalizeClass(req.params.class);
    const chapter = await Textbook.findOne({
      class: classVal,
      subject: req.params.subject.toLowerCase(),
      chapterNumber: parseInt(req.params.chapter),
    });

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    res.json({ chapter });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/content/pdf/:class/:subject
// @desc   Get full PDF for a subject
const getChapterPdf = async (req, res) => {
  try {
    const { class: classVal, subject } = req.params;
    const BookFile = mongoose.models.BookFile || mongoose.model('BookFile', new mongoose.Schema({ 
      filename: String, 
      subject: String, 
      class: String,
      gridFsId: mongoose.Schema.Types.ObjectId,
      extractedTextPreview: String 
    }, { collection: 'bookfiles' }));

    const bookFile = await BookFile.findOne({ class: classVal, subject: subject.toLowerCase() });
    
    if (!bookFile || !bookFile.gridFsId) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'textbooks' });
    
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${bookFile.filename}"`);
    
    const downloadStream = bucket.openDownloadStream(bookFile.gridFsId);
    
    downloadStream.on('error', (err) => {
      console.error('GridFS download error:', err);
      res.status(500).end();
    });
    
    downloadStream.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getClasses, getSubjects, getChapters, getChapter, getChapterPdf };
