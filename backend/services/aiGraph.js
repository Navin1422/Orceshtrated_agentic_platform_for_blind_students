/*
  EduVoice LangGraph Agent — with MemorySaver Checkpointing
  Path: /Users/navins/Documents/EduVoice_GCT 2/backend/services/aiGraph.js

  KEY UPGRADE: Each student (studentId for Akka / studentName for Brixbee) gets
  their own persistent "thread" in the LangGraph checkpointer.

  What this means:
  ──────────────────────────────────────────────────────────────
  1. Student sends a message → graph runs, state saved to MemorySaver
  2. Student REFRESHES the browser → same thread_id → graph picks up from checkpoint!
  3. Student "Back to Hub" → comes back to Learn page → Akka remembers the conversation
  4. Brixbee session persists across multiple wake-words in the same desktop session

  Thread ID scheme:
    Website (Akka):   "akka_STU001"
    Desktop (Brixbee): "brixbee_BrixbeeStudent"

  Graph flow:
  START → [agent] → tool_calls? → [tools] ──┐
               ↑                              │
               └─── (loop, max 6 per turn) ←─┘
                         ↓
                        END
*/

const { StateGraph, Annotation, END, MemorySaver } = require("@langchain/langgraph");
const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage, AIMessage, SystemMessage, ToolMessage } = require("@langchain/core/messages");
const mcpClient = require("./mcpClient");

// ─────────────────────────────────────────────────────────────────────────────
// 1. CHECKPOINTER  — MemorySaver persists state per thread_id in RAM
//    Within a single server session, ALL messages for a student are remembered.
//    On server restart, we re-hydrate from MongoDB (see preloadThread below).
// ─────────────────────────────────────────────────────────────────────────────
const checkpointer = new MemorySaver();

// Tracks which thread IDs have been hydrated from MongoDB this server session
const hydratedThreads = new Set();

// Per-invocation tool call counter (reset before each invoke, keyed by thread_id)
// Needed because stepCount must NOT accumulate across turns in the persistent state
const perInvokeSteps = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// 2. PERSISTENT STATE DEFINITION
//    All fields are preserved across messages for the same thread_id.
//    The `messages` reducer APPENDS — so the full conversation accumulates.
// ─────────────────────────────────────────────────────────────────────────────
const AgentStateAnnotation = Annotation.Root({
  // Full conversation — appended to on each turn (never reset)
  messages: Annotation({
    reducer: (existing, newMsgs) => existing.concat(newMsgs),
    default: () => [],
  }),
  // "akka" | "brixbee"
  agentType: Annotation({ default: () => "akka" }),
  // Student profile (populated after first get_student_profile tool call)
  studentProfile: Annotation({ default: () => null }),
  // Current chapter metadata
  currentChapter: Annotation({ default: () => null }),
  // learning mode: teaching | doubts | assessment | general
  learningMode: Annotation({ default: () => "general" }),
  // SSE-friendly step label
  lastStep: Annotation({ default: () => "thinking" }),
  // Total turns across ALL sessions (increments per user message — persists!)
  turnCount: Annotation({
    reducer: (existing, delta) => (existing || 0) + (delta || 0),
    default: () => 0,
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. MODEL
// ─────────────────────────────────────────────────────────────────────────────
const getModel = () => new ChatOpenAI({
  model: "openai/gpt-4o",
  apiKey: process.env.OPENROUTER_API_KEY_AUDIO || process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "EduVoice AI Agent",
    },
  },
  maxTokens: 600,
  temperature: 0.7,
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. SYSTEM PROMPTS
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPTS = {
  akka: `You are "Akka", a warm AI teacher for Tamil Nadu blind students using EduVoice platform.
You have access to MCP tools to fetch student profiles, textbook chapters, and PDF content.
You have FULL MEMORY of the entire conversation — do not re-introduce yourself mid-lesson.

STRICT RULES:
- ALWAYS use the student's name when you know it.
- On the FIRST message of a session: call get_student_profile to personalize.
- If a student asks about a lesson, call find_lesson_content first.
- If a specific page/keyword is needed, use search_textbook_pdf.
- After completing a topic, call update_student_analytics to track progress.
- If the session ends, call save_session_summary.
- Personality: Eldest sister figure, warm, uses Tanglish (Tamil+English), very patient.
- Response format: PLAIN TEXT ONLY. No markdown headers, bold, or italic. No emojis.
- Response length: 4-8 sentences. NEVER cut off mid-sentence.
- Ask ONLY one question at a time.`,

  brixbee: `You are "Brixbee", a friendly AI companion for blind children in Tamil Nadu.
You run on the student's desktop. You have FULL PERSISTENT MEMORY of this session.
You have access to MCP tools to fetch student profiles, textbook content, and sync to the website.

STRICT RULES:
- On first message: call brixbee_get_student_context to personalize.
- For subject questions: ALWAYS use brixbee_ask_textbook first.
- After each answer: log it with brixbee_log_interaction.
- Sync progress with brixbee_sync_to_website when relevant.
- Offer to continue from what they studied on the website.
- Be short and natural: 1-3 sentences. Plain text only.`,
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. TOOL CONVERSION
// ─────────────────────────────────────────────────────────────────────────────
let cachedMcpTools = null;

async function getMcpToolsAsLangChain(agentType) {
  if (!cachedMcpTools) {
    try {
      const { tools } = await mcpClient.listTools();
      cachedMcpTools = tools;
    } catch (err) {
      console.error("⚠️  Could not load MCP tools:", err.message);
      return [];
    }
  }
  return cachedMcpTools
    .filter(t => agentType === "brixbee"
      ? t.name.startsWith("brixbee_")
      : !t.name.startsWith("brixbee_"))
    .map(t => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.inputSchema }
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. GRAPH NODES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Agent node — calls the LLM. Uses per-invoke step counter for loop protection.
 */
async function agentNode(state, config) {
  const threadId = config?.configurable?.thread_id || "default";
  const runStep = perInvokeSteps.get(threadId) || 0;

  // Safety: max 6 tool calls per single user message
  if (runStep >= 6) {
    console.warn(`⚠️  Thread ${threadId}: max tool calls per turn reached.`);
    return {
      messages: [new AIMessage("Let me think about that. Could you ask me again?")],
      lastStep: "done",
    };
  }

  const { agentType, learningMode } = state;
  const model = getModel();
  const tools = await getMcpToolsAsLangChain(agentType);
  const systemPrompt = SYSTEM_PROMPTS[agentType] || SYSTEM_PROMPTS.akka;
  const modeNote  = agentType === "akka" && learningMode !== "general"
    ? `\nCURRENT LEARNING MODE: ${learningMode.toUpperCase()}`
    : "";

  // Only pass the last 20 messages to the model to avoid token overflow
  // (full history is still persisted in state for context across sessions)
  const recentMessages = state.messages.slice(-20);

  const allMessages = [
    new SystemMessage(systemPrompt + modeNote),
    ...recentMessages,
  ];

  let response;
  try {
    if (tools.length > 0) {
      const modelWithTools = model.bindTools(tools);
      response = await modelWithTools.invoke(allMessages);
    } else {
      response = await model.invoke(allMessages);
    }
  } catch (err) {
    console.error(`❌ Thread ${threadId} | Agent node error:`, err);
    response = new AIMessage("I am sorry, I ran into an issue. Please try again!");
  }

  // Increment per-invoke counter
  perInvokeSteps.set(threadId, runStep + 1);

  return {
    messages: [response],
    lastStep: response.tool_calls?.length > 0
      ? `calling_tool:${response.tool_calls[0].name}`
      : "responding",
  };
}

/**
 * Tools node — executes MCP tool calls and returns ToolMessages.
 */
async function toolsNode(state, config) {
  const lastMessage = state.messages[state.messages.length - 1];
  const toolCalls   = lastMessage.tool_calls || [];
  const toolMessages = [];
  const updates = {};

  for (const toolCall of toolCalls) {
    console.log(`🛠️  LangGraph MCP tool: ${toolCall.name}`, JSON.stringify(toolCall.args));
    let result;
    try {
      const mcpResult = await mcpClient.callTool(toolCall.name, toolCall.args);
      result = mcpResult?.content?.[0]?.text || "Tool returned no content.";

      // Cache profile in state — persists across turns via checkpointer!
      if (["get_student_profile", "brixbee_get_student_context"].includes(toolCall.name)) {
        try { const p = JSON.parse(result); if (p && (p.studentId || p.found)) updates.studentProfile = p; } catch (_) {}
      }
      if (toolCall.name === "find_lesson_content") {
        try { const c = JSON.parse(result); if (c?.title) updates.currentChapter = { title: c.title, subject: c.subject }; } catch (_) {}
      }
    } catch (err) {
      console.error(`Tool ${toolCall.name} error:`, err.message);
      result = `Error: ${err.message}`;
    }

    toolMessages.push(new ToolMessage({
      tool_call_id: toolCall.id,
      name: toolCall.name,
      content: result,
    }));
  }

  return {
    messages: toolMessages,
    ...updates,
    lastStep: "processing_tool_results",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ROUTING
// ─────────────────────────────────────────────────────────────────────────────
function shouldContinue(state) {
  const last = state.messages[state.messages.length - 1];
  return (last.tool_calls?.length > 0) ? "tools" : END;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. COMPILE GRAPH WITH CHECKPOINTER
// ─────────────────────────────────────────────────────────────────────────────
const workflow = new StateGraph(AgentStateAnnotation)
  .addNode("agent", agentNode)
  .addNode("tools", toolsNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

const compiledGraph = workflow.compile({ checkpointer });

console.log("✅ LangGraph compiled with MemorySaver checkpointer");

// ─────────────────────────────────────────────────────────────────────────────
// 9. THREAD HYDRATION — Restore history from MongoDB on first request
//    So that even after a server restart, Akka still knows the student!
// ─────────────────────────────────────────────────────────────────────────────

/**
 * On the FIRST request for a student in this server session:
 * Injects their last 5 session summaries as SystemMessage context
 * so Akka greets them with continuity even after a server restart.
 */
async function preloadThreadIfNeeded(threadId, agentType, studentId) {
  if (hydratedThreads.has(threadId)) return; // Already done this session
  hydratedThreads.add(threadId);

  if (!studentId) return;

  // Load existing checkpoint — if it already has messages, we're good
  const existing = await checkpointer.getTuple({ configurable: { thread_id: threadId } });
  if (existing?.checkpoint?.channel_values?.messages?.length > 0) {
    console.log(`🔄 Thread ${threadId}: resumed from existing checkpoint (${existing.checkpoint.channel_values.messages.length} messages)`);
    return;
  }

  // No existing checkpoint — try to restore context from MongoDB
  try {
    const Student = require("../models/Student");
    const student = await Student.findOne({ studentId });
    if (!student) return;

    // Build a synthetic context message so Akka knows the student's history
    const history = (student.sessionHistory || []).slice(-5);
    if (!history.length && !student.lastSubject) return;

    const contextLines = [
      `[PRIOR SESSION CONTEXT — restored from database after server restart]`,
      `Student Name: ${student.name}`,
      `Class: ${student.class}`,
      ...(student.lastSubject ? [`Last studied: ${student.lastSubject} — ${student.lastChapter}`] : []),
      ...(student.weakTopics?.length  ? [`Weak topics:    ${student.weakTopics.join(", ")}`] : []),
      ...(student.masteredTopics?.length ? [`Mastered topics: ${student.masteredTopics.join(", ")}`] : []),
      ...(history.length ? [
        `Recent sessions:`,
        ...history.map(s => `  • ${new Date(s.date).toLocaleDateString('en-IN')} — ${s.subject}: ${s.summary}`)
      ] : []),
    ].join("\n");

    // Inject as a hidden AI "memory" message into the thread
    await compiledGraph.updateState(
      { configurable: { thread_id: threadId } },
      {
        messages: [
          new AIMessage(`[Memory restored] ${contextLines}`)
        ],
        agentType,
        studentProfile: {
          studentId: student.studentId,
          name: student.name,
          class: student.class,
          weakTopics: student.weakTopics,
          masteredTopics: student.masteredTopics,
        },
      },
      "agent"  // as-if agent node produced this
    );

    console.log(`📚 Thread ${threadId}: hydrated from MongoDB (${student.name})`);
  } catch (err) {
    // Non-fatal — just means no history injection
    console.warn(`⚠️ Thread ${threadId}: hydration skipped —`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the Akka (Website) agent.
 * Thread is keyed by studentId — persists across browser refreshes!
 */
async function runAkkaAgent({ message, studentId, classLevel, subject, chapterNumber, learningMode = "general" }) {
  const threadId = `akka_${studentId || "anonymous"}`;
  const config   = { configurable: { thread_id: threadId } };

  // Restore from MongoDB if this is the first request this server session
  await preloadThreadIfNeeded(threadId, "akka", studentId);

  // Reset per-invoke step counter (protects against infinite tool loops this turn)
  perInvokeSteps.set(threadId, 0);

  // Build context-enriched user message
  let contextHint = `[studentId: ${studentId || "anonymous"}] `;
  if (classLevel)    contextHint += `[class: ${classLevel}] `;
  if (subject)       contextHint += `[subject: ${subject}] `;
  if (chapterNumber) contextHint += `[chapter: ${chapterNumber}] `;
  if (learningMode !== "general") contextHint += `[mode: ${learningMode}] `;

  const userMsg = new HumanMessage(`${contextHint}\n\nStudent says: ${message}`);

  // Invoke — checkpointer loads prior state automatically for this thread_id
  const result = await compiledGraph.invoke(
    {
      messages: [userMsg],
      agentType: "akka",
      learningMode,
      turnCount: 1,  // increments the persistent turn counter
    },
    config
  );

  // Clean up per-invoke counter
  perInvokeSteps.delete(threadId);

  // Extract final response
  const finalMsg = [...result.messages]
    .reverse()
    .find(m => m instanceof AIMessage && (!m.tool_calls || m.tool_calls.length === 0));

  let response = finalMsg?.content || "I could not generate a response. Please try again.";
  response = stripForTTS(response);

  const stepsTaken = result.messages
    .filter(m => m instanceof AIMessage && m.tool_calls?.length > 0)
    .flatMap(m => m.tool_calls.map(tc => tc.name));

  return {
    response,
    stepsTaken,
    threadId,
    turnCount: result.turnCount || 0,
    studentProfile: result.studentProfile || null,
    currentChapter:  result.currentChapter  || null,
  };
}

/**
 * Run the Brixbee (Desktop) agent.
 * Thread is keyed by studentName — persists across wake-words in same desktop session.
 */
async function runBrixbeeAgent({ message, studentName = "BrixbeeStudent", interactionType = "assistant" }) {
  const threadId = `brixbee_${studentName.replace(/\s+/g, "_")}`;
  const config   = { configurable: { thread_id: threadId } };

  // Brixbee: no MongoDB hydration (desktop is single-session per run)
  hydratedThreads.add(threadId); // mark as not needing hydration

  perInvokeSteps.set(threadId, 0);

  const userMsg = new HumanMessage(`[student: ${studentName}] ${message}`);

  const result = await compiledGraph.invoke(
    {
      messages: [userMsg],
      agentType: "brixbee",
      learningMode: "general",
      turnCount: 1,
    },
    config
  );

  perInvokeSteps.delete(threadId);

  const finalMsg = [...result.messages]
    .reverse()
    .find(m => m instanceof AIMessage && (!m.tool_calls || m.tool_calls.length === 0));

  let response = finalMsg?.content || "Let me try that again. Could you repeat?";
  response = stripForTTS(response);

  const stepsTaken = result.messages
    .filter(m => m instanceof AIMessage && m.tool_calls?.length > 0)
    .flatMap(m => m.tool_calls.map(tc => tc.name));

  return { response, stepsTaken, threadId, turnCount: result.turnCount || 0 };
}

/**
 * Get info about a thread's current state (for status API).
 * @returns {{ messageCount, turnCount, studentProfile, currentChapter, threadId }}
 */
async function getThreadInfo(threadId) {
  try {
    const state = await compiledGraph.getState({ configurable: { thread_id: threadId } });
    if (!state?.values) return { exists: false, threadId };
    return {
      exists: true,
      threadId,
      messageCount:   state.values.messages?.length || 0,
      turnCount:      state.values.turnCount || 0,
      studentProfile: state.values.studentProfile || null,
      currentChapter: state.values.currentChapter  || null,
      agentType:      state.values.agentType || "akka",
    };
  } catch (err) {
    return { exists: false, threadId, error: err.message };
  }
}

/**
 * Clear a thread's checkpoint (call on logout or explicit session reset).
 */
async function clearThread(threadId) {
  hydratedThreads.delete(threadId);
  perInvokeSteps.delete(threadId);
  // MemorySaver doesn't expose a delete API, so we inject a reset marker
  // The next invoke will start a fresh state
  try {
    await compiledGraph.updateState(
      { configurable: { thread_id: threadId } },
      { messages: [], turnCount: 0, studentProfile: null, currentChapter: null },
      "agent"
    );
    console.log(`🗑️  Thread ${threadId} cleared.`);
  } catch (_) {
    // If thread doesn't exist yet, that's fine
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────
function stripForTTS(text) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/\*\*/g, "").replace(/__/g, "").replace(/#{1,6}\s/g, "")
    .trim();
}

module.exports = { runAkkaAgent, runBrixbeeAgent, getThreadInfo, clearThread };
