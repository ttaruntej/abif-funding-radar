import React, { useState, useEffect } from 'react';
import { Lock, Cpu, ArrowRight, ShieldCheck, AlertCircle, Fingerprint, Sun, Moon, Database } from 'lucide-react';
import Footer from './Footer';

const PasswordGate = ({ children, isAuthenticated, setIsAuthenticated, theme, toggleTheme }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [isChecking, setIsChecking] = useState(!isAuthenticated);
    const [relayStatus, setRelayStatus] = useState('checking');

    const apiCandidates = React.useMemo(() => {
        const prodApiBase = 'https://abif-funding-radar-api.vercel.app';
        const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || prodApiBase).replace(/\/$/, '');
        return Array.from(new Set([configuredApiBase, prodApiBase]));
    }, []);

    useEffect(() => {
        setIsChecking(false);
    }, [isAuthenticated]);

    useEffect(() => {
        let isMounted = true;

        const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);

            try {
                return await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timer);
            }
        };

        const checkRelayHealth = async () => {
            for (const apiBase of apiCandidates) {
                try {
                    const response = await fetchWithTimeout(`${apiBase}/api/health`, { method: 'GET' });
                    if (response.ok) {
                        if (isMounted) setRelayStatus('ready');
                        return;
                    }
                } catch (err) { }
            }

            if (isMounted) setRelayStatus('offline');
        };

        checkRelayHealth();

        return () => {
            isMounted = false;
        };
    }, [apiCandidates]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsChecking(true);
        setError(false);
        let data = null;

        try {
            for (const apiBase of apiCandidates) {
                try {
                    const response = await fetch(`${apiBase}/api/verify-access`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password })
                    });

                    data = await response.json().catch(() => ({ success: false, error: 'Malformed response' }));
                    break;
                } catch (err) {
                    data = null;
                }
            }

            if (!data) {
                throw new Error('No API endpoint reachable');
            }

            if (data.success) {
                setRelayStatus('ready');
                sessionStorage.setItem('site_auth', 'true');
                if (typeof data.token === 'string' && data.token.trim() !== '') {
                    sessionStorage.setItem('site_access_token', data.token.trim());
                }
                setIsAuthenticated(true);
            } else {
                sessionStorage.removeItem('site_auth');
                sessionStorage.removeItem('site_access_token');
                setError(data.error || 'Invalid Access Key');
                setPassword('');
            }
        } catch (err) {
            console.error('Auth error:', err);
            setRelayStatus('offline');
            setError('System Relay Unreachable. Please retry.');
        } finally {
            setIsChecking(false);
        }
    };

    if (isChecking) {
        return (
            <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'} flex flex-col items-center justify-center font-black tracking-[0.5em] uppercase text-blue-500`}>
                <div className="w-12 h-1 bg-blue-500/20 rounded-full mb-4 overflow-hidden relative">
                    <div className="absolute inset-0 bg-blue-500 animate-scan"></div>
                </div>
                Initializing Security...
            </div>
        );
    }

    if (isAuthenticated) {
        return children;
    }

    return (
        <div className={`flex flex-col min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} transition-colors duration-700 selection:bg-blue-500/30`}>

            {/* Top Navigation Bar / Actions - Highly Evident Toggle */}
            <div className="flex justify-center pt-8 pb-4 relative z-[100]">
                <button
                    onClick={toggleTheme}
                    className={`flex items-center gap-3 px-6 py-2.5 rounded-full border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-amber-500 hover:bg-white/10 shadow-[0_0_20px_rgba(251,191,36,0.1)]' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-lg md:hover:scale-105'} backdrop-blur-xl transition-all active:scale-95 group font-black text-[10px] uppercase tracking-[0.2em]`}
                >
                    {theme === 'dark' ? (
                        <>
                            <Sun size={14} className="animate-spin-slow" />
                            Switch to Light Mode
                        </>
                    ) : (
                        <>
                            <Moon size={14} />
                            Switch to Dark Mode
                        </>
                    )}
                </button>
            </div>

            {/* Main Auth View - Tightened Spacing */}
            <div className="flex-grow flex flex-col items-center justify-center p-4">

                {/* Background Dynamic Gradients */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] dark:opacity-[0.05]" />
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-glow" />
                    <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px] animate-glow" style={{ animationDelay: '2s' }} />
                </div>

                <div className="relative w-full max-w-[420px] z-10 flex flex-col items-center">
                    {/* Brand Header */}
                    <div className="text-center mb-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="inline-block relative mb-3">
                            <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full animate-pulse" />
                            <div className={`w-12 h-12 rounded-xl ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} border flex items-center justify-center shadow-xl relative z-10`}>
                                <Fingerprint className="text-blue-500" size={24} />
                            </div>
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter italic leading-none mb-1">
                            ABIF <span className="text-blue-500">Radar</span>
                        </h1>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.5em] opacity-80">Funding Intelligence Portal</p>
                    </div>

                    {/* Authentication Card - Compacted Space */}
                    <div className={`${theme === 'dark' ? 'bg-slate-900/50 border-white/5' : 'bg-white border-slate-200'} backdrop-blur-2xl border rounded-[32px] overflow-hidden shadow-2xl relative group transition-all duration-700 w-full animate-in fade-in slide-in-from-bottom-8 duration-1000`}>

                        {/* Status Bar */}
                        <div className="px-8 py-3 bg-slate-100/30 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${relayStatus === 'ready'
                                    ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                    : relayStatus === 'offline'
                                        ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.45)]'
                                        : 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.45)]'
                                    }`} />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    {relayStatus === 'ready'
                                        ? 'Relay Link Active'
                                        : relayStatus === 'offline'
                                            ? 'Relay Link Unreachable'
                                            : 'Checking Relay Link'}
                                </span>
                            </div>
                            <ShieldCheck size={12} className="text-blue-500 opacity-60" />
                        </div>

                        <div className="p-8 sm:p-10 pt-8">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-3 text-center">
                                    <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Restricted Access Area</h2>

                                    <div className="space-y-3">
                                        <input
                                            id="password-input"
                                            type="password"
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value);
                                                if (error) setError(false);
                                            }}
                                            placeholder="Enter Admin Token..."
                                            autoComplete="current-password"
                                            className={`w-full ${theme === 'dark' ? 'bg-slate-950/60 border-white/10 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500/50'} border rounded-2xl px-6 py-4 font-bold text-base placeholder:text-slate-400/40 outline-none transition-all duration-300 shadow-inner text-center tracking-[0.2em] focus:ring-4 focus:ring-blue-500/10 focus:scale-[1.01]`}
                                            required
                                        />

                                        {/* Error Alert */}
                                        {error && (
                                            <div className="flex items-center justify-center gap-2 text-red-500 animate-in fade-in slide-in-from-top-1 duration-300 bg-red-500/5 border border-red-500/10 py-2.5 rounded-xl">
                                                <AlertCircle size={10} />
                                                <span className="text-[10px] font-black uppercase tracking-wider">{error}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isChecking}
                                    className="w-full relative overflow-hidden bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] uppercase tracking-[0.3em] py-4.5 rounded-2xl transition-all duration-300 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 group/btn active:scale-[0.98] disabled:opacity-50"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />
                                    {isChecking ? 'Processing...' : 'Authorize Access'}
                                    <ArrowRight className="group-hover/btn:translate-x-1 transition-transform" size={14} />
                                </button>
                            </form>

                            {/* Info Meta */}
                            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between opacity-50">
                                <div className="flex items-center gap-2">
                                    <Database size={10} className="text-slate-500" />
                                    <span className="text-[7px] font-black uppercase tracking-widest leading-none">Security Protocol AES-256</span>
                                </div>
                                <span className="text-[7px] font-black uppercase tracking-widest italic">V2.4_Secure</span>
                            </div>
                        </div>
                    </div>

                    {/* Legal Subtext */}
                    <div className="mt-6 text-center max-w-[320px] px-2">
                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.05em] leading-relaxed italic opacity-80">
                            Strictly for ABIF Authorized Personnel. Access is monitored and logged under IIT Kharagpur security protocols.
                        </p>
                    </div>
                </div>
            </div>

            {/* Standard Footer */}
            <Footer lastUpdatedTs={null} />
        </div>
    );
};

export default PasswordGate;
