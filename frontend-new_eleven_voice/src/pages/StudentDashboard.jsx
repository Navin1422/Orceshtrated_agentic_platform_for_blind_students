import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStudent } from '../context/StudentContext';
import { useAuth } from '../context/AuthContext';
import voiceAssistant from '../services/voiceAssistant';
import voiceAgentService from '../services/voiceAgentService';
import { getStudent, getSubjects, getChapters, getChapter, markFeedbackRead } from '../services/api';
import '../styles/index.css';

const StudentDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { 
        student, setStudent,
        selectedClass, setSelectedClass, 
        selectedSubject, setSelectedSubject, 
        setSelectedChapter,
        setChatHistory,
        loginStudent,
        isRestoring,
    } = useStudent();
    
    const { user } = useAuth();
    
    const [status, setStatus] = useState('Initializing Dashboard...');
    const [isListening, setIsListening] = useState(false);
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [isReady, setIsReady] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const flowStarted = useRef(false);

    // Dynamic Refresh: Poll for new feedback every 30 seconds
    useEffect(() => {
        if (!student?.studentId) return;
        
        const pollInterval = setInterval(async () => {
            try {
                const res = await getStudent(student.studentId);
                // Update student context with latest data (e.g. new feedback)
                setStudent(res.data.student);
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 30000); // 30 seconds

        return () => clearInterval(pollInterval);
    }, [student?.studentId]);

    // Calculate unread feedback
    const unreadCount = student?.feedback?.filter(f => !f.read).length || 0;

    // Helper: extract pure class number like "8" from "Class 8" or "8th" or "8" or "Six"
    const normalizeClass = (raw = '') => {
        const lower = raw.toLowerCase().trim();
        const wordsToNumbers = {
            'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
            'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
            'first': '1', 'second': '2', 'third': '3', 'fourth': '4', 'fifth': '5',
            'sixth': '6', 'seventh': '7', 'eighth': '8', 'ninth': '9', 'tenth': '10'
        };
        
        // Check for word match
        for (const [word, num] of Object.entries(wordsToNumbers)) {
            if (lower.includes(word)) return num;
        }

        const match = raw.match(/\d+/);
        return match ? match[0] : raw.trim();
    };

    // On mount: either restore from context (localStorage), or register from login data
    useEffect(() => {
        console.log('[TRACER] StudentDashboard Mount. isRestoring:', isRestoring, 'student:', !!student);
        console.log('[TRACER] location.state:', location.state);

        if (isRestoring) {
            console.log('[TRACER] Still restoring student session, waiting...');
            return;
        }
        
        const init = async () => {
            if (student) {
                console.log('[TRACER] Found student in context, ready.');
                setIsReady(true);
                return;
            }

            // Priority: location state -> AuthContext user -> null
            const locationData = location.state?.studentData || (user?.role === 'student' ? user : null);
            
            if (locationData) {
                try {
                    console.log('[TRACER] Initializing with locationData:', locationData);
                    setStatus('SETTING UP YOUR PROFILE...');
                    const classNormalized = normalizeClass(locationData.class);
                    await loginStudent(locationData.name, classNormalized);
                    setSelectedClass(classNormalized);
                    setIsReady(true);
                } catch (err) {
                    console.error('[TRACER] Student registration failed:', err);
                    setStatus('SETUP FAILED.');
                    voiceAssistant.speak('I had trouble setting up your profile.');
                }
            } else {
                console.warn('[TRACER] No student data found in state or context! Redirecting to Intro.');
                navigate('/');
            }
        };
        init();
    }, [isRestoring]);

    // Start the voice flow only once student is ready in context
    useEffect(() => {
        if (isReady && student && !flowStarted.current) {
            flowStarted.current = true;
            startStudentFlow();
        }
    }, [isReady, student]);

    const startStudentFlow = async () => {
        setStatus('WELCOMING STUDENT...');
        const cls = selectedClass || student.class;
        
        // Use AI for a dynamic greeting
        const greeting = await voiceAgentService.getGreeting();
        voiceAssistant.speak(greeting, fetchAndAskSubject);
    };

    const handleAIAssistance = async (spokenText, retryAction) => {
        const normalized = spokenText.toLowerCase();
        const questionKeywords = ['what', 'how', 'help', 'can you', 'tell me', 'website', 'features', 'use', 'navigate', 'dashboard', 'pdf', 'whatsapp', 'emergency'];
        
        if (questionKeywords.some(k => normalized.includes(k))) {
            setStatus('Answering website question...');
            const aiResponse = await voiceAgentService.getResponse(spokenText, "Student asking about dashboard features");
            await voiceAssistant.speak(aiResponse);
            retryAction();
            return true;
        }
        return false;
    };

    const fetchAndAskSubject = async () => {
        try {
            setStatus('FETCHING SUBJECTS...');
            const rawCls = selectedClass || student.class;
            const cls = normalizeClass(rawCls);
            console.log('Fetching subjects for class:', cls, '(raw:', rawCls, ')');
            const res = await getSubjects(cls);
            console.log('API response:', res.data);
            const subjects = res.data.subjects; // lowercase from backend e.g. ['english', 'maths']
            setAvailableSubjects(subjects);

            if (!subjects || subjects.length === 0) {
                voiceAssistant.speak(`I couldn't find subjects for class ${cls}. Please check with your teacher.`);
                setStatus('NO SUBJECTS FOUND');
                return;
            }

            const displayNames = subjects.map(s => s.charAt(0).toUpperCase() + s.slice(1));
            const subjectsText = `Available subjects for class ${cls} are: ${displayNames.join(', ')}. Which subject would you like to study today? Or you can ask me how to use the dashboard.`;
            
            voiceAssistant.speak(subjectsText, async () => {
                setIsListening(true);
                await voiceAssistant.listen(
                    async (spokenText) => {
                        setIsListening(false);
                        
                        // Check if it's a question about the website first
                        if (await handleAIAssistance(spokenText, fetchAndAskSubject)) return;

                        // Match against lowercase backend names
                        const matched = subjects.find(s => spokenText.toLowerCase().includes(s.toLowerCase()));
                        if (matched) {
                            handleSubjectSelection(matched);
                        } else {
                            voiceAssistant.speak(`I didn't catch that. Please say one of: ${displayNames.join(', ')}.`, fetchAndAskSubject);
                        }
                    },
                    (err) => {
                        setIsListening(false);
                        voiceAssistant.speak("Please say a subject name clearly.", fetchAndAskSubject);
                    }
                );
            });
        } catch (err) {
            console.error('fetchAndAskSubject error:', err);
            voiceAssistant.speak("I had trouble connecting to the server. Please check your internet and try again.");
            setStatus('CONNECTION ERROR');
        }
    };

    const handleSubjectSelection = async (subject) => {
        setSelectedSubject(subject);
        setStatus(`FETCHING CHAPTERS FOR ${subject.toUpperCase()}...`);
        const rawCls = selectedClass || student.class;
        const cls = normalizeClass(rawCls);
        
        try {
            const res = await getChapters(cls, subject);
            const chapters = res.data.chapters;

            if (!chapters || chapters.length === 0) {
                voiceAssistant.speak(`I couldn't find any chapters for ${subject}. Please try another subject.`, fetchAndAskSubject);
                setStatus('NO CHAPTERS FOUND');
                return;
            }

            setStatus(`${chapters.length} CHAPTERS FOUND`);
            const chaptersText = `In ${subject}, we have ${chapters.length} chapters. The chapters are: ${chapters.map(c => `Chapter ${c.chapterNumber}: ${c.title}`).join('. ')}. Which chapter would you like to start? You can say the chapter number or the chapter name.`;
            
            voiceAssistant.speak(chaptersText, async () => {
                setIsListening(true);
                await voiceAssistant.listen(
                    async (spokenText) => {
                        setIsListening(false);
                        const lower = spokenText.toLowerCase();

                        // Map word numbers to digits for STT engines that spell out numbers
                        const wordToNum = {
                            'one': 1, 'first': 1,
                            'two': 2, 'second': 2,
                            'three': 3, 'third': 3,
                            'four': 4, 'fourth': 4,
                            'five': 5, 'fifth': 5,
                            'six': 6, 'sixth': 6,
                            'seven': 7, 'seventh': 7,
                            'eight': 8, 'eighth': 8,
                            'nine': 9, 'ninth': 9,
                            'ten': 10, 'tenth': 10
                        };

                        // Strategy 1: match by number spoken ("chapter 2", "second", "2", "three")
                        const numMatch = spokenText.match(/\d+/);
                        let chapter = null;

                        if (numMatch) {
                            const chapterNum = parseInt(numMatch[0]);
                            chapter = chapters.find(c => c.chapterNumber === chapterNum);
                        } else {
                            // Check for word numbers
                            for (const [word, num] of Object.entries(wordToNum)) {
                                if (lower.includes(word)) {
                                    chapter = chapters.find(c => c.chapterNumber === num);
                                    if (chapter) break;
                                }
                            }
                        }

                        // Strategy 2: match by chapter title keywords
                        if (!chapter) {
                            chapter = chapters.find(c => {
                                // check if any word of the title appears in spoken text
                                const titleWords = (c.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
                                return titleWords.some(word => lower.includes(word));
                            });
                        }

                        // Strategy 3 (last resort): first chapter
                        if (!chapter) {
                            chapter = chapters[0];
                            voiceAssistant.speak(
                                `I didn't catch which chapter. Let's start with Chapter ${chapter.chapterNumber}: ${chapter.title}.`,
                                () => launchLesson(chapter, subject)
                            );
                            return;
                        }

                        voiceAssistant.speak(
                            `Great! Let's start Chapter ${chapter.chapterNumber}: ${chapter.title}. I am preparing your lesson now.`,
                            () => launchLesson(chapter, subject)
                        );
                    },
                    (err) => {
                        setIsListening(false);
                        voiceAssistant.speak(`Sorry, I didn't hear you. Let's start with Chapter ${chapters[0].chapterNumber}: ${chapters[0].title}.`, () => launchLesson(chapters[0], subject));
                    }
                );
            });
        } catch (err) {
            console.error('handleSubjectSelection error:', err);
            setStatus('ERROR');
            voiceAssistant.speak("Something went wrong while getting chapters. Please try again.", fetchAndAskSubject);
        }
    };

    const launchLesson = async (chapterSummary, subject) => {
        try {
            setStatus('PREPARING LESSON...');
            const rawCls = selectedClass || student.class;
            const cls = normalizeClass(rawCls);
            const res = await getChapter(cls, subject, chapterSummary.chapterNumber);
            setSelectedChapter(res.data.chapter);
            setChatHistory([]);
            navigate('/learn');
        } catch (err) {
            console.error('launchLesson error:', err);
            setStatus('ERROR');
            voiceAssistant.speak("I couldn't load the chapter content. Please try again.", fetchAndAskSubject);
        }
    };

    // Show loading screen while student profile is being set up in backend
    if (!isReady || !student) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '1.5rem',
                    padding: '4rem',
                    textAlign: 'center',
                    boxShadow: '0 20px 25px -5px rgb(15 23 42 / 0.1), 0 8px 10px -6px rgb(15 23 42 / 0.1)',
                    maxWidth: '500px',
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
                    <div style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                        border: '2px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 2rem',
                        animation: 'pulse 2s infinite',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
                    }}>
                        <span style={{ fontSize: '3rem' }}>⚡</span>
                    </div>
                    <h2 style={{ 
                        fontSize: '1.875rem', 
                        fontWeight: 700, 
                        color: '#0f172a', 
                        marginBottom: '1rem',
                        letterSpacing: '-0.025em',
                        lineHeight: 1.2
                    }}>
                        Connecting to EduVoice AI
                    </h2>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        borderRadius: '2rem',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#475569',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase'
                    }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#3b82f6',
                            animation: 'pulse 2s infinite'
                        }}></span>
                        {status}
                    </div>
                </div>
            </div>
        );
    }

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
                        onClick={() => setIsFeedbackOpen(true)}
                        style={{
                            background: unreadCount > 0 
                                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                            color: unreadCount > 0 ? '#ffffff' : '#475569',
                            border: unreadCount > 0 ? 'none' : '1px solid #e2e8f0',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.75rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: unreadCount > 0 
                                ? '0 4px 6px -1px rgb(239 68 68 / 0.2)'
                                : '0 1px 3px 0 rgb(15 23 42 / 0.1)',
                            letterSpacing: '0.025em',
                            position: 'relative'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = unreadCount > 0
                                ? '0 10px 15px -3px rgb(239 68 68 / 0.3)'
                                : '0 4px 6px -1px rgb(15 23 42 / 0.1)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = unreadCount > 0
                                ? '0 4px 6px -1px rgb(239 68 68 / 0.2)'
                                : '0 1px 3px 0 rgb(15 23 42 / 0.1)';
                        }}
                    >
                        <span style={{ marginRight: '0.5rem' }}>📝</span>
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                background: '#ef4444',
                                color: 'white',
                                borderRadius: '50%',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: '700'
                            }}>
                                {unreadCount}
                            </span>
                        )}
                        Feedback
                    </button>
                    <button
                        onClick={() => {
                            setStudent(null);
                            navigate('/');
                        }}
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
                        Logout
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main style={{ 
                maxWidth: '1200px', 
                margin: '0 auto', 
                padding: '3rem 2rem',
                position: 'relative',
                zIndex: 10
            }}>
                {/* Welcome Section */}
                <div style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '1.5rem',
                    padding: '3rem',
                    marginBottom: '3rem',
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
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '2rem'
                    }}>
                        <div>
                            <h1 style={{ 
                                fontSize: '2.5rem', 
                                fontWeight: 800, 
                                color: '#0f172a', 
                                marginBottom: '0.5rem',
                                letterSpacing: '-0.05em',
                                lineHeight: 1.1
                            }}>
                                Welcome back, {student.name}
                            </h1>
                            <p style={{ 
                                fontSize: '1.125rem', 
                                color: '#475569', 
                                fontWeight: 500,
                                letterSpacing: '0.025em'
                            }}>
                                Class {student.class || selectedClass} • Ready to learn
                            </p>
                        </div>
                        <div style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                            border: '2px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '3rem',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
                        }}>
                            👨‍🎓
                        </div>
                    </div>
                    
                    {/* Premium Voice Status */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1.25rem 1.5rem',
                        borderRadius: '1rem',
                        background: isListening 
                            ? 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)'
                            : 'linear-gradient(135deg, #d1fae5 0%, #d4f4e4 100%)',
                        border: isListening ? '1px solid #60a5fa' : '1px solid #34d399',
                        color: isListening ? '#1e40af' : '#065f46',
                        marginBottom: '2rem',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>
                            {isListening ? '👂' : '🎤'}
                        </span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                                {isListening ? 'Listening for your response...' : 'Ready to assist'}
                            </div>
                            <div style={{ fontSize: '0.8125rem', opacity: 0.8 }}>
                                {status}
                            </div>
                        </div>
                    </div>

                    <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        padding: '1rem',
                        fontSize: '0.875rem',
                        color: '#64748b',
                        lineHeight: 1.6
                    }}>
                        <strong>💡 Tip:</strong> Speak clearly and select your subject below to begin learning. I'll guide you through each lesson step by step.
                    </div>
                </div>
                    
                {/* Subject Selection */}
                {availableSubjects.length > 0 && (
                    <div style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '1.5rem',
                        padding: '2.5rem',
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
                            fontSize: '1.875rem', 
                            fontWeight: 700, 
                            color: '#0f172a', 
                            marginBottom: '2rem',
                            letterSpacing: '-0.025em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <span style={{ fontSize: '1.5rem' }}>📚</span>
                            Available Subjects
                        </h2>
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                            gap: '1.5rem'
                        }}>
                            {availableSubjects.map(s => (
                                <button
                                    key={s}
                                    style={{
                                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                        color: '#0f172a',
                                        border: '1px solid #e2e8f0',
                                        padding: '1.5rem',
                                        borderRadius: '1rem',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                        width: '100%',
                                        textAlign: 'center',
                                        boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.1)',
                                        letterSpacing: '0.025em',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                    onClick={() => handleSubjectSelection(s)}
                                    onMouseOver={(e) => {
                                        e.target.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                                        e.target.style.borderColor = '#cbd5e1';
                                        e.target.style.transform = 'translateY(-4px) scale(1.02)';
                                        e.target.style.boxShadow = '0 20px 25px -5px rgb(15 23 42 / 0.1), 0 8px 10px -6px rgb(15 23 42 / 0.1)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.target.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                                        e.target.style.borderColor = '#e2e8f0';
                                        e.target.style.transform = 'translateY(0) scale(1)';
                                        e.target.style.boxShadow = '0 4px 6px -1px rgb(15 23 42 / 0.1)';
                                    }}
                                >
                                    <div style={{
                                        fontSize: '2rem',
                                        marginBottom: '0.75rem'
                                    }}>
                                        {s === 'mathematics' ? '🔢' : s === 'science' ? '🔬' : s === 'english' ? '📖' : s === 'history' ? '📜' : '📚'}
                                    </div>
                                    <div>
                                        {s.charAt(0).toUpperCase() + s.slice(1)}
                                    </div>
                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: '#64748b',
                                        marginTop: '0.5rem',
                                        fontWeight: 400
                                    }}>
                                        Click to start learning
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Feedback Modal */}
            {isFeedbackOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(15, 23, 42, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '1.5rem',
                        padding: '2rem',
                        maxWidth: '600px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        boxShadow: '0 25px 50px -12px rgb(15 23 42 / 0.25)',
                        position: 'relative'
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
                            fontSize: '1.5rem', 
                            fontWeight: 700, 
                            color: '#0f172a', 
                            marginBottom: '1.5rem',
                            letterSpacing: '-0.025em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <span style={{ fontSize: '1.25rem' }}>📝</span>
                            Teacher Feedback
                        </h2>
                        
                        {!student.feedback || student.feedback.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>
                                <p style={{ 
                                    color: '#64748b', 
                                    fontSize: '0.9375rem',
                                    margin: 0
                                }}>
                                    No feedback from your teacher yet. Keep learning!
                                </p>
                            </div>
                        ) : (
                            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                                {[...student.feedback].reverse().map((f, i) => (
                                    <div key={i} style={{ 
                                        padding: '1.25rem', 
                                        borderRadius: '1rem',
                                        marginBottom: '1rem',
                                        background: f.read 
                                            ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
                                            : 'linear-gradient(135deg, #d1fae5 0%, #d4f4e4 100%)',
                                        border: `1px solid ${f.read ? '#e2e8f0' : '#34d399'}`,
                                        position: 'relative',
                                        boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)'
                                    }}>
                                        {!f.read && (
                                            <span style={{ 
                                                position: 'absolute', top: '12px', right: '12px',
                                                background: '#10b981', color: 'white',
                                                padding: '0.375rem 0.75rem', fontSize: '0.75rem',
                                                fontWeight: 600, borderRadius: '2rem',
                                                letterSpacing: '0.05em',
                                                textTransform: 'uppercase'
                                            }}>
                                                New
                                            </span>
                                        )}
                                        <p style={{ 
                                            fontSize: '0.9375rem', 
                                            fontWeight: 500, 
                                            lineHeight: 1.6,
                                            color: '#0f172a',
                                            margin: '0 0 1rem 0'
                                        }}>
                                            "{f.message}"
                                        </p>
                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            fontSize: '0.8125rem', 
                                            fontWeight: 600,
                                            color: '#64748b',
                                            letterSpacing: '0.025em'
                                        }}>
                                            <span>Teacher {f.teacherId}</span>
                                            <span>{new Date(f.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button 
                            onClick={async () => {
                                setIsFeedbackOpen(false);
                                if (unreadCount > 0) {
                                    try {
                                        await markFeedbackRead(student.studentId);
                                        const updatedFeedback = student.feedback.map(f => ({ ...f, read: true }));
                                        setStudent({ ...student, feedback: updatedFeedback });
                                    } catch (e) { console.error(e); }
                                }
                            }} 
                            style={{
                                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '0.875rem 2rem',
                                borderRadius: '0.75rem',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                width: '100%',
                                marginTop: '1.5rem',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                letterSpacing: '0.025em',
                                boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.1)'
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
                            Close Feedback
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;
