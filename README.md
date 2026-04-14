EduVoice is an innovative, AI-powered educational ecosystem designed specifically for blind children. By leveraging state-of-the-art Voice AI and Agentic Workflows, it transforms traditional Tamil Nadu textbooks into interactive, conversational learning experiences. 

---

## 🚀 Key Features

### 👩‍🏫 Meet "Akka" (The AI Teacher)
* **Warm & Culturally Nuanced:** Akka uses **Tanglish** (Tamil + English) and adopts the persona of an encouraging elder sister.
* **Textbook Integration:** Directly fetches content from specific chapters and pages of school textbooks.
* **Learning Modes:**
    * 📖 **Teaching:** Guided walkthroughs of subtopics.
    * ❓ **Doubt Clearing:** Instant answers to specific student questions.
    * 📝 **Assessment:** Quick, interactive quizzes to track progress.

### 🤖 Brixbee Companion
* **Desktop Assistant:** A Python-based companion that provides a physical/desktop presence for the AI.
* **Multimodal Learning:** Links physical interactions with digital learning content.

### 🛠️ Agentic Intelligence (MCP)
* **Standardized Protocol:** Uses **Model Context Protocol (MCP)** to intelligently browse textbooks and retrieve student profiles.
* **Smart Memory:** Maintains a sophisticated record of "weak topics" and "mastered concepts."

### 🔊 Voice-First Accessibility
* **Premium TTS:** Powered by ElevenLabs for human-like, expressive speech.
* **Interactive Speech:** Seamless student interaction through voice commands.
* **Inclusion First:** Optimized for screen readers and zero-UI voice navigation.

---

## 🏗️ Technical Architecture

The EduVoice ecosystem is built on a modular four-pillar architecture:

*   🌐 **Frontend:** `React + Vite` — Interactive dashboards for Students, Teachers, and Admins.
*   🧠 **Backend:** `Node.js + Express` — AI orchestration, MongoDB session storage, and PDF parsing.
*   🛠️ **MCP Server:** `MCP SDK` — Specialized agentic tools for textbook search and profile management.
*   🤖 **Desktop App:** `Python` — Low-latency voice companion and hardware integration.

---

## 🛠️ Setup Instructions

### Prerequisites
* **Node.js:** v18+
* **Python:** 3.10+
* **Database:** MongoDB Atlas Account
* **API Keys:** OpenRouter (Gemini 3 Flash), ElevenLabs, and Twilio.

### 1. Backend Setup
```bash
cd backend
npm install
# Create .env with OPENROUTER_API_KEY, MONGODB_URI, etc.
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
# Create .env with VITE_BACKEND_URL
npm run dev
```

### 3. MCP Server Setup
```bash
cd eduvoice-mcp
npm install
node index.js
```

### 4. Brixbee Desktop (Optional)
```bash
cd brixxbee_phase-1
pip install -r requirements.txt
python main.py
```

---

## 📊 Database Schema
EduVoice tracks:
*   **Students:** Profiles, weak topics, and session history.
*   **Textbooks:** Digitized content mapped to class and subject.
*   **Interaction Logs:** Detailed history for "Teacher Dashboard" observability.

---

## 🌈 Vision & Impact
In Tamil Nadu, many vision-impaired students face barriers in accessing modern digital learning tools. EduVoice bridges this gap by providing a **personalized AI tutor** that doesn't just read books, but **teaches concepts** with the warmth of a local mentor.

---

## 🤝 Contributing
We welcome contributions that improve accessibility, voice recognition in regional accents, and the expansion of the textbook database.

*Developed with ❤️ for the students of Tamil Nadu.*
