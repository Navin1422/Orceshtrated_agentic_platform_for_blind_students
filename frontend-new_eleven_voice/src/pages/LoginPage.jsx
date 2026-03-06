import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import voiceAssistant from '../services/voiceAssistant';
import voiceAgentService from '../services/voiceAgentService';
import '../styles/index.css';



const LoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isLoading, isAuthenticated, user } = useAuth();
    const [role, setRole] = useState(location.state?.role || 'student');

    const [email, setEmail] = useState('');

    const [password, setPassword] = useState('');

    const [isListening, setIsListening] = useState(false);

    const [status, setStatus] = useState(`Logging in as ${role.toUpperCase()}...`);

    const [recognizedText, setRecognizedText] = useState('');

    const [studentData, setStudentData] = useState({
        name: '',
        class: '',
        school: '',
        availableClasses: ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12']
    });

    // Tracks which field is currently being confirmed ('email' | 'password')
    const [confirmingType, setConfirmingType] = useState('email');

    const flowStarted = useRef(false);




    useEffect(() => {
        // Removed auto-redirect to allow users to see the login portal/flow even if already authenticated
        /*
        if (!isLoading && isAuthenticated && user && !flowStarted.current) {
            console.log('[TRACER] Auto-redirect triggered for already logged in user:', user.role);
            if (user.role === 'teacher') navigate('/teacher');
            else if (user.role === 'admin') navigate('/admin');
            else navigate('/student');
            return;
        }
        */
        
        // Get role from location state or default to student

        const currentRole = location.state?.role || role;

        setRole(currentRole);

        

        console.log('LoginPage - Role:', currentRole);

        console.log('LoginPage - Location state:', location.state);

        

        if (!flowStarted.current) {

            console.log(`Starting ${currentRole} voice login...`);

            if (currentRole === 'student') {

                startStudentVoiceLogin();

            } else if (currentRole === 'teacher') {

                startTeacherVoiceLogin();

            } else if (currentRole === 'admin') {

                startAdminVoiceLogin();

            }

            flowStarted.current = true;

        }

        return () => {
            voiceAssistant.stopListening();
        };

    }, [location.state, role]);



    const startStudentVoiceLogin = () => {

        console.log('startStudentVoiceLogin called');

        // Small delay to ensure page is fully loaded and voice assistant is ready

        setTimeout(() => {

            collectStudentInfo();

        }, 1000);

    };



    const startTeacherVoiceLogin = () => {

        console.log('startTeacherVoiceLogin called');

        setTimeout(() => {

            collectTeacherInfo();

        }, 1000);

    };



    const startAdminVoiceLogin = () => {

        console.log('startAdminVoiceLogin called');

        setTimeout(() => {

            collectAdminInfo();

        }, 1000);

    };



    const collectTeacherInfo = () => {

        console.log('collectTeacherInfo called');

        setStatus('TEACHER LOGIN - VOICE ASSISTANT READY');

        

        setTimeout(() => {

            voiceAssistant.speak("Okay teacher! Let's get you logged in. Please tell me your full name.", async () => {

                setIsListening(true);

                try {

                    const nameResult = await voiceAssistant.listen(

                        (res) => {

                            console.log('Teacher name captured:', res);

                            setIsListening(false);

                            const cleanName = voiceAssistant.cleanName(res);

                            setStudentData(prev => ({ ...prev, name: cleanName }));

                            voiceAssistant.speak(`Thank you ${cleanName}! Now please tell me your email address.`, async () => {

                                collectTeacherEmail(cleanName);

                            });

                        },

                        (err) => {

                            console.error('Teacher name recognition error:', err);

                            setIsListening(false);

                            voiceAssistant.speak("I didn't hear your name clearly. Please say your name again.", () => collectTeacherInfo());

                        }

                    );

                } catch (error) {

                    console.error('Teacher name input failed:', error);

                    setIsListening(false);

                    voiceAssistant.speak("Name input failed. Please try again.", () => collectTeacherInfo());

                }

            });

        }, 500);

    };



    const collectAdminInfo = () => {

        console.log('collectAdminInfo called');

        setStatus('ADMIN LOGIN - VOICE ASSISTANT READY');

        

        setTimeout(() => {

            voiceAssistant.speak("Okay admin! Let's get you logged in. Please tell me your full name.", async () => {

                setIsListening(true);

                try {

                    const nameResult = await voiceAssistant.listen(

                        (res) => {

                            console.log('Admin name captured:', res);

                            setIsListening(false);

                            const cleanName = voiceAssistant.cleanName(res);

                            setStudentData(prev => ({ ...prev, name: cleanName }));

                            voiceAssistant.speak(`Thank you ${cleanName}! Now please tell me your email address.`, async () => {

                                collectAdminEmail(cleanName);

                            });

                        },

                        (err) => {

                            console.error('Admin name recognition error:', err);

                            setIsListening(false);

                            voiceAssistant.speak("I didn't hear your name clearly. Please say your name again.", () => collectAdminInfo());

                        }

                    );

                } catch (error) {

                    console.error('Admin name input failed:', error);

                    setIsListening(false);

                    voiceAssistant.speak("Name input failed. Please try again.", () => collectAdminInfo());

                }

            });

        }, 500);

    };

    const handleAIAssistance = async (spokenText, retryAction) => {
        const normalized = spokenText.toLowerCase();
        const questionKeywords = ['what', 'how', 'help', 'can you', 'tell me', 'website', 'features', 'use', 'navigate', 'dashboard', 'pdf', 'whatsapp', 'emergency'];
        
        if (questionKeywords.some(k => normalized.includes(k))) {
            setStatus('Answering website question...');
            const aiResponse = await voiceAgentService.getResponse(spokenText, "User asking about login/website during login flow");
            await voiceAssistant.speak(aiResponse);
            retryAction();
            return true;
        }
        return false;
    };

    const collectStudentInfo = () => {
        console.log('collectStudentInfo called');
        setStatus('STUDENT LOGIN - VOICE ASSISTANT READY');
        
        setTimeout(async () => {
            const greeting = "Okay student! Let's get you logged in. First, please tell me your full name. Or you can ask me a question about the website.";
            voiceAssistant.speak(greeting, async () => {
                setIsListening(true);
                try {
                    await voiceAssistant.listen(
                        async (res) => {
                            console.log('Name captured:', res);
                            setIsListening(false);
                            
                            if (await handleAIAssistance(res, collectStudentInfo)) return;

                            const cleanName = voiceAssistant.cleanName(res);
                            setStudentData(prev => ({ ...prev, name: cleanName }));
                            voiceAssistant.speak(`Thank you ${cleanName}! Now please tell me your class. You can say any class from Class 1 to Class 12.`, async () => {
                                setIsListening(true);
                                collectClassInfo(cleanName);
                            });
                        },
                        (err) => {
                            console.error('Name recognition error:', err);
                            setIsListening(false);
                            voiceAssistant.speak("I didn't hear your name clearly. Please say your name again.", () => collectStudentInfo());
                        }
                    );
                } catch (error) {
                    console.error('Name input failed:', error);
                    setIsListening(false);
                    voiceAssistant.speak("Name input failed. Please try again.", () => collectStudentInfo());
                }
            });
        }, 500);
    };

    const collectClassInfo = async (studentName) => {
        setIsListening(true);

        try {

            const classResult = await voiceAssistant.listen(

                (res) => {

                    console.log('Class captured:', res);

                    setIsListening(false);

                    setStudentData(prev => ({ ...prev, class: res }));

                    voiceAssistant.speak(`Great! ${res}. Now please tell me your school name.`, async () => {

                        setIsListening(true);

                        collectSchoolInfo(studentName, res);

                    });

                },

                (err) => {

                    console.error('Class recognition error:', err);

                    setIsListening(false);

                    voiceAssistant.speak("I didn't hear your class clearly. Please say your class again.", () => collectClassInfo(studentName));

                }

            );

        } catch (error) {

            console.error('Class input failed:', error);

            setIsListening(false);

            voiceAssistant.speak("Class input failed. Please try again.", () => collectClassInfo(studentName));

        }

    };



    const collectSchoolInfo = async (studentName, studentClass) => {

        setIsListening(true);

        try {

            const schoolResult = await voiceAssistant.listen(

                (schoolInfo) => {

                    console.log('School captured:', schoolInfo);

                    setIsListening(false);

                    const cleanSchool = schoolInfo.trim();

                    setStudentData(prev => ({ ...prev, school: cleanSchool }));

                    voiceAssistant.speak("Now please say your email address.", async () => {

                        collectEmail(studentName, studentClass, cleanSchool);

                    });

                },

                (err) => {

                    console.error('School recognition error:', err);

                    setIsListening(false);

                    voiceAssistant.speak("I didn't hear your school name. Please try again.", () => collectSchoolInfo(studentName, studentClass));

                }

            );

            

            // Timeout handling

            setTimeout(() => {

                if (isListening) {

                    setIsListening(false);

                    voiceAssistant.speak("I didn't hear your school name. Please try again.", () => collectSchoolInfo(studentName, studentClass));

                }

            }, 8000);

            

        } catch (error) {

            console.error('School info collection failed:', error);

            setIsListening(false);

            voiceAssistant.speak("I didn't hear your school name. Please try again.", () => collectSchoolInfo(studentName, studentClass));

        }

    };



    const collectTeacherEmail = async (teacherName) => {

        setIsListening(true);

        setStatus('Listening for teacher email...');

        setRecognizedText('');

        try {

            const emailResult = await voiceAssistant.listen(

                (emailRes) => {

                    console.log('Teacher email captured:', emailRes);

                    setIsListening(false);

                    const cleanedEmail = voiceAssistant.cleanEmail(emailRes);

                    setRecognizedText(cleanedEmail);

                    setEmail(cleanedEmail);

                    setStatus('Email received! Now listening for password...');

                    

                    voiceAssistant.speak("Email received! Now please say your password.", async () => {

                        collectTeacherPassword(teacherName, cleanedEmail);

                    });

                },

                (err) => {

                    console.error('Teacher email recognition error:', err);

                    setIsListening(false);

                    setStatus('Email not heard. Please try again.');

                    voiceAssistant.speak("I didn't hear your email. Please try again.", () => collectTeacherEmail(teacherName));

                }

            );

        } catch (error) {

            console.error('Teacher email input failed:', error);

            setIsListening(false);

            voiceAssistant.speak("Email input failed. Please try again.", () => collectTeacherEmail(teacherName));

        }

    };



    const collectAdminEmail = async (adminName) => {

        setIsListening(true);

        setStatus('Listening for admin email...');

        setRecognizedText('');

        try {

            const emailResult = await voiceAssistant.listen(

                (emailRes) => {

                    console.log('Admin email captured:', emailRes);

                    setIsListening(false);

                    const cleanedEmail = voiceAssistant.cleanEmail(emailRes);

                    setRecognizedText(cleanedEmail);

                    setEmail(cleanedEmail);

                    setStatus('Email received! Now listening for password...');

                    

                    voiceAssistant.speak("Email received! Now please say your password.", async () => {

                        collectAdminPassword(adminName, cleanedEmail);

                    });

                },

                (err) => {

                    console.error('Admin email recognition error:', err);

                    setIsListening(false);

                    setStatus('Email not heard. Please try again.');

                    voiceAssistant.speak("I didn't hear your email. Please try again.", () => collectAdminEmail(adminName));

                }

            );

        } catch (error) {

            console.error('Admin email input failed:', error);

            setIsListening(false);

            voiceAssistant.speak("Email input failed. Please try again.", () => collectAdminEmail(adminName));

        }

    };



    const collectEmail = async (studentName, studentClass, studentSchool) => {

        setIsListening(true);

        setStatus('Listening for your email address...');

        setRecognizedText('');

        try {

            const emailResult = await voiceAssistant.listen(

                (emailRes) => {

                    console.log('Email captured:', emailRes);

                    setIsListening(false);

                    const cleanedEmail = voiceAssistant.cleanEmail(emailRes);

                    setRecognizedText(cleanedEmail);

                    setEmail(cleanedEmail);

                    setStatus('Email received! Logging you in...');

                    

                    voiceAssistant.speak("Email received! Logging you in now.", () => {

                        handleVoiceLogin(studentName, studentClass, studentSchool, cleanedEmail, '');

                    });

                },

                (err) => {

                    console.error('Email recognition error:', err);

                    setIsListening(false);

                    setStatus('Email not heard. Please try again.');

                    voiceAssistant.speak("I didn't hear your email. Please try again.", () => collectEmail(studentName, studentClass, studentSchool));

                }

            );

            

            // Timeout handling

            setTimeout(() => {

                if (isListening) {

                    setIsListening(false);

                    voiceAssistant.speak("I didn't hear your email. Please try again.", () => collectEmail(studentName, studentClass, studentSchool));

                }

            }, 8000);

            

        } catch (error) {

            console.error('Email input failed:', error);

            setIsListening(false);

            voiceAssistant.speak("Email input failed. Please try again.", () => collectEmail(studentName, studentClass, studentSchool));

        }

    };



    const collectTeacherPassword = async (teacherName, confirmedEmail) => {

        setIsListening(true);

        setStatus('Listening for teacher password...');

        setRecognizedText('');

        try {

            const passResult = await voiceAssistant.listen(

                (passRes) => {

                    console.log('Teacher password captured:', passRes);

                    setIsListening(false);

                    setRecognizedText(passRes);

                    setPassword(passRes);

                    setStatus('Password received! Logging you in...');

                    

                    voiceAssistant.speak("Password received! Logging you in now.", () => {

                        handleVoiceLogin(teacherName, '', '', confirmedEmail, passRes);

                    });

                },

                (err) => {

                    console.error('Teacher password recognition error:', err);

                    setIsListening(false);

                    setStatus('Password not heard. Please try again.');

                    voiceAssistant.speak("I didn't hear your password. Please try again.", () => collectTeacherPassword(teacherName, confirmedEmail));

                }

            );

        } catch (error) {

            console.error('Teacher password input failed:', error);

            setIsListening(false);

            voiceAssistant.speak("Password input failed. Please try again.", () => collectTeacherPassword(teacherName, confirmedEmail));

        }

    };



    const collectAdminPassword = async (adminName, confirmedEmail) => {

        setIsListening(true);

        setStatus('Listening for admin password...');

        setRecognizedText('');

        try {

            const passResult = await voiceAssistant.listen(

                (passRes) => {

                    console.log('Admin password captured:', passRes);

                    setIsListening(false);

                    setRecognizedText(passRes);

                    setPassword(passRes);

                    setStatus('Password received! Logging you in...');

                    

                    voiceAssistant.speak("Password received! Logging you in now.", () => {

                        handleVoiceLogin(adminName, '', '', confirmedEmail, passRes);

                    });

                },

                (err) => {

                    console.error('Admin password recognition error:', err);

                    setIsListening(false);

                    setStatus('Password not heard. Please try again.');

                    voiceAssistant.speak("I didn't hear your password. Please try again.", () => collectAdminPassword(adminName, confirmedEmail));

                }

            );

        } catch (error) {

            console.error('Admin password input failed:', error);

            setIsListening(false);

            voiceAssistant.speak("Password input failed. Please try again.", () => collectAdminPassword(adminName, confirmedEmail));

        }

    };



    const requestPassword = async (studentName, studentClass, studentSchool, confirmedEmail) => {

        setIsListening(true);

        setStatus('Listening for your password...');

        setRecognizedText('');

        try {

            const passResult = await voiceAssistant.listen(

                (passRes) => {

                    console.log('Password captured:', passRes);

                    setIsListening(false);

                    setRecognizedText(passRes); // Show password as plain text

                    setPassword(passRes);

                    setStatus('Password received! Logging you in...');

                    

                    // Directly continue to student dashboard

                    voiceAssistant.speak("Password received! Logging you in now.", () => {

                        handleVoiceLogin(studentName, studentClass, studentSchool, confirmedEmail, passRes);

                    });

                },

                (err) => {

                    console.error('Password recognition error:', err);

                    setIsListening(false);

                    setStatus('Password not heard. Please try again.');

                    voiceAssistant.speak("I didn't hear your password. Please try again.", () => requestPassword(studentName, studentClass, studentSchool, confirmedEmail));

                }

            );

            

            // Timeout handling

            setTimeout(() => {

                if (isListening) {

                    setIsListening(false);

                    voiceAssistant.speak("I didn't hear your password. Please try again.", () => requestPassword(studentName, studentClass, studentSchool, confirmedEmail));

                }

            }, 8000);

            

        } catch (error) {

            console.error('Password input failed:', error);

            setIsListening(false);

            voiceAssistant.speak("Password input failed. Please try again.", () => requestPassword(studentName, studentClass, studentSchool, confirmedEmail));

        }

    };



    const handleVoiceLogin = async (studentName, studentClass, studentSchool, email, password) => {
        setStatus('VALIDATING CREDENTIALS...');
        console.log('handleVoiceLogin called with:', { studentName, studentClass, studentSchool, email, role });
        
        // Prepare user data for authentication
        const userData = {
            name: studentName,
            class: studentClass,
            school: studentSchool,
            email: email,
            role: role
        };
        
        voiceAssistant.speak("Logging you in now.", async () => {
            try {
                // Perform login - this ensures token is stored and auth state is updated
                const loginResult = await login(userData, role);
                
                if (loginResult.success) {
                    console.log('[TRACER] Authentication successful. Role:', role);
                    console.log('[TRACER] Preparing to navigate to dashboard with data:', userData);
                    
                    // Navigate only after authentication is complete
                    setTimeout(() => {
                        if (role === 'admin') {
                            console.log('[TRACER] Navigating to /admin');
                            navigate('/admin', { state: { adminData: userData } });
                        } else if (role === 'teacher') {
                            console.log('[TRACER] Navigating to /teacher');
                            navigate('/teacher', { state: { teacherData: userData } });
                        } else {
                            console.log('[TRACER] Navigating to /student with studentData:', userData);
                            navigate('/student', { 
                                state: { 
                                    studentData: userData
                                } 
                            });
                        }
                    }, 500); // Small delay to ensure auth state is fully set
                } else {
                    console.error('Login failed:', loginResult.error);
                    setStatus('Login failed. Please try again.');
                    voiceAssistant.speak("Login failed. Please try again.", () => {
                        // Restart the login flow based on role
                        if (role === 'student') {
                            collectStudentInfo();
                        } else if (role === 'teacher') {
                            collectTeacherInfo();
                        } else if (role === 'admin') {
                            collectAdminInfo();
                        }
                    });
                }
            } catch (error) {
                console.error('Authentication error:', error);
                setStatus('Authentication error. Please try again.');
                voiceAssistant.speak("Authentication error. Please try again.", () => {
                    // Restart the login flow
                    if (role === 'student') {
                        collectStudentInfo();
                    } else if (role === 'teacher') {
                        collectTeacherInfo();
                    } else if (role === 'admin') {
                        collectAdminInfo();
                    }
                });
            }
        });
    };



    const handleManualLogin = async (e) => {
        e.preventDefault();
        
        // Prepare user data for authentication
        const userData = {
            name: email.split('@')[0], // Extract name from email
            email: email,
            role: role
        };
        
        try {
            // Perform login
            const loginResult = await login(userData, role);
            
            if (loginResult.success) {
                // Navigate based on role
                if (role === 'admin') {
                    navigate('/admin', { state: { adminData: { name: userData.name, email: email } } });
                } else if (role === 'teacher') {
                    navigate('/teacher', { state: { teacherData: { name: userData.name, email: email } } });
                } else {
                    navigate('/student', { state: { studentData: { name: userData.name, email: email } } });
                }
            } else {
                setStatus('Login failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Manual login error:', error);
            setStatus('Login error. Please try again.');
        }
    };



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
                        onClick={() => navigate('/')}
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
                        ← Back
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
                            background: isListening ? '#10b981' : '#f59e0b',
                            animation: isListening ? 'pulse 2s infinite' : 'none'
                        }}></span>
                        {status}
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
                        {role.toUpperCase()} LOGIN PORTAL
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
                        Secure voice-powered authentication for {role}s
                    </p>
                </div>

                {/* Voice Collection Status */}
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
                    
                    <h2 style={{ 
                        fontSize: '1.875rem', 
                        marginBottom: '2rem', 
                        fontWeight: 700,
                        color: '#0f172a',
                        letterSpacing: '-0.025em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>🎤</span>
                        VOICE LOGIN SYSTEM
                    </h2>
                    
                    {/* Student Information Display */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ 
                            fontSize: '1.25rem', 
                            marginBottom: '1.5rem', 
                            fontWeight: 700,
                            color: '#0f172a',
                            letterSpacing: '-0.025em'
                        }}>
                            {role.toUpperCase()} INFORMATION
                        </h3>
                        
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: role === 'student' ? 'repeat(2, 1fr)' : '1fr', 
                            gap: '1.5rem', 
                            marginBottom: '1.5rem'
                        }}>
                            <div style={{
                                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1rem',
                                padding: '1.5rem',
                                boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)'
                            }}>
                                <p style={{ 
                                    fontSize: '0.875rem', 
                                    color: '#64748b', 
                                    marginBottom: '0.5rem',
                                    fontWeight: 500,
                                    letterSpacing: '0.025em',
                                    textTransform: 'uppercase'
                                }}>
                                    Name
                                </p>
                                <p style={{ 
                                    fontWeight: 700, 
                                    fontSize: '1.125rem', 
                                    color: '#0f172a',
                                    letterSpacing: '-0.025em'
                                }}>
                                    {studentData.name || 'Listening...'}
                                </p>
                            </div>
                            
                            {role === 'student' && (
                                <div style={{
                                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '1rem',
                                    padding: '1.5rem',
                                    boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)'
                                }}>
                                    <p style={{ 
                                        fontSize: '0.875rem', 
                                        color: '#64748b', 
                                        marginBottom: '0.5rem',
                                        fontWeight: 500,
                                        letterSpacing: '0.025em',
                                        textTransform: 'uppercase'
                                    }}>
                                        Class
                                    </p>
                                    <p style={{ 
                                        fontWeight: 700, 
                                        fontSize: '1.125rem', 
                                        color: '#0f172a',
                                        letterSpacing: '-0.025em'
                                    }}>
                                        {studentData.class || 'Listening...'}
                                    </p>
                                </div>
                            )}
                            
                            {role === 'student' && (
                                <div style={{
                                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '1rem',
                                    padding: '1.5rem',
                                    boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)'
                                }}>
                                    <p style={{ 
                                        fontSize: '0.875rem', 
                                        color: '#64748b', 
                                        marginBottom: '0.5rem',
                                        fontWeight: 500,
                                        letterSpacing: '0.025em',
                                        textTransform: 'uppercase'
                                    }}>
                                        School
                                    </p>
                                    <p style={{ 
                                        fontWeight: 700, 
                                        fontSize: '1.125rem', 
                                        color: '#0f172a',
                                        letterSpacing: '-0.025em'
                                    }}>
                                        {studentData.school || 'Listening...'}
                                    </p>
                                </div>
                            )}
                            
                            <div style={{
                                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1rem',
                                padding: '1.5rem',
                                boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)'
                            }}>
                                <p style={{ 
                                    fontSize: '0.875rem', 
                                    color: '#64748b', 
                                    marginBottom: '0.5rem',
                                    fontWeight: 500,
                                    letterSpacing: '0.025em',
                                    textTransform: 'uppercase'
                                }}>
                                    Email
                                </p>
                                <p style={{ 
                                    fontWeight: 700, 
                                    fontSize: '1.125rem', 
                                    color: '#0f172a',
                                    letterSpacing: '-0.025em',
                                    wordBreak: 'break-all'
                                }}>
                                    {email || 'Listening...'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Voice Status Indicator */}
                    <div style={{ 
                        textAlign: 'center', 
                        padding: '3rem', 
                        border: '2px dashed #cbd5e1', 
                        marginBottom: '2rem',
                        borderRadius: '1rem',
                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
                    }}>
                        <div style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                            border: '2px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.5rem',
                            animation: isListening ? 'pulse 2s infinite' : 'float 8s ease-in-out infinite',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
                        }}>
                            <span style={{ fontSize: '3rem' }}>
                                {isListening ? '👂' : '🎙️'}
                            </span>
                        </div>
                        
                        <p style={{ 
                            fontWeight: 700, 
                            fontSize: '1.125rem',
                            color: '#0f172a',
                            marginBottom: '1rem',
                            letterSpacing: '-0.025em'
                        }}>
                            {isListening ? 'Listening for voice input...' : 'Voice assistant ready'}
                        </p>
                        
                        {/* Recognized Text Display */}
                        {recognizedText && (
                            <div style={{ 
                                marginTop: '1.5rem', 
                                padding: '1.5rem', 
                                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                border: '1px solid #3b82f6',
                                borderRadius: '1rem',
                                textAlign: 'left',
                                boxShadow: '0 4px 6px -1px rgb(59 130 246 / 0.2)'
                            }}>
                                <p style={{ 
                                    fontSize: '0.875rem', 
                                    color: '#64748b', 
                                    margin: '0 0 0.75rem 0',
                                    fontWeight: 600,
                                    letterSpacing: '0.025em',
                                    textTransform: 'uppercase'
                                }}>
                                    {confirmingType === 'email' || status.includes('email') ? '📧 Email received:' : '🔐 Password received:'}
                                </p>
                                <p style={{ 
                                    fontWeight: 700, 
                                    fontSize: '1.125rem', 
                                    margin: 0,
                                    color: '#0f172a',
                                    letterSpacing: '-0.025em',
                                    wordBreak: 'break-all'
                                }}>
                                    {recognizedText}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Manual Login Fallback (for teachers/admins) */}
                {role !== 'student' && (
                    <div style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '1.5rem',
                        padding: '3rem',
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
                            marginBottom: '2rem', 
                            fontWeight: 700,
                            color: '#0f172a',
                            letterSpacing: '-0.025em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <span style={{ fontSize: '1.5rem' }}>⌨️</span>
                            MANUAL LOGIN
                        </h2>
                        
                        <form onSubmit={handleManualLogin}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '0.75rem', 
                                    fontWeight: 600,
                                    color: '#0f172a',
                                    letterSpacing: '0.025em'
                                }}>
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    style={{ 
                                        width: '100%', 
                                        padding: '1rem 1.25rem', 
                                        border: '1px solid #e2e8f0', 
                                        borderRadius: '0.75rem',
                                        fontSize: '1rem',
                                        background: '#ffffff',
                                        color: '#0f172a',
                                        outline: 'none',
                                        boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        fontWeight: 500,
                                        letterSpacing: '0.025em'
                                    }}
                                    placeholder="Enter your email address"
                                    required
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#3b82f6';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1), 0 4px 6px -1px rgb(15 23 42 / 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = '#e2e8f0';
                                        e.target.style.boxShadow = '0 1px 3px 0 rgb(15 23 42 / 0.1)';
                                    }}
                                />
                            </div>
                            
                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '0.75rem', 
                                    fontWeight: 600,
                                    color: '#0f172a',
                                    letterSpacing: '0.025em'
                                }}>
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    style={{ 
                                        width: '100%', 
                                        padding: '1rem 1.25rem', 
                                        border: '1px solid #e2e8f0', 
                                        borderRadius: '0.75rem',
                                        fontSize: '1rem',
                                        background: '#ffffff',
                                        color: '#0f172a',
                                        outline: 'none',
                                        boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        fontWeight: 500,
                                        letterSpacing: '0.025em'
                                    }}
                                    placeholder="Enter your password"
                                    required
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#3b82f6';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1), 0 4px 6px -1px rgb(15 23 42 / 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = '#e2e8f0';
                                        e.target.style.boxShadow = '0 1px 3px 0 rgb(15 23 42 / 0.1)';
                                    }}
                                />
                            </div>
                            
                            <button 
                                type="submit" 
                                style={{ 
                                    width: '100%', 
                                    fontSize: '1rem', 
                                    padding: '1rem 2rem',
                                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.1)',
                                    letterSpacing: '0.025em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
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
                                <span>🔐</span>
                                LOGIN AS {role.toUpperCase()}
                            </button>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );

};



export default LoginPage;

