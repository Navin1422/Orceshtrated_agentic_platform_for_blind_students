const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const OpenAI = require('openai');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Textbook = require('../models/Textbook');

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY_GEMINI || process.env.OPENROUTER_API_KEY,
});

async function structureContent(rawText, subject, classLevel) {
  console.log(`Structuring content for ${subject} Class ${classLevel}...`);
  
  const sampleText = rawText.slice(0, 30000); // 30k chars for better coverage

  const prompt = `
    I have extracted text from a ${subject} textbook for Class ${classLevel} (Tamil Nadu State Board).
    Please analyze this text and extract at least 5 important chapters from it.
    For each chapter, provide:
    1. Chapter Number
    2. Chapter Title
    3. Comprehensive Summary (at least 6-10 long sentences)
    4. 6 Key Points
    5. 5 Vocabulary words with meanings
    
    Format the output as a JSON array of objects like this:
    [
      {
        "class": "${classLevel}",
        "subject": "${subject.toLowerCase()}",
        "chapterNumber": 1,
        "title": "...",
        "content": "...",
        "keyPoints": ["...", "..."],
        "vocabulary": [{"word": "...", "meaning": "..."}]
      }
    ]
    
    IMPORTANT: Normalize subject to "${subject.toLowerCase()}".
    RAW TEXT SAMPLE:
    ${sampleText}
  `;

  try {
    const completion = await openrouter.chat.completions.create({
      model: 'google/gemini-2.0-flash-001',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0].message.content;
    const result = JSON.parse(content);
    return Array.isArray(result) ? result : (result.chapters || result.data || Object.values(result).find(v => Array.isArray(v)) || []);
  } catch (err) {
    console.error(`Error structuring ${subject}:`, err.message);
    return [];
  }
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'eduvoice' });
    console.log('✅ Connected to MongoDB');

    const tempTextDir = path.join(__dirname, 'temp_text');
    const files = fs.readdirSync(tempTextDir).filter(f => f.endsWith('.txt'));

    for (const file of files) {
      const filePath = path.join(tempTextDir, file);
      
      let subject = 'unknown';
      if (file.toLowerCase().includes('science') && !file.toLowerCase().includes('social')) subject = 'science';
      else if (file.toLowerCase().includes('social')) subject = 'social';
      else if (file.toLowerCase().includes('math')) subject = 'maths';
      else if (file.toLowerCase().includes('english')) subject = 'english';

      console.log(`\n📄 Processing text for subject: ${subject}...`);
      const rawText = fs.readFileSync(filePath, 'utf8');
      const chapters = await structureContent(rawText, subject, '6');

      if (chapters.length > 0) {
        // Remove existing for this class/subject to avoid duplicates
        await Textbook.deleteMany({ class: '6', subject: subject.toLowerCase() });
        await Textbook.insertMany(chapters);
        console.log(`✅ Ingested ${chapters.length} chapters for ${subject}`);
      } else {
        console.log(`⚠️ No chapters extracted for ${subject}`);
      }
    }

    console.log('\n🎓 PDF Ingestion complete! Class 6 is now mastered.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

run();
