import React, { useMemo } from 'react';
import { TrendingUp, Target, DollarSign, Activity, FileText, Radar } from 'lucide-react';
import MarketVectorChart from './MarketVectorChart';

const StatsBoard = ({ stats, marketSentiment, onReportClick, opportunities, activeAudience, activeCategory }) => {
    const highlights = useMemo(() => {
        const h = [
            {
                label: 'Opportunity Scope',
                val: stats.total,
                sub: 'OPPORTUNITIES',
                icon: Target,
                color: 'text-blue-500',
                bg: 'bg-blue-500/10',
                desc: 'TOTAL LISTED'
            },
            {
                label: 'Open Now',
                val: stats.active,
                sub: 'OPEN',
                icon: DollarSign,
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/10',
                desc: 'READY NOW'
            }
        ];

        if (activeCategory === 'ecosystem') {
            h.push({
                label: 'Ecosystem Support',
                val: stats.ecosystemSupport || 0,
                sub: 'INTERMEDIARY',
                icon: Radar,
                color: 'text-fuchsia-500',
                bg: 'bg-fuchsia-500/10',
                desc: 'OPERATIONS + COHORTS'
            });
        } else if (activeAudience === 'incubator') {
            h.push({
                label: 'Incubator Grants',
                val: stats.incubatorFunds || 0,
                sub: 'ELIGIBILITY',
                icon: Target,
                color: 'text-purple-500',
                bg: 'bg-purple-500/10',
                desc: 'ECOSYSTEM SUPPORT'
            });
        } else {
            h.push({
                label: 'Closing Soon',
                val: stats.closingSoon || 0,
                sub: 'URGENCY',
                icon: Activity,
                color: 'text-rose-500',
                bg: 'bg-rose-500/10',
                desc: 'ACTION REQUIRED'
            });
        }
        return h;
    }, [stats, activeAudience, activeCategory]);

    const briefingText = typeof stats.briefing === 'object' ? stats.briefing.summary : stats.briefing;

    return (
        <div className="mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

                {/* Left Side: Metrics & Radar (8 Columns) */}
                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-12 gap-6">
                    {/* Primary Metrics */}
                    <div className="sm:col-span-7 grid grid-cols-1 gap-4">
                        {highlights.map((h, i) => (
                            <div key={i} className="group h-full command-box-depth backdrop-blur-2xl border border-slate-200 dark:border-white/10 px-6 py-6 rounded-[32px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_20px_40px_-12px_rgba(59,130,246,0.15)] transition-all duration-500 overflow-hidden relative flex flex-col justify-center border-t border-l border-white/5">
                                <div className="flex items-center justify-between mb-4 relative z-10">
                                    <div className={`p-3 rounded-2xl ${h.bg} transition-transform duration-500 group-hover:scale-110 shadow-inner`}>
                                        <h.icon className={h.color} size={18} />
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{h.sub}</span>
                                        <h4 className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-tighter mt-1">{h.label}</h4>
                                    </div>
                                </div>

                                <div className="relative z-10 flex items-baseline gap-3">
                                    <span className="text-4xl font-black text-slate-950 dark:text-white tracking-tighter tabular-nums leading-none drop-shadow-sm">{h.val}</span>
                                    <div className="flex flex-col">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest italic leading-none ${h.color} group-hover:translate-x-1 transition-transform`}>Count</span>
                                        <span className="text-[8px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-[0.1em] mt-1.5">{h.desc}</span>
                                    </div>
                                </div>

                                <div className={`absolute bottom-0 right-0 w-24 h-24 translate-x-12 translate-y-12 rounded-full opacity-[0.03] group-hover:opacity-[0.08] transition-opacity ${h.bg}`} />
                            </div>
                        ))}
                    </div>

                    {/* Market Vector Visualization */}
                    <div className="sm:col-span-5 h-full">
                        <MarketVectorChart opportunities={opportunities} />
                    </div>
                </div>

                {/* Right Side: AI Briefing Command Center (4 Columns) */}
                <div className="lg:col-span-4 bg-slate-950 text-white rounded-[32px] p-6 shadow-2xl flex flex-col group relative overflow-hidden h-full border border-white/5">
                    <div className="relative z-10 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Quick Summary</h3>
                            </div>
                            <Activity size={16} className="text-blue-400" />
                        </div>

                        <div className="mb-8">
                            <p className="text-[14px] font-bold leading-relaxed italic text-blue-100/90 tracking-tight">
                                "{briefingText}"
                            </p>
                        </div>

                        {/* Intelligence Timeline Simulation */}
                        <div className="space-y-4 mb-6 relative">
                            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/10" />
                            {[
                                { label: 'Opportunity Review', val: `${stats.total} listed`, color: 'bg-blue-500' },
                                { label: 'Total Value', val: `${stats.totalFunds}`, color: 'bg-emerald-500' },
                                activeCategory === 'ecosystem'
                                    ? { label: 'Ecosystem Support', val: `${stats.ecosystemSupport || 0} open`, color: 'bg-fuchsia-500' }
                                    : activeAudience === 'incubator'
                                    ? { label: 'Incubator Support', val: `${stats.incubatorFunds} open`, color: 'bg-purple-500' }
                                    : { label: 'Closing Soon', val: `${stats.closingSoon} imminent`, color: 'bg-rose-500' }
                            ].map((log, i) => (
                                <div key={i} className="flex items-center gap-4 relative z-10 transition-all hover:translate-x-1">
                                    <div className={`w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${log.color}`} />
                                    <div className="flex justify-between items-center flex-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{log.label}</span>
                                        <span className="text-[10px] font-mono font-black text-blue-400">{log.val}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-auto flex flex-wrap gap-4 items-center justify-between pt-6 border-t border-white/10">
                            <div>
                                <p className="text-[8px] font-black text-white/30 uppercase tracking-widest leading-none mb-1.5">Activity Level</p>
                                <div className={`text-[10px] font-black uppercase tracking-[0.1em] ${marketSentiment.color}`}>{marketSentiment.label.split(' / ')[0]}</div>
                            </div>
                            <button
                                onClick={onReportClick}
                                className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-colors flex items-center gap-2"
                            >
                                <FileText size={12} />
                                View Brief
                            </button>
                        </div>
                    </div>

                    {/* Neural Shield Badge */}
                    <div className="absolute top-4 right-4 z-20" title="Source checked: entries are cross-checked against institution and funder pages for accuracy.">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-lg backdrop-blur-md">
                            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">Source Checked</span>
                        </div>
                    </div>

                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_107%,rgba(59,130,246,0.1)_0%,rgba(59,130,246,0)_50%)] pointer-events-none" />
                    <div className="absolute top-0 right-0 p-8 opacity-10 blur-xl">
                        <Radar size={120} className="rotate-45" />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default StatsBoard;
