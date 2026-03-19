import React from 'react';
import {
    ExternalLink,
    Linkedin,
    Mail,
    ShieldCheck,
    Database,
    Activity,
    Cpu,
    Zap,
    MapPin
} from 'lucide-react';

const Footer = ({ lastUpdatedTs }) => {
    const currentYear = new Date().getFullYear();

    const formatRelTime = (rawTs) => {
        if (!rawTs) return 'INITIALIZING';
        try {
            const diff = Math.floor((Date.now() - parseInt(rawTs)) / 1000);
            if (diff < 60) return 'UP TO DATE';
            if (diff < 3600) return `${Math.floor(diff / 60)}M AGO`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}H AGO`;
            return 'RECENT';
        } catch (e) { return 'STALE'; }
    };

    return (
        <footer className="mt-20 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950 transition-all duration-1000 overflow-hidden relative">
            {/* Aesthetic Background Accents */}
            <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-blue-500/10 to-transparent hidden lg:block" />
            <div className="absolute top-0 left-2/4 w-px h-full bg-gradient-to-b from-slate-500/5 to-transparent hidden lg:block" />
            <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-emerald-500/10 to-transparent hidden lg:block" />

            <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16 mb-20">

                    {/* Column 1: Key Links */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <Zap size={14} className="text-blue-500" />
                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Key Links</h4>
                        </div>
                        <ul className="space-y-4">
                            <li>
                                <a href="https://abif.iitkgp.ac.in/apply/incubation" target="_blank" rel="noopener noreferrer" className="group flex flex-col">
                                    <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-500 transition-colors flex items-center gap-2">
                                        Apply for Incubation <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-all" />
                                    </span>
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1 uppercase tracking-wider">Early-stage agri-tech support</span>
                                </a>
                            </li>
                            <li>
                                <a href="https://abif.iitkgp.ac.in/apply/samridh" target="_blank" rel="noopener noreferrer" className="group flex flex-col">
                                    <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-500 transition-colors flex items-center gap-2">
                                        SAMRIDH Accelerator <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-all" />
                                    </span>
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1 uppercase tracking-wider">MeitY matching fund program</span>
                                </a>
                            </li>
                            <li>
                                <a href="/user_manual" className="group flex flex-col">
                                    <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-500 transition-colors flex items-center gap-2">
                                        User Manual <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-all" />
                                    </span>
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1 uppercase tracking-wider">How startup and incubator teams use the platform</span>
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Column 2: Network Resources */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <Database size={14} className="text-emerald-500" />
                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Network Resources</h4>
                        </div>
                        <ul className="space-y-3">
                            {[
                                { label: 'Portfolio Startups', url: 'https://abif.iitkgp.ac.in/startups' },
                                { label: 'Mentor Network', url: 'https://abif.iitkgp.ac.in/mentors' },
                                { label: 'Registered FPOs', url: 'https://abif.iitkgp.ac.in/fpo' },
                                { label: 'Events & Programs', url: 'https://abif.iitkgp.ac.in/events' }
                            ].map((link, i) => (
                                <li key={i}>
                                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-500 transition-colors uppercase tracking-widest flex items-center justify-between group">
                                        {link.label}
                                        <div className="w-1 h-1 bg-slate-300 dark:bg-slate-800 rounded-full group-hover:bg-emerald-500 transition-colors" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 3: Institutional Partners */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <ShieldCheck size={14} className="text-slate-400" />
                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Institutional Partners</h4>
                        </div>
                        <div className="space-y-5">
                            <div className="flex items-start gap-4">
                                <img src="logos/iitkgp-logo.png" alt="IITKGP" className="w-8 h-8 object-contain opacity-90" />
                                <div className="flex flex-col">
                                    <a href="http://www.iitkgp.ac.in/" target="_blank" rel="noopener noreferrer" className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tighter hover:text-blue-500 transition-colors">IIT Kharagpur</a>
                                    <span className="text-[9px] text-slate-500 dark:text-slate-500 uppercase font-bold mt-0.5">Host Institution</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <img src="logos/nabard-logo.png" alt="NABARD" className="w-8 h-8 object-contain" />
                                <div className="flex flex-col">
                                    <a href="https://www.nabard.org/" target="_blank" rel="noopener noreferrer" className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tighter hover:text-emerald-500 transition-colors">NABARD</a>
                                    <span className="text-[9px] text-slate-500 dark:text-slate-500 uppercase font-bold mt-0.5">Funding Partner</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Column 4: Activity Snapshot */}
                    <div className="space-y-6 lg:pl-4">
                        <div className="bg-white/50 dark:bg-slate-900/50 rounded-[24px] p-6 border border-slate-100 dark:border-white/5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[9px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Activity Snapshot</h4>
                                <Activity size={12} className="text-blue-500" />
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">List Status</span>
                                    <span className="text-[9px] font-black text-emerald-500 uppercase flex items-center gap-1.5">
                                        <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                                        {formatRelTime(lastUpdatedTs)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Review Mode</span>
                                    <span className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase italic">Source Checked</span>
                                </div>
                            </div>
                            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/5 flex gap-4">
                                <a href="https://www.linkedin.com/company/agri-business-incubation-foundation-iit-kharagpur-abif/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-500 transition-colors">
                                    <Linkedin size={16} />
                                </a>
                                <a href="mailto:abif@iitkgp.ac.in" className="text-slate-400 hover:text-blue-500 transition-colors">
                                    <Mail size={16} />
                                </a>
                                <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
                                <a href="https://abif.iitkgp.ac.in/recruitment" target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest hover:text-blue-500 transition-colors">Recruitments</a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Legal Trace */}
                <div className="pt-8 border-t border-slate-200 dark:border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-slate-900 dark:bg-white rounded-lg">
                            <Cpu size={12} className="text-white dark:text-slate-900" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed">
                            &copy; {currentYear} Agri Business Incubation Foundation IIT Kharagpur (ABIF).<br />
                            Opportunity support for founders, incubators, and accelerators.
                        </p>
                    </div>

                    <div className="flex gap-8">
                        <a href="https://abif.iitkgp.ac.in/tenders" target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-slate-400 hover:text-slate-900 dark:hover:text-white uppercase tracking-[0.2em] transition-colors italic">Notices & Tenders</a>
                        <div className="flex items-center gap-2 text-slate-400">
                            <MapPin size={10} />
                            <span className="text-[9px] font-bold uppercase tracking-widest">Kharagpur, India</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lower Shadow Accent */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/20 via-emerald-500/20 to-blue-500/20" />
        </footer>
    );
};

export default Footer;
