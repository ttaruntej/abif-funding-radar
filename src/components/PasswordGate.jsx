import React, { useState, useEffect } from 'react';
import { Lock, Cpu, ArrowRight, ShieldCheck, AlertCircle, Fingerprint } from 'lucide-react';
import Footer from './Footer';

const PasswordGate = ({ children, isAuthenticated, setIsAuthenticated, theme, toggleTheme }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [isChecking, setIsChecking] = useState(!isAuthenticated);

    useEffect(() => {
        setIsChecking(false);
    }, [isAuthenticated]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsChecking(true);
        setError(false);

        const apiBase = (import.meta.env.VITE_API_BASE_URL || 'https://abif-funding-radar-api.vercel.app').replace(/\/$/, '');

        try {
            const response = await fetch(`${apiBase}/api/verify-access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            // Extract result - even for 401/403/500 errors
            const data = await response.json().catch(() => ({ success: false, error: 'Malformed response' }));

            if (data.success) {
                sessionStorage.setItem('site_auth', 'true');
                setIsAuthenticated(true);
            } else {
                // Specific message based on backend result
                setError(data.error || 'Invalid Access Key');
                setPassword('');
            }
        } catch (err) {
            console.error('Auth error:', err);
            setError('System Relay Unreachable. Please retry.');
        } finally {
            setIsChecking(false);
        }
    };

    if (isChecking) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-black tracking-[0.5em] uppercase text-blue-500">
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
        <div className={`flex flex-col min-h-screen ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'} transition-colors duration-1000`}>
            {/* Main Auth View */}
            <div className="flex-grow relative flex items-center justify-center p-4 sm:p-8 overflow-hidden">

                {/* Theme Toggle - Repositioned */}
                <div className="absolute top-6 right-6 z-[100]">
                    <button
                        onClick={toggleTheme}
                        className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-white/5 text-amber-500 border-white/10 hover:bg-white/10' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'} border backdrop-blur-xl transition-all active:scale-95 shadow-lg group`}
                    >
                        {theme === 'dark' ? <Cpu size={18} className="group-hover:rotate-12 transition-transform" /> : <Lock size={18} />}
                    </button>
                </div>

                {/* Background Dynamic Gradients */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-glow" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 rounded-full blur-[120px] animate-glow" style={{ animationDelay: '2s' }} />
                    <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,${theme === 'dark' ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.5)'}_100%)]`} />
                </div>

                <div className="relative w-full max-w-[440px] z-10">
                    {/* Minimalist Top Logo */}
                    <div className="text-center mb-10 flex flex-col items-center">
                        <div className="mb-6 relative">
                            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-150 animate-pulse" />
                            <div className={`w-14 h-14 rounded-2xl ${theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200'} border flex items-center justify-center shadow-2xl relative z-10`}>
                                <Fingerprint className="text-blue-500" size={28} />
                            </div>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-none mb-2">
                            ABIF <span className="text-blue-500">Radar</span>
                        </h1>
                        <div className="flex items-center gap-3">
                            <div className="h-px w-8 bg-slate-300 dark:bg-slate-800" />
                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">Intelligence Portal</p>
                            <div className="h-px w-8 bg-slate-300 dark:bg-slate-800" />
                        </div>
                    </div>

                    {/* Main Card */}
                    <div className={`${theme === 'dark' ? 'bg-slate-900/60 border-white/5' : 'bg-white/90 border-slate-200'} backdrop-blur-2xl border rounded-[48px] p-8 sm:p-12 shadow-2xl relative group transition-all duration-500 hover:shadow-blue-500/5`}>
                        {/* Status Bar */}
                        <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Secure Server Active</span>
                            </div>
                            <ShieldCheck size={14} className="text-blue-500 opacity-60" />
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest ml-1">Identity Confirmation</label>
                                <div className="relative">
                                    <input
                                        id="password-input"
                                        type="password"
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            if (error) setError(false);
                                        }}
                                        placeholder="Enter Access Key"
                                        className={`w-full ${theme === 'dark' ? 'bg-slate-950/40 border-white/10 text-white' : 'bg-slate-100/50 border-slate-200 text-slate-900'} border rounded-3xl px-8 py-5 font-bold text-base placeholder:text-slate-400/50 focus:ring-2 focus:ring-blue-500/30 outline-none transition-all duration-300 shadow-inner text-center tracking-[0.2em]`}
                                        required
                                    />
                                    {error && (
                                        <div className="absolute -bottom-6 left-2 flex items-center gap-2 text-red-500 animate-in fade-in duration-300">
                                            <AlertCircle size={10} />
                                            <span className="text-[10px] font-bold uppercase tracking-tighter">{error}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isChecking}
                                className="w-full relative overflow-hidden bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] uppercase tracking-[0.3em] py-5 rounded-3xl transition-all duration-300 shadow-xl shadow-blue-600/10 flex items-center justify-center gap-3 group/btn active:scale-[0.98] disabled:opacity-50"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
                                {isChecking ? 'Verifying...' : 'Unlock Portal'}
                                <ArrowRight className="group-hover/btn:translate-x-1 transition-transform" size={16} />
                            </button>
                        </form>

                        {/* Card Meta */}
                        <div className="mt-12 pt-8 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Cpu size={12} className="text-slate-400" />
                                <span className="text-[8px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">AES-256 Encrypted</span>
                            </div>
                            <div className="px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/10">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest italic">V2.4.0_STABLE</span>
                            </div>
                        </div>
                    </div>

                    {/* Security Subtext */}
                    <div className="mt-10 px-6 text-center">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-700 uppercase tracking-[0.1em] leading-relaxed italic">
                            Strictly for ABIF Authorized Personnel. Access is monitored and logged under IIT Kharagpur security protocols.
                        </p>
                    </div>
                </div>
            </div>

            {/* Usual Footer */}
            <Footer lastUpdatedTs={null} />
        </div>
    );
};

export default PasswordGate;
