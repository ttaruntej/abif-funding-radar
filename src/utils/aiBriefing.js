export const generateBriefing = (data, { categoryLabel = '', search = '' } = {}) => {
    if (!data || data.length === 0) return {
        summary: search
            ? `No strategic mandates matching "${search}" were identified in the current intelligence sweep.`
            : categoryLabel
                ? `The ${categoryLabel} segment currently shows no active funding mandates.`
                : "No opportunities currently tracked.",
        insights: [],
        highlight: null,
        status: 'dormant'
    };

    const sectorCounts = {};
    const providerCounts = {};
    let highValueCount = 0;
    let closingSoonCount = 0;
    let topAward = null;
    let maxAwardValue = -1;

    data.forEach(s => {
        // 1. Sector Analysis
        (s.sectors || []).forEach(sector => {
            sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
        });

        // 2. Provider Analysis
        if (s.body) {
            const provider = s.body.split('/')[0].split('(')[0].trim();
            providerCounts[provider] = (providerCounts[provider] || 0) + 1;
        }

        // 3. Urgency
        if (s.status === 'Closing Soon') closingSoonCount++;

        // 4. Value Analysis
        if (s.maxAward && /(Crore|Cr)/i.test(s.maxAward)) {
            highValueCount++;
            const currentVal = parseFloat(s.maxAward.match(/\d+(\.\d+)?/)?.[0] || 0);
            if (currentVal > maxAwardValue) {
                maxAwardValue = currentVal;
                topAward = s;
            }
        }
    });

    const sortedSectors = Object.entries(sectorCounts).sort(([, a], [, b]) => b - a);
    const topSector = sortedSectors[0]?.[0] || 'Agnostic';

    const sortedProviders = Object.entries(providerCounts).sort(([, a], [, b]) => b - a);
    const mainDriver = sortedProviders[0]?.[0] || "Government portals";

    const contextPrefix = search
        ? `Intelligence scan for "${search}"`
        : categoryLabel && categoryLabel !== 'All'
            ? `Strategic synthesis of ${categoryLabel} segments`
            : `Institutional research synthesis of ${data.length} active opportunities`;

    return {
        summary: `${contextPrefix} indicates primary traction in ${topSector} funding segments.`,
        insights: [
            `Strategic Note: ${mainDriver} is currently orchestrating the majority of institutional capital frameworks.`,
            `Liquidity Exposure: ${highValueCount} active programs provide capital in the Crore-plus tier.`,
            closingSoonCount > 0
                ? `Operational Priority: ${closingSoonCount} initiatives are reaching cycle maturity within the next 14 days.`
                : "Stability Assessment: Consistent availability observed for rolling strategic programs."
        ],
        highlight: topAward ? {
            name: topAward.name,
            value: topAward.maxAward
        } : null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'active'
    };
};
