import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Clock, User, RefreshCw, AlertCircle, Database, Search, Filter } from 'lucide-react';
import { fetchSuggestions } from '../services/api';

const SuggestionsHub = ({ onClose, addLog, theme }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all'); // all, recent, anonymous

    const loadSuggestions = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const data = await fetchSuggestions();
            // Sort by timestamp descending
            const sorted = (data || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setSuggestions(sorted);
            setError(null);
            if (!silent && data?.length === 0) addLog('No ecosystem suggestions found.', 'info');
        } catch (err) {
            setError('Failed to sync suggestions. Security relay might be throttled.');
            if (!silent) addLog('Could not retrieve suggestions.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSuggestions();
    }, []);

    const filteredSuggestions = suggestions.filter(s => {
        const matchesSearch = s.feedback.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filter === 'all' ||
            (filter === 'anonymous' && s.email.toLowerCase() === 'anonymous') ||
            (filter === 'recent' && (new Date() - new Date(s.timestamp)) < 7 * 24 * 60 * 60 * 1000);
        return matchesSearch && matchesFilter;
    });

    const formatDate = (isoStr) => {
        const date = new Date(isoStr);
        return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) + ' | ' +
            date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-slate-950/40 animate-in fade-in">
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[40px] shadow-3xl flex flex-col overflow-hidden animate-shutter">

                {/* Header */}
                <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/30">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                            <MessageSquare className="text-white" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-none">Ecosystem Suggestions</h2>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Strategic Intelligence Repository</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => loadSuggestions()}
                            disabled={loading}
                            className={`p-3 rounded-2xl border border-slate-200 dark:border-white/5 text-slate-400 hover:text-blue-500 transition-all active:scale-95 ${loading ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw size={18} />
                        </button>
                        <button onClick={onClose} className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-slate-400 hover:text-red-500 transition-all active:scale-95">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4">
                    <div className="relative flex-grow max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search suggestions or emails..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {[
                            { id: 'all', label: 'All Time' },
                            { id: 'recent', label: 'Last 7 Days' },
                            { id: 'anonymous', label: 'Anonymous' }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${filter === f.id
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50">
                            <div className="w-12 h-1 bg-blue-500/20 rounded-full overflow-hidden relative">
                                <div className="absolute inset-0 bg-blue-500 animate-scan"></div>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Decrypting Suggestions...</span>
                        </div>
                    ) : error ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                            <div className="p-4 bg-red-500/10 rounded-full mb-4">
                                <AlertCircle className="text-red-500" size={32} />
                            </div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-2 font-black">Sync Interrupted</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase max-w-xs leading-relaxed">{error}</p>
                            <button onClick={() => loadSuggestions()} className="mt-6 px-6 py-3 bg-slate-950 dark:bg-white text-white dark:text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform">Retry Sync</button>
                        </div>
                    ) : filteredSuggestions.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-20 grayscale opacity-40">
                            <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full mb-6">
                                <Database size={40} className="text-slate-400" />
                            </div>
                            <h3 className="text-base font-black text-slate-400 uppercase tracking-[0.3em]">No Intelligence Logged</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">Suggestions received from users will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredSuggestions.map((item, idx) => (
                                <div
                                    key={item.id}
                                    className="group p-6 rounded-[32px] bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 hover:border-blue-500/30 transition-all duration-500 animate-in fade-in slide-in-from-bottom-2"
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 flex items-center justify-center text-blue-500 shadow-sm">
                                                <User size={18} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-xs">{item.email}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Clock size={10} className="text-slate-400" />
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(item.timestamp)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="hidden sm:flex items-center gap-2">
                                            <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-full text-[8px] font-black text-slate-400 uppercase tracking-widest">Verified Log</span>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        {/* Stylized Quote Mark */}
                                        <div className="absolute -left-2 -top-2 text-4xl text-blue-500/10 font-serif italic pointer-events-none">"</div>
                                        <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 leading-relaxed pl-4 line-height-relaxed break-words whitespace-pre-wrap">
                                            {item.feedback}
                                        </p>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
                                        <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                            <span>ID: {item.id.slice(-8)}</span>
                                            <div className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                                            <span className="text-blue-500/60">Repository Synced</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="px-8 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center no-print">
                    <div className="flex items-center gap-3 opacity-60">
                        <Database size={12} className="text-slate-400" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Data Persistent via GitHub API v3</span>
                    </div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Intelligence: {suggestions.length} Entries</div>
                </div>
            </div>
        </div>
    );
};

export default SuggestionsHub;
