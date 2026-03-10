import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../public/data/opportunities.json');
const PUBLISHABLE_FILE = path.join(__dirname, '../public/data/publishable_opportunities.json');
const REVIEW_QUEUE_FILE = path.join(__dirname, '../public/data/review_queue.json');

const REVIEW_SOURCE_PREFIXES = ['research:', 'notebooklm:'];
const CORE_SOURCE_PREFIXES = ['scraper:', 'manual:'];
const CORE_SOURCE_EXACT = new Set(['integrity-guard']);
const OPENISH_STATUSES = new Set(['open', 'closing soon', 'verify manually']);

function normalizeName(name = '') {
    return String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function parseDeadline(deadline) {
    if (!deadline) return null;

    const value = String(deadline).trim();
    if (!value || /(rolling|varies|check portal|check source|cohort|cycle|fy|quarter|recurring|verify manually|open all year|removed)/i.test(value)) {
        return null;
    }

    const dayMonthYear = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dayMonthYear) {
        const [, day, month, year] = dayMonthYear;
        return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00+05:30`);
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed;
    }

    return null;
}

function getSourceBucket(dataSource = '') {
    if (!dataSource) return 'unknown';
    if (CORE_SOURCE_EXACT.has(dataSource)) return 'core';
    if (CORE_SOURCE_PREFIXES.some((prefix) => dataSource.startsWith(prefix))) return 'core';
    if (REVIEW_SOURCE_PREFIXES.some((prefix) => dataSource.startsWith(prefix))) return 'review';
    return 'unknown';
}

function buildIssue(code, detail) {
    return { code, detail };
}

function reviewActionFor(issues) {
    if (issues.some((issue) => issue.code === 'duplicate-name')) return 'merge-or-deduplicate';
    if (issues.some((issue) => issue.code === 'source-review-required')) return 'verify-from-official-source';
    if (issues.some((issue) => issue.code === 'past-deadline-status-mismatch')) return 'recompute-status-or-archive';
    if (issues.some((issue) => issue.code === 'broken-link')) return 'replace-link';
    return 'manual-review';
}

function getReviewPriority(item, issues) {
    let score = 0;

    if (issues.some((issue) => issue.code === 'source-review-required')) score += 40;
    if (issues.some((issue) => issue.code === 'missing-critical-eligibility')) score += 20;
    if (issues.some((issue) => issue.code === 'past-deadline-status-mismatch')) score += 15;
    if (issues.some((issue) => issue.code === 'duplicate-name')) score += 10;
    if (issues.some((issue) => issue.code === 'broken-link')) score -= 15;
    if (item.linkStatus === 'verified') score += 10;
    if (String(item.dataSource || '').includes('notebook')) score += 10;

    return score;
}

function shouldRecommendArtifactReview(item, issues) {
    if (!item.link || item.linkStatus === 'broken') return false;
    return issues.some((issue) => ['source-review-required', 'missing-critical-eligibility'].includes(issue.code));
}

function getIssues(item, duplicateNames, now) {
    const issues = [];
    const normalizedName = normalizeName(item.name);
    const parsedDeadline = parseDeadline(item.deadline);
    const sourceBucket = getSourceBucket(item.dataSource || '');
    const status = String(item.status || '').toLowerCase();

    if (!item.name) issues.push(buildIssue('missing-name', 'Opportunity name is missing.'));
    if (!item.link) issues.push(buildIssue('missing-link', 'Opportunity link is missing.'));
    if (!item.dataSource) {
        issues.push(buildIssue('missing-data-source', 'Opportunity has no provenance tag.'));
    } else if (sourceBucket === 'review' || sourceBucket === 'unknown') {
        issues.push(buildIssue('source-review-required', `Source "${item.dataSource}" should pass through review before publication.`));
    }

    if (duplicateNames.has(normalizedName)) {
        issues.push(buildIssue('duplicate-name', 'Another opportunity with the same normalized name exists in the dataset.'));
    }

    if (item.linkStatus === 'broken') {
        issues.push(buildIssue('broken-link', 'Stored application/source link is currently marked broken.'));
    }

    if (parsedDeadline && OPENISH_STATUSES.has(status) && parsedDeadline < now) {
        issues.push(buildIssue('past-deadline-status-mismatch', `Status is "${item.status}" even though the deadline has passed.`));
    }

    if (String(item.dataSource || '').includes('notebook') && (!Array.isArray(item.criticalEligibility) || item.criticalEligibility.length === 0)) {
        issues.push(buildIssue('missing-critical-eligibility', 'Notebook-derived record does not yet include critical eligibility extraction.'));
    }

    return issues;
}

function toReviewItem(item, issues) {
    const reviewPriority = getReviewPriority(item, issues);
    return {
        name: item.name,
        body: item.body,
        link: item.link,
        deadline: item.deadline,
        status: item.status,
        dataSource: item.dataSource || 'unknown',
        category: item.category,
        linkStatus: item.linkStatus,
        issues,
        recommendedAction: reviewActionFor(issues),
        reviewPriority,
        artifactReviewRecommended: shouldRecommendArtifactReview(item, issues),
        lastScraped: item.lastScraped || item.lastScanned || null,
    };
}

function sortByName(a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''));
}

function sortReviewItems(a, b) {
    if ((b.reviewPriority || 0) !== (a.reviewPriority || 0)) {
        return (b.reviewPriority || 0) - (a.reviewPriority || 0);
    }
    return sortByName(a, b);
}

function main() {
    if (!fs.existsSync(DATA_FILE)) {
        throw new Error(`Missing source data file: ${DATA_FILE}`);
    }

    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const opportunities = Array.isArray(raw) ? raw : [];
    const now = new Date('2026-03-10T00:00:00+05:30');

    const duplicateTracker = new Map();
    for (const item of opportunities) {
        const normalized = normalizeName(item.name);
        if (!normalized) continue;
        duplicateTracker.set(normalized, (duplicateTracker.get(normalized) || 0) + 1);
    }
    const duplicateNames = new Set([...duplicateTracker.entries()].filter(([, count]) => count > 1).map(([name]) => name));

    const publishable = [];
    const reviewItems = [];

    for (const item of opportunities) {
        const issues = getIssues(item, duplicateNames, now);
        const blockingIssues = issues.filter((issue) => issue.code !== 'missing-critical-eligibility');

        if (blockingIssues.length > 0) {
            reviewItems.push(toReviewItem(item, issues));
            continue;
        }

        publishable.push(item);
    }

    publishable.sort(sortByName);
    reviewItems.sort(sortReviewItems);

    const reviewQueue = {
        generatedAt: new Date().toISOString(),
        summary: {
            totalSourceItems: opportunities.length,
            publishableItems: publishable.length,
            reviewItems: reviewItems.length,
            duplicateGroups: duplicateNames.size,
            artifactReviewCandidates: reviewItems.filter((item) => item.artifactReviewRecommended).length,
        },
        items: reviewItems,
    };

    fs.writeFileSync(PUBLISHABLE_FILE, JSON.stringify(publishable, null, 2));
    fs.writeFileSync(REVIEW_QUEUE_FILE, JSON.stringify(reviewQueue, null, 2));

    console.log(`Publishable opportunities: ${publishable.length}`);
    console.log(`Review queue items: ${reviewItems.length}`);
    console.log(`Duplicate name groups: ${duplicateNames.size}`);
}

main();
