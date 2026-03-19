import { useState, useEffect, useMemo } from 'react';
import { fetchOpportunities, fetchResearchReport } from '../services/api';
import { generateBriefing } from '../utils/aiBriefing';
import { isEcosystemSupportOpportunity, matchesOpportunityCategory } from '../utils/opportunityFilters';
import { CATEGORIES } from '../constants/tracker';

export const useEcosystemData = () => {
    // Data State
    const [opportunities, setOpportunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [report, setReport] = useState(null);
    const [lastUpdatedTs, setLastUpdatedTs] = useState(() => {
        try { return localStorage.getItem('lastUpdatedTs') || null; } catch (e) { return null; }
    });

    // Navigation/Filter State
    const [activeAudience, setActiveAudience] = useState('startup');
    const [activeCategory, setActiveCategory] = useState('all');
    const [activeSector, setActiveSector] = useState('All Sectors');
    const [activeStatus, setActiveStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentView, setCurrentView] = useState('dashboard');

    // Operational Logs
    const [operationalLogs, setOperationalLogs] = useState(() => {
        try {
            const stored = localStorage.getItem('operationalLogs');
            return (stored ? JSON.parse(stored) : []).slice(0, 10);
        } catch (e) { return []; }
    });

    useEffect(() => {
        try { localStorage.setItem('operationalLogs', JSON.stringify(operationalLogs)); } catch (e) { }
    }, [operationalLogs]);

    const addLog = (event, type = 'info') => {
        const newLog = {
            id: Date.now(),
            event,
            type,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        setOperationalLogs(prev => [newLog, ...prev].slice(0, 10));
    };

    const loadData = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const data = await fetchOpportunities();
            setOpportunities(data);

            const [reportData] = await Promise.allSettled([fetchResearchReport()]);
            if (reportData.status === 'fulfilled') setReport(reportData.value);

            setError(null);

            const nowTs = Date.now().toString();
            setLastUpdatedTs(nowTs);
            try { localStorage.setItem('lastUpdatedTs', nowTs); } catch (e) { }

            if (isSilent) addLog(`Opportunity list updated: ${data.length} items available.`, 'success');
            return data;
        } catch (err) {
            setError("The opportunity list could not be reached.");
            addLog('Refresh could not be completed right now.', 'error');
            return null;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // Derived State
    const { filtered, catCounts, activeStats, availableSectors, dynamicSentiment } = useMemo(() => {
        // Shared Match Logic
        const getMatchQualifiers = (o) => {
            const isArchive = ['Closed', 'Verify Manually'].includes(o.status);
            const matchesView = currentView === 'dashboard' ? !isArchive : isArchive;
            const matchesAudience = activeAudience === 'all' || (o.targetAudience || []).includes(activeAudience);
            const matchesSector = activeSector === 'All Sectors' || (o.sectors || []).includes(activeSector);
            const matchesStatus = activeStatus === 'all' ||
                (activeStatus === 'Open' ? ['Open', 'Closing Soon'].includes(o.status) : o.status === activeStatus);
            const matchesSearch = !searchQuery ||
                (o.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (o.description || '').toLowerCase().includes(searchQuery.toLowerCase());

            return { matchesView, matchesAudience, matchesSector, matchesStatus, matchesSearch };
        };

        const result = [];
        const counts = {};
        CATEGORIES.forEach(c => { counts[c.key] = 0; });
        const sectorSet = new Set();

        // Metrics for THIS specific filtered context
        const contextualActive = [];
        let contextualTotalCount = 0;
        let contextualOpenCount = 0;
        let contextualClosingSoonCount = 0;
        let contextualEcosystemCount = 0;

        opportunities.forEach(o => {
            const q = getMatchQualifiers(o);
            const oCat = (o.category || '').toLowerCase();
            const isEcosystemSupport = isEcosystemSupportOpportunity(o);

            // 1. Calculate Category Counts (independent of current activeCategory filter)
            if (q.matchesView && q.matchesAudience && q.matchesSector && q.matchesStatus && q.matchesSearch) {
                counts.all += 1;
                if (counts.hasOwnProperty(oCat)) {
                    counts[oCat]++;
                }
                if (isEcosystemSupport) {
                    counts.ecosystem += 1;
                }
            }

            // 2. Primary Filtered Result & Contextual Stats
            if (q.matchesView && q.matchesAudience && q.matchesSector && q.matchesStatus && q.matchesSearch &&
                matchesOpportunityCategory(o, activeCategory)) {

                result.push(o);

                contextualTotalCount++;
                if (['Open', 'Rolling', 'Closing Soon'].includes(o.status)) {
                    contextualOpenCount++;
                    contextualActive.push(o);
                    if (isEcosystemSupport) {
                        contextualEcosystemCount++;
                    }
                }
                if (o.status === 'Closing Soon') contextualClosingSoonCount++;
            }


            // 4. Available Sectors
            if (q.matchesView) {
                (o.sectors || []).forEach(s => sectorSet.add(s));
            }
        });

        // 3. Optional Total Funds Calculation (Simplified for this hook)
        const calculateTotalFundMass = (ops) => {
            let total = 0;
            ops.forEach(op => {
                if (!op.maxAward) return;
                const matches = op.maxAward.match(/[\d,.]+/g);
                if (matches) {
                    let num = parseFloat(matches[0].replace(/,/g, ''));
                    if (op.maxAward.toLowerCase().includes('crore') || op.maxAward.toLowerCase().includes('cr')) {
                        total += num * 10000000;
                    } else if (op.maxAward.toLowerCase().includes('lakh')) {
                        total += num * 100000;
                    }
                }
            });
            const formatter = new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumSignificantDigits: 3
            });
            return {
                numeric: total,
                totalStr: total > 0 ? formatter.format(total) : 'Undisclosed'
            };
        };

        const totalFundsObj = calculateTotalFundMass(contextualActive);

        let contextualIncubatorCount = 0;
        contextualActive.forEach(o => {
            if (o.targetAudience && o.targetAudience.includes('incubator')) {
                contextualIncubatorCount++;
            }
        });

        const statsObj = {
            total: contextualTotalCount,
            active: contextualOpenCount,
            closingSoon: contextualClosingSoonCount,
            totalFunds: totalFundsObj.totalStr,
            incubatorFunds: contextualIncubatorCount,
            ecosystemSupport: contextualEcosystemCount,
            briefing: generateBriefing(contextualActive, {
                categoryLabel: CATEGORIES.find(c => c.key === activeCategory)?.label,
                search: searchQuery,
                activeAudience
            })
        };

        const sentiment = (statsObj.active / (statsObj.total || 1)) > 0.5
            ? { label: 'High Activity', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
            : { label: 'Steady Activity', color: 'text-blue-400', bg: 'bg-blue-500/10' };

        return {
            filtered: result,
            catCounts: counts,
            activeStats: statsObj,
            availableSectors: Array.from(sectorSet).sort(),
            dynamicSentiment: sentiment
        };
    }, [opportunities, activeAudience, activeCategory, activeSector, activeStatus, searchQuery, currentView]);

    const clearFilters = () => {
        setSearchQuery('');
        setActiveCategory('all');
        setActiveSector('All Sectors');
        setActiveStatus('all');
        addLog('Filters cleared.', 'info');
    };

    const activateEcosystemPreset = () => {
        setCurrentView('dashboard');
        setSearchQuery('');
        setActiveAudience('incubator');
        setActiveCategory('ecosystem');
        setActiveSector('All Sectors');
        setActiveStatus('all');
        addLog('Ecosystem preset activated.', 'success');
    };

    return {
        opportunities, loading, error, report, setReport, lastUpdatedTs, loadData,
        activeAudience, setActiveAudience,
        activeCategory, setActiveCategory,
        activeSector, setActiveSector,
        activeStatus, setActiveStatus,
        searchQuery, setSearchQuery,
        currentView, setCurrentView,
        operationalLogs, addLog,
        filtered, catCounts, activeStats, availableSectors, dynamicSentiment,
        clearFilters,
        activateEcosystemPreset
    };
};
