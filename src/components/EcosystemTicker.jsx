import React, { useMemo } from 'react';
import { Radio, AlertCircle, TrendingUp, Zap } from 'lucide-react';

const EcosystemTicker = ({ opportunities, lastUpdatedTs }) => {
    const tickerItems = useMemo(() => {
        if (!opportunities || opportunities.length === 0) return [];

        const openCount = opportunities.filter(o => ['Open', 'Rolling', 'Closing Soon'].includes(o.status)).length;
        const closingSoon = opportunities.filter(o => o.status === 'Closing Soon');
        const internationalCount = opportunities.filter(o => o.category === 'international').length;

        // Dynamic Sector trends
        const sectors = opportunities.flatMap(o => o.sectors || []);
        const sectorCounts = sectors.reduce((acc, s) => ({ ...acc, [s]: (acc[s] || 0) + 1 }), {});
        const topSector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0];

        const lastUpdatedText = lastUpdatedTs
            ? `Cycle Completed: ${new Date(Number(lastUpdatedTs)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Autonomous Search Active';

        const items = [
            { icon: <Radio size={12} className="text-emerald-500 animate-pulse" />, text: `System Status: ${openCount} Live Mandates Discovered` },
            { icon: <TrendingUp size={12} className="text-blue-500" />, text: `Sector Dominance: ${topSector ? topSector[0] : 'Strategic Tech'} leading ecosystem flow` },
            { icon: <Zap size={12} className="text-amber-500" />, text: lastUpdatedText },
            { icon: <Globe size={12} className="text-purple-500" />, text: `Global Intel: ${internationalCount} Cross-border schemes verified` }
        ];

        // Add specific alerts if closing soon
        if (closingSoon.length > 0) {
            items.unshift({
                icon: <AlertCircle size={12} className="text-red-500" />,
                text: `Urgent: ${closingSoon[0].name.slice(0, 30)}... expires soon`
            });
        }

        return [...items, ...items]; // Duplicate for seamless infinite loop
    }, [opportunities, lastUpdatedTs]);

    if (tickerItems.length === 0) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[110] bg-slate-950 text-white h-9 flex items-center overflow-hidden border-b border-white/5 pointer-events-none no-print">
            <div className="flex items-center whitespace-nowrap animate-ticker scroll-smooth">
                {tickerItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 px-10 border-r border-white/5">
                        {item.icon}
                        <span className="text-[11px] font-black uppercase tracking-[0.25em] leading-none opacity-90">
                            {item.text}
                        </span>
                    </div>
                ))}
            </div>

            {/* Legend Tag - High Visibility */}
            <div className="absolute left-0 top-0 bottom-0 bg-blue-700 px-6 flex items-center shadow-[10px_0_30px_rgba(0,0,0,0.8)] z-10 border-r border-white/10">
                <span className="text-[9px] font-black italic uppercase tracking-widest text-white">Live Intel Feed</span>
            </div>
        </div>
    );
};

// Simple Globe Icon fallback since it's not in the import list of original lucide icons I was using
const Globe = ({ size, className }) => (
    <svg
        width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeLinejoin="round" className={className}
    >
        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

export default EcosystemTicker;
