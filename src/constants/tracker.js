export const CATEGORIES = [
    { key: 'all', label: 'All', icon: 'ALL' },
    { key: 'ecosystem', label: 'Ecosystem Support', icon: 'ECO' },
    { key: 'national', label: 'National', icon: 'IN' },
    { key: 'international', label: 'International', icon: 'GL' },
    { key: 'state', label: 'State Specific', icon: 'ST' },
    { key: 'csr', label: 'CSR', icon: 'CSR' },
];

export const STATUS_COLORS = {
    Open: 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30',
    'Coming Soon': 'bg-blue-900/30 text-blue-400 border-blue-500/30',
    Rolling: 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30',
    'Closing Soon': 'bg-red-900/30 text-red-400 border-red-500/30',
    Closed: 'bg-slate-800 text-slate-500 border-slate-700',
    'Verify Manually': 'bg-slate-800 text-slate-500 border-slate-700',
};

export const CAT_STYLES = {
    all: 'border-blue-500/50 text-blue-400 bg-blue-500/10',
    ecosystem: 'border-fuchsia-500/50 text-fuchsia-400 bg-fuchsia-500/10',
    national: 'border-blue-500/50 text-blue-400 bg-blue-500/10',
    international: 'border-purple-500/50 text-purple-400 bg-purple-500/10',
    state: 'border-orange-500/50 text-orange-400 bg-orange-500/10',
    csr: 'border-teal-500/50 text-teal-400 bg-teal-500/10',
};

export const CAT_COLORS = {
    ecosystem: { bg: 'bg-fuchsia-900/40', border: 'border-fuchsia-500/50', text: 'text-fuchsia-400' },
    national: { bg: 'bg-blue-900/40', border: 'border-blue-500/50', text: 'text-blue-400' },
    international: { bg: 'bg-purple-900/40', border: 'border-purple-500/50', text: 'text-purple-400' },
    state: { bg: 'bg-orange-900/40', border: 'border-orange-500/50', text: 'text-orange-400' },
    csr: { bg: 'bg-teal-900/40', border: 'border-teal-500/50', text: 'text-teal-400' },
};

export const SECTIONS = [
    {
        key: 'closing-soon',
        label: 'Closing Soon',
        subtitle: 'Apply before the deadline passes',
        filter: (o) => o.status === 'Closing Soon',
        borderColor: 'border-red-500'
    },
    {
        key: 'open',
        label: 'Open | Fixed Deadline',
        subtitle: 'Active calls with specific closing dates',
        filter: (o) => o.status === 'Open',
        borderColor: 'border-emerald-500'
    },
    {
        key: 'rolling',
        label: 'Rolling Opportunities',
        subtitle: 'Apply anytime | no fixed deadline',
        filter: (o) => o.status === 'Rolling',
        borderColor: 'border-blue-500'
    },
    {
        key: 'coming-soon',
        label: 'Coming Soon',
        subtitle: 'Watch these | expected to open soon',
        filter: (o) => o.status === 'Coming Soon',
        borderColor: 'border-amber-500'
    },
];
