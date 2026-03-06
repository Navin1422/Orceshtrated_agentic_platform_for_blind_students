import React from 'react';

const VoiceButton = ({ isListening, onStart, onStop, size = 'md' }) => {
    const sizeMap = { 
        sm: { outer: '80px', inner: '60px', font: '1.5rem' }, 
        md: { outer: '120px', inner: '90px', font: '2.5rem' }, 
        lg: { outer: '160px', inner: '120px', font: '3.5rem' } 
    };
    
    const config = sizeMap[size] || sizeMap.md;

    return (
        <div className={`voice-orb-wrapper ${isListening ? 'listening' : ''}`} style={{ width: config.outer, height: config.outer }}>
            <div className="orb-ring" style={{ width: '100%', height: '100%' }}></div>
            {isListening && <div className="pulse-layer"></div>}
            <button
                className={`voice-orb ${isListening ? 'active' : ''}`}
                style={{ 
                    width: config.inner, 
                    height: config.inner, 
                    fontSize: config.font,
                    padding: 0,
                    margin: 0,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isListening ? '#FF4136' : 'var(--accent-yellow)',
                    border: '4px solid black',
                    boxShadow: isListening ? 'none' : 'var(--shadow-small)',
                    transform: isListening ? 'translate(2px, 2px)' : 'none'
                }}
                onClick={isListening ? onStop : onStart}
                aria-label={isListening ? 'Stop listening' : 'Start listening'}
            >
                {isListening ? '⏹' : '🎙️'}
            </button>
        </div>
    );
};

export default VoiceButton;
