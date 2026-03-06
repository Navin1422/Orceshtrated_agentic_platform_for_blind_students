const express = require('express');
const router = express.Router();
const { chat, endSession, logInteraction, pdfChat, agentChat, brixbeeChat, getSessionInfo } = require('../controllers/aiController');

// POST /api/ai/chat - Legacy AI teacher (prompt-based)
router.post('/chat', chat);

// POST /api/ai/session-end - End and save session
router.post('/session-end', endSession);

// POST /api/ai/log - Log Brixbee desktop interactions
router.post('/log', logInteraction);

// POST /api/ai/pdf-chat - PDF-powered Q&A (legacy fallback)
router.post('/pdf-chat', pdfChat);

// ─── LangGraph Agent Routes ──────────────────────────────────────────────────

// POST /api/ai/agent-chat — LangGraph Akka Agent (Website AI Teacher)
//   Checkpointing ON: no history needed from frontend
//   Body: { message, studentId, classLevel, subject, chapterNumber, learningMode }
router.post('/agent-chat', agentChat);

// POST /api/ai/brixbee-chat — LangGraph Brixbee Agent (Desktop AI)
//   Body: { message, studentName, interactionType }
router.post('/brixbee-chat', brixbeeChat);

// GET /api/ai/session-info/:studentId — Query thread checkpoint state
//   Returns: { exists, messageCount, turnCount, studentProfile, currentChapter }
//   Frontend uses this to show "Session resumed — X messages in memory"
router.get('/session-info/:studentId', getSessionInfo);

module.exports = router;
