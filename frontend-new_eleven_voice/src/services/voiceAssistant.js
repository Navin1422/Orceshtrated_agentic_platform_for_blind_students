/**
 * VoiceAssistant - Comprehensive service to handle TTS and STT for EduVoice.
 * Using Eleven Labs for high-quality TTS and Browser Web Speech API for STT.
 */
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

class VoiceAssistant {
    constructor() {
        this.synth = window.speechSynthesis;
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        // Initialize Eleven Labs (Disabled for now to avoid 401 errors)
        const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
        const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'Xb7hH8MSUJpSbSDYk0k2';

        this.apiKey = apiKey;
        this.elevenLabsVoiceId = voiceId;

        // this.elevenlabs = new ElevenLabsClient({
        //     apiKey: this.apiKey,
        // });

        // Browser Audio element for Eleven Labs playback
        this.audio = new Audio();
        
        console.log(`[VoiceAssistant] Initialized. API Key Present: ${!!this.apiKey}, Voice ID: ${this.elevenLabsVoiceId}`);
        
        // Check if speech recognition is supported
        if (!this.SpeechRecognition) {
            console.error('Speech recognition not supported in this browser');
            this.recognition = null;
            alert('Speech recognition is not supported in your browser. Please try Chrome or Edge.');
        } else {
            try {
                this.recognition = new this.SpeechRecognition();
                this.recognition.continuous = false;
                this.recognition.interimResults = false;
                this.recognition.maxAlternatives = 3;
                this.recognition.lang = 'en-IN'; // Default to Indian English
                console.log('Speech recognition initialized successfully');
            } catch (error) {
                console.error('Failed to initialize speech recognition:', error);
                this.recognition = null;
            }
        }
        
        this.voices = [];
        this.selectedVoice = null;
        this.currentLanguage = 'en-IN';
        this.setIsListening = null;

        // Load voices with preference for natural Indian female voices
        const loadVoices = () => {
            this.voices = this.synth.getVoices();
            console.log('Available voices:', this.voices.map(v => `${v.name} (${v.lang})`));
            
            // Priority order for most natural human-like voices
            this.selectedVoice = this.voices.find(v => 
                v.name.toLowerCase().includes('google') && 
                (v.lang === 'en-IN' || v.lang === 'en-US')
            ) ||
            this.voices.find(v => 
                (v.lang === 'en-IN' || v.lang === 'en-US') && 
                (v.name.toLowerCase().includes('female') || 
                 v.name.toLowerCase().includes('woman') ||
                 v.name.toLowerCase().includes('samantha') ||
                 v.name.toLowerCase().includes('karen') ||
                 v.name.toLowerCase().includes('moira') ||
                 v.name.toLowerCase().includes('tessa'))
            ) ||
            this.voices.find(v => v.lang === 'en-IN') ||
            this.voices.find(v => v.lang === 'en-US') ||
            this.voices.find(v => v.lang.startsWith('en')) ||
            this.voices[0];
            
            console.log('Selected voice:', this.selectedVoice ? `${this.selectedVoice.name} (${this.selectedVoice.lang})` : 'None');
        };

        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = loadVoices;
        }
        loadVoices();
    }

    /**
     * Unlocks the audio context for the browser.
     * MUST be called from a user gesture (click).
     */
    unlock() {
        console.log('[VoiceAssistant] Unlocking audio context...');
        this.audio.play().then(() => {
            this.audio.pause();
            this.audio.currentTime = 0;
            console.log('[VoiceAssistant] Audio context unlocked successfully');
        }).catch(err => {
            console.warn('[VoiceAssistant] Silent play failed - still locked:', err.name);
        });
    }

    setLanguage(lang) {
        this.currentLanguage = lang === 'tamil' ? 'ta-IN' : 'en-IN';
        this.recognition.lang = this.currentLanguage;
        console.log(`Language set to: ${lang} (${this.currentLanguage})`);
        
        // Reload voices for new language
        const loadVoices = () => {
            this.voices = this.synth.getVoices();
            if (lang === 'tamil') {
                // For Tamil, prefer any available Tamil voice
                this.selectedVoice = this.voices.find(v => v.lang.startsWith('ta')) || this.selectedVoice;
            } else {
                // Re-apply English voice selection for most natural human speech
                this.selectedVoice = this.voices.find(v => 
                    (v.lang === 'en-IN' || v.lang === 'en-US') && 
                    (v.name.toLowerCase().includes('female') || 
                     v.name.toLowerCase().includes('woman') ||
                     v.name.toLowerCase().includes('samantha') ||
                     v.name.toLowerCase().includes('karen') ||
                     v.name.toLowerCase().includes('moira') ||
                     v.name.toLowerCase().includes('tessa'))
                ) ||
                this.voices.find(v => v.lang === 'en-IN') ||
                this.voices.find(v => v.lang === 'en-US') &&
                    (v.name.toLowerCase().includes('female')) ||
                    this.voices.find(v => v.lang.startsWith('en')) ||
                    this.voices[0];
            }
        };
        loadVoices();
    }

    /**
     * Set listening state for external components
     */
    setListeningState(setIsListening) {
        this.setIsListening = setIsListening;
    }

    /**
     * TTS: Speak text through Eleven Labs or Browser fallback
     */
    async speak(text, onEnd) {
        // Cancel any current browser speech
        if (this.synth.speaking) this.synth.cancel();
        
        // Stop any current Eleven Labs audio
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }

        console.log(`[VoiceAssistant] Using browser fallback TTS as requested: "${text.substring(0, 30)}..."`);
        return this.speakFallback(text, onEnd);
    }

    /**
     * Browser fallback TTS
     */
    speakFallback(text, onEnd) {
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            if (this.selectedVoice) utterance.voice = this.selectedVoice;
            utterance.lang = this.currentLanguage;
            utterance.pitch = 0.9;
            utterance.rate = 1.0;
            utterance.volume = 0.9;

            utterance.onend = () => {
                console.log('[Browser TTS] Fallback completed');
                if (onEnd) onEnd();
                resolve();
            };

            utterance.onerror = (event) => {
                if (event.error === 'canceled' || event.error === 'interrupted') {
                    resolve();
                    return;
                }
                console.error('[Browser TTS] Error:', event.error);
                if (onEnd) onEnd();
                resolve();
            };

            try {
                this.synth.speak(utterance);
            } catch (error) {
                console.error('[Browser TTS] Failed to speak:', error);
                if (onEnd) onEnd();
                resolve();
            }
        });
    }

    /**
     * Sanitize speech transcript by removing trailing punctuation
     */
    sanitizeTranscript(transcript) {
        if (!transcript || typeof transcript !== 'string') return transcript;
        
        // Remove trailing punctuation (.,!?) and extra spaces
        let sanitized = transcript.trim();
        sanitized = sanitized.replace(/[.,!?]+$/g, '');
        sanitized = sanitized.replace(/\s+$/g, '');
        
        // Remove commas that appear between letters and numbers (common speech recognition error)
        sanitized = sanitized.replace(/([a-zA-Z]),([0-9])/g, '$1$2');
        sanitized = sanitized.replace(/([0-9]),([a-zA-Z])/g, '$1$2');
        
        // Remove unnecessary commas within words/phrases
        sanitized = sanitized.replace(/,+/g, '');
        
        console.log('Sanitized transcript:', `"${transcript}" -> "${sanitized}"`);
        return sanitized;
    }

    /**
     * STT: Listen for a single command or input
     */
    listen(onResult, onError, setIsListening) {
        return new Promise((resolve) => {
            // Check if speech recognition is available
            if (!this.recognition) {
                console.error('Speech recognition not supported');
                if (onError) onError('not_supported');
                resolve(null);
                return;
            }

            // Set up fresh recognition session
            try {
                // Cancel any existing recognition first
                if (this.recognition) {
                    this.recognition.abort();
                }
                
                // Create new recognition instance
                this.recognition = new this.SpeechRecognition();
                this.recognition.continuous = false;
                this.recognition.interimResults = false;
                this.recognition.maxAlternatives = 3;
                this.recognition.lang = this.currentLanguage;
                
                console.log('Starting fresh STT session...');
                
                // Set up event handlers
                this.recognition.onresult = (event) => {
                    if (event.results.length > 0) {
                        const rawTranscript = event.results[0][0].transcript;
                        console.log('Raw transcript:', rawTranscript);
                        
                        // Sanitize transcript before processing
                        const sanitizedTranscript = this.sanitizeTranscript(rawTranscript);
                        
                        if (onResult) onResult(sanitizedTranscript);
                    }
                };
                
                this.recognition.onerror = (event) => {
                    console.error('STT Error:', event.error);
                    console.error('Error details:', event);
                    
                    // Handle specific errors
                    if (event.error === 'no-speech') {
                        console.log('No speech detected');
                    } else if (event.error === 'not-allowed') {
                        console.error('Microphone permission denied');
                    }
                    
                    if (onError) onError(event.error);
                    resolve(null);
                };
                
                this.recognition.onend = () => {
                    console.log('STT session ended.');
                    if (this.setIsListening) {
                        this.setIsListening(false);
                    }
                };
                
                this.recognition.onspeechstart = () => {
                    console.log('Speech detected - listening...');
                    if (this.setIsListening) {
                        this.setIsListening(true);
                    }
                };
                
                // Start listening
                this.recognition.start();
                console.log('STT listening for speech input...');
                console.log('Language:', this.recognition.lang);
                
            } catch (err) {
                console.error('STT failed to start:', err);
                if (onError) onError('failed_to_start');
                resolve(null);
            }
        });
    }

    /**
     * Stop any active STT session
     */
    stopListening() {
        if (this.recognition) {
            try {
                this.recognition.abort();
                console.log('STT session stopped/aborted.');
            } catch (err) {
                console.error('Error stopping recognition:', err);
            }
        }
        if (this.setIsListening) {
            this.setIsListening(false);
        }
    }


    /**
     * Clean name from voice input
     */
    cleanName(raw) {
        console.log('Raw name input:', raw);
        
        // Use the centralized sanitization to remove trailing punctuation
        let clean = this.sanitizeTranscript(raw);
        
        // Convert to lowercase for processing
        clean = clean.toLowerCase();
        
        // Remove trailing words and punctuation
        clean = clean.replace(/\s+(again|lastly|finally|please)$/g, '');
        
        // Remove extra spaces
        clean = clean.replace(/\s+/g, ' ');
        
        // Capitalize first letter of each word properly
        clean = clean.split(' ').map(word => {
            if (word.length === 0) return word;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');
        
        console.log('Cleaned name:', clean);
        return clean;
    }

    /**
     * Clean email from voice input
     */
    cleanEmail(raw) {
        console.log('Raw email input:', raw);
        
        // Handle common speech recognition errors
        let clean = raw.toLowerCase().trim();
        
        // Remove trailing words like "again", "lastly", etc.
        clean = clean.replace(/\s+(again|lastly|finally|please|yes|no)$/g, '');
        
        // Fix common misinterpretations
        clean = clean.replace(/ggmail/g, 'gmail');
        clean = clean.replace(/g mail/g, 'gmail');
        clean = clean.replace(/jimail/g, 'gmail');
        clean = clean.replace(/gmai/g, 'gmail');
        clean = clean.replace(/gimail/g, 'gmail');
        clean = clean.replace(/geemail/g, 'gmail');
        clean = clean.replace(/jemail/g, 'gmail');
        clean = clean.replace(/yahooo/g, 'yahoo');
        clean = clean.replace(/outlookk/g, 'outlook');
        clean = clean.replace(/hotmail/g, 'hotmail');
        
        // Convert spoken words to email format
        clean = clean.replace(/\s+at\s+/g, '@');
        clean = clean.replace(/\s+at\s+the\s+rate/g, '@');
        clean = clean.replace(/\s+@\s+/g, '@');
        clean = clean.replace(/\s+dot\s+/g, '.');
        clean = clean.replace(/\s+dotted\s+/g, '.');
        clean = clean.replace(/\s+underscore\s+/g, '_');
        clean = clean.replace(/\s+dash\s+/g, '-');
        clean = clean.replace(/\s+hyphen\s+/g, '-');
        clean = clean.replace(/\s+plus\s+/g, '+');
        
        // Handle number words
        const numberWords = {
            'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
            'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
        };
        
        for (const [word, num] of Object.entries(numberWords)) {
            clean = clean.replace(new RegExp(`\\s+${word}\\s+`, 'g'), num);
            clean = clean.replace(new RegExp(`\\s+${word}$`, 'g'), num);
            clean = clean.replace(new RegExp(`^${word}\\s+`, 'g'), num);
        }
        
        // Remove extra spaces
        clean = clean.replace(/\s+/g, '');
        
        // Ensure proper email format
        if (clean.includes('@') && !clean.includes('.')) {
            clean += '.com';
        }
        
        // Add common domain if missing
        if (clean.includes('@') && !clean.match(/@[a-zA-Z]+\./)) {
            clean = clean.replace('@', '@gmail.');
        }
        
        console.log('Cleaned email:', clean);
        return clean;
    }

    // Add email confirmation method
    confirmEmail(email, onConfirm, onRetry) {
        const spokenEmail = email.replace(/@/g, ' at ').replace(/\./g, ' dot ');
        const confirmText = `I heard your email as: ${spokenEmail}. Is this correct? Say yes to confirm or no to try again.`;
        
        this.speak(confirmText, async () => {
            try {
                const result = await this.listen(
                    (res) => {
                        if (res.includes('yes') || res.includes('correct') || res.includes('right')) {
                            if (onConfirm) onConfirm(email);
                        } else if (res.includes('no') || res.includes('wrong') || res.includes('retry')) {
                            if (onRetry) onRetry();
                        } else {
                            this.speak("Please say yes or no.", () => this.confirmEmail(email, onConfirm, onRetry));
                        }
                    },
                    (err) => {
                        console.error('Email confirmation error:', err);
                        if (onRetry) onRetry();
                    }
                );
            } catch (error) {
                console.error('Email confirmation failed:', error);
                if (onRetry) onRetry();
            }
        });
    }
}

export default new VoiceAssistant();
