export const generateBriefing = (data, { categoryLabel = '', search = '' } = {}) => {
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

    const contextPrefix = search
        ? `Search results for "${search}"`
        : categoryLabel && categoryLabel !== 'All'
            ? `Current view for ${categoryLabel}`
            : `Current view of ${data.length} active opportunities`;

    return {
        summary: `${contextPrefix} shows the strongest activity in ${topSector} opportunities.`,
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
