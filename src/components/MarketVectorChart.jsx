import React, { useMemo } from 'react';
import { Radar, Activity, Zap } from 'lucide-react';

const MarketVectorChart = ({ opportunities }) => {
    // Process data for sector dominance
    const chartData = useMemo(() => {
        if (!opportunities || opportunities.length === 0) return [];

        const sectorCounts = {};
        opportunities.forEach(o => {
            (o.sectors || []).forEach(s => {
                // Filter out 'Agnostic' or 'Misc' for a more interesting strategic radar
                if (s.toLowerCase() === 'agnostic' || s.toLowerCase() === 'miscellaneous') return;
                sectorCounts[s] = (sectorCounts[s] || 0) + 1;
            });
        });

        // Get top 6 sectors for the radar visualization
        const sorted = Object.entries(sectorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, value]) => ({ name, value }));

        return sorted.length > 0 ? sorted : [{ name: 'Scanning...', value: 1 }];
    }, [opportunities]);

    const maxValue = Math.max(...chartData.map(d => d.value), 1);

    if (chartData.length < 3) return null; // Need at least 3 points for a radar feel

    return (
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-2xl border border-slate-200 dark:border-white/5 p-6 rounded-[32px] shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden relative flex flex-col h-full">
            <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 rounded-xl">
                        <Radar size={18} className="text-blue-500" />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Market Vector</h3>
                        <p className="text-[8px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mt-1.5">Sector Dominance (Excl. Agnostic)</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-500/10 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest leading-none">Analysis Active</span>
                </div>
            </div>

            {/* Strategic Radar Visualization (High-Tech SVG) */}
            <div className="flex-1 flex items-center justify-center relative min-h-[220px]">
                <svg viewBox="0 0 360 360" className="w-full h-full max-w-[280px] drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                    {/* Background Grid Rings */}
                    {[0.25, 0.5, 0.75, 1].map((r, i) => (
                        <circle
                            key={i}
                            cx="180" cy="180"
                            r={100 * r}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                            className="text-slate-200 dark:text-slate-800 opacity-60"
                        />
                    ))}

                    {/* Grid Lines */}
                    {chartData.map((_, i) => {
                        const angle = (i * 2 * Math.PI) / chartData.length;
                        const x = 180 + 100 * Math.cos(angle);
                        const y = 180 + 100 * Math.sin(angle);
                        return (
                            <line
                                key={i}
                                x1="180" y1="180"
                                x2={x} y2={y}
                                stroke="currentColor"
                                strokeWidth="1"
                                className="text-slate-200 dark:text-slate-800 opacity-60"
                            />
                        );
                    })}

                    {/* Data Points & Label Positions */}
                    {chartData.map((d, i) => {
                        const angle = (i * 2 * Math.PI) / chartData.length;
                        const r = (d.value / maxValue) * 100;
                        const x = 180 + r * Math.cos(angle);
                        const y = 180 + r * Math.sin(angle);

                        // Position labels further out
                        const lx = 180 + 135 * Math.cos(angle);
                        const ly = 180 + 135 * Math.sin(angle);

                        return (
                            <React.Fragment key={i}>
                                <circle cx={x} cy={y} r="4" fill="rgb(59, 130, 246)" className="shadow-lg" />
                                <foreignObject x={lx - 60} y={ly - 20} width="120" height="40">
                                    <div className="flex flex-col items-center justify-center leading-tight">
                                        <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase w-full text-center drop-shadow-sm px-1 whitespace-nowrap overflow-hidden text-ellipsis">
                                            {d.name}
                                        </span>
                                        <span className="text-[9px] font-mono font-black text-blue-500 mt-1">{d.value}</span>
                                    </div>
                                </foreignObject>
                            </React.Fragment>
                        );
                    })}

                    {/* AI Data Mesh (The Radar Area) */}
                    <path
                        d={chartData.map((d, i) => {
                            const angle = (i * 2 * Math.PI) / chartData.length;
                            const r = (d.value / maxValue) * 100;
                            const x = 180 + r * Math.cos(angle);
                            const y = 180 + r * Math.sin(angle);
                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ') + ' Z'}
                        fill="url(#radarGradient)"
                        stroke="rgb(59, 130, 246)"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        className="animate-pulse"
                    />

                    <defs>
                        <radialGradient id="radarGradient" cx="180" cy="180" r="100" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.4)" />
                            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.7)" />
                        </radialGradient>
                    </defs>
                </svg>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity size={10} className="text-slate-400" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active Pulse</span>
                </div>
                <div className="flex items-center gap-1">
                    <Zap size={10} className="text-blue-500" />
                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest italic">{chartData[0]?.name.toUpperCase()} DOMINANCE</span>
                </div>
            </div>

            {/* Background Decorative Mesh */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_107%_30%,rgba(59,130,246,0.03)_0%,rgba(59,130,246,0)_50%)] pointer-events-none" />
        </div>
    );
};

export default MarketVectorChart;
