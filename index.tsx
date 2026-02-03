

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import {
    AnalysisResult,
    ChatMessage,
    AppStatus
} from './types';

import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

import DottedGlowBackground from './components/DottedGlowBackground';

// API Base URL - uses current origin in production, localhost in development
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:8000' : '';
import {
    SparklesIcon,
    ArrowUpIcon,
    FileIcon,
    UserIcon,
    TrendingUpIcon,
    CheckCircleIcon,
    MessageCircleIcon,
    BriefcaseIcon
} from './components/Icons';

const LOADING_VIBES = [
    "AI is having a main-character moment with your resume ✨",
    "Stalking your resume (professionally) 👀",
    "Vibing with your experience…",
    "Reading your resume like tea ☕",
    "Putting your resume under the AI microscope 🔍",
    "Letting AI cook with your resume 🍳🔥",
    "Consulting the career gods 🧠",
    "Asking AI what your resume is giving…",
    "Resume check: loading vibes…",
    "Career glow-up in progress 💅",
    "Resume rizz incoming…",
    "Turning PDFs into possibilities 😤"
];

function App() {
    const [status, setStatus] = useState<AppStatus>('idle');
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [existingResume, setExistingResume] = useState<AnalysisResult | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingMsg, setLoadingMsg] = useState(LOADING_VIBES[0]);
    const [user, setUser] = useState<any>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Initial load from localStorage
    useEffect(() => {
        const savedUser = localStorage.getItem('resume_bestie_user');
        if (savedUser) {
            try {
                const parsed = JSON.parse(savedUser);
                setUser(parsed);
                // Ideally, we'd also validate the token here or auto-fetch existing resume
                // But for now, just restoring the user object is enough to skip login screen
            } catch (e) {
                console.error("Failed to parse saved user", e);
                localStorage.removeItem('resume_bestie_user');
            }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('resume_bestie_user');
        setUser(null);
        setAnalysis(null);
        setExistingResume(null);
        setStatus('idle');
        setChatHistory([]);
    };

    const [showProfileMenu, setShowProfileMenu] = useState(false);

    // Auto-scroll chat but allow global scrolling
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, isChatLoading]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoadingMsg(LOADING_VIBES[Math.floor(Math.random() * LOADING_VIBES.length)]);
        setStatus('analyzing');
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/api/analyze`, {
                method: 'POST',
                headers: {
                    'X-Google-Id': user.uid || user.sub
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.statusText}`);
            }

            const result = await response.json() as AnalysisResult;
            setAnalysis(result);
            setStatus('dashboard');

            const welcomeMsg = `HEYYY ${result.personal_info?.name || 'BESTIE'}! 💅✨ Your resume is literally giving main character energy. You were born for that ${result.predicted_role} life. I've already scouted the best opportunities for you to secure the bag. 💸 Ready to dominate?`;
            startFluidTyping(welcomeMsg);
        } catch (err: any) {
            console.error(err);
            setError("Analysis failed. Let's try that again, bestie! 🥺");
            setStatus('idle');
        }
    };

    const startFluidTyping = (text: string) => {
        setChatHistory([{ role: 'assistant', content: '' }]);
        let currentText = '';
        let i = 0;
        const interval = setInterval(() => {
            if (i < text.length) {
                currentText += text[i];
                setChatHistory(prev => {
                    const next = [...prev];
                    next[next.length - 1] = { ...next[next.length - 1], content: currentText };
                    return next;
                });
                i++;
            } else {
                clearInterval(interval);
            }
        }, 12);
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || isChatLoading || !analysis) return;

        const input = chatInput;
        setChatInput('');

        setChatHistory(prev => [...prev, { role: 'user', content: input }]);
        setIsChatLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: input,
                    context: analysis  // Send the entire analysis object
                }),
            });

            if (!response.ok) {
                throw new Error('Chat request failed');
            }

            const data = await response.json();
            const assistantMessage = data.response;
            setIsChatLoading(false);

            // Start typing animation for assistant reply
            let currentText = '';
            setChatHistory(prev => [...prev, { role: 'assistant', content: '' }]);

            let i = 0;
            const interval = setInterval(() => {
                if (i < assistantMessage.length) {
                    currentText += assistantMessage[i];
                    setChatHistory(prev => {
                        const next = [...prev];
                        next[next.length - 1] = { ...next[next.length - 1], content: currentText };
                        return next;
                    });
                    i++;
                } else {
                    clearInterval(interval);
                }
            }, 8); // Snappy 8ms per character for fluid feel

        } catch (err) {
            console.error(err);
            setChatHistory(prev => [...prev, { role: 'assistant', content: "Bestie, my brain glitched. Can we try that again? 🥺" }]);
            setIsChatLoading(false);
        }
    };

    const reset = () => {
        setStatus('idle');
        setAnalysis(null);
        setChatHistory([]);
        setIsChatLoading(false);
        setError(null);
    };

    if (!user) {
        return (
            <div className="login-screen fade-in">
                <DottedGlowBackground color="rgba(99, 102, 241, 0.08)" glowColor="rgba(129, 140, 248, 0.4)" speedScale={0.5} />
                <div className="hero-content slide-up">
                    <div className="badge animate-float">Career Bestie AI 💅</div>
                    <h1>Welcome <span>Bestie</span></h1>
                    <p>Login to unlock your main character energy and secure the bag. 💸✨</p>
                    <div className="google-login-container">
                        <GoogleLogin
                            onSuccess={async (credentialResponse) => {
                                if (credentialResponse.credential) {
                                    try {
                                        const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ credential: credentialResponse.credential })
                                        });

                                        if (!res.ok) throw new Error('Verification failed');

                                        const verifiedData = await res.json();
                                        setUser(verifiedData);
                                        localStorage.setItem('resume_bestie_user', JSON.stringify(verifiedData));
                                        if (verifiedData.existing_resume) {
                                            setExistingResume(verifiedData.existing_resume);
                                        }
                                        console.log("Verified as:", verifiedData);
                                    } catch (err) {
                                        console.error("Backend verification failed:", err);
                                        try {
                                            // Fallback to local decode
                                            const decoded = jwtDecode(credentialResponse.credential);
                                            console.log("Local decode success:", decoded);
                                            setUser(decoded);
                                            setError("Backend disconnected. Saving disabled. ⚠️");
                                            alert("Backend disconnected! You are logged in locally, but your resume won't be saved.");
                                        } catch (decodeErr) {
                                            console.error("Local decode failed:", decodeErr);
                                            setError("Login failed completely.");
                                            alert("Login failed! Please check console.");
                                        }
                                    }
                                }
                            }}
                            onError={() => {
                                console.log('Login Failed');
                                setError("Vibe check failed! Google login didn't work. 🥺");
                            }}
                            theme="filled_black"
                            shape="pill"
                        />
                    </div>
                    {error && <div className="error-text slide-up">{error}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="resume-app">
            <DottedGlowBackground color="rgba(99, 102, 241, 0.08)" glowColor="rgba(129, 140, 248, 0.4)" speedScale={0.5} />

            {status === 'idle' && (
                <div className="hero-section fade-in">
                    <div className="hero-content slide-up">
                        <div className="badge animate-float">Career Bestie AI 💅</div>

                        {existingResume ? (
                            <div className="welcome-back-card fade-in">
                                <h2>Welcome back, <span>{user.name}</span>! ✨</h2>
                                <p>I remember you bestie! We have your resume on file. Want to pick up where we left off?</p>
                                <div className="welcome-actions">
                                    <button className="primary-btn" onClick={() => {
                                        setAnalysis(existingResume);
                                        setStatus('dashboard');
                                        startFluidTyping(`Welcome back bestie! 💅✨ I've restored your analysis. Let's get that bag! 💸`);
                                    }}>Use Existing Resume</button>
                                    <button className="glass-secondary-btn" onClick={() => setExistingResume(null)}>Upload New One</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h1>Upgrade Your <span>Career Rizz</span></h1>
                                <p>Turn your PDF into a main character moment. Upload your resume and let's secure the bag together. 💸✨</p>

                                <div className="dropzone-container">
                                    <div className="dropzone" onClick={() => fileInputRef.current?.click()}>
                                        <div className="dropzone-inner">
                                            <div className="dropzone-icon"><FileIcon /></div>
                                            <h3>Drop your resume here</h3>
                                            <p>PDF, PNG, or JPG • Max 10MB</p>
                                        </div>
                                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} accept=".pdf,.png,.jpg,.jpeg,.webp" />
                                    </div>
                                </div>
                                {error && <div className="error-text slide-up">{error}</div>}
                            </>
                        )}
                    </div>
                </div>
            )}

            {status === 'analyzing' && (
                <div className="loading-screen fade-in">
                    <div className="scanner-container">
                        <div className="scanner-rect">
                            <div className="scanner-laser"></div>
                            <div className="scanner-dots"></div>
                        </div>
                        <p className="loading-text-bestie">{loadingMsg}</p>
                    </div>
                </div>
            )}

            {status === 'dashboard' && analysis && (
                <div className="dashboard-wrapper fade-in">
                    <header className="dashboard-header">
                        <div className="logo" onClick={reset}>Resume<span>Bestie</span></div>
                        <div className="header-actions">
                            <button className="new-btn" onClick={reset}>Scan New</button>
                            <div className="user-profile" onClick={() => setShowProfileMenu(!showProfileMenu)} style={{ cursor: 'pointer', position: 'relative' }}>
                                <div className="user-info">
                                    <span className="user-name">{user.name || analysis.personal_info.name}</span>
                                    <span className="user-label">Main Character</span>
                                </div>
                                <div className="avatar">
                                    {user.picture ? (
                                        <img src={user.picture} alt="Profile" className="profile-img" />
                                    ) : (
                                        <UserIcon />
                                    )}
                                </div>
                                {showProfileMenu && (
                                    <div className="profile-menu fade-in">
                                        <div className="profile-menu-item danger" onClick={(e) => {
                                            e.stopPropagation();
                                            handleLogout();
                                        }}>
                                            Log Out
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>

                    <main className="dashboard-main">
                        <aside className="left-sidebar">
                            <div className="sidebar-card compact slide-up" style={{ animationDelay: '0.2s' }}>
                                <div className="card-label"><CheckCircleIcon /> Glow Up Tips</div>
                                {analysis.improvements.map((imp, i) => (
                                    <div key={i} className={`gap-item-small ${imp.type}`}>{imp.suggestion}</div>
                                ))}
                            </div>

                            <div className="sidebar-card compact slide-up" style={{ animationDelay: '0.3s' }}>
                                <div className="card-label"><SparklesIcon /> Expertise Matrix</div>
                                <div className="skills-cloud">
                                    {analysis.skills.map((s, i) => <span key={i} className="skill-tag-small">{s}</span>)}
                                </div>
                            </div>
                        </aside>

                        <section className="chat-section">
                            <div className="section-header">
                                <div className="header-left">
                                    <MessageCircleIcon />
                                    <h3>Career Concierge</h3>
                                </div>
                                <div className="header-status">Live</div>
                            </div>
                            <div className="chat-container">
                                {chatHistory.map((msg, idx) => (
                                    <div key={idx} className={`chat-bubble-wrapper ${msg.role}`}>
                                        <div className="chat-bubble">
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isChatLoading && (
                                    <div className="chat-bubble-wrapper assistant loading-state">
                                        <div className="chat-bubble analyzing-bubble">
                                            <div className="analyzing-sparkle">✨</div>
                                            <span>Bestie is cooking...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="chat-input-container">
                                <div className="chat-input-wrapper">
                                    <input
                                        type="text"
                                        placeholder="Ask about your resume, bestie..."
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <button className="send-btn" onClick={handleSendMessage} disabled={isChatLoading || !chatInput.trim()}>
                                        <ArrowUpIcon />
                                    </button>
                                </div>
                            </div>
                        </section>

                        <aside className="right-sidebar">
                            <div className="sidebar-card slide-up">
                                <div className="card-label"><BriefcaseIcon /> The Bag 💸</div>
                                <div className="job-list">
                                    {analysis.jobs && analysis.jobs.length > 0 ? (
                                        analysis.jobs.map((j, i) => (
                                            <a key={i} href={j.apply_link} target="_blank" className="job-item">
                                                <div className="job-info">
                                                    <h4>{j.title}</h4>
                                                    <p className="job-company-text">{j.company}</p>
                                                </div>
                                                <div className="job-match-badge">{j.match_score}%</div>
                                            </a>
                                        ))
                                    ) : (
                                        <div className="no-jobs">No jobs found yet!</div>
                                    )}
                                </div>
                            </div>

                            <div className="sidebar-card compact slide-up" style={{ animationDelay: '0.1s' }}>
                                <div className="card-label"><TrendingUpIcon /> Predicted Role</div>
                                <h2 className="profile-role-small">{analysis.predicted_role}</h2>
                                <p className="profile-summary-small">{analysis.executive_summary}</p>
                            </div>
                        </aside>
                    </main>
                </div>
            )}
        </div>
    );
}

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
            <App />
        </GoogleOAuthProvider>
    );
}
