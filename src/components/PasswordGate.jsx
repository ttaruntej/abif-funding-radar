import React, { useState, useEffect } from 'react';
import { Lock, Cpu, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

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
        try {
            const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
            const response = await fetch(`${apiBase}/api/verify-access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await response.json();

            if (data.success) {
                sessionStorage.setItem('site_auth', 'true');
                setIsAuthenticated(true);
                setError(false);
            } else {
                setError(true);
                setPassword('');
                const input = document.getElementById('password-input');
                input?.classList.add('animate-bounce');
                setTimeout(() => input?.classList.remove('animate-bounce'), 500);
            }
        } catch (err) {
            console.error('Auth error:', err);
            setError(true);
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
        <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'} selection:bg-blue-500/30 font-sans relative overflow-hidden flex items-center justify-center p-4 transition-colors duration-500`}>
            {/* Theme Toggle in Password Gate */}
            <div className="absolute top-8 right-8 z-[100]">
                <button
                    onClick={toggleTheme}
                    className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/10 text-amber-500 border-white/10' : 'bg-slate-200 text-slate-600 border-slate-300'} border backdrop-blur-xl transition-all active:scale-95 shadow-2xl`}
                >
                    {theme === 'dark' ? <Cpu size={20} className="animate-pulse" /> : <Lock size={20} />}
                </button>
            </div>
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-glow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px] animate-glow" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
            </div>

            <div className="relative w-full max-w-md animate-in duration-700">
                {/* Brand Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20 mb-6 shadow-2xl backdrop-blur-xl group hover:border-blue-500/40 transition-all duration-500">
                        <Lock className="text-blue-500 group-hover:scale-110 transition-transform duration-500" size={32} />
                    </div>
                    <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic leading-none mb-3">
                        ABIF <span className="text-blue-500">Radar</span>
                    </h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                        Funding Intelligence Portal v2.0
                    </p>
                </div>

                {/* Password Card */}
                <div className={`${theme === 'dark' ? 'bg-slate-900/40 border-white/5' : 'bg-white/80 border-slate-200'} backdrop-blur-3xl border rounded-[40px] p-8 sm:p-10 shadow-3xl relative group overflow-hidden transition-colors duration-500`}>
                    {/* Decorative Scan Line */}
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent animate-scan" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <ShieldCheck className="text-emerald-500" size={18} />
                            <h2 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Restricted Access</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="relative">
                                <input
                                    id="password-input"
                                    type="password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (error) setError(false);
                                    }}
                                    placeholder="Enter access code..."
                                    className={`w-full ${theme === 'dark' ? 'bg-slate-950/50 border-white/10 text-blue-500' : 'bg-white border-slate-200 text-blue-600'} border rounded-2xl px-6 py-5 font-black text-lg placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all duration-300 shadow-inner group-hover:border-blue-500/40 text-center tracking-[0.5em]`}
                                    required
                                />
                                {error && (
                                    <div className="absolute -bottom-6 left-1 flex items-center gap-2 text-red-500 animate-in fade-in duration-300">
                                        <AlertCircle size={12} />
                                        <span className="text-[9px] font-black uppercase tracking-wider">Access Denied: Invalid Key</span>
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] uppercase tracking-[0.25em] py-5 rounded-2xl transition-all duration-300 shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 group/btn active:scale-95"
                            >
                                Authenticate Access
                                <ArrowRight className="group-hover/btn:translate-x-1 transition-transform" size={16} />
                            </button>
                        </form>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Cpu size={12} className="text-slate-500" />
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Neural Link Encrypted</span>
                        </div>
                        <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">© 2026 ABIF IIT KGP</span>
                    </div>
                </div>

                {/* System Message */}
                <div className={`mt-8 text-center p-4 ${theme === 'dark' ? 'bg-blue-500/5 border-blue-500/10' : 'bg-blue-50 border-blue-100'} border rounded-2xl backdrop-blur-md transition-colors duration-500`}>
                    <p className={`text-[9px] font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'} uppercase tracking-widest leading-relaxed`}>
                        Authorized personnel only. Your access activity is being logged for institutional security compliance.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PasswordGate;
