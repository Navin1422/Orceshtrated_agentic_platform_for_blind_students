const mongoose = require('mongoose');

const bookFileSchema = new mongoose.Schema({
  filename: String,
  subject: String,
  class: String,
  gridFsId: mongoose.Schema.Types.ObjectId,
  extractedTextPreview: String,
  uploadedBy: String,
  uploadDate: { type: Date, default: Date.now }
}, { collection: 'bookfiles' });

module.exports = mongoose.models.BookFile || mongoose.model('BookFile', bookFileSchema);
