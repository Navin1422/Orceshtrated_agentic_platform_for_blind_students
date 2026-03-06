import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// ─── AI ───
// sendMessage → LangGraph Akka Agent. Response includes { response, toolsUsed, studentProfile, currentChapter }
export const sendMessage     = (data) => API.post('/ai/agent-chat', data);
export const sendOldChat     = (data) => API.post('/ai/chat', data);
export const endSession      = (data) => API.post('/ai/session-end', data);
// sendBrixbeeMessage → LangGraph Brixbee Agent (used when website needs to check desktop state)
export const sendBrixbeeMessage = (data) => API.post('/ai/brixbee-chat', data);

// ─── Students ───
export const createStudent  = (data)      => API.post('/students', data);
export const getStudent     = (id)        => API.get(`/students/${id}`);
export const updateStudent  = (id, data)  => API.put(`/students/${id}`, data);
export const getProgress    = (id)        => API.get(`/students/${id}/progress`);
export const saveNotes      = (id, data)  => API.post(`/students/${id}/notes`, data);
export const sendFeedback   = (id, data)  => API.post(`/students/${id}/feedback`, data);
export const markFeedbackRead = (id)      => API.put(`/students/${id}/feedback/read`);

// ─── Content ───
export const getClasses  = ()                           => API.get('/content/classes');
export const getSubjects = (cls)                        => API.get(`/content/${cls}/subjects`);
export const getChapters = (cls, subject)               => API.get(`/content/${cls}/${subject}/chapters`);
export const getChapter  = (cls, subject, chapterNum)   => API.get(`/content/${cls}/${subject}/${chapterNum}`);

// ─── Teachers ───
export const getTeacherProfile = (id) => API.get(`/teachers/${id}`);
export const getTeacherAssessments = (id) => API.get(`/teachers/${id}/assessments`);
export const uploadTeacherAssessment = (id, formData) => API.post(`/teachers/${id}/assessments`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
export const deleteTeacherAssessment = (teacherId, assessmentId) => API.delete(`/teachers/${teacherId}/assessments/${assessmentId}`);
export const getClassAnalytics = (id) => API.get(`/teachers/${id}/analytics`);
export const submitTeacherFeedback = (id, data) => API.post(`/teachers/${id}/feedback`, data);
export const exportTeacherReports = (id) => API.get(`/teachers/${id}/export`);

// ─── Admins ───
export const getAdminProfile = (id) => API.get(`/admins/${id}`);
export const getAllStudentsAdmin = (id) => API.get(`/admins/${id}/students`);
export const deleteStudentAdmin = (adminId, studentId) => API.delete(`/admins/${adminId}/students/${studentId}`);
export const getAllBooksAdmin = (id) => API.get(`/admins/${id}/books`);
export const uploadBookAdmin = (id, formData) => API.post(`/admins/${id}/books`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
export const deleteBookAdmin = (adminId, bookId) => API.delete(`/admins/${adminId}/books/${bookId}`);
export const triggerManualCallAdmin = (id) => API.post(`/admins/${id}/trigger-call`);
export const exportAdminReports = (id) => API.get(`/admins/${id}/export-reports`);
export const auditAiSessions = (id) => API.get(`/admins/${id}/audit-sessions`);
export const getAllTeachersAdmin = (id) => API.get(`/admins/${id}/teachers`);
export const deleteTeacherAdmin = (adminId, teacherId) => API.delete(`/admins/${adminId}/teachers/${teacherId}`);
export const backupDataAdmin = (id) => API.get(`/admins/${id}/backup`);

export default API;
