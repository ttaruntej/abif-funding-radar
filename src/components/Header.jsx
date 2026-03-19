import React from 'react';
import { CATEGORIES } from '../constants/tracker';
import { Search, Globe, Landmark, Handshake, Database, Cpu, History, Radar, MessageSquare, BookOpen } from 'lucide-react';

const Header = ({
    currentView,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    catCounts,
    activeAudience,
    setActiveAudience,
    setActiveSector
}) => {

    const getCatIcon = (key) => {
        switch (key) {
            case 'national': return <Landmark size={12} />;
            case 'international': return <Globe size={12} />;
            case 'state': return <Landmark size={12} />;
            case 'csr': return <Handshake size={12} />;
            default: return <Cpu size={12} />;
        }
    };

    const [localSearch, setLocalSearch] = React.useState(searchQuery);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(localSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [localSearch, setSearchQuery]);

    // Sync local search with global search (e.g. when filters are cleared)
    React.useEffect(() => {
        setLocalSearch(searchQuery);
    }, [searchQuery]);

    return (
        <header className="fixed top-9 left-0 right-0 z-[100] px-2 sm:px-4 py-0 pointer-events-none mt-2">
            <div className="max-w-7xl mx-auto flex flex-col gap-2 items-center pointer-events-auto transition-all duration-700 w-full">

                {/* Top Row - Main Header */}
                <div className="flex items-center gap-2 sm:gap-4 bg-white/90 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200 dark:border-white/5 h-14 rounded-full px-3 sm:px-4 shadow-2xl w-full">

                    {/* Brand */}
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="relative">
                            <img src="logos/abif-logo.png" alt="Agri Business Incubation Foundation" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
                            <div className="absolute inset-0 bg-blue-500/10 blur-lg rounded-full" />
                        </div>
                        <div className="hidden lg:flex flex-col text-left leading-none group/intel relative" title="Funding and opportunity list">
                            <span className="text-[10px] font-black tracking-tighter text-slate-900 dark:text-white uppercase italic">Brief</span>
                        </div>
                    </div>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0 hidden md:block"></div>

                    {/* Main filters */}
                    <div className="flex-1 flex items-center gap-2 sm:gap-4 overflow-hidden">

                        {/* Search */}
                        <div className="relative flex-1 min-w-[120px] sm:min-w-[200px]">
                            <Search size={14} className={`absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 transition-all ${localSearch ? 'text-blue-500' : 'text-slate-500'}`} />
                            <input
                                type="text"
                                placeholder={currentView === 'archive' ? "Search..." : "Find..."}
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                                className="w-full h-9 bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-blue-500/20 rounded-xl pl-8 sm:pl-10 pr-2 sm:pr-4 text-[11px] sm:text-[12px] font-bold text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all outline-none"
                            />
                        </div>

                        {/* Categories */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-fade-right py-1 scroll-smooth">
                            <div className="flex items-center gap-2 pr-10"> {/* Deep padding for prominent fade indicator */}
                                {CATEGORIES.map(cat => {
                                    const isActive = activeCategory === cat.key;
                                    return (
                                        <button
                                            key={cat.key}
                                            onClick={() => setActiveCategory(cat.key)}
                                            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl transition-all duration-500 whitespace-nowrap group relative active:scale-95 cursor-pointer ${isActive
                                                ? 'bg-slate-950 dark:bg-white text-white dark:text-slate-950 shadow-md'
                                                : 'bg-slate-100/40 dark:bg-slate-800/40 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}
                                        >
                                            <span className={isActive ? 'text-blue-500' : 'text-slate-400'}>
                                                {getCatIcon(cat.key)}
                                            </span>
                                            <span className="text-[9px] font-black uppercase tracking-widest">{cat.label}</span>
                                            {catCounts[cat.key] > 0 && (
                                                <span className={`text-[8px] font-mono font-black px-1 rounded ${isActive ? 'bg-white/10 dark:bg-slate-950/20 text-white dark:text-slate-950' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                                    {catCounts[cat.key]}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0 hidden md:block"></div>

                    {/* Feedback Anchor */}
                    <button
                        onClick={() => {
                            const el = document.getElementById('feedback');
                            if (el) {
                                const yOffset = -120; // Account for fixed header
                                const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                window.scrollTo({ top: y, behavior: 'smooth' });
                            }
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-600 text-blue-600 hover:text-white transition-all duration-500 font-black text-[9px] uppercase tracking-widest border border-blue-500/10 hover:border-blue-600 shadow-sm active:scale-90 cursor-pointer shrink-0"
                    >
                        <MessageSquare size={12} />
                        <span className="hidden sm:inline">Share Suggestion</span>
                    </button>

                    <a
                        href="?page=user_manual"
                        className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:text-emerald-400 transition-all duration-500 font-black text-[9px] uppercase tracking-widest border border-emerald-500/10 hover:border-emerald-600 shadow-sm active:scale-90 cursor-pointer shrink-0"
                    >
                        <BookOpen size={12} />
                        <span>User Manual</span>
                    </a>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0 hidden md:block"></div>

                    {/* Audience switcher (Desktop) */}
                    <div className="hidden md:flex bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-white/10 shrink-0 shadow-inner overflow-hidden">
                        <div className="relative flex">
                            <div className={`absolute inset-y-0 h-full w-1/2 bg-blue-600 shadow-[0_4px_15px_rgba(37,99,235,0.4)] rounded-xl transition-all duration-500 ease-out ${activeAudience === 'incubator' ? 'translate-x-full' : 'translate-x-0'}`} />
                            <button
                                onClick={() => { setActiveAudience('startup'); setActiveSector('All Sectors'); }}
                                className={`relative z-10 px-5 py-2 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] w-24 sm:w-28 transition-colors cursor-pointer ${activeAudience === 'startup' ? 'text-white' : 'text-slate-400 dark:text-slate-600 hover:text-slate-900 dark:hover:text-slate-400'}`}
                            >
                                STARTUP
                            </button>
                            <button
                                onClick={() => { setActiveAudience('incubator'); setActiveSector('All Sectors'); }}
                                className={`relative z-10 px-5 py-2 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] w-24 sm:w-28 transition-colors cursor-pointer ${activeAudience === 'incubator' ? 'text-white' : 'text-slate-400 dark:text-slate-600 hover:text-slate-900 dark:hover:text-slate-400'}`}
                            >
                                INCUBATOR
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Row - Mobile Audience Switcher */}
                <div className="flex md:hidden bg-white/90 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200 dark:border-white/5 p-1 rounded-full shadow-lg overflow-hidden w-fit">
                    <div className="relative flex">
                        <div className={`absolute inset-y-0 h-full w-1/2 bg-blue-600 shadow-[0_4px_15px_rgba(37,99,235,0.4)] rounded-full transition-all duration-500 ease-out ${activeAudience === 'incubator' ? 'translate-x-full' : 'translate-x-0'}`} />
                        <button
                            onClick={() => { setActiveAudience('startup'); setActiveSector('All Sectors'); }}
                            className={`relative z-10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-colors cursor-pointer ${activeAudience === 'startup' ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            STARTUP
                        </button>
                        <button
                            onClick={() => { setActiveAudience('incubator'); setActiveSector('All Sectors'); }}
                            className={`relative z-10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-colors cursor-pointer ${activeAudience === 'incubator' ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            INCUBATOR
                        </button>
                    </div>
                </div>

            </div>
        </header>
    );
};

export default Header;

