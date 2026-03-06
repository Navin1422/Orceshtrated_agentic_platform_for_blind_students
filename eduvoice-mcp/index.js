/* 
  EduVoice MCP Server - Unified tools for Website AI (Akka) + Desktop Brixbee
  Path: /Users/navins/Documents/EduVoice_GCT 2/eduvoice-mcp/index.js
*/

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const twilio = require("twilio");
const envPath = path.join(__dirname, ".env");
require("dotenv").config({ path: envPath });

// Load Backend Models
const Student = require("../backend/models/Student");
const Textbook = require("../backend/models/Textbook");
const BrixbeeLog = require("../backend/models/BrixbeeLog");
const BookFile = require("../backend/models/BookFile");

// Initialise MCP Server
const server = new Server({
  name: "eduvoice-mcp",
  version: "2.0.0",
}, {
  capabilities: {
    tools: {},
    resources: {}
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TOOL DEFINITIONS
// Grouped into: Website (Akka) + Desktop Brixbee (shared MCP)
// ─────────────────────────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [

      // ── WEBSITE / AKKA TOOLS ──────────────────────────────────────────────

      {
        name: "get_student_profile",
        description: "[WEBSITE] Fetch student profile: name, class, weak topics, mastered topics, last active date, session history.",
        inputSchema: {
          type: "object",
          properties: {
            studentId: { type: "string", description: "The unique ID of the student (e.g. STU123)" }
          },
          required: ["studentId"]
        }
      },
      {
        name: "find_lesson_content",
        description: "[WEBSITE] Get context for a specific textbook chapter: content, subtopics, and vocabulary.",
        inputSchema: {
          type: "object",
          properties: {
            classLevel: { type: "string", description: "Class e.g. 5, 8, 10" },
            subject: { type: "string", description: "Subject name" },
            chapterNumber: { type: "number", description: "Chapter number" }
          },
          required: ["classLevel", "subject", "chapterNumber"]
        }
      },
      {
        name: "search_textbook_pdf",
        description: "[WEBSITE] Search for specific keywords or page numbers in the actual PDF textbook content.",
        inputSchema: {
          type: "object",
          properties: {
            classLevel: { type: "string" },
            subject: { type: "string" },
            query: { type: "string", description: "Search query or page number" }
          },
          required: ["classLevel", "subject", "query"]
        }
      },
      {
        name: "update_student_analytics",
        description: "[WEBSITE] Mark a topic as 'weak' or 'mastered' based on student performance.",
        inputSchema: {
          type: "object",
          properties: {
            studentId: { type: "string" },
            topic: { type: "string" },
            status: { type: "string", enum: ["weak", "mastered"] }
          },
          required: ["studentId", "topic", "status"]
        }
      },
      {
        name: "send_voice_reminder",
        description: "[WEBSITE] Trigger a Twilio voice call reminder to the student.",
        inputSchema: {
          type: "object",
          properties: {
            phoneNumber: { type: "string", description: "Recipient phone number" }
          },
          required: ["phoneNumber"]
        }
      },
      {
        name: "fetch_teacher_notes",
        description: "[WEBSITE] Fetch specific feedback or instructions left by a teacher for this student.",
        inputSchema: {
          type: "object",
          properties: {
            studentId: { type: "string" }
          },
          required: ["studentId"]
        }
      },
      {
        name: "save_session_summary",
        description: "[WEBSITE] Save a summary of the Akka learning session to student record.",
        inputSchema: {
          type: "object",
          properties: {
            studentId: { type: "string" },
            subject: { type: "string" },
            chapter: { type: "string" },
            summary: { type: "string" }
          },
          required: ["studentId", "subject", "chapter", "summary"]
        }
      },

      // ── DESKTOP BRIXBEE TOOLS ────────────────────────────────────────────

      {
        name: "brixbee_get_student_context",
        description: "[BRIXBEE] Fetch the linked student's profile for Brixbee desktop to provide personalized help. Uses studentName to lookup.",
        inputSchema: {
          type: "object",
          properties: {
            studentName: { type: "string", description: "Name of the student using Brixbee" }
          },
          required: ["studentName"]
        }
      },
      {
        name: "brixbee_ask_textbook",
        description: "[BRIXBEE] Get textbook answer for a subject question Brixbee was asked. Searches PDF and database.",
        inputSchema: {
          type: "object",
          properties: {
            question: { type: "string", description: "The question the student asked Brixbee" },
            subject: { type: "string", description: "Subject hint: math, science, english, social" },
            classLevel: { type: "string", description: "Class level of the student, e.g. 8" }
          },
          required: ["question", "subject"]
        }
      },
      {
        name: "brixbee_log_interaction",
        description: "[BRIXBEE] Log a Brixbee interaction (question + answer) to the database for teacher review.",
        inputSchema: {
          type: "object",
          properties: {
            studentName: { type: "string" },
            query: { type: "string" },
            response: { type: "string" },
            type: { type: "string", enum: ["teacher", "assistant", "pdf-teacher", "vision", "guardian"] }
          },
          required: ["query", "response", "type"]
        }
      },
      {
        name: "brixbee_sync_to_website",
        description: "[BRIXBEE] Sync a Brixbee interaction to the student's website profile (weak topics, session notes).",
        inputSchema: {
          type: "object",
          properties: {
            studentName: { type: "string" },
            topic: { type: "string", description: "Topic that was discussed" },
            understood: { type: "boolean", description: "Did the student seem to understand?" },
            notes: { type: "string", description: "Short description of what was covered" }
          },
          required: ["studentName", "topic", "understood"]
        }
      },
      {
        name: "brixbee_get_recent_website_session",
        description: "[BRIXBEE] Get what the student was last studying on the website so Brixbee can offer continuity.",
        inputSchema: {
          type: "object",
          properties: {
            studentName: { type: "string" }
          },
          required: ["studentName"]
        }
      }

    ]
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// TOOL EXECUTION
// ─────────────────────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {

      // ── WEBSITE TOOLS ─────────────────────────────────────────────────────

      case "get_student_profile": {
        const student = await Student.findOne({ studentId: args.studentId });
        if (!student) return { content: [{ type: "text", text: "Student not found." }], isError: true };
        return { content: [{ type: "text", text: JSON.stringify(student, null, 2) }] };
      }

      case "find_lesson_content": {
        const lesson = await Textbook.findOne({
          class: args.classLevel,
          subject: args.subject.toLowerCase(),
          chapterNumber: args.chapterNumber
        });
        if (!lesson) return { content: [{ type: "text", text: "Lesson content not found in database." }], isError: true };
        return { content: [{ type: "text", text: JSON.stringify(lesson, null, 2) }] };
      }

      case "search_textbook_pdf": {
        const bookFile = await BookFile.findOne({ class: args.classLevel, subject: args.subject.toLowerCase() });
        if (!bookFile || !bookFile.extractedTextPreview) {
          return { content: [{ type: "text", text: "No PDF text indexed for this subject/class." }], isError: true };
        }
        
        const text = bookFile.extractedTextPreview;
        const pageMatch = args.query.match(/page\s+(\d+)/i);
        if (pageMatch) {
          const pageNum = pageMatch[1];
          const marker = `\n${pageNum}\n`;
          const idx = text.indexOf(marker);
          if (idx !== -1) return { content: [{ type: "text", text: text.substring(idx, idx + 2000) }] };
        }
        
        const snippets = text.split("\n\n").filter(chunk => chunk.toLowerCase().includes(args.query.toLowerCase())).slice(0, 3);
        return { content: [{ type: "text", text: snippets.length ? snippets.join("\n---\n") : "No matching snippets found." }] };
      }

      case "update_student_analytics": {
        const student = await Student.findOne({ studentId: args.studentId });
        if (!student) return { content: [{ type: "text", text: "Student not found." }], isError: true };
        
        if (args.status === "weak" && !student.weakTopics.includes(args.topic)) {
          student.weakTopics.push(args.topic);
          student.masteredTopics = student.masteredTopics.filter(t => t !== args.topic);
        } else if (args.status === "mastered") {
          student.masteredTopics.push(args.topic);
          student.weakTopics = student.weakTopics.filter(t => t !== args.topic);
        }
        await student.save();
        return { content: [{ type: "text", text: `Successfully marked "${args.topic}" as ${args.status}.` }] };
      }

      case "send_voice_reminder": {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.calls.create({
          url: process.env.TWILIO_TWIML_URL || "http://demo.twilio.com/docs/voice.xml",
          to: args.phoneNumber,
          from: process.env.TWILIO_FROM_NUMBER
        });
        return { content: [{ type: "text", text: `Voice reminder sent to ${args.phoneNumber}` }] };
      }

      case "fetch_teacher_notes": {
        const student = await Student.findOne({ studentId: args.studentId });
        if (!student) return { content: [{ type: "text", text: "Student not found." }], isError: true };
        
        const feedback = student.feedback || [];
        if (feedback.length === 0) return { content: [{ type: "text", text: "No notes found from teachers." }] };
        return { content: [{ type: "text", text: JSON.stringify(feedback, null, 2) }] };
      }

      case "save_session_summary": {
        const student = await Student.findOne({ studentId: args.studentId });
        if (!student) return { content: [{ type: "text", text: "Student not found." }], isError: true };
        
        student.sessionHistory.push({
          date: new Date(),
          subject: args.subject,
          chapter: args.chapter,
          summary: args.summary
        });
        if (student.sessionHistory.length > 20) student.sessionHistory = student.sessionHistory.slice(-20);
        student.lastSubject = args.subject;
        student.lastChapter = args.chapter;
        await student.save();
        return { content: [{ type: "text", text: "Session summary saved successfully." }] };
      }

      // ── BRIXBEE TOOLS ────────────────────────────────────────────────────

      case "brixbee_get_student_context": {
        // Find by name (case-insensitive)
        const student = await Student.findOne({
          name: { $regex: new RegExp(args.studentName, "i") }
        });
        if (!student) {
          return { content: [{ type: "text", text: JSON.stringify({ found: false, message: "No student profile linked to this name." }) }] };
        }
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              found: true,
              studentId: student.studentId,
              name: student.name,
              class: student.class,
              weakTopics: student.weakTopics,
              masteredTopics: student.masteredTopics,
              lastSubject: student.lastSubject,
              lastChapter: student.lastChapter,
              lastActiveAt: student.lastActiveAt
            }, null, 2)
          }]
        };
      }

      case "brixbee_ask_textbook": {
        // Try DB first for specific lesson
        if (args.classLevel) {
          const lesson = await Textbook.findOne({
            class: args.classLevel,
            subject: args.subject.toLowerCase()
          });
          if (lesson) {
            const relevantContent = lesson.content ? lesson.content.substring(0, 2000) : "";
            const keyPoints = lesson.keyPoints ? lesson.keyPoints.join(", ") : "";
            return {
              content: [{
                type: "text",
                text: `TEXTBOOK SOURCE: "${lesson.title}" (Class ${args.classLevel} ${args.subject})\n\nCONTENT: ${relevantContent}\n\nKEY POINTS: ${keyPoints}`
              }]
            };
          }
        }

        // Try BookFile PDF text
        const bookFile = await BookFile.findOne({ subject: args.subject.toLowerCase() });
        if (bookFile && bookFile.extractedTextPreview) {
          const text = bookFile.extractedTextPreview;
          const qWords = args.question.toLowerCase().split(" ").filter(w => w.length > 3);
          const snippets = text.split("\n\n")
            .filter(chunk => qWords.some(w => chunk.toLowerCase().includes(w)))
            .slice(0, 3);
          if (snippets.length) {
            return {
              content: [{
                type: "text",
                text: `PDF SEARCH RESULTS:\n${snippets.join("\n---\n")}`
              }]
            };
          }
        }

        return {
          content: [{ type: "text", text: "No specific textbook content found. Use general knowledge to answer." }]
        };
      }

      case "brixbee_log_interaction": {
        const log = new BrixbeeLog({
          query: args.query,
          response: args.response,
          type: args.type
        });
        await log.save();
        return { content: [{ type: "text", text: "Interaction logged successfully." }] };
      }

      case "brixbee_sync_to_website": {
        const student = await Student.findOne({
          name: { $regex: new RegExp(args.studentName, "i") }
        });
        if (!student) {
          return { content: [{ type: "text", text: "Student profile not found. Sync skipped." }] };
        }

        // Update weak/mastered topics based on understanding
        if (!args.understood && !student.weakTopics.includes(args.topic)) {
          student.weakTopics.push(args.topic);
          if (student.weakTopics.length > 10) student.weakTopics.shift();
        } else if (args.understood && !student.masteredTopics.includes(args.topic)) {
          student.masteredTopics.push(args.topic);
          student.weakTopics = student.weakTopics.filter(t => t !== args.topic);
        }

        // Add Brixbee session note
        if (args.notes) {
          student.sessionHistory.push({
            date: new Date(),
            subject: args.topic,
            chapter: "Brixbee Desktop",
            summary: `[Brixbee] ${args.notes}`
          });
          if (student.sessionHistory.length > 20) student.sessionHistory = student.sessionHistory.slice(-20);
        }

        student.lastActiveAt = new Date();
        await student.save();
        return { content: [{ type: "text", text: `Synced to website profile for ${student.name}. Topic: ${args.topic} marked as ${args.understood ? "understood" : "needs review"}.` }] };
      }

      case "brixbee_get_recent_website_session": {
        const student = await Student.findOne({
          name: { $regex: new RegExp(args.studentName, "i") }
        });
        if (!student) {
          return { content: [{ type: "text", text: "No student profile found." }] };
        }

        const lastSession = student.sessionHistory[student.sessionHistory.length - 1];
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              lastSubject: student.lastSubject || "Not set",
              lastChapter: student.lastChapter || "Not set",
              lastSession: lastSession || null,
              weakTopics: student.weakTopics,
              class: student.class
            }, null, 2)
          }]
        };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

// Start MCP Server and Database
async function startServer() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) throw new Error("MONGODB_URI missing in .env");

    await mongoose.connect(MONGODB_URI, { dbName: 'eduvoice' });
    console.error("✅ Connected to MongoDB via MCP Server");

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🚀 EduVoice Unified MCP Server v2.0 started (Website + Brixbee)");
  } catch (err) {
    console.error("❌ MCP Server failed to start:", err);
  }
}

startServer();
