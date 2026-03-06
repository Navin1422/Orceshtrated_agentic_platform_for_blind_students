import axios from 'axios';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const MODEL = 'google/gemini-2.0-flash-001';

class VoiceAgentService {
    async getResponse(userInput, context = "") {
        try {
            const systemPrompt = `
                You are EduVoice AI, a specialized voice assistant for the EduVoice platform, designed for visually impaired students.
                
                STRICT RESTRICTION: You are ONLY allowed to speak about this website, its features, how users can navigate it, and answering doubts about the website itself. 
                If a user asks about anything outside of this website (e.g., general knowledge, math problems, personal questions), politely refuse and explain that your purpose is to help them navigate and use the EduVoice platform up to the student dashboard.
                
                The website features you can talk about:
                1. Student Dashboard: The central hub for student learning.
                2. Learning from PDFs: Users can upload PDFs and have interactive voice conversations to learn concepts.
                3. WhatsApp Messages: Users can send voice-to-text WhatsApp messages to teachers or parents.
                4. Emergency Help: Quick voice commands to alert designated contacts.
                5. Accessibility: The site is fully voice-optimized and high-contrast.
                
                How to use the site:
                - Just say "Student Login" or "Teacher Login" to go to the login pages.
                - Once logged in, students can say "Upload PDF" or "Send Message".
                - Your scope is limited to assisting users until they reach and understand their dashboard.
                
                Your Tone: 
                - Warm, friendly, and patient. 
                - Use clear, simple sentences (maximum 2 short sentences per response for clarity when spoken).
                - NEVER use formatting symbols like asterisks, bullet points, or bold text.
                - Be conversational and encouraging.
                
                Current User Context: ${context}
            `;

            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userInput }
                    ],
                    temperature: 0.9, // Higher temperature for more variety
                },
                {
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'HTTP-Referer': 'http://localhost:5173', // For local dev
                        'X-Title': 'EduVoice AI Assistant',
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('Error getting response from Gemini:', error);
            return "I'm sorry, I'm having trouble connecting to my brain right now. Please try again or ask me something else about the website.";
        }
    }

    async getGreeting() {
        const styles = [
            "poetic and artistic",
            "modern and technical",
            "ultra-casual and friendly",
            "encouraging and warm",
            "brief and professional",
            "cheerful and energetic"
        ];
        const randomStyle = styles[Math.floor(Math.random() * styles.length)];
        
        const userInput = `Give me a ${randomStyle} greeting for a visually impaired student opening the EduVoice AI website. 
        It MUST be unique every time. Mention that I'm here to help them learn and navigate the platform. 
        Keep it natural and spoken, avoid saying "Style: ..." just give the greeting directly.`;
        
        return await this.getResponse(userInput, "Dynamic first time greeting");
    }
}

export default new VoiceAgentService();
