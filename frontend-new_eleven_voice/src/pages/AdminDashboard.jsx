import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    getAdminProfile, 
    getAllStudentsAdmin,
    deleteStudentAdmin, 
    getAllBooksAdmin, 
    uploadBookAdmin, 
    deleteBookAdmin,
    triggerManualCallAdmin,
    exportAdminReports,
    auditAiSessions,
    getAllTeachersAdmin,
    deleteTeacherAdmin,
    backupDataAdmin
} from '../services/api';
import '../styles/index.css';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState('ADMIN CONSOLE: CONNECTING...');
    const [fileUploaded, setFileUploaded] = useState(false);
    
    const [adminData, setAdminData] = useState(null);
    const [students, setStudents] = useState([]);
    const [uploadedBooks, setUploadedBooks] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [aiLogs, setAiLogs] = useState([]);

    const [file, setFile] = useState(null);
    const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
    const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
    const ADMIN_ID = 'A001'; // Mock logged-in admin ID

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            const adminRes = await getAdminProfile(ADMIN_ID);
            setAdminData({
                name: adminRes.data.admin.name,
                email: adminRes.data.admin.email
            });

            const studentsRes = await getAllStudentsAdmin(ADMIN_ID);
            setStudents(studentsRes.data.students);

            const booksRes = await getAllBooksAdmin(ADMIN_ID);
            setUploadedBooks(booksRes.data.books);

            const teachersRes = await getAllTeachersAdmin(ADMIN_ID);
            setTeachers(teachersRes.data.teachers);

            setStatus('ADMIN CONSOLE: ONLINE');
        } catch (error) {
            console.error('Failed to load admin dashboard data:', error);
            setStatus('ADMIN CONSOLE: ERROR');
        }
    };

    const handleExportReports = async () => {
        try {
            setStatus('EXPORTING STUDENT REPORTS...');
            const res = await exportAdminReports(ADMIN_ID);
            const reports = res.data.reports;
            
            const headers = ['Name', 'Student ID', 'Class', 'Avg Score', 'Sessions', 'Weak Topics', 'Mastered Topics'];
            const csvContent = [
                headers.join(','),
                ...reports.map(r => [
                    `"${r.name}"`, r.studentId, r.class, r.avgScore, r.sessionsCount, `"${r.weakTopics}"`, `"${r.masteredTopics}"`
                ].join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `EduVoice_Admin_Student_Report_${new Date().toLocaleDateString()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setStatus('REPORTS EXPORTED ✓');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 3000);
        } catch (error) {
            console.error('Export error:', error);
            setStatus('EXPORT FAILED');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 3000);
        }
    };

    const handleAuditSessions = async () => {
        try {
            setStatus('FETCHING AI SESSION LOGS...');
            const res = await auditAiSessions(ADMIN_ID);
            setAiLogs(res.data.logs);
            setIsLogsModalOpen(true);
            setStatus('ADMIN CONSOLE: ONLINE');
        } catch (error) {
            console.error('Audit error:', error);
            setStatus('AUDIT FAILED');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 3000);
        }
    };

    const handleManageTeachers = async () => {
        try {
            setStatus('FETCHING TEACHER RECORDS...');
            const res = await getAllTeachersAdmin(ADMIN_ID);
            setTeachers(res.data.teachers);
            setIsTeacherModalOpen(true);
            setStatus('ADMIN CONSOLE: ONLINE');
        } catch (error) {
            console.error('Manage teachers error:', error);
            setStatus('LOAD FAILED');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 3000);
        }
    };

    const handleDeleteTeacher = async (teacherId) => {
        if (!window.confirm('Are you sure you want to remove this teacher?')) return;
        try {
            setStatus('REMOVING TEACHER...');
            await deleteTeacherAdmin(ADMIN_ID, teacherId);
            setTeachers(prev => prev.filter(t => t.teacherId !== teacherId));
            setStatus('TEACHER REMOVED');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 2000);
        } catch (error) {
            console.error('Delete teacher error:', error);
            setStatus('DELETE FAILED');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 3000);
        }
    };

    const handleBackupData = async () => {
        try {
            setStatus('INITIATING DB BACKUP...');
            const res = await backupDataAdmin(ADMIN_ID);
            const data = res.data.data;
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `EduVoice_System_Backup_${new Date().toLocaleDateString()}.json`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setStatus('BACKUP DOWNLOADED ✓');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 3000);
        } catch (error) {
            console.error('Backup error:', error);
            setStatus('BACKUP FAILED');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 3000);
        }
    };

    const handleTriggerCall = async () => {
        try {
            if (!window.confirm('Initiate inactivity reminder call to the designated student?')) return;
            
            setStatus('INITIATING TWILIO CALL...');
            await triggerManualCallAdmin(ADMIN_ID);
            
            setStatus('CALL INITIATED SUCCESSFULLY ✓');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 3000);
        } catch (error) {
            console.error('Call trigger error:', error);
            setStatus('CALL FAILED');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 3000);
        }
    };

    const handleBookUpload = async () => {
        if (!file) return;

        try {
            setStatus('UPLOADING BOOK...');
            const formData = new FormData();
            formData.append('bookPdf', file);
            formData.append('title', file.name.replace('.pdf', ''));
            formData.append('subject', 'General');
            formData.append('class', 'All');

            await uploadBookAdmin(ADMIN_ID, formData);
            
            setFileUploaded(true);
            setFile(null);
            setStatus('BOOK UPLOADED SUCCESSFULLY! AI ENGINE UPDATED');
            
            // Reload books
            const booksRes = await getAllBooksAdmin(ADMIN_ID);
            setUploadedBooks(booksRes.data.books);
            
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 3000);
        } catch (error) {
            console.error('Failed to upload book:', error);
            setStatus('UPLOAD ERROR');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 3000);
        }
    };

    const handleDeleteStudent = async (studentId) => {
        try {
            setStatus('REMOVING STUDENT...');
            await deleteStudentAdmin(ADMIN_ID, studentId);
            setStudents(prev => prev.filter(s => s.studentId !== studentId && s._id !== studentId));
            setStatus('STUDENT RECORD REMOVED');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 2000);
        } catch (error) {
            console.error('Failed to delete student:', error);
            setStatus('DELETE ERROR');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 3000);
        }
    };

    const handleDeleteBook = async (bookId) => {
        try {
            setStatus('REMOVING BOOK...');
            await deleteBookAdmin(ADMIN_ID, bookId);
            setUploadedBooks(prev => prev.filter(b => b._id !== bookId));
            setStatus('BOOK REMOVED FROM AI ENGINE');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 2000);
        } catch (error) {
            console.error('Failed to delete book:', error);
            setStatus('DELETE ERROR');
            setTimeout(() => setStatus('ADMIN CONSOLE: ONLINE'), 3000);
        }
    };

    if (!adminData) {
        return <div className="dashboard-layout fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <h1 style={{ fontSize: '2rem' }}>LOADING CONSOLE...</h1>
        </div>;
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
                        ← Logout
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main style={{ 
                maxWidth: '1400px', 
                margin: '0 auto', 
                padding: '3rem 2rem',
                position: 'relative',
                zIndex: 10
            }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '1.5rem',
                    padding: '2.5rem',
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
                        alignItems: 'center'
                    }}>
                        <div>
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
                                marginBottom: '1.5rem',
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase'
                            }}>
                                <span style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: '#10b981',
                                    animation: 'pulse 2s infinite'
                                }}></span>
                                {status}
                            </div>
                            
                            <h2 style={{ 
                                fontSize: '1.875rem', 
                                fontWeight: 700, 
                                color: '#0f172a',
                                marginBottom: '0.75rem',
                                letterSpacing: '-0.025em'
                            }}>
                                Admin Console
                            </h2>
                            <p style={{ 
                                fontSize: '0.875rem', 
                                color: '#64748b', 
                                marginTop: '0.5rem',
                                fontWeight: 500
                            }}>
                                📧 {adminData.email}
                            </p>
                        </div>
                        
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '2rem',
                            fontWeight: 700,
                            boxShadow: '0 10px 15px -3px rgb(59 130 246 / 0.3)'
                        }}>
                            A
                        </div>
                    </div>
                </div>

                {/* Book Upload Section */}
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
                        marginBottom: '1.5rem', 
                        fontWeight: 700,
                        color: '#0f172a',
                        letterSpacing: '-0.025em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>📚</span>
                        BOOK UPLOAD SYSTEM
                    </h2>
                    <p style={{ 
                        marginBottom: '2rem', 
                        fontWeight: 600,
                        color: '#475569',
                        fontSize: '1rem'
                    }}>
                        Upload PDF books that the AI will use to teach students. These books are analyzed and converted into interactive lessons.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                        <div>
                            <div style={{ 
                                padding: '2rem', 
                                border: '2px dashed #cbd5e1', 
                                textAlign: 'center', 
                                marginBottom: '2rem',
                                borderRadius: '1rem',
                                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#3b82f6';
                                e.currentTarget.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = '#cbd5e1';
                                e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                            }}
                            >
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => setFile(e.target.files[0])}
                                    style={{ border: 'none', background: 'transparent', width: 'auto', boxShadow: 'none' }}
                                />
                            </div>
                            <button 
                                onClick={handleBookUpload} 
                                disabled={!file || status.includes('UPLOADING')}
                                style={{ 
                                    width: '100%', 
                                    fontSize: '1rem', 
                                    padding: '1.25rem 2rem',
                                    background: (!file || status.includes('UPLOADING'))
                                        ? 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
                                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: (!file || status.includes('UPLOADING')) ? '#94a3b8' : '#ffffff',
                                    border: 'none',
                                    borderRadius: '0.75rem',
                                    fontWeight: 700,
                                    cursor: (!file || status.includes('UPLOADING')) ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: (!file || status.includes('UPLOADING'))
                                        ? '0 1px 3px 0 rgb(15 23 42 / 0.1)'
                                        : '0 4px 6px -1px rgb(16 185 129 / 0.2)',
                                    letterSpacing: '0.025em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    opacity: (!file || status.includes('UPLOADING')) ? 0.5 : 1
                                }}
                                onMouseOver={(e) => {
                                    if (!(!file || status.includes('UPLOADING'))) {
                                        e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 10px 15px -3px rgb(16 185 129 / 0.3)';
                                    }
                                }}
                                onMouseOut={(e) => {
                                    if (!(!file || status.includes('UPLOADING'))) {
                                        e.target.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = '0 4px 6px -1px rgb(16 185 129 / 0.2)';
                                    }
                                }}
                            >
                                <span>📤</span>
                                PUBLISH TO AI ENGINE
                            </button>
                        </div>
                        <div>
                            <h3 style={{ 
                                fontSize: '1.25rem', 
                                marginBottom: '1rem', 
                                fontWeight: 700,
                                color: '#0f172a',
                                letterSpacing: '-0.025em'
                            }}>
                                UPLOADED BOOKS ({uploadedBooks.length})
                            </h3>
                            <div style={{ 
                                maxHeight: '200px', 
                                overflowY: 'auto',
                                borderRadius: '0.75rem',
                                border: '1px solid #e2e8f0'
                            }}>
                                {uploadedBooks.length === 0 ? (
                                    <div style={{ 
                                        padding: '2rem', 
                                        textAlign: 'center',
                                        color: '#64748b',
                                        fontStyle: 'italic'
                                    }}>
                                        No books uploaded yet.
                                    </div>
                                ) : (
                                    uploadedBooks.map(book => (
                                        <div key={book._id} style={{
                                            padding: '1rem',
                                            border: '1px solid #e2e8f0',
                                            marginBottom: '0.5rem',
                                            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                            borderRadius: '0.5rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
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
                                            <div>
                                                <p style={{ 
                                                    fontWeight: 600, 
                                                    fontSize: '0.9rem',
                                                    color: '#0f172a',
                                                    letterSpacing: '-0.025em'
                                                }}>
                                                    {book.filename}
                                                </p>
                                                <p style={{ 
                                                    fontSize: '0.8rem', 
                                                    color: '#64748b',
                                                    fontWeight: 500
                                                }}>
                                                    {book.subject} - Class {book.class}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteBook(book._id)}
                                                style={{ 
                                                    padding: '0.5rem 1rem', 
                                                    fontSize: '0.8rem', 
                                                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '0.5rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    boxShadow: '0 4px 6px -1px rgb(239 68 68 / 0.2)',
                                                    letterSpacing: '0.025em'
                                                }}
                                                onMouseOver={(e) => {
                                                    e.target.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                                                    e.target.style.transform = 'translateY(-2px)';
                                                    e.target.style.boxShadow = '0 10px 15px -3px rgb(239 68 68 / 0.3)';
                                                }}
                                                onMouseOut={(e) => {
                                                    e.target.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                                                    e.target.style.transform = 'translateY(0)';
                                                    e.target.style.boxShadow = '0 4px 6px -1px rgb(239 68 68 / 0.2)';
                                                }}
                                            >
                                                DELETE
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Student Management */}
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
                        marginBottom: '1.5rem', 
                        fontWeight: 700,
                        color: '#0f172a',
                        letterSpacing: '-0.025em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>👥</span>
                        STUDENT MANAGEMENT
                    </h2>
                    <p style={{ 
                        marginBottom: '2rem', 
                        fontWeight: 600,
                        color: '#475569',
                        fontSize: '1rem'
                    }}>
                        Monitor and manage all student accounts, progress, and learning activities.
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ 
                            width: '100%', 
                            textAlign: 'left', 
                            borderCollapse: 'collapse', 
                            minWidth: '800px',
                            background: '#ffffff',
                            borderRadius: '0.75rem',
                            overflow: 'hidden',
                            boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)'
                        }}>
                            <thead>
                                <tr style={{ 
                                    borderBottom: '2px solid #e2e8f0',
                                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
                                }}>
                                    <th style={{ 
                                        padding: '1rem', 
                                        textTransform: 'uppercase', 
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        fontSize: '0.875rem',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Student
                                    </th>
                                    <th style={{ 
                                        padding: '1rem', 
                                        textTransform: 'uppercase', 
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        fontSize: '0.875rem',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Class
                                    </th>
                                    <th style={{ 
                                        padding: '1rem', 
                                        textTransform: 'uppercase', 
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        fontSize: '0.875rem',
                                        letterSpacing: '0.05em'
                                    }}>
                                        School
                                    </th>
                                    <th style={{ 
                                        padding: '1rem', 
                                        textTransform: 'uppercase', 
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        fontSize: '0.875rem',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Progress
                                    </th>
                                    <th style={{ 
                                        padding: '1rem', 
                                        textTransform: 'uppercase', 
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        fontSize: '0.875rem',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Last Active
                                    </th>
                                    <th style={{ 
                                        padding: '1rem', 
                                        textTransform: 'uppercase', 
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        fontSize: '0.875rem',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.length === 0 && (
                                    <tr>
                                        <td colSpan="6" style={{ 
                                            padding: '2rem', 
                                            textAlign: 'center', 
                                            color: '#64748b',
                                            fontStyle: 'italic',
                                            fontSize: '0.875rem'
                                        }}>
                                            No students registered yet.
                                        </td>
                                    </tr>
                                )}
                                {students.map((student) => {
                                    // Calculate real avg score from session history
                                    const scores = student.sessionHistory?.filter(s => s.score !== undefined).map(s => s.score) || [];
                                    const avgScore = scores.length > 0 
                                        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
                                        : 0;
                                    const examCount = scores.length;
                                    
                                    return (
                                        <tr key={student._id} style={{ 
                                            borderBottom: '1px solid #e2e8f0',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.background = '#ffffff';
                                        }}
                                        >
                                            <td style={{ padding: '1rem' }}>
                                                <div>
                                                    <p style={{ 
                                                        fontWeight: 700, 
                                                        color: '#0f172a',
                                                        letterSpacing: '-0.025em'
                                                    }}>
                                                        {student.name}
                                                    </p>
                                                    <p style={{ 
                                                        fontSize: '0.875rem', 
                                                        color: '#64748b',
                                                        fontWeight: 500
                                                    }}>
                                                        ID: {student.studentId}
                                                    </p>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem', fontWeight: 600, color: '#0f172a' }}>
                                                {student.class}
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#64748b' }}>
                                                N/A
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div>
                                                    <p style={{ 
                                                        fontSize: '0.875rem', 
                                                        color: '#64748b',
                                                        fontWeight: 500
                                                    }}>
                                                        Avg: {avgScore}% ({examCount} tests)
                                                    </p>
                                                    <div style={{ 
                                                        width: '100px', 
                                                        height: '6px', 
                                                        background: '#e2e8f0', 
                                                        borderRadius: '3px',
                                                        marginTop: '4px',
                                                        overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            width: `${avgScore}%`,
                                                            height: '100%',
                                                            background: avgScore >= 80 ? '#10b981' : avgScore >= 60 ? '#f59e0b' : '#ef4444',
                                                            borderRadius: '3px'
                                                        }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                                                {new Date(student.lastActiveAt).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <button 
                                                    onClick={() => handleDeleteStudent(student.studentId)}
                                                    style={{ 
                                                        padding: '0.5rem 1rem', 
                                                        fontSize: '0.875rem', 
                                                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '0.5rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        boxShadow: '0 4px 6px -1px rgb(239 68 68 / 0.2)',
                                                        letterSpacing: '0.025em'
                                                    }}
                                                    onMouseOver={(e) => {
                                                        e.target.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                                                        e.target.style.transform = 'translateY(-2px)';
                                                        e.target.style.boxShadow = '0 10px 15px -3px rgb(239 68 68 / 0.3)';
                                                    }}
                                                    onMouseOut={(e) => {
                                                        e.target.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                                                        e.target.style.transform = 'translateY(0)';
                                                        e.target.style.boxShadow = '0 4px 6px -1px rgb(239 68 68 / 0.2)';
                                                    }}
                                                >
                                                    REMOVE
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* System Actions */}
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
                        marginBottom: '1.5rem', 
                        fontWeight: 700,
                        color: '#0f172a',
                        letterSpacing: '-0.025em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>🔧</span>
                        SYSTEM ADMINISTRATION
                    </h2>
                    <p style={{ 
                        fontWeight: 600, 
                        marginBottom: '2rem',
                        color: '#475569',
                        fontSize: '1rem'
                    }}>
                        Complete system control and monitoring tools.
                    </p>
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                        gap: '1.5rem'
                    }}>
                        <button 
                            onClick={handleExportReports}
                            style={{ 
                                padding: '2rem', 
                                fontSize: '1rem',
                                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                color: '#0f172a',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)',
                                letterSpacing: '0.025em',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(15 23 42 / 0.1)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 1px 3px 0 rgb(15 23 42 / 0.1)';
                            }}
                        >
                            <span style={{ fontSize: '2rem' }}>📊</span>
                            EXPORT STUDENT REPORTS
                        </button>
                        <button 
                            onClick={handleAuditSessions}
                            style={{ 
                                padding: '2rem', 
                                fontSize: '1rem',
                                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                color: '#0f172a',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)',
                                letterSpacing: '0.025em',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(15 23 42 / 0.1)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 1px 3px 0 rgb(15 23 42 / 0.1)';
                            }}
                        >
                            <span style={{ fontSize: '2rem' }}>🤖</span>
                            AUDIT AI SESSIONS
                        </button>
                        <button 
                            onClick={handleManageTeachers}
                            style={{ 
                                padding: '2rem', 
                                fontSize: '1rem',
                                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                color: '#0f172a',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)',
                                letterSpacing: '0.025em',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(15 23 42 / 0.1)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 1px 3px 0 rgb(15 23 42 / 0.1)';
                            }}
                        >
                            <span style={{ fontSize: '2rem' }}>👨‍🏫</span>
                            MANAGE TEACHERS
                        </button>
                        <button 
                            onClick={handleBackupData}
                            style={{ 
                                padding: '2rem', 
                                fontSize: '1rem',
                                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                color: '#0f172a',
                                border: '1px solid #e2e8f0',
                                borderRadius: '1rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 1px 3px 0 rgb(15 23 42 / 0.1)',
                                letterSpacing: '0.025em',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(15 23 42 / 0.1)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 1px 3px 0 rgb(15 23 42 / 0.1)';
                            }}
                        >
                            <span style={{ fontSize: '2rem' }}>💾</span>
                            BACKUP DATA
                        </button>
                        <button 
                            onClick={handleTriggerCall}
                            style={{ 
                                padding: '2rem', 
                                fontSize: '1rem',
                                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                                color: '#1e40af',
                                border: '1px solid #bfdbfe',
                                borderRadius: '1rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 4px 6px -1px rgb(59 130 246 / 0.1)',
                                letterSpacing: '0.025em',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgb(59 130 246 / 0.2)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(59 130 246 / 0.1)';
                            }}
                        >
                            <span style={{ fontSize: '2rem' }}>📞</span>
                            INACTIVITY CALL (+917708566849)
                        </button>
                    </div>
                </div>

                {/* Teacher Modal */}
                {isTeacherModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                        <div style={{ background: '#fff', borderRadius: '1.5rem', padding: '2rem', maxWidth: '800px', width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(15,23,42,0.25)', position: 'relative' }}>
                            <button onClick={() => setIsTeacherModalOpen(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.5rem' }}>👨‍🏫 Teacher Management</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Teacher</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Email</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teachers.length === 0 ? (
                                        <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No teachers registered.</td></tr>
                                    ) : (
                                        teachers.map(t => (
                                            <tr key={t._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.75rem', fontWeight: 600 }}>{t.name}</td>
                                                <td style={{ padding: '0.75rem' }}>{t.email}</td>
                                                <td style={{ padding: '0.75rem' }}>{t.teacherId}</td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                    <button onClick={() => handleDeleteTeacher(t.teacherId)} style={{ padding: '0.4rem 0.8rem', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Logs Modal */}
                {isLogsModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                        <div style={{ background: '#fff', borderRadius: '1.5rem', padding: '2rem', maxWidth: '900px', width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(15,23,42,0.25)', position: 'relative' }}>
                            <button onClick={() => setIsLogsModalOpen(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.5rem' }}>🤖 AI Conversation Audit</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {aiLogs.length === 0 ? (
                                    <p style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No AI sessions logged yet.</p>
                                ) : (
                                    aiLogs.map((log, idx) => (
                                        <div key={idx} style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                                                <span>{log.type.toUpperCase()}</span>
                                                <span>{new Date(log.timestamp).toLocaleString()}</span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a' }}><strong>Q:</strong> {log.query}</p>
                                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#475569' }}><strong>A:</strong> {log.response}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
