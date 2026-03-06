import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
    getTeacherProfile, 
    getTeacherAssessments, 
    uploadTeacherAssessment, 
    deleteTeacherAssessment,
    submitTeacherFeedback,
    getClassAnalytics,
    exportTeacherReports
} from '../services/api';
import '../styles/index.css';

const TeacherDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [status, setStatus] = useState('TEACHER HUB: ONLINE');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Dynamic data from database
    const [teacherData, setTeacherData] = useState({
        name: 'Teacher',
        school: 'EduVoice Academy',
        email: '',
        classes: [],
        subjects: []
    });
    const [students, setStudents] = useState([]);
    const [uploadedAssessments, setUploadedAssessments] = useState([]);

    const [assessmentFile, setAssessmentFile] = useState(null);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [assessmentTarget, setAssessmentTarget] = useState('class');
    const [targetStudentId, setTargetStudentId] = useState('');

    // Modal states
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isScoresModalOpen, setIsScoresModalOpen] = useState(false);
    const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

    // Data states
    const [feedbackStudent, setFeedbackStudent] = useState(null);
    const [feedbackMsg, setFeedbackMsg] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [analyticsData, setAnalyticsData] = useState(null);
    const [reportsData, setReportsData] = useState([]);
    const [isRecording, setIsRecording] = useState(false);

    useEffect(() => {
        console.log('TeacherDashboard: Component mounted');
        console.log('TeacherDashboard: Current User Context:', user);
        fetchDashboardData();
    }, [user]);

    const fetchDashboardData = async () => {
        if (!user) {
            console.log('TeacherDashboard: No user in context');
            setIsLoading(false);
            return;
        }

        const tId = user.teacherId || user.id || 'T001';
        console.log('TeacherDashboard: Fetching data for', tId);
        
        setIsLoading(true);
        setError(null);

        try {
            // Fetch profile and students
            const profileRes = await getTeacherProfile(tId);
            console.log('TeacherDashboard: Profile loaded', profileRes.data);
            if (profileRes.data) {
                setTeacherData(profileRes.data.teacher);
                setStudents(profileRes.data.students || []);
                
                // Set default selections
                if (profileRes.data.teacher.classes?.length > 0) {
                    setSelectedClass(profileRes.data.teacher.classes[0]);
                }
                if (profileRes.data.teacher.subjects?.length > 0) {
                    setSelectedSubject(profileRes.data.teacher.subjects[0]);
                }
            }

            // Fetch assessments
            const assessmentsRes = await getTeacherAssessments(tId);
            if (assessmentsRes.data) {
                setUploadedAssessments(assessmentsRes.data.assessments || []);
            }

        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            setError('Failed to load dashboard data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async () => {
        if (!assessmentFile || !user) return;
        const tId = user.teacherId || user.id;

        const formData = new FormData();
        formData.append('title', assessmentFile.name.replace(/\.[^/.]+$/, ''));
        formData.append('class', selectedClass);
        formData.append('subject', selectedSubject);
        formData.append('target', assessmentTarget);
        if (assessmentTarget === 'individual') {
            formData.append('targetStudentId', targetStudentId);
        }
        formData.append('assessmentPdf', assessmentFile);

        setStatus('UPLOADING...');
        try {
            await uploadTeacherAssessment(tId, formData);
            setStatus('ASSESSMENT PUBLISHED!');
            setAssessmentFile(null);
            
            // Refresh assessments
            const res = await getTeacherAssessments(tId);
            setUploadedAssessments(res.data.assessments || []);
            
            setTimeout(() => setStatus('TEACHER HUB: ONLINE'), 3000);
        } catch (err) {
            console.error('Upload error:', err);
            setStatus('UPLOAD FAILED');
            setTimeout(() => setStatus('TEACHER HUB: ONLINE'), 3000);
        }
    };

    const handleDeleteAssessment = async (assessmentId) => {
        if (!user) return;
        const tId = user.teacherId || user.id || 'T001';

        if (!window.confirm('Are you sure you want to delete this assessment?')) return;

        setStatus('DELETING...');
        try {
            await deleteTeacherAssessment(tId, assessmentId);
            setUploadedAssessments(prev => prev.filter(a => a._id !== assessmentId));
            setStatus('ASSESSMENT REMOVED');
            alert('Assessment deleted successfully');
            setTimeout(() => setStatus('TEACHER HUB: ONLINE'), 2000);
        } catch (err) {
            console.error('TeacherDashboard: Delete error', err);
            setStatus('DELETE FAILED');
            alert(`Delete failed: ${err.response?.data?.error || err.message}`);
            setTimeout(() => setStatus('TEACHER HUB: ONLINE'), 3000);
        }
    };

    const handleSendFeedback = async () => {
        console.log('TeacherDashboard: handleSendFeedback triggered', { feedbackMsg, feedbackStudent });
        if (!feedbackMsg.trim() || !user || !feedbackStudent) {
            console.log('TeacherDashboard: Aborting feedback - missing data');
            return;
        }
        const tId = user.teacherId || user.id || 'T001';
        const sId = feedbackStudent.studentId || feedbackStudent._id;

        setStatus('SENDING...');
        try {
            console.log('TeacherDashboard: Calling submitTeacherFeedback', { tId, sId });
            const res = await submitTeacherFeedback(tId, { 
                message: feedbackMsg, 
                targetStudentId: sId 
            });
            console.log('TeacherDashboard: Feedback response', res.data);
            
            setStatus(`FEEDBACK SENT TO ${feedbackStudent.name.toUpperCase()}!`);
            alert(`Feedback successfully sent to ${feedbackStudent.name}`);
            setIsFeedbackOpen(false);
            setFeedbackMsg('');
            setTimeout(() => setStatus('TEACHER HUB: ONLINE'), 3000);
        } catch (err) {
            console.error('TeacherDashboard: Feedback error', err);
            setStatus('FEEDBACK FAILED');
            alert(`Failed to send feedback: ${err.response?.data?.error || err.message}`);
            setTimeout(() => setStatus('TEACHER HUB: ONLINE'), 3000);
        }
    };

    const handleViewScores = async () => {
        if (!user) return;
        setIsScoresModalOpen(true);
        // Scores are basically derived from students session history
    };

    const handleViewAnalytics = async () => {
        if (!user) return;
        const tId = user.teacherId || user.id || 'T001';
        console.log('TeacherDashboard: handleViewAnalytics triggered for', tId);
        setStatus('FETCHING ANALYTICS...');
        try {
            const res = await getClassAnalytics(tId);
            console.log('TeacherDashboard: Analytics response', res.data);
            if (res.data?.analytics) {
                setAnalyticsData(res.data.analytics);
                setIsAnalyticsModalOpen(true);
            } else {
                console.log('TeacherDashboard: No analytics data in response');
            }
            setStatus('TEACHER HUB: ONLINE');
        } catch (err) {
            console.error('TeacherDashboard: Analytics error', err);
            setStatus('ANALYTICS FAILED');
            setTimeout(() => setStatus('TEACHER HUB: ONLINE'), 3000);
        }
    };

    const handleExportReports = async () => {
        if (!user) return;
        const tId = user.teacherId || user.id || 'T001';
        console.log('TeacherDashboard: handleExportReports triggered for', tId);
        setStatus('EXPORTING REPORTS...');
        try {
            const res = await exportTeacherReports(tId);
            console.log('TeacherDashboard: Export response', res.data);
            if (res.data?.reports) {
                const reports = res.data.reports;
                console.log(`TeacherDashboard: Generating CSV for ${reports.length} reports`);
                // Create CSV
                const headers = ['Name', 'ID', 'Class', 'Avg Score', 'Sessions', 'Weak Topics', 'Mastered Topics'];
                const csvContent = [
                    headers.join(','),
                    ...reports.map(r => [
                        `"${r.name}"`, r.studentId, r.class, r.avgScore, r.sessionsCount, `"${r.weakTopics}"`, `"${r.masteredTopics}"`
                    ].join(','))
                ].join('\n');

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.setAttribute('download', `EduVoice_Report_${new Date().toLocaleDateString()}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setStatus('REPORT DOWNLOADED ✓');
                setTimeout(() => setStatus('TEACHER HUB: ONLINE'), 3000);
            } else {
                console.log('TeacherDashboard: No reports data in response');
                setStatus('NO REPORTS FOUND');
                setTimeout(() => setStatus('TEACHER HUB: ONLINE'), 3000);
            }
        } catch (err) {
            console.error('TeacherDashboard: Export error', err);
            setStatus('EXPORT FAILED');
            setTimeout(() => setStatus('TEACHER HUB: ONLINE'), 3000);
        }
    };

    const handleRecordVoice = () => {
        setIsVoiceModalOpen(true);
    };

    const getStudentsForClass = (className) => {
        const classNum = className.replace('Class ', '');
        return students.filter(s => s.class === classNum);
    };

    // ── Shared button styles ──
    const btnStyle = (active, colorActive = '#3b82f6', colorActiveEnd = '#2563eb') => ({
        padding: '0.75rem 1.5rem',
        borderRadius: '0.75rem',
        border: 'none',
        fontWeight: 700,
        fontSize: '0.875rem',
        cursor: 'pointer',
        letterSpacing: '0.025em',
        transition: 'all 0.25s ease',
        background: active
            ? `linear-gradient(135deg, ${colorActive} 0%, ${colorActiveEnd} 100%)`
            : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
        color: active ? '#fff' : '#475569',
        boxShadow: active ? '0 4px 6px -1px rgba(59,130,246,0.25)' : '0 1px 3px rgba(15,23,42,0.1)',
    });

    const cardStyle = {
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid #e2e8f0',
        borderRadius: '1.5rem',
        padding: '2.5rem',
        marginBottom: '2.5rem',
        boxShadow: '0 10px 15px -3px rgb(15 23 42 / 0.07), 0 4px 6px -4px rgb(15 23 42 / 0.07)',
        position: 'relative',
        overflow: 'hidden',
    };

    const topLine = {
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, #cbd5e1, transparent)'
    };

    if (isLoading && !teacherData.email) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: '2rem' }}>
                <div className="loader">Loading Teacher Hub...</div>
                <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Please wait while we connect to the database.</div>
                <button 
                    onClick={() => navigate('/login')}
                    style={{ ...btnStyle(false), padding: '0.625rem 1.25rem' }}
                >← Back to Login</button>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            {/* Premium ambient background */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none',
                background: 'radial-gradient(circle at 20% 80%, rgba(59,130,246,0.06), transparent 60%), radial-gradient(circle at 80% 20%, rgba(15,23,42,0.04), transparent 60%)',
                filter: 'blur(80px)'
            }} />

            {/* ── NAVBAR ── */}
            <nav style={{
                padding: '1.25rem 3rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                position: 'sticky', top: 0, zIndex: 100,
                backdropFilter: 'blur(20px)',
                background: 'rgba(255,255,255,0.85)',
                borderBottom: '1px solid rgba(226,232,240,0.6)',
                boxShadow: '0 1px 4px rgba(15,23,42,0.06)'
            }}>
                <div style={{ fontWeight: 700, fontSize: '1.5rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.625rem', letterSpacing: '-0.025em' }}>
                    <span style={{ fontSize: '1.75rem' }}>🎓</span>
                    <span>EduVoice AI</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0f172a' }}>{teacherData.name}</div>
                        <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>{teacherData.school}</div>
                    </div>
                    <div style={{
                        width: '42px', height: '42px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: '1.125rem',
                        boxShadow: '0 4px 6px -1px rgb(59 130 246 / 0.3)'
                    }}>T</div>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            ...btnStyle(false),
                            padding: '0.625rem 1.25rem',
                            fontSize: '0.8125rem'
                        }}
                    >← Logout</button>
                </div>
            </nav>

            {/* ── MAIN ── */}
            <main style={{ maxWidth: '1300px', margin: '0 auto', padding: '2.5rem 2rem', position: 'relative', zIndex: 1 }}>

                {error && (
                    <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '0.75rem', marginBottom: '2rem', fontWeight: 600, border: '1px solid #fecaca' }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Welcome card */}
                <div style={cardStyle}>
                    <div style={topLine} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.375rem 0.875rem',
                                background: '#d1fae5', border: '1px solid #34d399',
                                borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 700,
                                color: '#065f46', letterSpacing: '0.05em',
                                textTransform: 'uppercase', marginBottom: '1rem'
                            }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                {status}
                            </div>
                            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em', marginBottom: '0.5rem' }}>
                                Welcome back, {teacherData.name}
                            </h1>
                            <div style={{ color: '#64748b', fontWeight: 500, display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                <span>🏛️ {teacherData.school}</span>
                                <span>📧 {teacherData.email}</span>
                            </div>
                        </div>
                        <div style={{
                            width: '72px', height: '72px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontSize: '1.875rem',
                            boxShadow: '0 12px 20px -4px rgb(59 130 246 / 0.3)'
                        }}>👩‍🏫</div>
                    </div>
                </div>

                {/* ── ASSESSMENT HUB ── */}
                <div style={cardStyle}>
                    <div style={topLine} />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.025em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span>📤</span> Assessment Hub
                    </h2>
                    <p style={{ color: '#64748b', fontWeight: 500, marginBottom: '2rem', fontSize: '0.9375rem' }}>
                        Create and assign assessments to your students. Assessments will be delivered via voice interface.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                        {/* LEFT: form */}
                        <div>
                            {/* Class */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.5rem', color: '#374151', fontSize: '0.875rem', letterSpacing: '0.025em' }}>SELECT CLASS</label>
                                <select
                                    value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                                    style={{ width: '100%', padding: '0.875rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9375rem', background: '#fff', color: '#0f172a', outline: 'none', boxShadow: '0 1px 3px rgba(15,23,42,0.08)', fontFamily: 'inherit', fontWeight: 500 }}
                                >
                                    <option value="">Choose a class...</option>
                                    {teacherData.classes?.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                                </select>
                            </div>

                            {/* Subject */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.5rem', color: '#374151', fontSize: '0.875rem', letterSpacing: '0.025em' }}>SELECT SUBJECT</label>
                                <select
                                    value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
                                    style={{ width: '100%', padding: '0.875rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9375rem', background: '#fff', color: '#0f172a', outline: 'none', boxShadow: '0 1px 3px rgba(15,23,42,0.08)', fontFamily: 'inherit', fontWeight: 500 }}
                                >
                                    <option value="">Choose a subject...</option>
                                    {teacherData.subjects?.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                                </select>
                            </div>

                            {/* Target toggle */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.5rem', color: '#374151', fontSize: '0.875rem', letterSpacing: '0.025em' }}>TARGET</label>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button onClick={() => setAssessmentTarget('class')} style={{ ...btnStyle(assessmentTarget === 'class'), flex: 1 }}>📚 Entire Class</button>
                                    <button onClick={() => setAssessmentTarget('individual')} style={{ ...btnStyle(assessmentTarget === 'individual'), flex: 1 }}>👤 Individual</button>
                                </div>
                            </div>

                            {/* Individual student selector */}
                            {assessmentTarget === 'individual' && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.5rem', color: '#374151', fontSize: '0.875rem', letterSpacing: '0.025em' }}>SELECT STUDENT</label>
                                    <select
                                        value={targetStudentId} onChange={e => setTargetStudentId(e.target.value)}
                                        style={{ width: '100%', padding: '0.875rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.9375rem', background: '#fff', color: '#0f172a', outline: 'none', boxShadow: '0 1px 3px rgba(15,23,42,0.08)', fontFamily: 'inherit', fontWeight: 500 }}
                                    >
                                        <option value="">Choose a student...</option>
                                        {getStudentsForClass(selectedClass).map(s => (
                                            <option key={s._id} value={s.studentId}>{s.name} ({s.studentId})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* File upload */}
                            <div style={{
                                border: '2px dashed #cbd5e1', borderRadius: '1rem',
                                padding: '1.5rem', textAlign: 'center', marginBottom: '1.5rem',
                                background: assessmentFile ? 'linear-gradient(135deg, #d1fae5, #d4f4e4)' : '#f8fafc',
                                transition: 'all 0.2s'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                                <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                                    {assessmentFile ? `✅ ${assessmentFile.name}` : 'Upload PDF assessment file'}
                                </div>
                                <input
                                    type="file" accept=".pdf"
                                    onChange={e => setAssessmentFile(e.target.files[0])}
                                    style={{ border: 'none', background: 'transparent', boxShadow: 'none', width: 'auto', padding: 0 }}
                                />
                            </div>

                            {/* Publish button */}
                            <button
                                onClick={handleUpload}
                                disabled={!assessmentFile || !selectedClass || !selectedSubject || (assessmentTarget === 'individual' && !targetStudentId)}
                                style={{
                                    width: '100%', padding: '1rem', borderRadius: '0.875rem',
                                    border: 'none', fontWeight: 700, fontSize: '1rem',
                                    letterSpacing: '0.025em', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    transition: 'all 0.25s ease',
                                    background: (!assessmentFile || !selectedClass || !selectedSubject || (assessmentTarget === 'individual' && !targetStudentId))
                                        ? 'linear-gradient(135deg, #f1f5f9, #e2e8f0)'
                                        : 'linear-gradient(135deg, #10b981, #059669)',
                                    color: '#fff',
                                    opacity: (!assessmentFile || !selectedClass || !selectedSubject || (assessmentTarget === 'individual' && !targetStudentId)) ? 0.6 : 1
                                }}
                            >
                                <span>📤</span> Publish Assessment
                            </button>
                        </div>

                        {/* RIGHT: uploaded assessments list */}
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem', letterSpacing: '-0.025em' }}>
                                Uploaded Assessments ({uploadedAssessments.length})
                            </h3>
                            <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                                {uploadedAssessments.length === 0 && (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9375rem', fontStyle: 'italic', border: '1px solid #e2e8f0', borderRadius: '0.875rem' }}>
                                        No assessments uploaded yet.
                                    </div>
                                )}
                                {uploadedAssessments.map(a => (
                                    <div key={a._id} style={{
                                        padding: '1.25rem 1.5rem',
                                        background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                                        border: '1px solid #e2e8f0', borderRadius: '0.875rem',
                                        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                                        display: 'flex', gap: '1rem', alignItems: 'flex-start'
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>{a.title}</div>
                                            <div style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 500, marginBottom: '0.375rem' }}>
                                                {a.subject} · {a.class} · {a.target}
                                            </div>
                                            <div style={{ fontSize: '0.8125rem', color: '#94a3b8', display: 'flex', gap: '0.875rem' }}>
                                                <span>📅 {new Date(a.date).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteAssessment(a._id)}
                                            style={{
                                                padding: '0.5rem 0.875rem', fontSize: '0.8125rem', fontWeight: 700,
                                                background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff',
                                                border: 'none', borderRadius: '0.5rem', cursor: 'pointer'
                                            }}
                                        >Delete</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── STUDENT PROGRESS ── */}
                <div style={cardStyle}>
                    <div style={topLine} />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.025em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span>📈</span> Student Progress
                    </h2>
                    <p style={{ color: '#64748b', fontWeight: 500, marginBottom: '2rem', fontSize: '0.9375rem' }}>
                        Monitor individual student performance and assessment results.
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                            <thead>
                                <tr style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderBottom: '2px solid #e2e8f0' }}>
                                    {['Student', 'Class', 'Progress', 'Last Active', 'Actions'].map(h => (
                                        <th key={h} style={{ padding: '1rem 1.25rem', textAlign: 'left', fontSize: '0.8125rem', fontWeight: 700, color: '#374151', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {students.map(student => {
                                    const scores = student.sessionHistory?.filter(s => s.score !== undefined).map(s => s.score) || [];
                                    const avgProgress = scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : 0;
                                    
                                    return (
                                        <tr key={student._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '1rem 1.25rem' }}>
                                                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem' }}>{student.name}</div>
                                                <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>ID: {student.studentId}</div>
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: '#374151' }}>Class {student.class}</td>
                                            <td style={{ padding: '1rem 1.25rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                    <div style={{ width: '80px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${avgProgress}%`, height: '100%', borderRadius: '4px',
                                                            background: avgProgress >= 80 ? '#10b981' : avgProgress >= 60 ? '#f59e0b' : '#ef4444'
                                                        }} />
                                                    </div>
                                                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>{avgProgress}%</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem', fontSize: '0.875rem', color: '#64748b' }}>
                                                {student.lastActiveAt ? new Date(student.lastActiveAt).toLocaleDateString() : 'Never'}
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        onClick={() => { setSelectedStudent(student); setIsDetailsOpen(true); }}
                                                        style={{ ...btnStyle(true, '#3b82f6', '#2563eb'), padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
                                                    >View Details</button>
                                                    <button
                                                        onClick={() => { setFeedbackStudent(student); setIsFeedbackOpen(true); }}
                                                        style={{ ...btnStyle(false), padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
                                                    >Feedback</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── GRADING & FEEDBACK QUICK ACTIONS ── */}
                <div style={cardStyle}>
                    <div style={topLine} />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.025em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span>🔧</span> Grading &amp; Feedback
                    </h2>
                    <p style={{ color: '#64748b', fontWeight: 500, marginBottom: '2rem', fontSize: '0.9375rem' }}>
                        Review assessment scores and provide feedback to students.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                        {[
                            { icon: '📊', label: 'Review All Scores',    color: '#3b82f6', end: '#2563eb', onClick: () => { console.log('Action: Review Scores'); handleViewScores(); } },
                            { icon: '🎤', label: 'Record Voice Feedback', color: '#10b981', end: '#059669', onClick: () => { console.log('Action: Record Voice'); handleRecordVoice(); } },
                            { icon: '📤', label: 'Export Reports',        color: '#6366f1', end: '#4f46e5', onClick: () => { console.log('Action: Export Reports'); handleExportReports(); } },
                            { icon: '📈', label: 'Class Analytics',       color: '#f59e0b', end: '#d97706', onClick: () => { console.log('Action: Analytics'); handleViewAnalytics(); } },
                        ].map(({ icon, label, color, end, onClick }) => (
                            <button
                                key={label}
                                onClick={onClick}
                                style={{
                                    padding: '1.75rem 1.25rem', borderRadius: '1rem', 
                                    background: `linear-gradient(135deg, ${color}18, ${end}10)`,
                                    border: `1px solid ${color}30`,
                                    color: '#0f172a', fontWeight: 700, fontSize: '0.9375rem',
                                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', gap: '0.75rem',
                                    transition: 'all 0.25s ease',
                                    boxShadow: '0 2px 4px rgba(15,23,42,0.05)'
                                }}
                            >
                                <span style={{ fontSize: '2rem' }}>{icon}</span>
                                <span style={{ letterSpacing: '0.025em', textAlign: 'center' }}>{label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </main>

            {/* ── STUDENT DETAILS MODAL ── */}
            {isDetailsOpen && selectedStudent && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', borderRadius: '1.5rem', padding: '2rem', maxWidth: '480px', width: '90%', boxShadow: '0 25px 50px rgba(15,23,42,0.25)', position: 'relative' }}>
                        <button onClick={() => setIsDetailsOpen(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.5rem' }}>📋 Student Details</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                            {[
                                { label: 'Name', value: selectedStudent.name },
                                { label: 'Class', value: `Class ${selectedStudent.class}` },
                                { label: 'Student ID', value: selectedStudent.studentId },
                                { label: 'Weak Topics', value: selectedStudent.weakTopics?.join(', ') || 'None' },
                                { label: 'Mastered Topics', value: selectedStudent.masteredTopics?.join(', ') || 'None' },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '0.625rem', border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontWeight: 600, color: '#64748b', fontSize: '0.875rem' }}>{label}</span>
                                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem', textAlign: 'right' }}>{value}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setIsDetailsOpen(false)} style={{ ...btnStyle(true), width: '100%', marginTop: '1.5rem', padding: '0.875rem' }}>Close</button>
                    </div>
                </div>
            )}

            {/* ── FEEDBACK MODAL ── */}
            {isFeedbackOpen && feedbackStudent && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', borderRadius: '1.5rem', padding: '2rem', maxWidth: '480px', width: '90%', boxShadow: '0 25px 50px rgba(15,23,42,0.25)', position: 'relative' }}>
                        <button onClick={() => setIsFeedbackOpen(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>📝 Send Feedback</h3>
                        <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>To: <strong>{feedbackStudent.name}</strong></p>
                        <textarea
                            value={feedbackMsg}
                            onChange={e => setFeedbackMsg(e.target.value)}
                            placeholder="Type your feedback message..."
                            rows={5}
                            style={{ width: '100%', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.875rem', fontSize: '0.9375rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                            <button onClick={() => { setIsFeedbackOpen(false); setFeedbackMsg(''); }} style={{ ...btnStyle(false), flex: 1, padding: '0.875rem' }}>Cancel</button>
                            <button
                                onClick={handleSendFeedback}
                                disabled={!feedbackMsg.trim()}
                                style={{ ...btnStyle(true, '#10b981', '#059669'), flex: 1, padding: '0.875rem', opacity: feedbackMsg.trim() ? 1 : 0.5, cursor: feedbackMsg.trim() ? 'pointer' : 'not-allowed' }}
                            >Send ✓</button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── SCORES MODAL ── */}
            {isScoresModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', borderRadius: '1.5rem', padding: '2rem', maxWidth: '800px', width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(15,23,42,0.25)', position: 'relative' }}>
                        <button onClick={() => setIsScoresModalOpen(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.5rem' }}>📊 Detailed Student Scores</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Student</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Subject</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Score</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.flatMap(s => s.sessionHistory?.map(sh => ({ ...sh, studentName: s.name })) || []).sort((a,b) => new Date(b.date) - new Date(a.date)).length === 0 ? (
                                    <tr>
                                        <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No assessment scores available yet.</td>
                                    </tr>
                                ) : (
                                    students.flatMap(s => s.sessionHistory?.map(sh => ({ ...sh, studentName: s.name })) || []).sort((a,b) => new Date(b.date) - new Date(a.date)).map((score, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>{score.studentName}</td>
                                            <td style={{ padding: '0.75rem' }}>{score.subject}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: score.score >= 80 ? '#10b981' : score.score >= 50 ? '#f59e0b' : '#ef4444' }}>{score.score}%</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8rem' }}>{new Date(score.date).toLocaleDateString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        <button onClick={() => setIsScoresModalOpen(false)} style={{ ...btnStyle(true), width: '100%', marginTop: '1.5rem' }}>Close</button>
                    </div>
                </div>
            )}

            {/* ── ANALYTICS MODAL ── */}
            {isAnalyticsModalOpen && analyticsData && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', borderRadius: '1.5rem', padding: '2.5rem', maxWidth: '900px', width: '95%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(15,23,42,0.25)', position: 'relative' }}>
                        <button onClick={() => setIsAnalyticsModalOpen(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '2rem', textAlign: 'center' }}>📈 Class Performance Analytics</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                            <div style={{ padding: '1.5rem', background: '#f0f9ff', borderRadius: '1rem', border: '1px solid #bae6fd', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Students</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0c4a6e' }}>{analyticsData.totalStudents}</div>
                            </div>
                            <div style={{ padding: '1.5rem', background: '#f0fdf4', borderRadius: '1rem', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Sessions</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#064e3b' }}>{analyticsData.totalSessions}</div>
                            </div>
                            <div style={{ padding: '1.5rem', background: '#fffbeb', borderRadius: '1rem', border: '1px solid #fef3c7', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Mastered Topics</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#78350f' }}>{analyticsData.topMasteredTopics?.length || 0}</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div>
                                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Subject Performance</h4>
                                {analyticsData.subjectPerformance?.map(sp => (
                                    <div key={sp.subject} style={{ marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>
                                            <span>{sp.subject}</span>
                                            <span>{sp.avg}%</span>
                                        </div>
                                        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${sp.avg}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '4px' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ background: '#fef2f2', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #fee2e2' }}>
                                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#991b1b', marginBottom: '0.75rem' }}>⚠️ Common Weak Areas</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {analyticsData.topWeakTopics?.map(t => <span key={t} style={{ padding: '0.4rem 0.8rem', background: '#fff', borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', border: '1px solid #fecaca' }}>{t}</span>)}
                                    </div>
                                </div>
                                <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #dcfce7' }}>
                                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#166534', marginBottom: '0.75rem' }}>✅ Top Mastered Topics</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {analyticsData.topMasteredTopics?.map(t => <span key={t} style={{ padding: '0.4rem 0.8rem', background: '#fff', borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 700, color: '#15803d', border: '1px solid #bbf7d0' }}>{t}</span>)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button onClick={() => setIsAnalyticsModalOpen(false)} style={{ ...btnStyle(true), width: '100%', marginTop: '2.5rem', padding: '1rem' }}>Done</button>
                    </div>
                </div>
            )}

            {/* ── VOICE FEEDBACK MODAL ── */}
            {isVoiceModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', borderRadius: '2rem', padding: '2.5rem', maxWidth: '450px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px rgba(15,23,42,0.25)', position: 'relative' }}>
                        <button onClick={() => setIsVoiceModalOpen(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>🎤 Record Voice Feedback</h3>
                        
                        <div style={{ 
                            width: '120px', height: '120px', borderRadius: '50%', background: isRecording ? '#fee2e2' : '#f1f5f9', 
                            margin: '0 auto 2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            border: isRecording ? '4px solid #ef4444' : '4px solid transparent',
                            boxShadow: isRecording ? '0 0 20px rgba(239, 68, 68, 0.4)' : 'none'
                        }}
                        onClick={() => setIsRecording(!isRecording)}
                        >
                            <span style={{ fontSize: '3.5rem', animation: isRecording ? 'pulse 1.5s infinite' : 'none' }}>{isRecording ? '⏹' : '🎤'}</span>
                        </div>

                        <p style={{ fontWeight: 600, color: isRecording ? '#ef4444' : '#64748b', marginBottom: '2rem' }}>
                            {isRecording ? 'RECORDING... SPEAK NOW' : 'TAP THE MIC TO START RECORDING'}
                        </p>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => { setIsVoiceModalOpen(false); setIsRecording(false); }} style={{ ...btnStyle(false), flex: 1 }}>Cancel</button>
                            <button 
                                disabled={isRecording}
                                onClick={() => {
                                    setStatus('VOICE FEEDBACK BROADCASTED!');
                                    setIsVoiceModalOpen(false);
                                    setTimeout(() => setStatus('TEACHER HUB: ONLINE'), 3000);
                                }}
                                style={{ ...btnStyle(true, '#10b981', '#059669'), flex: 1, opacity: isRecording ? 0.5 : 1 }}
                            >Broadcast ✓</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherDashboard;
