import React, { useEffect, useState, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStudent } from '../context/StudentContext';
import { VoiceContext } from '../context/VoiceContext';
import voiceAssistant from '../services/voiceAssistant';
import voiceAgentService from '../services/voiceAgentService';
import '../styles/index.css';

const IntroPage = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const { student, isRestoring: studentRestoring } = useStudent();
    const { speak, listen, stopListening, startAIAssistant, isAIActive, isListening: voiceContextListening } = useContext(VoiceContext);
    const [status, setStatus] = useState('Initializing EduVoice AI...');
    const [isListening, setIsListening] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const flowStarted = useRef(false);

    useEffect(() => {
        // Wait for both Auth and Student states to be fully restored
        if (authLoading || studentRestoring) return;

        // Initial status
        setStatus('Ready to Start');

        return () => {
            stopListening();
        };
    }, [isAuthenticated, authLoading, studentRestoring, user, student, navigate]);

    // Helper to sync local listening state with context
    useEffect(() => {
        setIsListening(voiceContextListening);
    }, [voiceContextListening]);

    const handleVoiceInput = async (res, nextStep, retryStep, stage) => {
        const normalizedResult = res.toLowerCase().trim();
        
        // Comprehensive check for questions about the website
        const questionKeywords = ['what', 'how', 'help', 'can you', 'tell me', 'who are you', 'website', 'platform', 'features', 'use', 'navigate', 'dashboard', 'pdf', 'whatsapp', 'emergency'];
        const isQuestion = questionKeywords.some(keyword => normalizedResult.includes(keyword));

        if (isQuestion) {
            setStatus('Answering your question...');
            const aiResponse = await voiceAgentService.getResponse(res, `User asking for help during ${stage}`);
            await speak(aiResponse);
            retryStep(); // Ask again after helping
            return true;
        }
        return false;
    };

    const askLanguage = () => {
        setStatus('Listening for language preference...');
        speak("Would you like to continue in English or Tamil? Or you can ask me what I can do.", async () => {
            listen(async (res) => {
                console.log('Language or Question result:', res);
                
                if (await handleVoiceInput(res, null, askLanguage, "language selection")) return;

                const normalizedResult = res.toLowerCase().trim();
                if (normalizedResult.includes('tamil') || normalizedResult.includes('தமிழ்')) {
                    speak("Okay, I will speak in Tamil.", () => {
                        askRole('tamil');
                    });
                } else if (normalizedResult.includes('english') || normalizedResult.includes('ஆங்கிலம்')) {
                    speak("Okay, I will speak in English.", () => {
                        askRole('english');
                    });
                } else {
                    speak("Sorry, please say English or Tamil. Or ask me a question about the platform.", askLanguage);
                }
            });
        });
    };

    const askRole = (lang) => {
        const introQuestion = lang === 'tamil' 
            ? "சொல்லுங்கள், நீங்கள் யார்?"
            : "Tell me, who are you?";
        
        const roleQuestion = lang === 'tamil' 
            ? "மாணவர்,ஆசிரியர், அல்லது நிர்வாகி?"
            : "Student, Teacher, or Admin?";

        setStatus('Listening for your role...');
        
        setTimeout(() => {
            speak(introQuestion + " " + roleQuestion, async () => {
                listen(async (res) => {
                    console.log('Role result:', res);
                    
                    if (await handleVoiceInput(res, null, () => askRole(lang), "role selection")) return;

                    const role = res.toLowerCase();
                    if (role.includes('student') || role.includes('மாணவர்')) {
                        console.log('[DEBUG] Navigating to /login as student');
                        stopListening();
                        navigate('/login', { state: { role: 'student', lang } });
                    } else if (role.includes('teacher') || role.includes('ஆசிரியர்')) {
                        console.log('[DEBUG] Navigating to /login as teacher');
                        stopListening();
                        navigate('/login', { state: { role: 'teacher', lang } });
                    } else if (role.includes('admin') || role.includes('நிர்வாகி')) {
                        console.log('[DEBUG] Navigating to /login as admin');
                        stopListening();
                        navigate('/login', { state: { role: 'admin', lang } });
                    } else {
                        const retryQuestion = lang === 'tamil' 
                            ? "தெளிவாக சொல்லுங்கள்: மாணவர், ஆசிரியர், அல்லது நிர்வாகி?"
                            : "Please say your role clearly: Student, Teacher, or Admin.";
                        speak(retryQuestion, () => askRole(lang));
                    }
                });
            });
        }, 500);
    };

    const handleManualLogin = (role) => {
        stopListening();
        navigate('/login', { state: { role, lang: 'english' } });
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}>
            {/* Premium Background */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(circle at 20% 80%, rgba(30, 58, 138, 0.08), transparent 60%), radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.06), transparent 60%), radial-gradient(circle at 40% 40%, rgba(0, 0, 0, 0.04), transparent 60%)',
                animation: 'float 25s ease-in-out infinite',
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
                        onClick={() => handleManualLogin('student')}
                        style={{
                            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.75rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.1)',
                            letterSpacing: '0.025em'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #1e293b 0%, #334155 100%)';
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 10px 15px -3px rgb(15 23 42 / 0.2)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 4px 6px -1px rgb(15 23 42 / 0.1)';
                        }}
                    >
                        Student Login
                    </button>
                    <button
                        onClick={() => handleManualLogin('teacher')}
                        style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.75rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 4px 6px -1px rgb(59 130 246 / 0.2)',
                            letterSpacing: '0.025em'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 10px 15px -3px rgb(59 130 246 / 0.3)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 4px 6px -1px rgb(59 130 246 / 0.2)';
                        }}
                    >
                        Teacher Login
                    </button>
                    <button
                        onClick={() => handleManualLogin('admin')}
                        style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.75rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 4px 6px -1px rgb(99 102 241 / 0.2)',
                            letterSpacing: '0.025em'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)';
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 10px 15px -3px rgb(99 102 241 / 0.3)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 4px 6px -1px rgb(99 102 241 / 0.2)';
                        }}
                    >
                        Admin Portal
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '3rem 2rem',
                position: 'relative',
                zIndex: 10,
                maxWidth: '1200px',
                margin: '0 auto',
                width: '100%'
            }}>
                {/* Hero Section */}
                <div style={{
                    textAlign: 'center',
                    maxWidth: '900px',
                    marginBottom: '4rem'
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
                            background: isListening ? '#10b981' : '#f59e0b',
                            animation: isListening ? 'pulse 2s infinite' : 'none'
                        }}></span>
                        {status}
                    </div>
                    
                    <h1 style={{
                        fontSize: 'clamp(3rem, 6vw, 5rem)',
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
                        Welcome to EduVoice AI
                    </h1>
                    
                    <p style={{
                        fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
                        color: '#64748b',
                        marginBottom: '3rem',
                        lineHeight: 1.6,
                        fontWeight: 400,
                        letterSpacing: '-0.01em',
                        maxWidth: '700px',
                        margin: '0 auto 3rem auto'
                    }}>
                        Intelligent voice-powered learning platform designed for accessible education
                    </p>
                </div>

                {/* Premium Voice Orb */}
                <div 
                    style={{
                        position: 'relative',
                        marginBottom: '4rem',
                        cursor: isInitialized ? 'default' : 'pointer'
                    }}
                    onClick={async () => {
                        if (!isInitialized) {
                            voiceAssistant.unlock();
                            setStatus('Consulting AI Assistant...');
                            setIsInitialized(true);
                            flowStarted.current = true;
                            
                            // Use AI for a dynamic greeting
                            const greeting = await voiceAgentService.getGreeting();
                            speak(greeting, () => {
                                askLanguage();
                            });
                        }
                    }}
                >
                    <div style={{
                        width: '240px',
                        height: '240px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        animation: isListening ? 'pulse 2s infinite' : 'float 8s ease-in-out infinite',
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -6px rgb(0 0 0 / 0.04)'
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
                            fontSize: '5rem',
                            filter: 'drop-shadow(0 4px 6px rgb(0 0 0 / 0.1))'
                        }}>
                            {isListening ? '👂' : (isInitialized ? '🎙️' : '▶️')}
                        </span>
                    </div>
                    {!isInitialized && (
                        <div style={{
                            position: 'absolute',
                            bottom: '-40px',
                            width: '100%',
                            textAlign: 'center',
                            fontWeight: 700,
                            color: '#3b82f6',
                            animation: 'pulse 1.5s infinite'
                        }}>
                            CLICK TO START
                        </div>
                    )}
                </div>

                {/* Premium Features Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '2rem',
                    maxWidth: '1200px',
                    width: '100%',
                    marginBottom: '4rem'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '1.25rem',
                        padding: '2.5rem',
                        textAlign: 'center',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)';
                    }}
                    >
                        <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>🎯</div>
                        <h3 style={{ color: '#0f172a', fontSize: '1.375rem', marginBottom: '0.75rem', fontWeight: 700, letterSpacing: '-0.025em' }}>
                            Voice-Powered Learning
                        </h3>
                        <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.7, fontWeight: 400 }}>
                            Interactive voice commands for hands-free learning experience
                        </p>
                    </div>
                    <div style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '1.25rem',
                        padding: '2.5rem',
                        textAlign: 'center',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)';
                    }}
                    >
                        <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>🤖</div>
                        <h3 style={{ color: '#0f172a', fontSize: '1.375rem', marginBottom: '0.75rem', fontWeight: 700, letterSpacing: '-0.025em' }}>
                            AI-Powered Teaching
                        </h3>
                        <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.7, fontWeight: 400 }}>
                            Intelligent AI assistant for personalized learning paths
                        </p>
                    </div>
                    <div style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '1.25rem',
                        padding: '2.5rem',
                        textAlign: 'center',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)';
                    }}
                    >
                        <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>♿</div>
                        <h3 style={{ color: '#0f172a', fontSize: '1.375rem', marginBottom: '0.75rem', fontWeight: 700, letterSpacing: '-0.025em' }}>
                            Accessibility First
                        </h3>
                        <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.7, fontWeight: 400 }}>
                            Designed specifically for visually impaired learners
                        </p>
                    </div>
                </div>

                {/* Premium Call-to-Action */}
                <div style={{
                    display: 'flex',
                    gap: '1.5rem',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={() => handleManualLogin('student')}
                        style={{
                            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '1.25rem 3rem',
                            borderRadius: '1rem',
                            fontSize: '1.125rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 10px 15px -3px rgb(15 23 42 / 0.2)',
                            letterSpacing: '0.025em',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #1e293b 0%, #334155 100%)';
                            e.target.style.transform = 'translateY(-4px) scale(1.05)';
                            e.target.style.boxShadow = '0 20px 25px -5px rgb(15 23 42 / 0.3)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
                            e.target.style.transform = 'translateY(0) scale(1)';
                            e.target.style.boxShadow = '0 10px 15px -3px rgb(15 23 42 / 0.2)';
                        }}
                    >
                        <span style={{ marginRight: '0.75rem' }}>🎓</span>
                        Start Learning
                    </button>
                    <button
                        onClick={() => handleManualLogin('teacher')}
                        style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '1.25rem 3rem',
                            borderRadius: '1rem',
                            fontSize: '1.125rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 10px 15px -3px rgb(59 130 246 / 0.3)',
                            letterSpacing: '0.025em',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
                            e.target.style.transform = 'translateY(-4px) scale(1.05)';
                            e.target.style.boxShadow = '0 20px 25px -5px rgb(59 130 246 / 0.4)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                            e.target.style.transform = 'translateY(0) scale(1)';
                            e.target.style.boxShadow = '0 10px 15px -3px rgb(59 130 246 / 0.3)';
                        }}
                    >
                        <span style={{ marginRight: '0.75rem' }}>👨‍🏫</span>
                        Teacher Portal
                    </button>
                    <button
                        onClick={() => handleManualLogin('admin')}
                        style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '1.25rem 3rem',
                            borderRadius: '1rem',
                            fontSize: '1.125rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 10px 15px -3px rgb(99 102 241 / 0.3)',
                            letterSpacing: '0.025em',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)';
                            e.target.style.transform = 'translateY(-4px) scale(1.05)';
                            e.target.style.boxShadow = '0 20px 25px -5px rgb(99 102 241 / 0.4)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                            e.target.style.transform = 'translateY(0) scale(1)';
                            e.target.style.boxShadow = '0 10px 15px -3px rgb(99 102 241 / 0.3)';
                        }}
                    >
                        <span style={{ marginRight: '0.75rem' }}>🛡️</span>
                        Admin Portal
                    </button>
                </div>
            </main>

            {/* Premium Footer */}
            <footer style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.9375rem',
                position: 'relative',
                zIndex: 10,
                borderTop: '1px solid #e2e8f0',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{
                    maxWidth: '600px',
                    margin: '0 auto'
                }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#475569', letterSpacing: '0.025em' }}>
                        EduVoice AI
                    </p>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>
                        Dedicated to making education accessible for everyone
                    </p>
                </div>
            </footer>

            {/* Premium Animations */}
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-30px) rotate(180deg); }
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.05); }
                }
                
                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default IntroPage;
