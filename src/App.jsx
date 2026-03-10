import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import './index.css';

import { exportToCSV } from './utils/csvExporter';
import { fetchResearchReport } from './services/api';
import { SECTIONS } from './constants/tracker';

// Hooks
import { useEcosystemData } from './hooks/useEcosystemData';
import { useScraperSync } from './hooks/useScraperSync';
import { useEmailDispatch } from './hooks/useEmailDispatch';

// Components
import Header from './components/Header';
import StatsBoard from './components/StatsBoard';
import CategoryNav from './components/CategoryNav';
import SchemeCard from './components/SchemeCard';
import EmptyState from './components/EmptyState';
import Footer from './components/Footer';
import FeedbackSection from './components/FeedbackSection';
import TacticalSpear from './components/TacticalSpear';
import EcosystemTicker from './components/EcosystemTicker';
import LazyGrid from './components/LazyGrid';
import { Activity, X, TrendingUp, CheckCircle2 } from 'lucide-react';

const IntelligenceReport = lazy(() => import('./components/IntelligenceReport'));

const App = () => {
    // 1. Theme setup
    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem('theme') || 'light';
        } catch (e) { return 'light'; }
    });

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
        try { localStorage.setItem('theme', theme); } catch (e) { }
    }, [theme]);

    // 2. Data & Ecosystem State (via Custom Hook)
    const {
        loading, error, report, setReport, lastUpdatedTs, loadData,
        activeAudience, setActiveAudience,
        activeCategory, setActiveCategory,
        activeSector, setActiveSector,
        activeStatus, setActiveStatus,
        searchQuery, setSearchQuery,
        currentView, setCurrentView,
        addLog,
        filtered, catCounts, activeStats, availableSectors, dynamicSentiment,
        clearFilters
    } = useEcosystemData();

    // 3. Scraper Sync Engine (via Custom Hook)
    const {
        isRefreshing,
        refreshSuccess,
        elapsedTime,
        syncProgress,
        cooldown,
        handleRefresh,
        getScraperMessage
    } = useScraperSync(addLog, loadData);

    // 4. Email Dispatch Engine (via Custom Hook)
    const {
        emailNotification,
        emailCooldown,
        dispatchMeta,
        handleEmailTrigger,
        setEmailNotification
    } = useEmailDispatch(addLog);

    // 5. UI Local State
    const [showReport, setShowReport] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isSyncingReport, setIsSyncingReport] = useState(false);
    const [briefingMode, setBriefingMode] = useState('standard');
    const [showFloatingBar, setShowFloatingBar] = useState(false);

    const sectionRefs = useRef({});
    const categoryNavRef = useRef(null);

    useEffect(() => {
        const handleScroll = () => {
            if (categoryNavRef.current) {
                const rect = categoryNavRef.current.getBoundingClientRect();
                setShowFloatingBar(rect.top <= 72);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleDownloadPDF = () => window.print();

    const handleSyncIntelligence = async () => {
        try {
            setIsSyncingReport(true);
            addLog('Synching Neural Report...', 'info');
            const freshReport = await fetchResearchReport();
            if (freshReport) {
                setReport(freshReport);
                addLog('Intelligence Refreshed from Data Core', 'success');
            }
        } catch (e) {
            addLog('Report Sync Fault', 'error');
        } finally {
            setTimeout(() => setIsSyncingReport(false), 2000);
        }
    };

    const scrollToFilters = () => {
        if (categoryNavRef.current) {
            const yOffset = -72;
            const y = categoryNavRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    const isFiltered = searchQuery !== '' || activeCategory !== 'all' || activeSector !== 'All Sectors' || activeStatus !== 'all';

    if (loading) return (
        <div className={`flex flex-col items-center justify-center min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-blue-500' : 'bg-slate-50 text-blue-600'} font-black tracking-[0.5em] uppercase text-center px-4 transition-colors duration-500`}>
            <div className="w-12 h-1 bg-blue-500/20 rounded-full mb-4 overflow-hidden relative">
                <div className="absolute inset-0 bg-blue-500 animate-scan"></div>
            </div>
            Neural Link Active...
        </div>
    );

    const visibleSections = currentView === 'archive'
        ? [{ key: 'vault', label: 'Vault Records', subtitle: 'Archive Database', borderColor: 'border-slate-400', items: filtered }].filter(s => s.items.length > 0)
        : SECTIONS.map(s => ({ ...s, items: filtered.filter(s.filter) })).filter(s => s.items.length > 0);

    return (
        <div className={`min-h-screen transition-colors duration-1000 selection:bg-blue-500/30 ${currentView === 'archive' ? 'bg-slate-100 dark:bg-slate-900 arclight-gradient' : 'bg-slate-50 dark:bg-slate-950'}`}>

            {isRefreshing && (
                <div className="fixed top-24 right-8 z-[110] animate-in scale-95 origin-right">
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-blue-500/20 shadow-2xl rounded-[24px] p-5 w-[300px] overflow-hidden relative">
                        {/* Progress Background Pulse */}
                        {!refreshSuccess && (
                            <div className="absolute bottom-0 left-0 h-1 bg-blue-500/30 w-full" />
                        )}
                        <div
                            className={`absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-1000 ease-out`}
                            style={{ width: `${syncProgress}%` }}
                        />

                        <div className="flex items-center gap-4 mb-3">
                            <div className={`w-8 h-8 rounded-full border-2 border-slate-700/50 flex items-center justify-center transition-all ${refreshSuccess ? 'bg-emerald-500 border-emerald-500 scale-110' : 'border-t-blue-500 animate-spin'}`}>
                                {refreshSuccess ? <CheckCircle2 size={16} className="text-white" /> : <Activity size={12} className="text-blue-500" />}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">{refreshSuccess ? 'Sync Complete' : 'Researching...'}</h3>
                                    {!refreshSuccess && <span className="text-[9px] font-mono font-bold text-blue-500">{syncProgress}%</span>}
                                </div>
                                <p className="text-[8px] text-slate-500 font-bold uppercase mt-1 truncate">{refreshSuccess ? 'Ecosystem Updated' : getScraperMessage()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {emailNotification && (
                <div className="fixed bottom-28 right-28 z-[110] animate-in slide-in-from-right-8">
                    <div className={`backdrop-blur-2xl border shadow-2xl rounded-2xl p-4 flex items-center gap-4 w-[300px] bg-white/90 dark:bg-slate-900/90 relative ${emailNotification.type === 'success' ? 'border-emerald-500/50' :
                        emailNotification.type === 'error' ? 'border-red-500/50' : 'border-blue-500/50'
                        }`}>

                        {/* Status Icon */}
                        <div className="flex-shrink-0">
                            {emailNotification.type === 'success' ? (
                                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center animate-success-check">
                                    <CheckCircle2 size={18} className="text-white" />
                                </div>
                            ) : emailNotification.type === 'error' ? (
                                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                                    <X size={18} className="text-white" />
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 border-transparent animate-spin flex items-center justify-center">
                                    <Activity size={12} className="text-blue-500" />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 pr-4">
                            <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest leading-none">Transmission</h3>
                            <p className="text-[8px] text-slate-500 font-bold uppercase mt-2">{emailNotification.message}</p>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => setEmailNotification(null)}
                            className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            <EcosystemTicker opportunities={filtered} lastUpdatedTs={lastUpdatedTs} />

            <Header
                currentView={currentView}
                searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                activeCategory={activeCategory} setActiveCategory={setActiveCategory}
                catCounts={catCounts}
                activeAudience={activeAudience} setActiveAudience={setActiveAudience}
                setActiveSector={setActiveSector}
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-32 pb-20">
                <div className={`animate-in delay-200 transition-all duration-700 ${currentView === 'archive' ? 'opacity-30 blur-sm pointer-events-none' : ''}`}>
                    <StatsBoard
                        stats={activeStats}
                        marketSentiment={dynamicSentiment}
                        onReportClick={() => setShowReport(true)}
                        opportunities={filtered}
                    />
                </div>

                <div ref={categoryNavRef}>
                    <CategoryNav
                        activeSector={activeSector} setActiveSector={setActiveSector}
                        availableSectors={availableSectors}
                        activeStatus={activeStatus} setActiveStatus={setActiveStatus}
                        currentView={currentView}
                        isFiltered={isFiltered}
                        onClearFilters={clearFilters}
                    />
                </div>

                <div className="mt-6 transition-all duration-500 relative">
                    {filtered.length === 0 ? (
                        <EmptyState
                            title={currentView === 'archive' ? "Archives Empty" : "No Matches"}
                            message="Adjust filters or refresh the ecosystem research."
                            actionLabel="View All Opportunities"
                            onAction={clearFilters}
                        />
                    ) : (
                        <div className="space-y-12">
                            {visibleSections.map(section => (
                                <div key={section.key} id={section.key} ref={el => { sectionRefs.current[section.key] = el; }} className="scroll-mt-40 animate-in">
                                    {visibleSections.length > 1 && (
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className={`w-1 h-3 rounded-full ${section.borderColor.replace('border-', 'bg-')}`} />
                                            <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400">{section.label}</h3>
                                        </div>
                                    )}
                                    <LazyGrid
                                        items={section.items}
                                        showCategoryBadge={activeCategory === 'all'}
                                        isArchivedMode={currentView === 'archive'}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <TacticalSpear
                handleRefresh={handleRefresh}
                isRefreshing={isRefreshing}
                refreshCooldown={cooldown}
                handleExportCSV={() => exportToCSV(filtered)}
                onEmailClick={() => setIsEmailModalOpen(true)}
                emailCooldown={emailCooldown}
                theme={theme}
                toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                currentView={currentView}
                setCurrentView={setCurrentView}
            />

            {isEmailModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsEmailModalOpen(false)} />
                    <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-3xl border border-white/5 p-8 animate-shutter">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="font-black text-slate-900 dark:text-white text-[12px] uppercase flex items-center gap-3">
                                Briefing Transmission
                            </h3>
                            <button onClick={() => setIsEmailModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {dispatchMeta && (
                            <div className="mb-6 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Activity size={12} className="text-emerald-500" />
                                    Last Active Dispatch
                                </h4>
                                <div className="space-y-3">
                                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                        Subject: <span className="font-medium text-slate-500">{dispatchMeta.subject}</span>
                                    </p>
                                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                        Sent To: <span className="font-medium text-slate-500 truncate block">{dispatchMeta.recipients}</span>
                                    </p>
                                    <div className="flex items-center gap-4 mt-2 mb-3">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Timestamp</span>
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                                {new Date(dispatchMeta.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                            </span>
                                        </div>
                                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Volume</span>
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{dispatchMeta.opportunityCount} Mandates</span>
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                                        <details className="text-[10px] text-slate-500 cursor-pointer group">
                                            <summary className="font-black uppercase tracking-widest hover:text-blue-500 transition-colors flex items-center justify-between">
                                                <span>View AI Sentiment Extract</span>
                                                <TrendingUp size={10} className="group-open:rotate-180 transition-transform" />
                                            </summary>
                                            <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-lg italic leading-relaxed text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-white/5" dangerouslySetInnerHTML={{ __html: dispatchMeta.aiIntro }} />
                                        </details>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">New Recipient(s)</label>
                                <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                    {briefingMode === 'standard'
                                        ? filtered.filter(o => o.targetAudience?.includes('incubator') && o.status !== 'Closed').length
                                        : filtered.length} Prospect Mandates
                                </span>
                            </div>

                            {/* Briefing Mode Toggle */}
                            <div className="flex gap-2 mb-4 p-1 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-white/5">
                                <button
                                    onClick={() => setBriefingMode('standard')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${briefingMode === 'standard' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                >
                                    Standard (Incubator)
                                </button>
                                <button
                                    onClick={() => setBriefingMode('filtered')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${briefingMode === 'filtered' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                    disabled={!isFiltered}
                                >
                                    Current Filters
                                </button>
                            </div>
                            <div>
                                <input
                                    type="text"
                                    placeholder="Enter emails separated by commas..."
                                    className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.target.value.trim()) {
                                            handleEmailTrigger(
                                                e.target.value,
                                                briefingMode,
                                                briefingMode === 'filtered' ? { activeAudience, activeCategory, activeSector, activeStatus, searchQuery } : {}
                                            );
                                            setIsEmailModalOpen(false);
                                        }
                                    }}
                                />
                            </div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase italic px-1">
                                * This will trigger the AI Agent to perform a fresh delta-analysis and dispatch summaries to the targets above.
                            </p>
                            <button
                                onClick={() => {
                                    const input = document.querySelector('input[placeholder="Enter emails separated by commas..."]');
                                    if (input && input.value.trim()) {
                                        handleEmailTrigger(
                                            input.value,
                                            briefingMode,
                                            briefingMode === 'filtered' ? { activeAudience, activeCategory, activeSector, activeStatus, searchQuery } : {}
                                        );
                                        setIsEmailModalOpen(false);
                                    }
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                                disabled={emailCooldown > 0}
                            >
                                {emailCooldown > 0 ? `Proxy Locked (${emailCooldown}s)` : 'Initiate Dispatch Relay'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showReport && report && (
                <Suspense fallback={null}>
                    <IntelligenceReport
                        report={report}
                        onClose={() => setShowReport(false)}
                        onDownloadPDF={handleDownloadPDF}
                        onSyncIntelligence={handleSyncIntelligence}
                        isSyncingReport={isSyncingReport}
                    />
                </Suspense>
            )}

            {showFloatingBar && currentView === 'dashboard' && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 duration-500 pointer-events-auto">
                    <div className="flex items-center p-1 bg-slate-950/80 dark:bg-slate-900/95 backdrop-blur-3xl border border-white/10 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                        {[
                            { key: 'all', label: 'All', color: 'bg-slate-400', section: null },
                            { key: 'Open', label: 'Open', color: 'bg-emerald-500', section: 'open' },
                            { key: 'Rolling', label: 'Rolling', color: 'bg-blue-500', section: 'rolling' },
                            { key: 'Coming Soon', label: 'Soon', color: 'bg-amber-500', section: 'coming-soon' }
                        ].map(s => (
                            <button
                                key={s.key}
                                onClick={() => {
                                    setActiveStatus(s.key);
                                    scrollToFilters();
                                }}
                                className={`px-5 py-2.5 rounded-full transition-all text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-3 ${activeStatus === s.key ? 'bg-white text-slate-900 shadow-xl scale-105' : 'text-white/40 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <div className={`w-1 h-1 rounded-full ${s.color} ${activeStatus === s.key ? 'animate-pulse' : 'opacity-40'}`} />
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <FeedbackSection addLog={addLog} />
            <Footer lastUpdatedTs={lastUpdatedTs} />
        </div>
    );
};

export default App;

