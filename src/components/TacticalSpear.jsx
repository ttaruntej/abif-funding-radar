import React, { useState } from 'react';
import {
    Plus,
    RefreshCw,
    Download,
    Mail,
    Sun,
    Moon,
    Archive,
    LayoutGrid,
    X,
    ChevronUp
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
    setCurrentView
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = () => setIsOpen(!isOpen);

    const actions = [
        {
            id: 'sync',
            icon: refreshCooldown > 0 ? <span className="text-[10px] font-black">{refreshCooldown}s</span> : <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />,
            label: refreshCooldown > 0 ? `COOLDOWN: ${refreshCooldown}S` : 'SYNCHRONIZE',
            onClick: handleRefresh,
            disabled: isRefreshing || currentView === 'archive' || refreshCooldown > 0,
            color: refreshCooldown > 0 ? 'text-amber-500' : 'hover:text-blue-500 hover:bg-blue-500/10'
        },
        {
            id: 'export',
            icon: <Download size={20} />,
            label: 'EXPORT DATA',
            onClick: handleExportCSV,
            color: 'hover:text-emerald-500 hover:bg-emerald-500/10'
        },
        {
            id: 'email',
            icon: emailCooldown > 0 ? <span className="text-[10px] font-black">{emailCooldown}s</span> : <Mail size={20} />,
            label: emailCooldown > 0 ? `LINK COOLING: ${emailCooldown}S` : 'TRANSMIT BRIEFING',
            onClick: onEmailClick,
            disabled: emailCooldown > 0,
            color: emailCooldown > 0 ? 'text-amber-500' : 'hover:text-indigo-500 hover:bg-indigo-500/10'
        },
        {
            id: 'theme',
            icon: theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />,
            label: theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE',
            onClick: toggleTheme,
            color: 'hover:text-amber-500 hover:bg-amber-500/10'
        },
        {
            id: 'view',
            icon: currentView === 'dashboard' ? <Archive size={20} /> : <LayoutGrid size={20} />,
            label: currentView === 'dashboard' ? 'VIEW ARCHIVES' : 'LIVE MONITOR',
            onClick: () => setCurrentView(currentView === 'dashboard' ? 'archive' : 'dashboard'),
            color: 'hover:text-purple-500 hover:bg-purple-500/10'
        }
    ];

    return (
        <div className="fixed bottom-8 right-8 z-[150] flex flex-col items-center">
            {/* Spear Extended Cluster */}
            <div className={`flex flex-col gap-3 mb-4 transition-all duration-500 transform ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                {actions.map((action, idx) => (
                    <div key={action.id} className="group relative flex items-center justify-end">
                        {/* Hover Metadata */}
                        <span className="absolute right-16 px-3 py-1 bg-slate-900/90 dark:bg-white/90 backdrop-blur-md text-[10px] font-black text-white dark:text-slate-900 uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-xl border border-white/10">
                            {action.label}
                        </span>

                        <button
                            onClick={() => { action.onClick(); if (action.id !== 'theme') setIsOpen(false); }}
                            disabled={action.disabled}
                            className={`w-14 h-14 rounded-2xl bg-white dark:bg-slate-900/80 backdrop-blur-3xl border border-slate-200 dark:border-white/5 shadow-2xl flex items-center justify-center text-slate-500 dark:text-slate-400 transition-all duration-500 ${action.color} ${action.disabled ? 'opacity-30 cursor-not-allowed' : 'active:scale-90 hover:scale-110'}`}
                            style={{ transitionDelay: `${(actions.length - 1 - idx) * 50}ms` }}
                        >
                            {action.icon}
                        </button>
                    </div>
                ))}
            </div>

            {/* Spear Trigger */}
            <button
                onClick={toggleOpen}
                title="Strategic Control Center"
                className={`w-16 h-16 rounded-[24px] shadow-3xl flex items-center justify-center transition-all duration-700 active:scale-90 ${isOpen
                    ? 'bg-red-500 text-white rotate-180'
                    : 'bg-slate-950 dark:bg-white text-white dark:text-slate-950 hover:shadow-blue-500/40'}`}
            >
                {isOpen ? <X size={24} /> : (
                    <div className="relative">
                        <ChevronUp size={24} className="animate-bounce" />
                        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full scale-150 animate-pulse" />
                    </div>
                )}
            </button>
        </div>
    );
};

export default TacticalSpear;

