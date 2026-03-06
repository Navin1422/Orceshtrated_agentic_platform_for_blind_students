import React, { createContext, useState, useEffect, useCallback } from 'react';
import voiceAssistant from '../services/voiceAssistant';
import voiceAgentService from '../services/voiceAgentService';

export const VoiceContext = createContext();

export const VoiceProvider = ({ children }) => {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [language, setLanguage] = useState('en-IN'); // Default to Indian English
    const [transcript, setTranscript] = useState('');
    const [role, setRole] = useState(null);
    const [userData, setUserData] = useState({ name: '', class: '', school: '', email: '' });
    const [isAIActive, setIsAIActive] = useState(false);

    // --- Text-to-Speech (TTS) ---
    const speak = useCallback((text, onEnd = () => { }) => {
        setIsSpeaking(true);
        return voiceAssistant.speak(text, () => {
            setIsSpeaking(false);
            onEnd();
        });
    }, []);

    // --- Speech-to-Text (STT) ---
    const listen = useCallback((onResult) => {
        // Sync the voiceAssistant language first
        voiceAssistant.setLanguage(language === 'ta-IN' ? 'tamil' : 'english');
        
        // Use the centralized voiceAssistant.listen which handles aborting previous sessions
        return voiceAssistant.listen(
            (result) => {
                setTranscript(result);
                if (onResult) onResult(result);
            },
            (err) => {
                console.error("VoiceContext listen error:", err);
                setIsListening(false);
            },
            setIsListening // Pass state setter so voiceAssistant can update it
        );
    }, [language]);

    const stopListening = useCallback(() => {
        voiceAssistant.stopListening();
        setIsListening(false);
    }, []);


    // --- AI Assistant Logic ---
    const startAIAssistant = useCallback(async (initialGreeting = "") => {
        setIsAIActive(true);
        
        let greeting = initialGreeting;
        if (!greeting) {
            greeting = await voiceAgentService.getGreeting();
        }

        await speak(greeting);
        listenForCommand();
    }, [speak]);

    const listenForCommand = useCallback(() => {
        listen(async (transcript) => {
            if (!transcript) return;

            console.log("AI Assistant heard:", transcript);
            
            // Check for exit commands
            const lowerTranscript = transcript.toLowerCase();
            if (lowerTranscript.includes("goodbye") || lowerTranscript.includes("exit") || lowerTranscript.includes("stop")) {
                await speak("Goodbye! Have a great time learning.");
                setIsAIActive(false);
                return;
            }

            const aiResponse = await voiceAgentService.getResponse(transcript);
            await speak(aiResponse);
            
            // Re-listen after speaking
            listenForCommand();
        });
    }, [listen, speak]);

    // --- Clean email from voice input ---
    const cleanEmail = useCallback((raw) => {
        let clean = raw.replace(/\s+at\s+/g, '@');
        clean = clean.replace(/\s+dot\s+/g, '.');
        clean = clean.replace(/\s+/g, ''); // remove all other spaces
        return clean;
    }, []);

    // --- Set language helper ---
    const setVoiceLanguage = useCallback((lang) => {
        if (lang === 'tamil') {
            setLanguage('ta-IN');
        } else {
            setLanguage('en-IN');
        }
    }, []);

    return (
        <VoiceContext.Provider value={{
            isListening, 
            isSpeaking, 
            language, 
            setLanguage: setVoiceLanguage,
            transcript, 
            speak, 
            listen, 
            stopListening,
            cleanEmail,
            role, 
            setRole, 
            userData, 
            setUserData,
            isAIActive,
            startAIAssistant
        }}>
            {children}
        </VoiceContext.Provider>
    );
};
