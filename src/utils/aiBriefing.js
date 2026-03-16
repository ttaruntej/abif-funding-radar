export const generateBriefing = (data, { categoryLabel = '', search = '', activeAudience = 'startup' } = {}) => {
    if (!data || data.length === 0) {
        return {
            summary: search
                ? `No matching opportunities for "${search}" were found right now.`
                : categoryLabel
                    ? `The ${categoryLabel} segment currently shows no active opportunities.`
                    : 'No opportunities currently tracked.',
            insights: [],
            highlight: null,
            status: 'dormant'
        };
    }

    const sectorCounts = {};
    const providerCounts = {};
    let incubatorCount = 0;
    let highValueCount = 0;
    let closingSoonCount = 0;
    let topAward = null;
    let maxAwardValue = -1;

    data.forEach((item) => {
        (item.sectors || []).forEach((sector) => {
            sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
        });

        if (item.body) {
            const provider = item.body.split('/')[0].split('(')[0].trim();
            providerCounts[provider] = (providerCounts[provider] || 0) + 1;
        }

        if (item.status === 'Closing Soon') closingSoonCount += 1;
        if (item.targetAudience && item.targetAudience.includes('incubator')) incubatorCount += 1;

        if (item.maxAward && /(Crore|Cr)/i.test(item.maxAward)) {
            highValueCount += 1;
            const currentVal = parseFloat(item.maxAward.match(/\d+(\.\d+)?/)?.[0] || 0);
            if (currentVal > maxAwardValue) {
                maxAwardValue = currentVal;
                topAward = item;
            }
        }
    });

    const sortedSectors = Object.entries(sectorCounts).sort(([, a], [, b]) => b - a);
    const topSector = sortedSectors[0]?.[0] || 'General';

    const sortedProviders = Object.entries(providerCounts).sort(([, a], [, b]) => b - a);
    const mainSource = sortedProviders[0]?.[0] || 'Public funding portals';

    const targetLabel = activeAudience === 'incubator' ? 'Incubator & Ecosystem' : 'Startup';

    const contextPrefix = search
        ? `Search results for "${search}" in ${targetLabel} funding`
        : categoryLabel && categoryLabel !== 'All'
            ? `Current ${categoryLabel} view for ${targetLabel}s`
            : `Current view of ${data.length} active ${targetLabel} opportunities`;

    const summaryBase = `${contextPrefix} shows ${topSector} activity as the primary focus.`;

    let audienceSpecificHighlight = '';
    if (activeAudience === 'incubator') {
        audienceSpecificHighlight = incubatorCount > 0
            ? ` Notably, ${incubatorCount} grants actively support Section 8 operational and capacity building.`
            : ' These grants provide ecosystem-level support rather than direct portfolio funding.';
    } else {
        audienceSpecificHighlight = highValueCount > 0
            ? ` Capital is highly concentrated, with ${highValueCount} active programs providing ₹1Cr+ funding.`
            : '';
    }

    return {
        summary: summaryBase + audienceSpecificHighlight,
        insights: [
            `Top source: ${mainSource} appears most often in this set.`,
            `Funding size: ${highValueCount} active programs provide capital in the crore-plus tier.`,
            closingSoonCount > 0
                ? `${closingSoonCount} opportunities are expected to close within the next 14 days.`
                : 'Rolling opportunities continue to stay available in this set.'
        ],
        highlight: topAward ? {
            name: topAward.name,
            value: topAward.maxAward
        } : null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'active'
    };
};
