import React from 'react';

const EmptyState = ({ title, message, actionLabel, onAction, icon = '🔍' }) => {
    return (
        <div className="flex flex-col items-center justify-center text-center p-12 md:p-20 gap-4 text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/30 border border-slate-300/50 dark:border-slate-700/50 border-dashed rounded-3xl mb-12 animate-in fade-in duration-500">
            <div className="text-5xl mb-2">{icon}</div>
            <h3 className="text-2xl font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
            <p className="text-sm max-w-md leading-relaxed">{message}</p>
            {actionLabel && onAction && (
                <button
                    className="mt-4 px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors border bg-blue-50 dark:bg-blue-500/10 border-blue-400 dark:border-blue-500/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                    onClick={onAction}
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
