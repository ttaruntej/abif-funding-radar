import React, { useEffect, useRef, useState } from 'react';
import {
    RefreshCw,
    Download,
    Mail,
    Sun,
    Moon,
    Archive,
    LayoutGrid,
    X,
    ChevronUp,
    LogOut,
    Lightbulb
} from 'lucide-react';

const TacticalSpear = ({
    handleRefresh,
    isRefreshing,
    refreshCooldown,
    handleExportCSV,
    onEmailClick,
    emailCooldown,
    theme,
    toggleTheme,
    currentView,
    setCurrentView,
    handleLogout,
    onSuggestionsClick
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return undefined;

        const onGlobalPointerDown = (event) => {
            if (panelRef.current && panelRef.current.contains(event.target)) return;
            setIsOpen(false);
        };

        const onEsc = (event) => {
            if (event.key === 'Escape') setIsOpen(false);
        };

        document.addEventListener('pointerdown', onGlobalPointerDown);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('pointerdown', onGlobalPointerDown);
            document.removeEventListener('keydown', onEsc);
        };
    }, [isOpen]);

    const actions = [
        {
            id: 'suggestions',
            icon: <Lightbulb size={18} />,
            label: 'Suggestions',
            subtitle: 'Share Feedback',
            onClick: onSuggestionsClick,
            color: 'hover:border-amber-400/40 hover:bg-amber-500/10 hover:text-amber-500'
        },
        {
            id: 'sync',
            icon: refreshCooldown > 0
                ? <span className="text-[10px] font-black">{refreshCooldown}s</span>
                : <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />,
            label: refreshCooldown > 0 ? 'Sync Cooldown' : 'Sync',
            subtitle: refreshCooldown > 0 ? `Ready in ${refreshCooldown}s` : 'Refresh Opportunities',
            onClick: handleRefresh,
            disabled: isRefreshing || currentView === 'archive' || refreshCooldown > 0,
            color: refreshCooldown > 0
                ? 'text-amber-500'
                : 'hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-500'
        },
        {
            id: 'export',
            icon: <Download size={18} />,
            label: 'Export',
            subtitle: 'Download CSV',
            onClick: handleExportCSV,
            color: 'hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-500'
        },
        {
            id: 'email',
            icon: emailCooldown > 0
                ? <span className="text-[10px] font-black">{emailCooldown}s</span>
                : <Mail size={18} />,
            label: emailCooldown > 0 ? 'Briefing Cooldown' : 'Briefing',
            subtitle: emailCooldown > 0 ? `Ready in ${emailCooldown}s` : 'Send Briefing',
            onClick: onEmailClick,
            disabled: emailCooldown > 0,
            color: emailCooldown > 0
                ? 'text-amber-500'
                : 'hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-500'
        },
        {
            id: 'theme',
            icon: theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />,
            label: theme === 'dark' ? 'Light Mode' : 'Dark Mode',
            subtitle: 'Toggle Theme',
            onClick: toggleTheme,
            keepOpen: true,
            color: 'hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-500'
        },
        {
            id: 'view',
            icon: currentView === 'dashboard' ? <Archive size={18} /> : <LayoutGrid size={18} />,
            label: currentView === 'dashboard' ? 'Archive' : 'Dashboard',
            subtitle: currentView === 'dashboard' ? 'View Archive' : 'Current List',
            onClick: () => setCurrentView(currentView === 'dashboard' ? 'archive' : 'dashboard'),
            color: 'hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-500'
        },
        {
            id: 'logout',
            icon: <LogOut size={18} />,
            label: 'Logout',
            subtitle: 'End Session',
            onClick: handleLogout,
            color: 'hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500'
        }
    ];

    const handleActionClick = (action) => {
        action.onClick();
        if (!action.keepOpen) setIsOpen(false);
    };

    return (
        <div ref={panelRef} className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-[160]">
            <div
                className={`mb-3 origin-bottom-right transition-all duration-300 ${isOpen
                    ? 'opacity-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 translate-y-3 pointer-events-none'
                    }`}
            >
                <div className="w-[min(92vw,22rem)] sm:w-[22rem] max-h-[65vh] overflow-y-auto rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl p-3">
                    <div className="px-2 pb-2 pt-1 flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                            Quick Actions
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            aria-label="Close quick actions"
                            className="w-8 h-8 rounded-xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 flex items-center justify-center"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {actions.map((action) => (
                            <button
                                key={action.id}
                                type="button"
                                onClick={() => handleActionClick(action)}
                                disabled={action.disabled}
                                className={`min-h-[56px] px-3 py-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 flex items-center gap-3 transition-all ${action.color} ${action.disabled ? 'opacity-45 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                            >
                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700/70 flex items-center justify-center flex-shrink-0">
                                    {action.icon}
                                </div>
                                <div className="min-w-0 text-left">
                                    <p className="text-[10px] font-black uppercase tracking-[0.14em] truncate">
                                        {action.label}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.1em] truncate">
                                        {action.subtitle}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => setIsOpen((value) => !value)}
                    title="Quick Actions"
                    aria-expanded={isOpen}
                    className={`w-16 h-16 rounded-[24px] shadow-2xl flex items-center justify-center transition-all duration-500 active:scale-95 border ${isOpen
                        ? 'bg-red-500 border-red-400 text-white'
                        : 'bg-slate-950 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-950'
                        }`}
                >
                    {isOpen ? <X size={22} /> : <ChevronUp size={24} className="animate-bounce" />}
                </button>
            </div>
        </div>
    );
};

export default TacticalSpear;
