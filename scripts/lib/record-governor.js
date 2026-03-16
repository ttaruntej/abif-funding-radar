import { createHash } from 'crypto';

const STATUS_LABELS = new Map([
    ['open', 'Open'],
    ['closing soon', 'Closing Soon'],
    ['rolling', 'Rolling'],
    ['closed', 'Closed'],
    ['coming soon', 'Coming Soon'],
    ['verify manually', 'Verify Manually'],
    ['check website', 'Check Website'],
    ['check portal', 'Check Website'],
    ['check source', 'Check Website'],
    ['unknown', 'Verify Manually'],
]);

const REVIEW_SOURCE_PREFIXES = ['research:', 'notebooklm:'];
const CORE_SOURCE_PREFIXES = ['scraper:', 'manual:'];
const CORE_SOURCE_EXACT = new Set(['integrity-guard']);

const DOMAIN_SOURCE_HINTS = [
    { pattern: /(^|\.)birac\.nic\.in$/i, dataSource: 'manual:official:birac' },
    { pattern: /(^|\.)onlinedst\.gov\.in$/i, dataSource: 'manual:official:dst' },
    { pattern: /(^|\.)nidhi\.dst\.gov\.in$/i, dataSource: 'manual:official:dst' },
    { pattern: /(^|\.)seedfund\.startupindia\.gov\.in$/i, dataSource: 'manual:official:startupindia' },
    { pattern: /(^|\.)startupindia\.gov\.in$/i, dataSource: 'manual:official:startupindia' },
    { pattern: /(^|\.)sbifoundation\.in$/i, dataSource: 'manual:official:sbif' },
    { pattern: /(^|\.)sidbi\.in$/i, dataSource: 'manual:official:sidbi' },
    { pattern: /(^|\.)aim\.gov\.in$/i, dataSource: 'manual:official:aim' },
    { pattern: /(^|\.)vc\.meity\.gov\.in$/i, dataSource: 'manual:official:meity' },
    { pattern: /(^|\.)tide20\.meity\.gov\.in$/i, dataSource: 'manual:official:meity' },
    { pattern: /(^|\.)stpi\.in$/i, dataSource: 'manual:official:stpi' },
    { pattern: /(^|\.)msme\.gov\.in$/i, dataSource: 'manual:official:msme' },
    { pattern: /(^|\.)missionstartupkarnataka\.org$/i, dataSource: 'manual:official:startupkarnataka' },
    { pattern: /(^|\.)startupodisha\.gov\.in$/i, dataSource: 'manual:official:startupodisha' },
    { pattern: /(^|\.)grants\.startupmission\.in$/i, dataSource: 'manual:official:ksum' },
    { pattern: /(^|\.)startupmission\.in$/i, dataSource: 'manual:official:ksum' },
    { pattern: /(^|\.)manage\.gov\.in$/i, dataSource: 'manual:official:manage' },
    { pattern: /(^|\.)indiainvestmentgrid\.gov\.in$/i, dataSource: 'manual:official:investindia' },
    { pattern: /(^|\.)innovateindia\.mygov\.in$/i, dataSource: 'manual:official:mygov' },
    { pattern: /(^|\.)ihubgujarat\.in$/i, dataSource: 'manual:official:ihubgujarat' },
    { pattern: /(^|\.)msh\.gov\.in$/i, dataSource: 'manual:official:meity-startuphub' },
    { pattern: /(^|\.)msh\.meity\.gov\.in$/i, dataSource: 'manual:official:meity-startuphub' },
    { pattern: /(^|\.)nabventures\.in$/i, dataSource: 'manual:official:nabventures' },
    { pattern: /(^|\.)ventures\.adb\.org$/i, dataSource: 'manual:official:adb' },
    { pattern: /(^|\.)adb\.org$/i, dataSource: 'manual:official:adb' },
    { pattern: /(^|\.)ifc\.org$/i, dataSource: 'manual:official:ifc' },
    { pattern: /(^|\.)socialalpha\.org$/i, dataSource: 'manual:official:socialalpha' },
    { pattern: /(^|\.)startupwave\.co$/i, dataSource: 'manual:official:startupwave' },
    { pattern: /(^|\.)asme\.org$/i, dataSource: 'manual:official:asme' },
    { pattern: /(^|\.)hdfc\.bank\.in$/i, dataSource: 'manual:csr:hdfc' },
    { pattern: /(^|\.)hdfcbank\.com$/i, dataSource: 'manual:csr:hdfc' },
    { pattern: /(^|\.)idfcfirst\.bank\.in$/i, dataSource: 'manual:csr:idfcfirst' },
    { pattern: /(^|\.)lichousing\.com$/i, dataSource: 'manual:csr:lichfl' },
    { pattern: /(^|\.)idfcfirstbank\.com$/i, dataSource: 'manual:csr:idfcfirst' },
    { pattern: /(^|\.)kotak\.com$/i, dataSource: 'manual:csr:kotak' },
    { pattern: /(^|\.)infosys\.com$/i, dataSource: 'manual:csr:infosys' },
    { pattern: /(^|\.)infosys\.org$/i, dataSource: 'manual:csr:infosys' },
    { pattern: /(^|\.)actionforindia\.org$/i, dataSource: 'manual:accelerator:actionforindia' },
    { pattern: /(^|\.)aic\.snu\.edu\.in$/i, dataSource: 'manual:incubator:aic-snu' },
    { pattern: /(^|\.)amazon\.com$/i, dataSource: 'manual:corporate:amazon' },
    { pattern: /(^|\.)keelingcurveprize\.org$/i, dataSource: 'manual:competition:keeling-curve' },
];

const MONTHS = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
};

function normalizeWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function dedupeArray(values) {
    return [...new Set(values.filter(Boolean))];
}

function normalizeArrayField(value) {
    if (Array.isArray(value)) {
        return dedupeArray(value.map((item) => normalizeWhitespace(item)));
    }

    const normalized = normalizeWhitespace(value);
    if (!normalized) return [];

    return dedupeArray(
        normalized
            .split(/[;,|]/)
            .map((item) => normalizeWhitespace(item))
            .filter(Boolean),
    );
}

function normalizeUrl(value) {
    const text = normalizeWhitespace(value);
    if (!text) return '';

    try {
        return new URL(text).toString();
    } catch {
        return text;
    }
}

function normalizeTimestamp(value) {
    const text = normalizeWhitespace(value);
    const parsed = text ? new Date(text) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
    }
    return new Date().toISOString();
}

function extractSourceDomain(link) {
    const normalizedLink = normalizeUrl(link);
    if (!normalizedLink) return null;

    try {
        return new URL(normalizedLink).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
        return null;
    }
}

function parseMonthDate(day, monthName, year) {
    const monthNumber = MONTHS[String(monthName || '').toLowerCase()];
    if (!monthNumber) return null;
    return new Date(`${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+05:30`);
}

export function parseDeadline(value) {
    const text = normalizeWhitespace(value);
    if (!text) return null;

    if (/(rolling|varies|check website|check portal|check source|open all year|open-all-year|recurring|cohort|cycle|fy|quarter|removed from source|expired)/i.test(text)) {
        return null;
    }

    const exactDayMonthYear = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (exactDayMonthYear) {
        const [, day, month, year] = exactDayMonthYear;
        return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00+05:30`);
    }

    const exactYearMonthDay = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (exactYearMonthDay) {
        const [, year, month, day] = exactYearMonthDay;
        return new Date(`${year}-${month}-${day}T00:00:00+05:30`);
    }

    const monthTextDate = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december),?\s+(\d{4})/i);
    if (monthTextDate) {
        return parseMonthDate(monthTextDate[1], monthTextDate[2], monthTextDate[3]);
    }

    const trailingDate = text.match(/(?:deadline|last\s*date|closes\s*by|apply\s*by|due\s*date)[^0-9a-z]*(\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december),?\s+\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i);
    if (trailingDate) {
        return parseDeadline(trailingDate[1]);
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed;
    }

    return null;
}

export function dateToStatus(deadlineDate, now = new Date()) {
    if (!deadlineDate) return 'Rolling';

    const comparison = new Date(now);
    comparison.setHours(0, 0, 0, 0);

    const target = new Date(deadlineDate);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((target - comparison) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Closed';
    if (diffDays <= 14) return 'Closing Soon';
    return 'Open';
}

function normalizeLinkStatus(value) {
    const lower = normalizeWhitespace(value).toLowerCase();
    if (!lower) return 'unknown';
    if (lower.includes('verified')) return 'verified';
    if (lower.includes('broken')) return 'broken';
    if (lower.includes('probable')) return 'probable';
    return 'unknown';
}

function canonicalizeStatus(status, deadline, linkStatus) {
    const lower = normalizeWhitespace(status).toLowerCase();

    if (STATUS_LABELS.has(lower)) {
        return STATUS_LABELS.get(lower);
    }

    if (/verify manually|manual verify|review manually/i.test(lower)) return 'Verify Manually';
    if (/check website|check portal|check source|check details|see portal/i.test(lower)) return 'Check Website';
    if (/coming soon|opens soon|upcoming/i.test(lower)) return 'Coming Soon';
    if (/closing soon|last few days/i.test(lower)) return 'Closing Soon';
    if (/rolling|open all year|throughout the year|always open/i.test(lower)) return 'Rolling';
    if (/closed|not accepting|applications are closed|expired/i.test(lower)) return 'Closed';
    if (/\bopen\b/i.test(lower)) return 'Open';

    const parsedDeadline = parseDeadline(deadline || status);
    if (parsedDeadline) return dateToStatus(parsedDeadline);
    if (linkStatus === 'broken') return 'Verify Manually';
    return 'Rolling';
}

function canonicalizeCategory(category, name, body, link) {
    const combined = [category, name, body, link].map((value) => normalizeWhitespace(value).toLowerCase()).join(' ');
    if (/\bcsr\b|corporate social responsibility|foundation|philanthropy/.test(combined)) return 'csr';
    if (/indo-|international|global|bilateral|multilateral|france|netherlands|australia|europe|us |usa|uk |united nations/.test(combined)) return 'international';
    if (/odisha|karnataka|kerala|tamil nadu|gujarat|state|startuptn|startup odisha|ksum|mission startup karnataka/.test(combined)) return 'state';
    return 'national';
}

function formatDeadline(deadline, deadlineDate, status) {
    const normalizedDeadline = normalizeWhitespace(deadline);
    if (deadlineDate) {
        return `${String(deadlineDate.getDate()).padStart(2, '0')}-${String(deadlineDate.getMonth() + 1).padStart(2, '0')}-${deadlineDate.getFullYear()}`;
    }
    if (!normalizedDeadline && status === 'Rolling') return 'Rolling';
    return normalizedDeadline || 'Check Website';
}

function inferDataSource(record) {
    const existing = normalizeWhitespace(record.dataSource);
    if (existing) {
        return { dataSource: existing, inferred: false, reason: null };
    }

    const domain = extractSourceDomain(record.link);
    if (domain) {
        const match = DOMAIN_SOURCE_HINTS.find((hint) => hint.pattern.test(domain));
        if (match) {
            return { dataSource: match.dataSource, inferred: true, reason: `domain:${domain}` };
        }

        if (/\.(gov|nic)\.in$/i.test(domain)) {
            return { dataSource: 'manual:official:legacy', inferred: true, reason: `gov-domain:${domain}` };
        }

        return { dataSource: 'legacy:unclassified', inferred: true, reason: `unmapped-domain:${domain}` };
    }

    return { dataSource: 'legacy:unclassified', inferred: true, reason: 'missing-link' };
}

function deriveSourceType(dataSource) {
    const normalized = normalizeWhitespace(dataSource);
    if (!normalized) return 'unknown';
    if (normalized.startsWith('scraper:')) return 'live';
    if (normalized.startsWith('manual:')) return 'manual';
    if (normalized.startsWith('research:') || normalized.startsWith('notebooklm:')) return 'review';
    if (normalized === 'integrity-guard') return 'integrity';
    if (normalized.startsWith('legacy:')) return 'legacy';
    return 'unknown';
}

function calculateConfidence(record, { sourceType, inferredDataSource }) {
    const baseScores = {
        live: 0.9,
        manual: 0.72,
        integrity: 0.76,
        review: 0.45,
        legacy: 0.42,
        unknown: 0.35,
    };

    let score = baseScores[sourceType] ?? 0.35;

    if (record.linkStatus === 'verified') score += 0.1;
    if (record.linkStatus === 'probable') score += 0.03;
    if (record.linkStatus === 'broken') score -= 0.25;

    if (parseDeadline(record.deadline)) score += 0.04;
    if (record.description) score += 0.04;
    if (record.body) score += 0.03;
    if (record.criticalEligibility?.length) score += 0.03;
    if (record.status === 'Verify Manually' || record.status === 'Check Website') score -= 0.08;
    if (inferredDataSource) score -= 0.07;

    return Math.max(0.05, Math.min(0.99, Number(score.toFixed(2))));
}

function createFingerprint(record) {
    const fingerprintInput = [
        normalizeWhitespace(record.name).toLowerCase(),
        normalizeWhitespace(record.body).toLowerCase(),
        extractSourceDomain(record.link) || '',
        normalizeWhitespace(record.deadline).toLowerCase(),
    ].join('|');

    return createHash('sha1').update(fingerprintInput).digest('hex').slice(0, 16);
}

export function getSourceBucket(dataSource = '') {
    const normalized = normalizeWhitespace(dataSource);
    if (!normalized) return 'unknown';
    if (CORE_SOURCE_EXACT.has(normalized)) return 'core';
    if (CORE_SOURCE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return 'core';
    if (REVIEW_SOURCE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return 'review';
    if (normalized.startsWith('legacy:')) return 'legacy';
    return 'unknown';
}

function inferTargetAudience(record) {
    let audiences = normalizeArrayField(record.targetAudience || []);
    const searchString = `${record.name || ''} ${record.description || ''} ${record.body || ''}`.toLowerCase();

    // If the text heavily implies operational support for ecosystems/incubators
    const incubatorKeywords = [
        'setting up of incubator',
        'host institute',
        'section 8',
        'ecosystem enabler',
        'accelerator program',
        'incubation centre',
        'nidhi-itbi',
        'nidhi-step',
        'bionest',
        'tide 2.0',
        'samridh'
    ];

    if (incubatorKeywords.some(keyword => searchString.includes(keyword))) {
        audiences.push('incubator');
    }

    // Default to startup if nothing else is provided and it doesn't look purely like an incubator grant
    if (audiences.length === 0) {
        audiences.push('startup');
    }

    return dedupeArray(audiences);
}

export function normalizeOpportunityRecord(record, context = {}) {
    const inferredSource = inferDataSource(record);
    const link = normalizeUrl(record.link);
    const linkStatus = normalizeLinkStatus(record.linkStatus);
    const deadlineDate = parseDeadline(record.deadline);
    const body = normalizeWhitespace(record.body || record.provider || '');
    const normalized = {
        ...record,
        name: normalizeWhitespace(record.name),
        body,
        maxAward: normalizeWhitespace(record.maxAward || record.value || 'Varies'),
        deadline: formatDeadline(record.deadline, deadlineDate, canonicalizeStatus(record.status, record.deadline, linkStatus)),
        deadlineIso: deadlineDate ? deadlineDate.toISOString() : null,
        link,
        description: normalizeWhitespace(record.description),
        category: canonicalizeCategory(record.category, record.name, body, link),
        status: canonicalizeStatus(record.status, record.deadline, linkStatus),
        linkStatus,
        dataSource: inferredSource.dataSource,
        targetAudience: inferTargetAudience(record),
        sectors: normalizeArrayField(record.sectors),
        stages: normalizeArrayField(record.stages),
        criticalEligibility: normalizeArrayField(record.criticalEligibility),
        lastScraped: normalizeTimestamp(record.lastScraped || record.lastScanned || context.collectedAt),
    };

    const sourceType = deriveSourceType(normalized.dataSource);
    const sourceDomain = extractSourceDomain(normalized.link);
    normalized.sourceMeta = {
        sourceId: normalizeWhitespace(context.sourceId || record.sourceMeta?.sourceId || normalized.dataSource || 'unknown'),
        sourceType,
        collectionMode: normalizeWhitespace(context.collectionMode || record.sourceMeta?.collectionMode || 'unspecified'),
        collectedAt: normalizeTimestamp(context.collectedAt || record.sourceMeta?.collectedAt || normalized.lastScraped),
        sourceDomain,
        canonicalSourceUrl: normalized.link || null,
        inferredDataSource: inferredSource.inferred,
        inferenceReason: inferredSource.reason,
    };
    normalized.confidence = calculateConfidence(normalized, {
        sourceType,
        inferredDataSource: inferredSource.inferred,
    });
    normalized.recordFingerprint = createFingerprint(normalized);

    return normalized;
}

export function validateOpportunityRecord(record) {
    const errors = [];
    const warnings = [];

    if (!record.name || record.name.length < 6) {
        errors.push({ code: 'missing-name', detail: 'Opportunity name is missing or too short.' });
    }

    if (!record.link) {
        errors.push({ code: 'missing-link', detail: 'Opportunity link is missing.' });
    }

    if (!record.body) {
        errors.push({ code: 'missing-provider', detail: 'Opportunity provider/body is missing.' });
    }

    if (!record.dataSource) {
        errors.push({ code: 'missing-data-source', detail: 'Opportunity provenance is missing.' });
    }

    if (record.linkStatus === 'broken') {
        warnings.push({ code: 'broken-link', detail: 'Stored opportunity link is marked broken.' });
    }

    if (!record.description) {
        warnings.push({ code: 'missing-description', detail: 'Opportunity description is empty.' });
    }

    if (record.sourceMeta?.inferredDataSource) {
        warnings.push({ code: 'inferred-data-source', detail: `Provenance inferred from ${record.sourceMeta.inferenceReason || 'source URL'}.` });
    }

    if (typeof record.confidence === 'number' && record.confidence < 0.55) {
        warnings.push({ code: 'low-confidence', detail: `Computed confidence is ${record.confidence}.` });
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}

export function buildSourceHealthReport({ runs = [], finalData = [] } = {}) {
    const finalBySource = new Map();
    for (const item of finalData) {
        const key = item.dataSource || 'unknown';
        finalBySource.set(key, (finalBySource.get(key) || 0) + 1);
    }

    const summary = {
        totalRuns: runs.length,
        totalRawRecords: runs.reduce((sum, run) => sum + (run.rawCount || 0), 0),
        totalAcceptedRecords: runs.reduce((sum, run) => sum + (run.acceptedCount || 0), 0),
        totalRejectedRecords: runs.reduce((sum, run) => sum + (run.rejectedCount || 0), 0),
        totalWarnings: runs.reduce((sum, run) => sum + (run.warningCount || 0), 0),
        lowConfidenceRecords: finalData.filter((item) => typeof item.confidence === 'number' && item.confidence < 0.55).length,
        inferredProvenanceRecords: finalData.filter((item) => item.sourceMeta?.inferredDataSource).length,
        finalDatasetSize: finalData.length,
        activeSources: finalBySource.size,
    };

    const sources = runs
        .map((run) => ({
            sourceId: run.sourceId,
            label: run.label,
            collectionMode: run.collectionMode,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
            durationMs: run.durationMs,
            rawCount: run.rawCount,
            acceptedCount: run.acceptedCount,
            rejectedCount: run.rejectedCount,
            warningCount: run.warningCount,
            finalDatasetCount: finalBySource.get(run.datasetSourceId || run.sourceId) || 0,
            error: run.error || null,
            rejectedSamples: run.rejectedSamples || [],
        }))
        .sort((a, b) => String(a.sourceId).localeCompare(String(b.sourceId)));

    return {
        generatedAt: new Date().toISOString(),
        summary,
        sources,
    };
}
