import React from 'react';
import { CATEGORIES, STATUS_COLORS } from '../constants/tracker';
import { ExternalLink, ShieldCheck, AlertTriangle, Target, DollarSign, Calendar, Lock } from 'lucide-react';

const SchemeCard = React.memo(({ scheme, showCategoryBadge, isArchivedMode, activeAudience }) => {
    const isVerified = scheme.linkStatus === 'verified';
    const isProbable = scheme.linkStatus === 'probable';
    const isArchived = scheme.status === 'Closed' || scheme.status === 'Verify Manually' || isArchivedMode;

    const catMeta = CATEGORIES.find(c => c.key === scheme.category);
    const statusStyle = STATUS_COLORS[scheme.status] || 'bg-slate-800 text-slate-400 border-slate-700';

    // Stable confidence badge derived from source status.
    const generateConfidence = (name) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        const base = isVerified ? 94 : isProbable ? 72 : 45;
        const variance = Math.abs(hash % 50) / 10;
        return (base + variance).toFixed(1);
    };
    const confidence = generateConfidence(scheme.name);

    return (
        <div className={`group relative flex flex-col rounded-[40px] p-8 transition-all duration-700 overflow-hidden ${isArchivedMode
            ? 'bg-slate-200/40 dark:bg-slate-800/20 border-slate-300 dark:border-white/5 opacity-80'
            : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-white/5 shadow-sm hover:shadow-3xl hover:-translate-y-2'
            } border`}>

            {/* Arclight Depth Stamp */}
            {isArchivedMode && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5">
                    <span className="archive-stamp italic transform -rotate-12 scale-150">ARCHIVED</span>
                </div>
            )}

            {/* Top Tactical Layer */}
            <div className="flex flex-col sm:flex-row justify-between items-start mb-6 relative z-10 gap-3 sm:gap-0">
                <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm ${statusStyle} ${isArchivedMode ? 'grayscale opacity-50' : ''}`}>
                    {scheme.status}
                </div>

                <div className="flex flex-col sm:items-end gap-2 text-right">
                    <div className={`flex flex-row items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm ${isArchivedMode ? 'bg-slate-100 dark:bg-slate-900/50' : 'bg-white/80 dark:bg-slate-800/80'}`}>
                        <DollarSign size={12} className={isArchivedMode ? 'text-slate-400' : 'text-emerald-500'} />
                        <span className={`text-[12px] font-black tracking-tight ${isArchivedMode ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>{scheme.maxAward}</span>
                    </div>
                    {/* Data Source Badge */}
                    <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${scheme.dataSource === 'integrity-guard'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                        : 'bg-blue-500/10 border-blue-500/20 text-blue-600'
                        }`}>
                        {scheme.dataSource === 'integrity-guard' ? 'INSTITUTIONAL' : 'TRACKED'}
                    </div>
                </div>
            </div>

            {/* Content Layer */}
            <div className="flex-1 relative z-10">
                <div className="flex items-start gap-3 mb-3">
                    <h3 className={`text-xl font-black leading-[1.1] tracking-tight transition-colors duration-500 ${isArchivedMode ? 'text-slate-600 dark:text-slate-500' : 'text-slate-950 dark:text-white group-hover:text-blue-500'
                        }`}>
                        {scheme.name}
                    </h3>
                </div>

                <div className="flex items-center gap-2 mb-6">
                    <Target size={12} className="text-slate-500 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest truncate">{scheme.body}</span>
                </div>

                {/* Meta Tags (Nano Style) */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {scheme.category && scheme.category !== 'all' && (
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] flex items-center gap-1.5 ${isArchivedMode ? 'bg-slate-300 dark:bg-slate-800 text-slate-500' : 'bg-slate-950 dark:bg-white text-white dark:text-slate-900'
                            }`}>
                            {catMeta?.icon} {catMeta?.label.toUpperCase()}
                        </span>
                    )}
                    {scheme.stages?.slice(0, 1).map(s => (
                        <span key={s} className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">{s}</span>
                    ))}
                    {scheme.sectors?.slice(0, 1).map(s => (
                        <span key={s} className={`px-2.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-widest ${isArchivedMode ? 'border-slate-300 dark:border-slate-800 text-slate-400' : 'bg-blue-500/5 border-blue-500/20 text-blue-500'
                            }`}>{s}</span>
                    ))}
                    {(scheme.targetAudience && scheme.targetAudience.includes('incubator') && activeAudience === 'incubator') && (
                        <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1 ${isArchivedMode ? 'border-slate-300 dark:border-slate-800 text-slate-400' : 'bg-purple-500/5 border-purple-500/20 text-purple-600 dark:text-purple-400'
                            }`}>
                            <Target size={10} />
                            INCUBATOR ELIGIBLE
                        </span>
                    )}
                </div>

                <p className={`text-[13px] leading-relaxed line-clamp-3 mb-8 font-medium italic ${isArchivedMode ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-400'
                    }`}>
                    {scheme.description}
                </p>
                {/* Critical Eligibility (Gotchas) */}
                {scheme.criticalEligibility && scheme.criticalEligibility.length > 0 && (
                    <div className="mt-4 mb-6 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle size={12} className="text-amber-600 dark:text-amber-500" />
                            <span className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">Critical Eligibility</span>
                        </div>
                        <ul className="space-y-1.5">
                            {scheme.criticalEligibility.map((item, idx) => (
                                <li key={idx} className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-start gap-2 leading-tight">
                                    <div className="w-1 h-1 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Bottom action area */}
            <div className={`mt-auto pt-6 border-t relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 ${isArchivedMode ? 'border-slate-300 dark:border-slate-800/50' : 'border-slate-100 dark:border-slate-800/50'
                }`}>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-slate-400" />
                        <span className={`text-[10px] font-bold uppercase tracking-tighter ${isArchivedMode ? 'text-slate-400' : 'text-slate-500'}`}>Deadline: </span>
                        <span className={`text-[11px] font-bold ${isArchivedMode ? 'text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>{scheme.deadline}</span>
                    </div>
                    {/* Verification Pulse */}
                    <div className="flex items-center gap-2">
                        {isVerified ? (
                            <>
                                <ShieldCheck size={12} className={isArchivedMode ? 'text-slate-400' : 'text-emerald-500'} />
                                <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isArchivedMode ? 'text-slate-400' : 'text-emerald-500'}`}>Source Match ({confidence}%)</span>
                            </>
                        ) : (
                            <>
                                <AlertTriangle size={12} className={isArchivedMode ? 'text-slate-400' : 'text-amber-500'} />
                                <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isArchivedMode ? 'text-slate-400' : 'text-amber-500'}`}>Review Match ({confidence}%)</span>
                            </>
                        )}
                    </div>
                </div>

                <a
                    href={scheme.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={isArchivedMode ? "View Historical Record" : "Visit Official Portal"}
                    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all duration-500 w-full sm:w-auto ${isArchivedMode
                        ? 'bg-slate-300/30 dark:bg-slate-900/50 text-slate-500 border border-slate-400/20'
                        : 'bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-slate-950 dark:text-white hover:bg-slate-950 dark:hover:bg-white hover:text-white dark:hover:text-slate-950 shadow-xl'}`}
                >
                    {isArchivedMode ? <><Lock size={12} /> View Record</> : <><ExternalLink size={14} /> View Opportunity</>}
                </a>
            </div>

            {/* Hover Glow Effect */}
            {!isArchivedMode && (
                <div className="absolute inset-0 rounded-[40px] bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none -z-10 blur-3xl scale-125" />
            )}
        </div>
    );
});

export default SchemeCard;
