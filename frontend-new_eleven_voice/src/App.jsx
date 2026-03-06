import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { VoiceProvider } from './context/VoiceContext';
import ProtectedRoute from './components/ProtectedRoute';
import IntroPage from './pages/IntroPage';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import NotesPage from './pages/NotesPage';
import AutoLoginPage from './pages/AutoLoginPage';
import './styles/index.css';

import { StudentProvider } from './context/StudentContext';
import LearnPage from './pages/LearnPage';

function App() {
    return (
        <AuthProvider>
            <VoiceProvider>
                <StudentProvider>
                    <Router>
                        <div className="App">
                            <Routes>
                                <Route path="/" element={<IntroPage />} />
                                <Route path="/login" element={<LoginPage />} />
                                {/* Brixbee desktop auto-login — no auth guard needed */}
                                <Route path="/auto-login" element={<AutoLoginPage />} />
                                <Route path="/student" element={
                                    <ProtectedRoute>
                                        <StudentDashboard />
                                    </ProtectedRoute>
                                } />
                                <Route path="/learn" element={
                                    <ProtectedRoute>
                                        <LearnPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/teacher" element={
                                    <ProtectedRoute>
                                        <TeacherDashboard />
                                    </ProtectedRoute>
                                } />
                                <Route path="/admin" element={
                                    <ProtectedRoute>
                                        <AdminDashboard />
                                    </ProtectedRoute>
                                } />
                                <Route path="/notes" element={
                                    <ProtectedRoute>
                                        <NotesPage />
                                    </ProtectedRoute>
                                } />
                            </Routes>
                        </div>
                    </Router>
                </StudentProvider>
            </VoiceProvider>
        </AuthProvider>
    );
}

export default App;
