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
import SuggestionsHub from './components/SuggestionsHub';
import { Activity, X, TrendingUp, CheckCircle2, Minus, Maximize2, AlertTriangle, RotateCcw } from 'lucide-react';

const IntelligenceReport = lazy(() => import('./components/IntelligenceReport'));
import PasswordGate from './components/PasswordGate';


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
        opportunities, loading, error, report, setReport, lastUpdatedTs, loadData,
        activeAudience, setActiveAudience,
        activeCategory, setActiveCategory,
        activeSector, setActiveSector,
        activeStatus, setActiveStatus,
        searchQuery, setSearchQuery,
        currentView, setCurrentView,
        addLog,
        filtered, catCounts, activeStats, availableSectors, dynamicSentiment,
        clearFilters,
        activateEcosystemPreset
    } = useEcosystemData();

    // 3. Scraper Sync Engine (via Custom Hook)
    const {
        isRefreshing,
        refreshSuccess,
        elapsedTime,
        syncProgress,
        cooldown,
        handleRefresh,
        syncSteps,
        syncSummary,
        syncRunId,
        syncUpdatedAt,
        syncFinishedAt,
        syncStartTime,
        syncError,
        syncFindings,
        isSyncPanelVisible,
        isSyncPanelMinimized,
        dismissSyncPanel,
        toggleSyncPanelMinimized,
        restoreSyncPanel,
        formatSyncDuration
    } = useScraperSync(addLog, loadData, opportunities);

    // 4. Email Dispatch Engine (via Custom Hook)
    const {
        emailNotification,
        dispatching,
        emailLaunchMode,
        emailCooldown,
        dispatchMeta,
        handleEmailTrigger,
        openGitHubEmailWorkflow,
        setEmailNotification
    } = useEmailDispatch(addLog);

    // 5. UI Local State
    const [showReport, setShowReport] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isSyncingReport, setIsSyncingReport] = useState(false);
    const [briefingMode, setBriefingMode] = useState('standard');
    const [dispatchRecipients, setDispatchRecipients] = useState('');
    const [showFloatingBar, setShowFloatingBar] = useState(false);
    const [expandAllCards, setExpandAllCards] = useState(false);
    const [pendingScrollTarget, setPendingScrollTarget] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        try {
            return sessionStorage.getItem('site_auth') === 'true';
        } catch (e) { return false; }
    });

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

    const handleLogout = () => {
        sessionStorage.removeItem('site_auth');
        sessionStorage.removeItem('site_access_token');
        setIsAuthenticated(false);
        addLog('Logged out successfully.', 'info');
    };

    useEffect(() => {
        const handleAuthExpired = (event) => {
            setIsAuthenticated(false);
            addLog(event?.detail?.message || 'Session expired. Please sign in again.', 'error');
        };

        window.addEventListener('abif-auth-expired', handleAuthExpired);
        return () => window.removeEventListener('abif-auth-expired', handleAuthExpired);
    }, [addLog]);

    const handleSyncIntelligence = async () => {
        try {
            setIsSyncingReport(true);
            addLog('Refreshing the briefing view...', 'info');
            const freshReport = await fetchResearchReport();
            if (freshReport) {
                setReport(freshReport);
                addLog('Briefing view refreshed.', 'success');
            }
        } catch (e) {
            addLog('Briefing view could not be refreshed.', 'error');
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

    const scrollToFeedback = () => {
        setExpandAllCards(true);
        setPendingScrollTarget('feedback');
    };

    const isFiltered = searchQuery !== '' || activeCategory !== 'all' || activeSector !== 'All Sectors' || activeStatus !== 'all';
    const shouldShowSyncPanel = isSyncPanelVisible && Boolean(syncStartTime || isRefreshing || refreshSuccess || syncError || syncFindings);

    const formatSyncStamp = (value) => {
        if (!value) return 'Waiting';
        return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const currentEmailFilters = briefingMode === 'filtered'
        ? { activeAudience, activeCategory, activeSector, activeStatus, searchQuery }
        : { activeAudience };

    const dispatchRecipientSummary = dispatchMeta
        ? dispatchMeta.recipientsSummary
        || (typeof dispatchMeta.recipientCount === 'number'
            ? `${dispatchMeta.recipientCount} recipient${dispatchMeta.recipientCount === 1 ? '' : 's'}`
            : dispatchMeta.recipients || 'Confidential')
        : 'Confidential';

    const handleWorkflowEmailLaunch = () => {
        if (!dispatchRecipients.trim()) {
            setEmailNotification({ type: 'error', message: 'Add at least one recipient email.' });
            addLog('Add at least one recipient before opening the briefing window.', 'error');
            return;
        }
        openGitHubEmailWorkflow(dispatchRecipients, briefingMode, currentEmailFilters);
    };

    const handleDirectEmailRelay = () => {
        if (!dispatchRecipients.trim()) {
            setEmailNotification({ type: 'error', message: 'Add at least one recipient email.' });
            addLog('Add at least one recipient before sending the briefing.', 'error');
            return;
        }
        handleEmailTrigger(dispatchRecipients, briefingMode, currentEmailFilters);
        setDispatchRecipients('');
        setIsEmailModalOpen(false);
    };

    const visibleSections = currentView === 'archive'
        ? [{ key: 'vault', label: 'Saved Records', subtitle: 'Archive', borderColor: 'border-slate-400', items: filtered }].filter(s => s.items.length > 0)
        : SECTIONS.map(s => ({ ...s, items: filtered.filter(s.filter) })).filter(s => s.items.length > 0);

    useEffect(() => {
        if (pendingScrollTarget !== 'feedback') return;

        const timer = setTimeout(() => {
            const el = document.getElementById('feedback');
            if (!el) return;

            const yOffset = -120;
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
            setPendingScrollTarget(null);
        }, 120);

        return () => clearTimeout(timer);
    }, [pendingScrollTarget, visibleSections.length]);

    if (loading) return (
        <div className={`flex flex-col items-center justify-center min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-blue-500' : 'bg-slate-50 text-blue-600'} font-black tracking-[0.5em] uppercase text-center px-4 transition-colors duration-500`}>
            <div className="w-12 h-1 bg-blue-500/20 rounded-full mb-4 overflow-hidden relative">
                <div className="absolute inset-0 bg-blue-500 animate-scan"></div>
            </div>
            Preparing Opportunity List...
        </div>
    );

    return (
        <PasswordGate
            isAuthenticated={isAuthenticated}
            setIsAuthenticated={setIsAuthenticated}
            theme={theme}
            toggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
        >
            <div className={`min-h-screen transition-colors duration-1000 selection:bg-blue-500/30 ${currentView === 'archive' ? 'bg-slate-100 dark:bg-slate-900 arclight-gradient' : 'bg-slate-50 dark:bg-slate-950'}`}>


                {shouldShowSyncPanel && (
                    <div className="fixed top-24 right-4 sm:right-8 z-[110] animate-in scale-95 origin-right">
                        {isSyncPanelMinimized ? (
                            <div className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border shadow-2xl rounded-[24px] px-4 py-3 w-[280px] max-w-[calc(100vw-2rem)] overflow-hidden relative ${syncSummary.tone === 'success'
                                ? 'border-emerald-500/30'
                                : syncSummary.tone === 'error'
                                    ? 'border-red-500/30'
                                    : 'border-blue-500/20'
                                }`}>
                                <div className="absolute bottom-0 left-0 h-1 bg-slate-200/60 dark:bg-white/5 w-full" />
                                <div
                                    className={`absolute bottom-0 left-0 h-1 transition-all duration-1000 ease-out ${syncSummary.tone === 'success'
                                        ? 'bg-emerald-500'
                                        : syncSummary.tone === 'error'
                                            ? 'bg-red-500'
                                            : 'bg-blue-500'
                                        }`}
                                    style={{ width: `${syncProgress}%` }}
                                />
                                <div className="flex items-start gap-3 pr-14">
                                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border transition-all ${syncSummary.tone === 'success'
                                        ? 'bg-emerald-500 border-emerald-500'
                                        : syncSummary.tone === 'error'
                                            ? 'bg-red-500 border-red-500'
                                            : 'border-blue-500/40 bg-blue-500/10'
                                        }`}>
                                        {syncSummary.tone === 'success' ? (
                                            <CheckCircle2 size={16} className="text-white" />
                                        ) : syncSummary.tone === 'error' ? (
                                            <AlertTriangle size={16} className="text-white" />
                                        ) : (
                                            <Activity size={15} className="text-blue-500 animate-pulse" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] truncate">
                                                {syncSummary.title}
                                            </h3>
                                            <span className="text-[8px] font-mono font-black text-slate-500 dark:text-slate-400">
                                                {Math.round(syncProgress)}%
                                            </span>
                                        </div>
                                        <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 leading-relaxed">
                                            {refreshSuccess && syncFindings
                                                ? syncFindings.newCount > 0
                                                    ? `${syncFindings.newCount} new opportunities ready to review.`
                                                    : 'No new opportunities in this update.'
                                                : syncError
                                                    ? 'Needs review. Restore this panel for details.'
                                                    : 'Refresh is still in progress.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="absolute top-3 right-3 flex items-center gap-1">
                                    <button
                                        onClick={restoreSyncPanel}
                                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                        aria-label="Restore sync panel"
                                    >
                                        <Maximize2 size={14} />
                                    </button>
                                    <button
                                        onClick={dismissSyncPanel}
                                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                        aria-label="Close sync panel"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border shadow-2xl rounded-[28px] p-5 w-[360px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-7rem)] overflow-hidden relative flex flex-col ${syncSummary.tone === 'success'
                                ? 'border-emerald-500/30'
                                : syncSummary.tone === 'error'
                                    ? 'border-red-500/30'
                                    : 'border-blue-500/20'
                                }`}>
                                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                                <div className="absolute bottom-0 left-0 h-1 bg-slate-200/60 dark:bg-white/5 w-full" />
                                <div
                                    className={`absolute bottom-0 left-0 h-1 transition-all duration-1000 ease-out ${syncSummary.tone === 'success'
                                        ? 'bg-emerald-500'
                                        : syncSummary.tone === 'error'
                                            ? 'bg-red-500'
                                            : 'bg-blue-500'
                                        }`}
                                    style={{ width: `${syncProgress}%` }}
                                />

                                <div className="absolute top-3 right-3 flex items-center gap-1">
                                    <button
                                        onClick={toggleSyncPanelMinimized}
                                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                        aria-label="Minimize sync panel"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <button
                                        onClick={dismissSyncPanel}
                                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                        aria-label="Close sync panel"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                <div className="flex items-start gap-4 mb-5 pr-10">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all ${syncSummary.tone === 'success'
                                        ? 'bg-emerald-500 border-emerald-500'
                                        : syncSummary.tone === 'error'
                                            ? 'bg-red-500 border-red-500'
                                            : 'border-blue-500/40 bg-blue-500/10'
                                        }`}>
                                        {syncSummary.tone === 'success' ? (
                                            <CheckCircle2 size={18} className="text-white" />
                                        ) : syncSummary.tone === 'error' ? (
                                            <X size={18} className="text-white" />
                                        ) : (
                                            <Activity size={16} className="text-blue-500 animate-pulse" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.22em]">
                                                {syncSummary.title}
                                            </h3>
                                            <span className={`text-[9px] font-mono font-black px-2 py-1 rounded-full uppercase ${syncSummary.tone === 'success'
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                : syncSummary.tone === 'error'
                                                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                }`}>
                                                {Math.round(syncProgress)}%
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-2 leading-relaxed">
                                            {syncSummary.subtitle}
                                        </p>
                                    </div>
                                </div>

                                <div className="min-h-0 flex-1 overflow-y-auto pr-1 -mr-1 space-y-5">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-white/5 p-3">
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Elapsed</span>
                                            <span className="block mt-1 text-[12px] font-black text-slate-900 dark:text-white">
                                                {formatSyncDuration(elapsedTime)}
                                            </span>
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-white/5 p-3">
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Cooldown</span>
                                            <span className="block mt-1 text-[12px] font-black text-slate-900 dark:text-white">
                                                {cooldown > 0 ? `${cooldown}s` : 'Ready'}
                                            </span>
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-white/5 p-3">
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Update</span>
                                            <span className="block mt-1 text-[12px] font-black text-slate-900 dark:text-white">
                                                {syncRunId ? `#${String(syncRunId).slice(-6)}` : 'Starting'}
                                            </span>
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-white/5 p-3">
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                {refreshSuccess || syncError ? 'Finished' : 'Updated'}
                                            </span>
                                            <span className="block mt-1 text-[12px] font-black text-slate-900 dark:text-white">
                                                {formatSyncStamp(syncFinishedAt || syncUpdatedAt || syncStartTime)}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.24em]">
                                                Progress Tracker
                                            </span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                                Current stage + progress
                                            </span>
                                        </div>

                                        <div className="space-y-2.5">
                                            {syncSteps.map((step) => (
                                                <div
                                                    key={step.key}
                                                    className={`flex items-start gap-3 rounded-2xl border px-3 py-3 transition-all ${step.status === 'complete'
                                                        ? 'border-emerald-500/20 bg-emerald-500/5'
                                                        : step.status === 'active'
                                                            ? 'border-blue-500/20 bg-blue-500/5'
                                                            : step.status === 'error'
                                                                ? 'border-red-500/20 bg-red-500/5'
                                                                : 'border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-slate-800/40'
                                                        }`}
                                                >
                                                    <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${step.status === 'complete'
                                                        ? 'bg-emerald-500'
                                                        : step.status === 'active'
                                                            ? 'bg-blue-500 animate-pulse'
                                                            : step.status === 'error'
                                                                ? 'bg-red-500'
                                                                : 'bg-slate-300 dark:bg-slate-700'
                                                        }`} />
                                                    <div className="min-w-0">
                                                        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${step.status === 'pending'
                                                            ? 'text-slate-500 dark:text-slate-400'
                                                            : 'text-slate-900 dark:text-white'
                                                            }`}>
                                                            {step.label}
                                                        </p>
                                                        <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                                            {step.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {(refreshSuccess || syncFindings) && (
                                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-white/5 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Update Summary</p>
                                                    <p className="mt-1 text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.16em]">
                                                        {syncFindings?.newCount > 0 ? `${syncFindings.newCount} new opportunities found` : 'No new opportunities found'}
                                                    </p>
                                                </div>
                                                <span className="text-[9px] font-mono font-black text-slate-500 dark:text-slate-400">
                                                    {syncFindings ? `${syncFindings.totalBefore} to ${syncFindings.totalAfter}` : 'Stable'}
                                                </span>
                                            </div>

                                            {syncFindings?.newCount > 0 ? (
                                                <div className="mt-3 space-y-2.5">
                                                    {syncFindings.newItems.map((item) => (
                                                        <div key={`${item.name}-${item.deadline}`} className="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-3">
                                                            <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.14em] leading-relaxed">
                                                                {item.name}
                                                            </p>
                                                            <div className="mt-2 flex items-center justify-between gap-3">
                                                                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.14em] truncate">
                                                                    {item.body}
                                                                </span>
                                                                <span className="text-[8px] font-black px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 uppercase tracking-[0.14em]">
                                                                    {item.status}
                                                                </span>
                                                            </div>
                                                            <p className="mt-2 text-[9px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-[0.14em]">
                                                                {item.deadline}
                                                            </p>
                                                        </div>
                                                    ))}
                                                    {syncFindings.newCount > syncFindings.newItems.length && (
                                                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                                            +{syncFindings.newCount - syncFindings.newItems.length} more new opportunities in this update
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    The opportunity list refreshed successfully, but no new opportunities were added this time.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {syncError && (
                                        <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-red-500 text-white flex items-center justify-center flex-shrink-0">
                                                    <AlertTriangle size={15} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-600 dark:text-red-400">
                                                        Update Needs Review
                                                    </p>
                                                    <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300 leading-relaxed">
                                                        {syncError}
                                                    </p>
                                                    <p className="mt-3 text-[9px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 leading-relaxed">
                                                        The last published opportunity list remains available. You can try again without closing this panel.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-4">
                                                <button
                                                    onClick={handleRefresh}
                                                    disabled={cooldown > 0 || isRefreshing}
                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-950 text-[9px] font-black uppercase tracking-[0.16em] disabled:opacity-50"
                                                >
                                                    <RotateCcw size={12} />
                                                    {cooldown > 0 ? `Try again in ${cooldown}s` : 'Try Again'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.18em]">
                                        This panel stays available until you close it. Minimize keeps the update within reach while you continue working.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {emailNotification && (
                    <div className="fixed bottom-24 right-4 sm:bottom-28 sm:right-28 z-[110] animate-in slide-in-from-right-8">
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
                                <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest leading-none">Briefing</h3>
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
                    onActivateEcosystemPreset={activateEcosystemPreset}
                    onSuggestionClick={scrollToFeedback}
                />

                <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-32 pb-20">
                    <div className={`animate-in delay-200 transition-all duration-700 ${currentView === 'archive' ? 'opacity-30 blur-sm pointer-events-none' : ''}`}>
                        <StatsBoard
                            stats={activeStats}
                            marketSentiment={dynamicSentiment}
                            onReportClick={() => setShowReport(true)}
                            opportunities={filtered}
                            activeAudience={activeAudience}
                            activeCategory={activeCategory}
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
                                message="Adjust your filters or refresh the opportunity list."
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
                                            activeAudience={activeAudience}
                                            forceAllItems={expandAllCards}
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
                    handleExportCSV={() => exportToCSV(filtered, { activeCategory, activeAudience })}
                    onEmailClick={() => setIsEmailModalOpen(true)}
                    onSuggestionsClick={() => setShowSuggestions(true)}
                    emailCooldown={emailCooldown}
                    theme={theme}
                    toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    currentView={currentView}
                    setCurrentView={setCurrentView}
                    handleLogout={handleLogout}
                />

                {showSuggestions && (
                    <SuggestionsHub
                        onClose={() => setShowSuggestions(false)}
                        addLog={addLog}
                        theme={theme}
                    />
                )}

                {isEmailModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsEmailModalOpen(false)} />
                        <div className="relative my-2 sm:my-0 w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain bg-white dark:bg-slate-900 rounded-[32px] shadow-3xl border border-white/5 p-5 sm:p-8 animate-shutter">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="font-black text-slate-900 dark:text-white text-[12px] uppercase flex items-center gap-3">
                                    Send Briefing
                                </h3>
                                <button onClick={() => setIsEmailModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {dispatchMeta && (
                                <div className="mb-6 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Activity size={12} className="text-emerald-500" />
                                        Last Sent Briefing
                                    </h4>
                                    <div className="space-y-3">
                                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                            Subject: <span className="font-medium text-slate-500">{dispatchMeta.subject}</span>
                                        </p>
                                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                            Recipients: <span className="font-medium text-slate-500 truncate block">{dispatchRecipientSummary}</span>
                                        </p>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-2 mb-3">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Timestamp</span>
                                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                                    {new Date(dispatchMeta.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                </span>
                                            </div>
                                            <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700" />
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Included</span>
                                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{dispatchMeta.opportunityCount} Opportunities</span>
                                            </div>
                                        </div>
                                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                                            <details className="text-[10px] text-slate-500 cursor-pointer group">
                                                <summary className="font-black uppercase tracking-widest hover:text-blue-500 transition-colors flex items-center justify-between">
                                                    <span>View Opening Note</span>
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Recipients</label>
                                    <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                        {briefingMode === 'standard'
                                            ? filtered.filter(o => o.targetAudience?.includes('incubator') && o.status !== 'Closed').length
                                            : filtered.length} Matching Opportunities
                                    </span>
                                </div>

                                {/* Briefing Mode Toggle */}
                                <div className="flex gap-2 mb-4 p-1 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <button
                                        onClick={() => setBriefingMode('standard')}
                                        className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${briefingMode === 'standard' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                    >
                                        Standard ({activeAudience === 'startup' ? 'Startup' : 'Incubator'})
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
                                        value={dispatchRecipients}
                                        placeholder="Enter recipient emails separated by commas..."
                                        className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                        onChange={(e) => setDispatchRecipients(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleDirectEmailRelay();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleDirectEmailRelay}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase tracking-[0.18em] py-5 rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                                        disabled={emailCooldown > 0 || (dispatching && emailLaunchMode !== 'github')}
                                    >
                                        {emailCooldown > 0 ? `Ready in ${emailCooldown}s` : 'Send Briefing Now'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showReport && report && (
                    <Suspense fallback={null}>
                        <IntelligenceReport
                            report={report[activeAudience] || report}
                            onClose={() => setShowReport(false)}
                            onDownloadPDF={handleDownloadPDF}
                            onSyncIntelligence={() => {
                                setShowReport(false);
                                handleRefresh();
                            }}
                            isSyncingReport={isRefreshing}
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
                                    className={`px-3 py-2 sm:px-5 sm:py-2.5 rounded-full transition-all text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 sm:gap-3 ${activeStatus === s.key ? 'bg-white text-slate-900 shadow-xl scale-105' : 'text-white/40 hover:text-white hover:bg-white/5'
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
        </PasswordGate>
    );
};

export default App;

