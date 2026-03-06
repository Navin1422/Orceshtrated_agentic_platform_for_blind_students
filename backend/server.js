const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { initCronJobs } = require('./services/cronJobs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Initialize Cron Jobs
initCronJobs();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));
app.use(express.json());

const path = require('path');

// Routes
app.use('/api/ai', require('./routes/ai'));
app.use('/api/students', require('./routes/students'));
app.use('/api/content', require('./routes/content'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/admins', require('./routes/admins'));

// Serve Frontend Static Files
const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'EduVoice backend is running 🎓' });
});

// TwiML Route for Voice Reminder
app.post('/api/twilio/voice-reminder', (req, res) => {
  res.type('text/xml');
  res.send(`
    <Response>
      <Say voice="alice">Hello! This is EduVoice. We missed you today! Please take some time to study and complete your lessons. Education is the key to your bright future. Happy learning!</Say>
      <Pause length="1"/>
      <Say voice="alice">Goodbye!</Say>
    </Response>
  `);
});

// For any other request, send index.html (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🎓 EduVoice Server running on http://localhost:${PORT}`);
  console.log(`📚 AI Teacher ready to help Tamil Nadu students!\n`);
});
