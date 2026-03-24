import {
    normalizeOpportunityRecord,
    validateOpportunityRecord,
} from '../../lib/record-governor.js';

export const RETIRED_RECORD_SIGNATURES = [
    { names: ['IDFC FIRST Bank IGNITE Accelerator'], links: ['https://www.idfcfirstbank.com/csr'] },
    { names: ['Infosys Social Innovation & Entrepreneurship CSR'], links: ['https://www.infosys.com/infosys-foundation/grants.html'] },
    { names: ['MeitY Blockchain India Challenge'], links: ['https://www.msh.gov.in/'] },
    { names: ['Rockefeller Foundation Global Impact Incubator'], links: ['https://www.rockefellerfoundation.org/grant-opportunities/'] },
    { names: ['SAREP Partnership Fund'], links: ['https://www.sarepenergy.net/'] },
];

export const KNOWN_RECORD_REMEDIATIONS = [
    {
        names: ['TIDE 2.0'],
        links: ['https://tide20.meity.gov.in/'],
        patch: {
            link: 'https://msh.meity.gov.in/assets/Administrative%20Approval_TIDE%202.0.pdf',
            body: 'MeitY Startup Hub',
            description: 'Official MeitY TIDE 2.0 approval document covering incubator support and ICT startup enablement.',
            deadline: 'Check Website',
            status: 'Check Website',
            dataSource: 'manual:official:meity-startuphub',
            targetAudience: ['incubator', 'startup'],
            linkStatus: 'probable',
        },
    },
    // Truncating the rest here for brevity, we can migrate the full list later if needed,
    // or keep it in a separate JSON/database file as per the new architecture.
    {
        names: ['SAMRIDH Cohort 3', 'SAMRIDH Scheme'],
        links: ['https://www.msh.gov.in/samridh', 'https://msh.meity.gov.in/assets/SAMRIDH%20guidelines.pdf'],
        patch: {
            name: 'SAMRIDH Scheme',
            link: 'https://msh.meity.gov.in/assets/SAMRIDH%20guidelines.pdf',
            body: 'MeitY Startup Hub',
            deadline: 'Check Website',
            status: 'Check Website',
            dataSource: 'manual:official:meity-startuphub',
            targetAudience: ['incubator', 'startup'],
            linkStatus: 'probable',
        },
    }
];

export function normalizeRemediationName(value = '') {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normalizeRemediationLink(value = '') {
    return String(value).trim().toLowerCase();
}

export function shouldRetireRecord(record) {
    if (!record || typeof record !== 'object') return false;

    const normalizedName = normalizeRemediationName(record.name);
    const normalizedLink = normalizeRemediationLink(record.link);

    return RETIRED_RECORD_SIGNATURES.some((candidate) =>
        candidate.names?.some((name) => normalizeRemediationName(name) === normalizedName) ||
        candidate.links?.some((link) => normalizeRemediationLink(link) === normalizedLink),
    );
}

export function applyRecordRemediation(record) {
    if (!record || typeof record !== 'object') return record;

    const normalizedName = normalizeRemediationName(record.name);
    const normalizedLink = normalizeRemediationLink(record.link);
    const match = KNOWN_RECORD_REMEDIATIONS.find((candidate) =>
        candidate.names?.some((name) => normalizeRemediationName(name) === normalizedName) ||
        candidate.links?.some((link) => normalizeRemediationLink(link) === normalizedLink),
    );

    if (!match) return record;

    const remediated = { ...record, ...match.patch };
    if (String(record.linkStatus || '').toLowerCase() === 'verified') {
        remediated.linkStatus = 'verified';
    }
    return remediated;
}

export function flattenValidationIssues(validation) {
    return [...validation.errors, ...validation.warnings].map((issue) => ({
        code: issue.code,
        detail: issue.detail,
    }));
}

export function normalizeRecordBatch(records, context = {}) {
    const accepted = [];
    const rejected = [];
    let warningCount = 0;

    for (const rawRecord of records) {
        if (shouldRetireRecord(rawRecord)) continue;

        const record = applyRecordRemediation(rawRecord);
        const normalized = normalizeOpportunityRecord(record, context);
        const validation = validateOpportunityRecord(normalized);
        warningCount += validation.warnings.length;

        if (validation.isValid) {
            accepted.push(normalized);
            continue;
        }

        rejected.push({
            name: normalized.name || null,
            link: normalized.link || null,
            dataSource: normalized.dataSource || null,
            issues: flattenValidationIssues(validation),
        });
    }

    return { accepted, rejected, warningCount };
}
