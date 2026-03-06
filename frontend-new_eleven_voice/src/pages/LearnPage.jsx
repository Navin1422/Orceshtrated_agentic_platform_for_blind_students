import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudent } from '../context/StudentContext';
import { VoiceContext } from '../context/VoiceContext';
import { sendMessage, endSession } from '../services/api';
import axios from 'axios';
import '../styles/index.css';


const LearnPage = () => {
    const navigate = useNavigate();
    const { 
        student, selectedClass, selectedSubject, selectedChapter, 
        addMessage, chatHistory, setChatHistory 
    } = useStudent();
    
    const { 
        speak, listen, isListening, isSpeaking, transcript 
    } = useContext(VoiceContext);

    const [textInput, setTextInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [learningMode, setLearningMode] = useState(null);
    const [graphStep, setGraphStep] = useState('');
    const [toolsUsed, setToolsUsed] = useState([]);
    const [sessionInfo, setSessionInfo] = useState(null);   // LangGraph checkpoint info
    const [showResumeBanner, setShowResumeBanner] = useState(false);
    const chatEndRef = useRef(null);
    const hasGreeted = useRef(null);
    const isFirstMessage = useRef(true);

    const TOOL_LABELS = {
        get_student_profile:       'Fetching your profile...',
        find_lesson_content:       'Loading chapter content...',
        search_textbook_pdf:       'Searching textbook PDF...',
        update_student_analytics:  'Updating your progress...',
        save_session_summary:      'Saving session...',
        fetch_teacher_notes:       'Checking teacher notes...',
    };

    // On mount: query LangGraph checkpoint — did this student have a prior session?
    useEffect(() => {
        if (!student?.studentId) return;
        axios.get(`/api/ai/session-info/${student.studentId}`)
            .then(res => {
                const info = res.data;
                setSessionInfo(info);
                if (info.exists && info.messageCount > 2) {
                    setShowResumeBanner(true);
                    // Auto-hide after 5 seconds
                    setTimeout(() => setShowResumeBanner(false), 5000);
                }
            })
            .catch(() => {}); // Silent fail if backend not ready
    }, [student?.studentId]);

    // Auto-scroll to newest message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isThinking]);

    // Greet and ask for mode choice when chapter loads
    useEffect(() => {
        if (selectedChapter && chatHistory.length === 0 && hasGreeted.current !== selectedChapter._id) {
            const greet = `Vanakkam ${student?.name || 'dear'}! We are in Chapter ${selectedChapter.chapterNumber}: "${selectedChapter.title}". 
            I am Akka, and Brixbee is here too! 
            How would you like to learn today? 
            Would you like me to "Teach you concepts", "Clear your doubts", or "Take a practice test"?`;
            
            addMessage('teacher', greet);
            speak(greet, () => {
                setLearningMode('choice');
                startVoiceInput();
            });
            hasGreeted.current = selectedChapter._id;
        }
    }, [selectedChapter]);

    const startVoiceInput = () => {
        listen((res) => {
            const text = res.trim().toLowerCase();
            if (!text) return;

            if (learningMode === 'choice') {
                if (text.includes('teach') || text.includes('concept') || text.includes('learn')) {
                    handleModeSelect('teaching');
                    return;
                }
                if (text.includes('doubt') || text.includes('clear') || text.includes('question')) {
                    handleModeSelect('doubts');
                    return;
                }
                if (text.includes('test') || text.includes('practice') || text.includes('assessment')) {
                    handleModeSelect('assessment');
                    return;
                }
            }

            if (/^(go )?home$/i.test(text) || /^dashboard$/i.test(text)) {
                navigate('/student');
                return;
            }

            handleSend(text);
        });
    };

    const handleModeSelect = (mode) => {
        setLearningMode(mode);
        const modeMsgs = {
            teaching: "Wonderful! I will teach you the concepts. Let me tell you the subtopics we have in this lesson from our database.",
            doubts: "Sure! I am here to clear any doubts. What is confusing you in this lesson?",
            assessment: "Great! Let's see how much you have learned. I will ask you some questions one by one. Are you ready?"
        };
        const msg = modeMsgs[mode];
        addMessage('teacher', msg);
        speak(msg, () => {
            const instructionMsgs = {
                teaching: `I have chosen to learn concepts. Please list all subtopics from the Key Points of this lesson and ask me which one I want to learn first.`,
                doubts: `I want to clear my doubts. Please ask me what specifically I am confused about in this lesson.`,
                assessment: `I want to take a practice test. Please start the assessment by asking the first question.`
            };
            handleSend(instructionMsgs[mode]);
        });
    };

    const handleSend = async (text) => {
        const msg = (text || textInput).trim();
        if (!msg || isThinking) return;
        setTextInput('');

        const isInstruction = msg.includes("Please list all subtopics") || 
                              msg.includes("Please ask me what specifically") ||
                              msg.includes("Please start the assessment");

        if (!isInstruction) addMessage('student', msg);
        
        setIsThinking(true);
        setGraphStep('Thinking...');
        setToolsUsed([]);

        try {
            const isNewSession = isFirstMessage.current;
            isFirstMessage.current = false;

            // No history in payload — LangGraph checkpointer manages the full conversation!
            const payload = {
                studentId:     student?.studentId,
                message:       msg,
                classLevel:    selectedClass,
                subject:       selectedSubject,
                chapterNumber: selectedChapter?.chapterNumber,
                learningMode:  learningMode,
                isNewSession,
            };

            if (student?.studentId) setGraphStep('Fetching your profile...');
            
            const res = await sendMessage(payload);
            const reply     = res.data.response;
            const usedTools = res.data.toolsUsed || [];
            const turnCount = res.data.turnCount || 0;

            if (usedTools.length > 0) {
                setToolsUsed(usedTools);
                const lastTool = usedTools[usedTools.length - 1];
                setGraphStep(TOOL_LABELS[lastTool] || `Used: ${lastTool}`);
            }

            // Update local session info display
            setSessionInfo(prev => ({ ...prev, exists: true, turnCount }));

            addMessage('teacher', reply);
            setIsThinking(false);
            setGraphStep('');

            speak(reply, () => {
                if (['teaching', 'doubts', 'assessment'].includes(learningMode)) {
                    startVoiceInput();
                }
            });
        } catch (err) {
            console.error(err);
            const errMsg = 'Oops! I had a small problem. Please try again!';
            addMessage('teacher', errMsg);
            setIsThinking(false);
            setGraphStep('');
            speak(errMsg);
        }
    };

    const handleEndSession = async () => {
        if (student?.studentId && selectedChapter) {
            try {
                await endSession({
                    studentId:    student.studentId,
                    subject:      selectedSubject,
                    chapter:      selectedChapter.chapterNumber,
                    chapterTitle: selectedChapter.title,
                    summary:      `Studied Chapter ${selectedChapter.chapterNumber}: ${selectedChapter.title}`,
                    clearGraph:   true,  // Clear LangGraph thread so next session starts fresh
                });
            } catch (e) { /* silent */ }
        }
        speak("Great class today! See you next time!", () => navigate('/student'));
    };

    const statusLabel = isSpeaking
        ? { icon: '📢', text: 'Speaking', color: '#065f46', bg: '#d1fae5', border: '#34d399' }
        : isListening
        ? { icon: '👂', text: 'Listening', color: '#1e40af', bg: '#dbeafe', border: '#60a5fa' }
        : isThinking
        ? { icon: '🤔', text: 'Thinking', color: '#92400e', bg: '#fef3c7', border: '#fbbf24' }
        : { icon: '🟢', text: 'Online', color: '#065f46', bg: '#d1fae5', border: '#34d399' };

    return (
        <div style={{ 
            display: 'flex', 
            height: '100vh', 
            width: '100vw', 
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            {/* ── SIDEBAR ── */}
            <aside style={{ 
                width: '380px',
                minWidth: '340px',
                borderRight: '1px solid #e2e8f0',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                padding: '1.5rem',
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                boxShadow: '2px 0 8px rgba(15,23,42,0.04)'
            }}>
                {/* Back Button */}
                <button 
                    onClick={handleEndSession}
                    style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1.25rem',
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.75rem',
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.15)',
                        letterSpacing: '0.025em'
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 12px -2px rgb(15 23 42 / 0.2)'; }}
                    onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(15 23 42 / 0.15)'; }}
                >
                    ← Back to Hub
                </button>

                {selectedChapter ? (
                    <>
                        {/* Chapter Info Card */}
                        <div style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            borderRadius: '1rem',
                            padding: '1.5rem',
                            color: 'white',
                            boxShadow: '0 10px 15px -3px rgb(59 130 246 / 0.25)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0,
                                height: '1px',
                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
                            }} />
                            <div style={{
                                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
                                textTransform: 'uppercase', opacity: 0.85, marginBottom: '0.5rem'
                            }}>
                                Chapter {selectedChapter.chapterNumber} · {selectedSubject?.toUpperCase()}
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                                {selectedChapter.title}
                            </h2>
                        </div>

                        {/* Lesson Content */}
                        <div style={{
                            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                            border: '1px solid #e2e8f0',
                            borderRadius: '1rem',
                            padding: '1.25rem',
                            boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.05)',
                            position: 'relative'
                        }}>
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0,
                                height: '1px',
                                background: 'linear-gradient(90deg, transparent, #cbd5e1, transparent)'
                            }} />
                            <h3 style={{
                                fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.05em',
                                textTransform: 'uppercase', color: '#475569', marginBottom: '1rem',
                                display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}>
                                <span>📖</span> Lesson Text
                            </h3>
                            <p style={{ 
                                fontSize: '0.9375rem', lineHeight: 1.6, color: '#374151',
                                maxHeight: '220px', overflowY: 'auto', fontWeight: 400,
                                marginBottom: '1rem', paddingRight: '0.5rem'
                            }}>
                                {selectedChapter.content}
                            </p>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {/* Read Aloud */}
                                <button
                                    onClick={() => speak(selectedChapter.content)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                        padding: '0.75rem 1rem',
                                        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                                        color: '#166534',
                                        border: '1px solid #86efac',
                                        borderRadius: '0.75rem',
                                        fontSize: '0.875rem', fontWeight: 700,
                                        cursor: 'pointer', width: '100%',
                                        transition: 'all 0.2s',
                                        letterSpacing: '0.025em'
                                    }}
                                    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 10px -3px rgb(22 163 74 / 0.2)'; }}
                                    onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                                >
                                    🔊 Read Aloud
                                </button>

                                {/* Two-column: View PDF + Take Notes */}
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                                    gap: '0.75rem',
                                    width: '100%' 
                                }}>
                                    <button
                                        onClick={() => window.open(`/api/content/pdf/${selectedClass}/${selectedSubject}`, '_blank')}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                            padding: '0.75rem 0.5rem',
                                            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                                            color: '#1e40af',
                                            border: '1px solid #93c5fd',
                                            borderRadius: '0.75rem',
                                            fontSize: '0.8125rem', fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            letterSpacing: '0.025em',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 10px -3px rgb(59 130 246 / 0.2)'; }}
                                        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                                    >
                                        📄 View PDF
                                    </button>
                                    <button
                                        onClick={() => navigate('/notes', {
                                            state: { topic: `${selectedSubject?.toUpperCase()} — ${selectedChapter?.title}` }
                                        })}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                            padding: '0.75rem 0.5rem',
                                            background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)',
                                            color: '#854d0e',
                                            border: '1px solid #fde047',
                                            borderRadius: '0.75rem',
                                            fontSize: '0.8125rem', fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            letterSpacing: '0.025em',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 10px -3px rgb(234 179 8 / 0.25)'; }}
                                        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                                    >
                                        📝 Take Notes
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Key Points */}
                        {selectedChapter.keyPoints?.length > 0 && (
                            <div style={{
                                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1rem',
                                padding: '1.5rem',
                                boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.05)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0,
                                    height: '1px',
                                    background: 'linear-gradient(90deg, transparent, #cbd5e1, transparent)'
                                }} />
                                <h3 style={{
                                    fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.05em',
                                    textTransform: 'uppercase', color: '#475569', marginBottom: '1rem',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                                }}>
                                    <span>⭐</span> Key Points
                                </h3>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                    {selectedChapter.keyPoints.map((kp, i) => (
                                        <li key={i} style={{ 
                                            padding: '0.75rem 1rem',
                                            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                            borderLeft: '3px solid #3b82f6',
                                            borderRadius: '0 0.5rem 0.5rem 0',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: '#1e293b',
                                            lineHeight: 1.5
                                        }}>
                                            {kp}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
                        <span style={{ fontSize: '3rem' }}>📚</span>
                        <h2 style={{ color: '#0f172a', fontWeight: 700 }}>No Lesson Selected</h2>
                        <button onClick={() => navigate('/student')} style={{
                            padding: '0.75rem 1.5rem', background: '#0f172a', color: 'white',
                            border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer'
                        }}>Go Select a Subject</button>
                    </div>
                )}
            </aside>

            {/* ── MAIN CHAT AREA ── */}
            <main style={{ 
                flex: 1,
                display: 'flex', 
                flexDirection: 'column',
                background: '#f1f5f9',
                minWidth: 0
            }}>
                {/* Chat Header */}
                <header style={{ 
                    padding: '1.25rem 2rem', 
                    borderBottom: '1px solid #e2e8f0',
                    background: 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(16px)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{
                            width: '42px', height: '42px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.25rem', boxShadow: '0 4px 6px -1px rgb(59 130 246 / 0.3)'
                        }}>🤖</div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', letterSpacing: '-0.01em' }}>
                                Akka &amp; Brixbee
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                                AI Learning Assistant
                            </div>
                        </div>
                    </div>

                    {/* Status badge */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.4rem 0.875rem',
                        background: statusLabel.bg,
                        border: `1px solid ${statusLabel.border}`,
                        color: statusLabel.color,
                        borderRadius: '2rem',
                        fontSize: '0.75rem', fontWeight: 700,
                        letterSpacing: '0.05em', textTransform: 'uppercase'
                    }}>
                        <span style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: statusLabel.border,
                            animation: (isListening || isSpeaking || isThinking) ? 'pulse 1.5s infinite' : 'none'
                        }} />
                        {statusLabel.icon} {statusLabel.text}
                    </div>
                </header>

                {/* Messages */}
                <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem'
                }}>
                    {/* ── LangGraph Session Resume Banner ── */}
                    {showResumeBanner && sessionInfo?.exists && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.875rem 1.25rem',
                            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                            border: '1px solid #86efac',
                            borderRadius: '0.875rem',
                            boxShadow: '0 4px 6px -1px rgb(22 163 74 / 0.12)',
                            animation: 'slideDown 0.4s ease',
                        }}>
                            <span style={{ fontSize: '1.5rem' }}>🔄</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#166534' }}>
                                    Session Resumed — Akka remembers you!
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.125rem' }}>
                                    {sessionInfo.messageCount} messages in memory · Turn #{sessionInfo.turnCount}
                                    {sessionInfo.currentChapter && ` · Last: ${sessionInfo.currentChapter.title}`}
                                </div>
                            </div>
                            <button
                                onClick={() => setShowResumeBanner(false)}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#166534', opacity: 0.6 }}
                            >✕</button>
                        </div>
                    )}

                    {/* ── LangGraph Thread Info (subtle persistent badge) ── */}
                    {sessionInfo?.exists && sessionInfo.turnCount > 0 && !showResumeBanner && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.375rem 0.75rem',
                            background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                            border: '1px solid #bfdbfe',
                            borderRadius: '2rem',
                            alignSelf: 'flex-start',
                            fontSize: '0.7rem', fontWeight: 700, color: '#1e40af',
                            letterSpacing: '0.04em'
                        }}>
                            🧠 Memory: Turn #{sessionInfo.turnCount} in checkpoint
                        </div>
                    )}

                    {/* Mode Selection Cards */}

                    {learningMode === 'choice' && (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                            <h2 style={{ 
                                fontSize: '1.5rem', fontWeight: 700, color: '#0f172a',
                                marginBottom: '0.5rem', letterSpacing: '-0.025em'
                            }}>Choose Your Study Mode</h2>
                            <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
                                How would you like to learn today?
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', maxWidth: '600px', margin: '0 auto' }}>
                                {[
                                    { mode: 'teaching', icon: '👩‍🏫', label: 'Teach Concepts', color: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
                                    { mode: 'doubts',   icon: '🤔',    label: 'Clear Doubts',   color: '#fef9c3', border: '#fde047', text: '#854d0e' },
                                    { mode: 'assessment', icon: '📝',  label: 'Practice Test',  color: '#d1fae5', border: '#86efac', text: '#166534' }
                                ].map(({ mode, icon, label, color, border, text }) => (
                                    <button
                                        key={mode}
                                        onClick={() => handleModeSelect(mode)}
                                        style={{
                                            padding: '1.5rem 1rem',
                                            background: `linear-gradient(135deg, white, ${color})`,
                                            border: `1px solid ${border}`,
                                            borderRadius: '1rem',
                                            cursor: 'pointer',
                                            display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', gap: '0.625rem',
                                            transition: 'all 0.25s',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                            color: text
                                        }}
                                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 20px -4px rgba(0,0,0,0.12)'; }}
                                        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; }}
                                    >
                                        <span style={{ fontSize: '2.25rem' }}>{icon}</span>
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.025em', textAlign: 'center' }}>{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Chat Messages */}
                    {chatHistory.map(msg => (
                        <div key={msg.id} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: msg.role === 'student' ? 'flex-end' : 'flex-start',
                            gap: '0.375rem'
                        }}>
                            <div style={{ 
                                fontSize: '0.6875rem', 
                                fontWeight: 700,
                                color: '#94a3b8',
                                letterSpacing: '0.075em',
                                textTransform: 'uppercase',
                                paddingLeft: msg.role === 'student' ? 0 : '0.25rem',
                                paddingRight: msg.role === 'student' ? '0.25rem' : 0
                            }}>
                                {msg.role === 'teacher' ? '🤖 Akka' : `👨‍🎓 ${student?.name || 'Student'}`}
                            </div>
                            <div style={{ 
                                padding: '1rem 1.25rem',
                                maxWidth: '78%',
                                background: msg.role === 'teacher' 
                                    ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                color: msg.role === 'teacher' ? '#1e293b' : 'white',
                                border: msg.role === 'teacher' ? '1px solid #e2e8f0' : 'none',
                                borderRadius: msg.role === 'teacher' 
                                    ? '0 1rem 1rem 1rem'
                                    : '1rem 0 1rem 1rem',
                                fontSize: '0.9375rem',
                                fontWeight: 500,
                                lineHeight: 1.65,
                                boxShadow: msg.role === 'teacher' 
                                    ? '0 4px 6px -1px rgb(15 23 42 / 0.06)'
                                    : '0 4px 6px -1px rgb(59 130 246 / 0.25)',
                                whiteSpace: 'pre-line'
                            }}>
                                {msg.text}
                            </div>
                        </div>
                    ))}

                    {/* LangGraph Thinking indicator with live step labels */}
                    {isThinking && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.075em', textTransform: 'uppercase', paddingLeft: '0.25rem' }}>
                                🤖 Akka
                            </div>
                            <div style={{
                                padding: '1rem 1.5rem',
                                background: 'linear-gradient(135deg, #fef9c3 0%, #fef3c7 100%)',
                                border: '1px solid #fde047',
                                borderRadius: '0 1rem 1rem 1rem',
                                fontSize: '0.9375rem', fontWeight: 600, color: '#854d0e',
                                display: 'flex', alignItems: 'center', gap: '0.625rem'
                            }}>
                                <span style={{ animation: 'pulse 1.5s infinite', display: 'inline-block' }}>🤔</span>
                                {graphStep || 'Thinking...'}
                            </div>
                            {/* LangGraph Step Pills */}
                            {toolsUsed.length > 0 && (
                                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', paddingLeft: '0.25rem' }}>
                                    {toolsUsed.map((tool, i) => (
                                        <span key={i} style={{
                                            fontSize: '0.6875rem', fontWeight: 700,
                                            padding: '0.2rem 0.6rem',
                                            background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                                            color: '#1e40af',
                                            border: '1px solid #93c5fd',
                                            borderRadius: '2rem',
                                            letterSpacing: '0.04em'
                                        }}>
                                            ⚙️ {tool.replace(/_/g, ' ')}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* ── FOOTER / INPUT BAR ── */}
                <footer style={{ 
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid #e2e8f0',
                    background: 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(16px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.875rem',
                    flexShrink: 0,
                    boxShadow: '0 -2px 8px rgba(15,23,42,0.06)'
                }}>
                    {/* Compact Mic Button */}
                    <button
                        onClick={() => isListening ? {} : startVoiceInput()}
                        title={isListening ? 'Listening...' : 'Start voice input'}
                        style={{
                            flexShrink: 0,
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.25rem',
                            cursor: isListening ? 'default' : 'pointer',
                            transition: 'all 0.25s ease',
                            position: 'relative',
                            background: isListening
                                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                            boxShadow: isListening
                                ? '0 0 0 4px rgba(239,68,68,0.2), 0 4px 6px -1px rgb(239 68 68 / 0.3)'
                                : '0 2px 4px rgba(15,23,42,0.1)',
                            animation: isListening ? 'micPulse 1.5s ease-in-out infinite' : 'none'
                        }}
                    >
                        {isListening ? '⏹' : '🎙️'}
                        {isListening && (
                            <span style={{
                                position: 'absolute',
                                inset: '-6px',
                                borderRadius: '50%',
                                border: '2px solid rgba(239,68,68,0.5)',
                                animation: 'ripple 1.2s ease-out infinite'
                            }} />
                        )}
                    </button>

                    
                    {/* Text Input */}
                    <input 
                        placeholder="Type a message or use voice..." 
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        style={{ 
                            flex: 1,
                            minWidth: 0,
                            padding: '0.75rem 1.25rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.75rem',
                            fontSize: '0.9375rem',
                            fontWeight: 500,
                            color: '#0f172a',
                            background: '#f8fafc',
                            outline: 'none',
                            transition: 'all 0.2s',
                            fontFamily: 'inherit',
                            boxShadow: '0 1px 3px rgba(15,23,42,0.06)'
                        }}
                        onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1), 0 1px 3px rgba(15,23,42,0.06)'; e.target.style.background = '#fff'; }}
                        onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = '0 1px 3px rgba(15,23,42,0.06)'; e.target.style.background = '#f8fafc'; }}
                    />

                    {/* Send Button */}
                    <button 
                        onClick={() => handleSend()}
                        disabled={!textInput.trim() || isThinking}
                        style={{
                            flexShrink: 0,
                            padding: '0.75rem 1.25rem',
                            background: textInput.trim() && !isThinking
                                ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                            color: textInput.trim() && !isThinking ? 'white' : '#94a3b8',
                            border: 'none',
                            borderRadius: '0.75rem',
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            cursor: textInput.trim() && !isThinking ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            letterSpacing: '0.025em',
                            display: 'flex', alignItems: 'center', gap: '0.375rem',
                            boxShadow: textInput.trim() && !isThinking 
                                ? '0 4px 6px -1px rgb(59 130 246 / 0.25)' 
                                : 'none',
                            whiteSpace: 'nowrap'
                        }}
                        onMouseOver={e => { if (textInput.trim() && !isThinking) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 12px -2px rgb(59 130 246 / 0.3)'; }}}
                        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = textInput.trim() && !isThinking ? '0 4px 6px -1px rgb(59 130 246 / 0.25)' : 'none'; }}
                    >
                        Send ➤
                    </button>
                </footer>
            </main>
        </div>
    );
};

export default LearnPage;
