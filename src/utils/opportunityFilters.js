const ECOSYSTEM_SUPPORT_KEYWORDS = [
    'ecosystem partner',
    'ecosystem partners',
    'innovation ecosystem',
    'entrepreneurship ecosystem',
    'venture ecosystem',
    'venture ecosystems',
    'implementation partner',
    'implementation partners',
    'venture builder',
    'venture builders',
];

function normalizeArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function isEcosystemSupportOpportunity(opportunity = {}) {
    const targetAudience = normalizeArray(opportunity.targetAudience).map((item) => String(item).toLowerCase());
    if (targetAudience.includes('incubator')) {
        return true;
    }

    const searchText = [
        opportunity.name,
        opportunity.body,
        opportunity.description,
        ...normalizeArray(opportunity.criticalEligibility),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return ECOSYSTEM_SUPPORT_KEYWORDS.some((keyword) => searchText.includes(keyword));
}

export function matchesOpportunityCategory(opportunity = {}, activeCategory = 'all') {
    if (!activeCategory || activeCategory === 'all') {
        return true;
    }

    if (activeCategory === 'ecosystem') {
        return isEcosystemSupportOpportunity(opportunity);
    }

    return String(opportunity.category || '').toLowerCase() === String(activeCategory).toLowerCase();
}
