import React from 'react';
import { ArrowLeft, BookOpen, Briefcase, Building2, Filter, RefreshCw, FileDown, Mail, ShieldCheck, Lightbulb, Users } from 'lucide-react';

const workflow = [
    {
        title: 'Open The Dashboard',
        detail: 'Sign in with the access password. The platform opens with the latest opportunities across national, state, international, and CSR sources.'
    },
    {
        title: 'Choose Your Audience Lens',
        detail: 'Switch between STARTUP and INCUBATOR views to instantly adapt the opportunity list and briefing logic to your team objective.'
    },
    {
        title: 'Narrow With Filters',
        detail: 'Use search, category chips, sector, and status filters (Open, Rolling, Coming Soon) to isolate relevant grants, calls, and programs.'
    },
    {
        title: 'Take Action',
        detail: 'Refresh source data, export filtered opportunities to CSV, or send a curated briefing by email to stakeholders.'
    }
];

const startupTips = [
    'Use STARTUP mode for founder-ready funding calls and scheme deadlines.',
    'Prioritize “Open” status opportunities before “Rolling” opportunities.',
    'Export weekly CSV snapshots for pipeline review and follow-up tracking.'
];

const incubatorTips = [
    'Use INCUBATOR mode to find institution-level calls and ecosystem programs.',
    'Share filtered briefings by sector to program managers and mentors.',
    'Track recurring sources with regular refresh checks before team meetings.'
];

const UserManual = () => {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-700">
            <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-14">
                <a
                    href="/"
                    className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                    <ArrowLeft size={14} />
                    Back To Dashboard
                </a>

                <section className="mt-6 rounded-[28px] border border-slate-200 dark:border-white/10 bg-white/85 dark:bg-slate-900/75 backdrop-blur p-6 sm:p-10 shadow-xl">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <BookOpen size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">ABIF Funding Radar User Manual</h1>
                            <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                                This guide helps startup and incubator teams quickly discover opportunities, filter by relevance, and circulate decision-ready briefings.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {workflow.map((step, index) => (
                        <article key={step.title} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Step {index + 1}</p>
                            <h2 className="mt-2 text-lg font-black">{step.title}</h2>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{step.detail}</p>
                        </article>
                    ))}
                </section>

                <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <article className="rounded-2xl border border-emerald-200/70 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-950/20 p-6">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                            <Briefcase size={16} />
                            <h3 className="text-sm font-black uppercase tracking-[0.16em]">Startup Team Playbook</h3>
                        </div>
                        <ul className="mt-4 space-y-2 text-sm text-emerald-900 dark:text-emerald-100 list-disc pl-5">
                            {startupTips.map((tip) => (
                                <li key={tip}>{tip}</li>
                            ))}
                        </ul>
                    </article>

                    <article className="rounded-2xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-950/20 p-6">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                            <Building2 size={16} />
                            <h3 className="text-sm font-black uppercase tracking-[0.16em]">Incubator Team Playbook</h3>
                        </div>
                        <ul className="mt-4 space-y-2 text-sm text-blue-900 dark:text-blue-100 list-disc pl-5">
                            {incubatorTips.map((tip) => (
                                <li key={tip}>{tip}</li>
                            ))}
                        </ul>
                    </article>
                </section>

                <section className="mt-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 sm:p-8">
                    <h3 className="text-lg font-black">Core Features At A Glance</h3>
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl bg-slate-100/70 dark:bg-slate-800/60 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.14em] flex items-center gap-2"><Filter size={13} /> Smart Filtering</p>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Combine search, category, sector, and status filters to shortlist opportunities in under a minute.</p>
                        </div>
                        <div className="rounded-xl bg-slate-100/70 dark:bg-slate-800/60 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.14em] flex items-center gap-2"><RefreshCw size={13} /> Live Refresh</p>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Run sync to fetch newly discovered opportunities and review updates in the sync panel.</p>
                        </div>
                        <div className="rounded-xl bg-slate-100/70 dark:bg-slate-800/60 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.14em] flex items-center gap-2"><FileDown size={13} /> CSV Export</p>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Export current filtered results for internal records, meetings, or follow-up workflows.</p>
                        </div>
                        <div className="rounded-xl bg-slate-100/70 dark:bg-slate-800/60 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.14em] flex items-center gap-2"><Mail size={13} /> Email Briefing</p>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Send instant briefings to selected recipients with either standard or current filter mode.</p>
                        </div>
                    </div>
                </section>

                <section className="mt-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 sm:p-8">
                    <h3 className="text-lg font-black">Recommended Team Routine</h3>
                    <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                        <p className="flex items-start gap-2"><Users size={14} className="mt-0.5 text-blue-500" /> Daily: Refresh once, scan new Open opportunities, and assign owners.</p>
                        <p className="flex items-start gap-2"><Lightbulb size={14} className="mt-0.5 text-amber-500" /> Weekly: Review filtered sector-wise shortlist and export evidence log.</p>
                        <p className="flex items-start gap-2"><ShieldCheck size={14} className="mt-0.5 text-emerald-500" /> Before outreach: Validate eligibility/deadline on source links before submission.</p>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default UserManual;
