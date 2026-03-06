import React, { createContext, useContext, useState, useEffect } from 'react';
import { createStudent, getStudent } from '../services/api';

const StudentContext = createContext(null);

export const StudentProvider = ({ children }) => {
  const [student, setStudent]         = useState(null);
  const [selectedClass, setSelectedClass]     = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [chatHistory, setChatHistory]         = useState([]);
  const [isLoading, setIsLoading]             = useState(false);
  const [isRestoring, setIsRestoring]         = useState(true);

  // Restore student from localStorage on mount
  useEffect(() => {
    const savedId = localStorage.getItem('eduvoice_student_id');
    if (savedId) {
      getStudent(savedId)
        .then(res => {
          setStudent(res.data.student);
          if (res.data.student.class) setSelectedClass(res.data.student.class);
          if (res.data.student.lastSubject) setSelectedSubject(res.data.student.lastSubject);
        })
        .catch(() => localStorage.removeItem('eduvoice_student_id'))
        .finally(() => setIsRestoring(false));
    } else {
      setIsRestoring(false);
    }
  }, []);

  const loginStudent = async (name, classLevel) => {
    const res = await createStudent({ name, classLevel, language: 'english' });
    const s = res.data.student;
    setStudent(s);
    localStorage.setItem('eduvoice_student_id', s.studentId);
    if (s.class) setSelectedClass(s.class);
    return res.data;
  };

  const logout = () => {
    setStudent(null);
    setSelectedClass('');
    setSelectedSubject('');
    setSelectedChapter(null);
    setChatHistory([]);
    localStorage.removeItem('eduvoice_student_id');
  };

  const addMessage = (role, text) => {
    setChatHistory(prev => [...prev, { role, text, id: Date.now() }]);
  };

  const value = {
    student, setStudent,
    selectedClass, setSelectedClass,
    selectedSubject, setSelectedSubject,
    selectedChapter, setSelectedChapter,
    chatHistory, setChatHistory, addMessage,
    isLoading, setIsLoading,
    isRestoring, setIsRestoring,
    loginStudent, logout,
  };

  return (
    <StudentContext.Provider value={value}>
      {children}
    </StudentContext.Provider>
  );
};

export const useStudent = () => {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error('useStudent must be used inside StudentProvider');
  return ctx;
};
