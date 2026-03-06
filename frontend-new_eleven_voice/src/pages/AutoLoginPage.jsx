import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * AutoLoginPage – called by Brixbee desktop app via:
 *   http://localhost:3000/auto-login?name=Navin&role=student&studentId=S001
 *
 * It reads the query params, synthesises auth state, saves to localStorage
 * and immediately redirects to the student dashboard.
 * A nice animated loading screen is shown while this happens.
 */
const AutoLoginPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();
    const [statusMsg, setStatusMsg] = useState('Connecting to Brixbee...');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const perform = async () => {
            const name      = searchParams.get('name')      || 'Brixbee Student';
            const role      = searchParams.get('role')      || 'student';
            const studentId = searchParams.get('studentId') || `S${Date.now()}`;
            const cls       = searchParams.get('class')     || 'Class 6';
            const school    = searchParams.get('school')    || 'EduVoice School';

            setStatusMsg('Syncing Brixbee Session...');
            await animate(40);

            const userData = {
                name,
                role,
                studentId,
                class: cls,
                school,
                email: 'brixbee_student@eduvoice.ai',
                loginSource: 'brixbee-desktop',
            };

            await login(userData, role);
            setStatusMsg('Authenticated! Opening Dashboard...');
            await animate(100);

            // Small timeout to allow AuthContext state to propagate
            setTimeout(() => {
                if (role === 'teacher') navigate('/teacher', { replace: true });
                else if (role === 'admin') navigate('/admin', { replace: true });
                else navigate('/student', { replace: true });
            }, 300);
        };

        perform();
    }, []); // eslint-disable-line

    const animate = (target) =>
        new Promise((resolve) => {
            let cur = progress;
            const step = () => {
                cur += 10;
                setProgress((p) => Math.min(p + 10, target));
                if (cur < target) setTimeout(step, 20);
                else resolve();
            };
            step();
        });

    return (
        <div style={styles.wrapper}>
            {/* Honeycomb background pattern */}
            <div style={styles.bgPattern} aria-hidden="true" />

            <div style={styles.card}>
                {/* Brixbee bee logo */}
                <div style={styles.bee} aria-label="Brixbee logo">🐝</div>
                <h1 style={styles.title}>EduVoice Brixbee</h1>
                <p style={styles.subtitle}>AI Teacher Platform</p>

                <div style={styles.progressBarWrap}>
                    <div style={{ ...styles.progressBar, width: `${progress}%` }} />
                </div>

                <p style={styles.status}>{statusMsg}</p>
                <p style={styles.hint}>Brixbee is opening your dashboard automatically...</p>
            </div>
        </div>
    );
};

const styles = {
    wrapper: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0F0F0B 0%, #1a1208 50%, #0F0F0B 100%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
    },
    bgPattern: {
        position: 'absolute',
        inset: 0,
        backgroundImage: `radial-gradient(circle at 20% 50%, rgba(212,175,55,0.08) 0%, transparent 50%),
                          radial-gradient(circle at 80% 20%, rgba(212,175,55,0.06) 0%, transparent 40%)`,
        pointerEvents: 'none',
    },
    card: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(212,175,55,0.3)',
        borderRadius: '24px',
        padding: '56px 48px',
        textAlign: 'center',
        maxWidth: '420px',
        width: '90vw',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 0 60px rgba(212,175,55,0.12)',
    },
    bee: {
        fontSize: '72px',
        display: 'block',
        marginBottom: '16px',
        animation: 'none',
        filter: 'drop-shadow(0 0 16px rgba(212,175,55,0.5))',
    },
    title: {
        color: '#D4AF37',
        fontSize: '28px',
        fontWeight: '700',
        margin: '0 0 6px 0',
        letterSpacing: '0.5px',
    },
    subtitle: {
        color: '#8a7a5a',
        fontSize: '13px',
        margin: '0 0 36px 0',
        textTransform: 'uppercase',
        letterSpacing: '2px',
    },
    progressBarWrap: {
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '50px',
        height: '6px',
        overflow: 'hidden',
        marginBottom: '24px',
    },
    progressBar: {
        height: '100%',
        background: 'linear-gradient(90deg, #B8860B, #D4AF37, #FFD700)',
        borderRadius: '50px',
        transition: 'width 0.1s ease',
    },
    status: {
        color: '#e8d5a3',
        fontSize: '16px',
        margin: '0 0 8px 0',
        fontWeight: '500',
    },
    hint: {
        color: '#5a5040',
        fontSize: '13px',
        margin: 0,
    },
};

export default AutoLoginPage;
