import React, { useState } from 'react';
import { MessageSquare, Send, CheckCircle2 } from 'lucide-react';

const FeedbackSection = ({ addLog }) => {
    const [feedback, setFeedback] = useState('');
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle'); // idle, sending, success, error

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!feedback.trim()) return;

        try {
            setStatus('sending');
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://abif-funding-tracker.vercel.app'}/api/send-feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feedback,
                    userEmail: email || 'Anonymous',
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) throw new Error('Failed to send feedback');

            setStatus('success');
            addLog('Suggestion transmitted to ABIF management', 'success');
            setFeedback('');
            setEmail('');
            setTimeout(() => setStatus('idle'), 5000);
        } catch (err) {
            setStatus('error');
            addLog('Feedback transmission failed', 'error');
            setTimeout(() => setStatus('idle'), 5000);
        }
    };

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 mb-20 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="relative overflow-hidden rounded-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-2xl p-8 md:p-12">
                {/* Background Accents */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-blue-500/10 rounded-2xl">
                                <MessageSquare className="text-blue-500" size={24} />
                            </div>
                            <h3 className="text-[12px] font-black text-blue-500 uppercase tracking-[0.3em]">Ecosystem Feedback</h3>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-6 leading-tight">
                            Help us refine the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-emerald-500 italic">Strategic Radar.</span>
                        </h2>
                        <p className="text-sm md:text-base font-medium text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
                            Have a suggestion for a new funding source or a feature request? Your feedback directly reaches the TBI Management team at Agri Business Incubation Foundation (ABIF) IIT Kharagpur.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Your email (optional)"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-400 capitalize-none"
                            />
                            <textarea
                                required
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Details of your suggestion or identified funding gap..."
                                rows={4}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-[24px] px-6 py-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-400 resize-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={status === 'sending' || status === 'success'}
                            className={`w-full group flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all duration-500 ${status === 'success'
                                ? 'bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                                : status === 'error'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-slate-950 dark:bg-white text-white dark:text-slate-950 hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white shadow-xl hover:shadow-blue-500/20 active:scale-95'
                                }`}
                        >
                            {status === 'sending' ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : status === 'success' ? (
                                <CheckCircle2 size={18} />
                            ) : (
                                <Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            )}
                            {status === 'sending' ? 'Transmitting...' : status === 'success' ? 'Suggestion Received' : 'Transmit Insight'}
                        </button>
                    </form>
                </div>
            </div>
        </section>
    );
};

export default FeedbackSection;
