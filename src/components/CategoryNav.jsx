import React from 'react';
import { Database, Info, History, Radar } from 'lucide-react';

const CategoryNav = ({
    activeSector,
    setActiveSector,
    availableSectors,
    currentView,
    isFiltered,
    onClearFilters
}) => {
    return (
        <div className="sticky top-[84px] z-[90] mb-6 px-3 sm:px-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/5 shadow-xl transition-all duration-300">

                <div className="flex items-center gap-3 sm:gap-4 overflow-hidden flex-1 relative">
                    {isFiltered && (
                        <button
                            onClick={onClearFilters}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border border-red-500/20 mr-2 group/reset"
                        >
                            <span className="group-hover:rotate-90 transition-transform duration-500">x</span>
                            CLEAR
                        </button>
                    )}

                    <div className="hidden sm:flex items-center gap-2 shrink-0 border-r border-slate-200 dark:border-slate-800 pr-4 mr-1">
                        <Database size={12} className="text-blue-500" />
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Focus</span>
                    </div>

                    <div className="relative flex-1 overflow-hidden h-10 flex items-center">
                        <div className="flex items-center gap-6 sm:gap-10 overflow-x-auto no-scrollbar py-2 mask-fade-right scroll-smooth snap-x">
                            {['All Sectors', ...availableSectors].map((sec) => (
                                <button
                                    key={sec}
                                    onClick={() => setActiveSector(sec)}
                                    className={`text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 flex items-center gap-3 group/sec py-2 px-1 snap-start cursor-pointer transition-transform active:scale-95 ${
                                        activeSector === sec
                                            ? 'text-blue-600 dark:text-blue-400'
                                            : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                                        activeSector === sec
                                            ? 'bg-blue-500 scale-125 shadow-[0_0_12px_rgba(59,130,246,0.6)]'
                                            : 'bg-slate-300 dark:bg-slate-800 opacity-40 group-hover/sec:opacity-100'
                                    }`} />
                                    {sec}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 ml-2 sm:ml-4 pl-2 sm:pl-4 border-l border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2 cursor-pointer group/mode" title={currentView === 'archive' ? 'Browse saved records' : 'Browse current opportunities'}>
                        {currentView === 'archive'
                            ? <History size={13} className="text-slate-400 group-hover/mode:text-blue-500 transition-colors" />
                            : <Radar size={13} className="text-blue-500 animate-pulse" />}
                        <span className="hidden sm:inline text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest leading-none">
                            {currentView === 'archive' ? 'ARCHIVE' : 'LIVE'}
                        </span>
                    </div>

                    <button
                        className="hidden md:flex items-center gap-2 group/info hover:text-blue-500 transition-colors ml-2 cursor-pointer relative"
                        title="How this list is prepared"
                    >
                        <Info size={12} className="text-slate-500 group-hover/info:text-blue-500" />
                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest leading-none">How It Works</span>

                        <div className="absolute bottom-full right-0 mb-4 w-64 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl border border-white/5 opacity-0 group-hover/info:opacity-100 transition-all pointer-events-none translate-y-2 group-hover/info:translate-y-0 z-[100]">
                            <h4 className="text-[10px] font-black uppercase text-blue-400 mb-2">How This List Is Prepared</h4>
                            <p className="text-[9px] leading-relaxed text-slate-300 normal-case font-medium">
                                Opportunities are gathered from trusted institution, funder, and program pages, then checked so teams can review them faster.
                            </p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CategoryNav;
