import React, { useState, useEffect, useRef, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { VoiceContext } from '../context/VoiceContext';
import { useStudent } from '../context/StudentContext';
import { saveNotes } from '../services/api';
import '../styles/index.css';

const NotesPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { speak, listen, isListening } = useContext(VoiceContext);
    const { student } = useStudent();

    const topic = location.state?.topic || 'GENERAL LEARNING';
    const [notes, setNotes] = useState([]);
    const [status, setStatus] = useState('STARTING SESSION...');
    const [isSaved, setIsSaved] = useState(false);

    // useRef so finalizeNotes always sees the latest notes list (avoids stale closure)
    const notesRef = useRef([]);
    const flowStarted = useRef(false);

    // Keep ref in sync with state
    const addNote = (text) => {
        const timestamp = new Date().toLocaleTimeString();
        const entry = `${timestamp}: ${text}`;
        notesRef.current = [...notesRef.current, entry];
        setNotes([...notesRef.current]);
        return entry;
    };

    useEffect(() => {
        if (!flowStarted.current) {
            flowStarted.current = true;
            startNotesFlow();
        }
    }, []);

    // ─── Voice Flow ───────────────────────────────────────────────────────────

    const askForMoreNotes = () => {
        setStatus('LISTENING — continue or say "done"');
        speak(
            "Would you like to add another point? Say yes or continue to add more, or say done or no to finish.",
            () => {
                listen((ans) => {
                    const lower = ans.toLowerCase();
                    if (
                        lower.includes('yes') ||
                        lower.includes('add') ||
                        lower.includes('more') ||
                        lower.includes('continue')
                    ) {
                        captureNote();
                    } else {
                        finalizeNotes();
                    }
                });
            }
        );
    };

    const captureNote = () => {
        setStatus('🎤 LISTENING FOR YOUR NOTE...');
        speak("Please tell me your next point.", () => {
            listen((res) => {
                if (!res || !res.trim()) {
                    speak("I didn't catch that. Please try again.", captureNote);
                    return;
                }
                const entry = addNote(res.trim());
                setStatus(`NOTE CAPTURED: ${res.trim()}`);
                speak(`Got it. I noted: ${res}.`, askForMoreNotes);
            });
        });
    };

    const startNotesFlow = () => {
        setStatus('AI INTRO PLAYING...');
        const introText = `Welcome to your study notes for ${topic}. Let's capture what you learned today. Please tell me the first thing you remember from the lesson.`;
        speak(introText, () => {
            setStatus('🎤 LISTENING FOR YOUR FIRST NOTE...');
            listen((res) => {
                if (!res || !res.trim()) {
                    speak("I didn't hear that clearly. Please try again.", startNotesFlow);
                    return;
                }
                addNote(res.trim());
                setStatus(`NOTE CAPTURED: ${res.trim()}`);
                speak(`Great! I noted: ${res}.`, askForMoreNotes);
            });
        });
    };

    const downloadNotes = () => {
        const lines = [
            `STUDY NOTES — ${topic}`,
            `Generated: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
            `Total Points: ${notes.length}`,
            '',
            '─'.repeat(50),
            '',
            ...notes.map((note, i) => `${i + 1}. ${note}`),
            '',
            '─'.repeat(50),
            'EduVoice AI — Personalized Learning Platform'
        ];
        const content = lines.join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notes_${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const finalizeNotes = async () => {
        const currentNotes = notesRef.current; // always fresh
        const count = currentNotes.length;
        const summaryText =
            count > 0
                ? `Perfect! I have saved ${count} point${count !== 1 ? 's' : ''} for ${topic}. Great job today!`
                : `No notes were captured for ${topic}. You can try again anytime.`;

        setStatus(count > 0 ? `✅ ${count} NOTE${count !== 1 ? 'S' : ''} SAVED` : 'NO NOTES CAPTURED');
        speak(summaryText);

        // Persist to backend if we have notes and a student
        if (count > 0 && student?.studentId) {
            try {
                await saveNotes(student.studentId, {
                    topic,
                    points: currentNotes,
                });
                setIsSaved(true);
            } catch (err) {
                console.error('Failed to save notes to backend:', err);
            }
        } else {
            setIsSaved(count > 0); // Mark saved for display even without backend
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            {/* Premium Background */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.06), transparent 60%), radial-gradient(circle at 80% 20%, rgba(15, 23, 42, 0.04), transparent 60%)',
                filter: 'blur(80px)'
            }}></div>

            {/* Navigation */}
            <nav style={{
                padding: '1.5rem 3rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative',
                zIndex: 10,
                backdropFilter: 'blur(10px)',
                background: 'rgba(255, 255, 255, 0.8)',
                borderBottom: '1px solid rgba(226, 232, 240, 0.5)'
            }}>
                <div style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    letterSpacing: '-0.025em'
                }}>
                    <span style={{ fontSize: '2rem' }}>🎓</span>
                    <span>EduVoice AI</span>
                </div>
                <div style={{
                    display: 'flex',
                    gap: '0.75rem'
                }}>
                    <button
                        onClick={() => navigate('/learn')}
                        style={{
                            background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.75rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)',
                            letterSpacing: '0.025em'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)';
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 4px 6px -1px rgb(15 23 42 / 0.1)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 1px 3px 0 rgb(15 23 42 / 0.1)';
                        }}
                    >
                        ← Back to Lesson
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main style={{ 
                maxWidth: '1200px', 
                margin: '0 auto', 
                padding: '3rem 2rem',
                position: 'relative',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                {/* Header */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: '3rem'
                }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                        border: '1px solid #cbd5e1',
                        borderRadius: '2rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#475569',
                        marginBottom: '2rem',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase'
                    }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isSaved ? '#10b981' : '#f59e0b',
                            animation: isListening ? 'pulse 2s infinite' : 'none'
                        }}></span>
                        {isSaved ? '✅ SAVED TO PROFILE' : 'AI SESSION ACTIVE'}
                    </div>
                    
                    <h1 style={{
                        fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                        fontWeight: 800,
                        color: '#0f172a',
                        marginBottom: '1.5rem',
                        lineHeight: 1.1,
                        letterSpacing: '-0.05em',
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>
                        STUDY NOTES
                    </h1>
                    
                    <p style={{
                        fontSize: 'clamp(1.125rem, 2vw, 1.5rem)',
                        color: '#64748b',
                        marginBottom: '3rem',
                        lineHeight: 1.6,
                        fontWeight: 400,
                        letterSpacing: '-0.01em',
                        maxWidth: '600px',
                        margin: '0 auto 3rem auto'
                    }}>
                        Voice-powered note taking for {topic.toLowerCase()}
                    </p>
                </div>

                {/* Premium Voice Orb */}
                <div style={{
                    position: 'relative',
                    marginBottom: '3rem'
                }}>
                    <div style={{
                        width: '160px',
                        height: '160px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                        border: '2px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        animation: isListening ? 'pulse 2s infinite' : 'float 8s ease-in-out infinite',
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -6px rgb(0 0 0 / 0.1)'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '-30px',
                            left: '-30px',
                            right: '-30px',
                            bottom: '-30px',
                            borderRadius: '50%',
                            border: '1px solid #f1f5f9',
                            animation: 'rotate 25s linear infinite'
                        }}></div>
                        <div style={{
                            position: 'absolute',
                            top: '-50px',
                            left: '-50px',
                            right: '-50px',
                            bottom: '-50px',
                            borderRadius: '50%',
                            border: '1px solid #f8fafc',
                            animation: 'rotate 35s linear infinite reverse'
                        }}></div>
                        <span style={{
                            fontSize: '4rem',
                            filter: 'drop-shadow(0 4px 6px rgb(0 0 0 / 0.1))'
                        }}>
                            {isListening ? '🎤' : '📝'}
                        </span>
                    </div>
                </div>

                {/* Status line */}
                <p style={{ 
                    fontWeight: 700, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.1em', 
                    marginBottom: '3rem',
                    fontSize: '1rem',
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                }}>
                    <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isListening ? '#10b981' : '#f59e0b',
                        animation: isListening ? 'pulse 2s infinite' : 'none'
                    }}></span>
                    {isListening ? '🎤 LISTENING...' : status}
                </p>

                {/* Notes Card */}
                <div style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '1.5rem',
                    padding: '3rem',
                    width: '100%',
                    maxWidth: '900px',
                    boxShadow: '0 10px 15px -3px rgb(15 23 42 / 0.1), 0 4px 6px -4px rgb(15 23 42 / 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: 'linear-gradient(90deg, transparent, #cbd5e1, transparent)'
                    }}></div>
                    
                    <h2 style={{ 
                        fontSize: '2rem', 
                        fontWeight: 700,
                        color: '#0f172a',
                        marginBottom: '2rem',
                        letterSpacing: '-0.025em',
                        display: 'inline-block',
                        borderBottom: '3px solid #3b82f6',
                        paddingBottom: '0.5rem'
                    }}>
                        {topic.toUpperCase()}
                    </h2>

                    {notes.length > 0 ? (
                        <div style={{ textAlign: 'left' }}>
                            <h3 style={{ 
                                fontSize: '1.25rem', 
                                marginBottom: '1.5rem', 
                                fontWeight: 700,
                                color: '#0f172a',
                                letterSpacing: '-0.025em'
                            }}>
                                YOUR VOICE NOTES ({notes.length} points):
                            </h3>
                            {notes.map((note, index) => (
                                <div
                                    key={index}
                                    style={{
                                        marginBottom: '1rem',
                                        padding: '1.25rem 1.5rem',
                                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '0.75rem',
                                        boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(15 23 42 / 0.1)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 1px 3px 0 rgb(15 23 42 / 0.1)';
                                    }}
                                >
                                    <p style={{ 
                                        fontWeight: 600, 
                                        fontSize: '1rem',
                                        color: '#0f172a',
                                        margin: 0,
                                        letterSpacing: '0.025em'
                                    }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    marginRight: '0.75rem'
                                        }}>
                                            {index + 1}
                                        </span>
                                        {note}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                                border: '2px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem',
                                fontSize: '2rem',
                                boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.1)'
                            }}>
                                📝
                            </div>
                            <p style={{ 
                                fontSize: '1.25rem', 
                                fontWeight: 700, 
                                color: '#0f172a',
                                marginBottom: '0.75rem',
                                letterSpacing: '-0.025em'
                            }}>
                                READY TO CAPTURE VOICE NOTES...
                            </p>
                            <p style={{ 
                                fontSize: '1rem', 
                                marginTop: '0.5rem', 
                                color: '#64748b',
                                lineHeight: 1.6
                            }}>
                                Speak naturally and I'll record your learning points
                            </p>
                        </div>
                    )}
                </div>

                {/* Manual controls */}
                <div style={{ 
                    marginTop: '3rem', 
                    display: 'flex', 
                    gap: '1rem', 
                    flexWrap: 'wrap', 
                    justifyContent: 'center'
                }}>
                    {!isSaved && (
                        <>
                            <button 
                                onClick={captureNote} 
                                disabled={isListening}
                                style={{
                                    background: isListening 
                                        ? 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
                                        : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                    color: isListening ? '#94a3b8' : '#ffffff',
                                    border: 'none',
                                    padding: '1rem 2rem',
                                    borderRadius: '0.75rem',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    cursor: isListening ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: isListening 
                                        ? '0 1px 3px 0 rgb(15 23 42 / 0.1)'
                                        : '0 4px 6px -1px rgb(59 130 246 / 0.2)',
                                    letterSpacing: '0.025em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                                onMouseOver={(e) => {
                                    if (!isListening) {
                                        e.target.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 10px 15px -3px rgb(59 130 246 / 0.3)';
                                    }
                                }}
                                onMouseOut={(e) => {
                                    if (!isListening) {
                                        e.target.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = '0 4px 6px -1px rgb(59 130 246 / 0.2)';
                                    }
                                }}
                            >
                                <span>🎤</span>
                                ADD NOTE
                            </button>
                            <button
                                onClick={finalizeNotes}
                                disabled={isListening || notes.length === 0}
                                style={{
                                    background: (isListening || notes.length === 0)
                                        ? 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
                                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: (isListening || notes.length === 0) ? '#94a3b8' : '#ffffff',
                                    border: 'none',
                                    padding: '1rem 2rem',
                                    borderRadius: '0.75rem',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    cursor: (isListening || notes.length === 0) ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: (isListening || notes.length === 0)
                                        ? '0 1px 3px 0 rgb(15 23 42 / 0.1)'
                                        : '0 4px 6px -1px rgb(16 185 129 / 0.2)',
                                    letterSpacing: '0.025em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                                onMouseOver={(e) => {
                                    if (!isListening && notes.length > 0) {
                                        e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 10px 15px -3px rgb(16 185 129 / 0.3)';
                                    }
                                }}
                                onMouseOut={(e) => {
                                    if (!isListening && notes.length > 0) {
                                        e.target.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = '0 4px 6px -1px rgb(16 185 129 / 0.2)';
                                    }
                                }}
                            >
                                <span>✅</span>
                                DONE — SAVE NOTES
                            </button>
                        </>
                    )}
                    {/* Download — visible anytime notes exist */}
                    {notes.length > 0 && (
                        <button
                            onClick={downloadNotes}
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '1rem 2rem',
                                borderRadius: '0.75rem',
                                fontSize: '1rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 4px 6px -1px rgb(99 102 241 / 0.25)',
                                letterSpacing: '0.025em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgb(99 102 241 / 0.3)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(99 102 241 / 0.25)';
                            }}
                        >
                            <span>⬇️</span>
                            DOWNLOAD NOTES
                        </button>
                    )}
                    {isSaved && (
                        <button 
                            onClick={() => navigate('/student')} 
                            style={{
                                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '1rem 2rem',
                                borderRadius: '0.75rem',
                                fontSize: '1rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.1)',
                                letterSpacing: '0.025em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                            onMouseOver={(e) => {
                                e.target.style.background = 'linear-gradient(135deg, #1e293b 0%, #334155 100%)';
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 10px 15px -3px rgb(15 23 42 / 0.1)';
                            }}
                            onMouseOut={(e) => {
                                e.target.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 6px -1px rgb(15 23 42 / 0.1)';
                            }}
                        >
                            <span>🏠</span>
                            BACK TO DASHBOARD
                        </button>
                    )}
                </div>
            </main>
        </div>
    );
};

export default NotesPage;
