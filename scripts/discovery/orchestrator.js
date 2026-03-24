import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { scrapeBirac } from './sources/tier-a/birac.js';
import { scrapeDST } from './sources/tier-a/dst.js';
import { scrapeSISFS } from './sources/tier-c/sisfs.js';
import { scrapeSBIFoundation } from './sources/tier-c/sbi-foundation.js';
import { scrapeNidhiPrograms, scrapeAIMAIC, scrapeStartupOdishaIncentives, scrapeManageCIA, scrapeIIGCSR } from './sources/tier-b/official-policies.js';
import { verifyStaticRecords, getStaticRecords } from './sources/static/static-verifier.js';

import { normalizeRecordBatch } from './utils/remediation.js';
import { buildSourceHealthReport } from '../lib/record-governor.js';
import { generateStrategicReport } from './extractors/intelligence.js';

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DATA_DIR = path.join(__dirname, '../../public/data');
const DATA_FILE = path.join(PUBLIC_DATA_DIR, 'opportunities.json');
const SOURCE_HEALTH_FILE = path.join(PUBLIC_DATA_DIR, 'source_health.json');

// --- Helper Functions from old official-discovery.js ---

function buildRunSummary({ sourceId, datasetSourceId, label, collectionMode, startedAt, rawCount, normalized, error = null }) {
    const finishedAt = new Date().toISOString();
    return {
        sourceId, datasetSourceId, label, collectionMode, startedAt, finishedAt,
        durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
        rawCount,
        acceptedCount: normalized.accepted.length,
        rejectedCount: normalized.rejected.length,
        warningCount: normalized.warningCount,
        error,
        rejectedSamples: normalized.rejected.slice(0, 5),
    };
}

async function collectSourceRecords({ browser, sourceId, datasetSourceId, label, collectionMode, collector }) {
    const startedAt = new Date().toISOString();
    let rawRecords = [];
    let error = null;
    try {
        rawRecords = await collector(browser);
    } catch (collectorError) {
        error = collectorError.message;
    }
    const normalized = normalizeRecordBatch(rawRecords, { sourceId, collectionMode, collectedAt: startedAt });
    return {
        records: normalized.accepted,
        run: buildRunSummary({ sourceId, datasetSourceId, label, collectionMode, startedAt, rawCount: rawRecords.length, normalized, error }),
    };
}

function captureRecordSet({ sourceId, datasetSourceId, label, collectionMode, rawRecords, error = null }) {
    const startedAt = new Date().toISOString();
    const normalized = normalizeRecordBatch(rawRecords, { sourceId, collectionMode, collectedAt: startedAt });
    return {
        records: normalized.accepted,
        run: buildRunSummary({ sourceId, datasetSourceId, label, collectionMode, startedAt, rawCount: rawRecords.length, normalized, error }),
    };
}

// --- Data Merging logic ---

function mergeData(existingData, scrapedData, verifiedStatic) {
    console.log('\n--- Merging data ---');
    const RETIRED_ALIAS_GROUPS = [
        { canonical: 'Atal Incubation Centre (AIC) Grant', aliases: ['Atal Incubation Centre (AIC) Establishment Grant'] },
        { canonical: 'NIDHI-TBI', aliases: ['DST NIDHI - TBI Support', 'DST NIDHI - Technology Business Incubator (TBI)'] },
        { canonical: 'India Investment Grid (IIG) – CSR Opportunities Portal', aliases: ['IIG - CSR Opportunities Portal'] },
        { canonical: 'MANAGE-CIA RKVY-RAFTAAR Agribusiness Incubation', aliases: ['MANAGE-CIA Agri-Business Incubation'] },
        { canonical: 'Startup Odisha – Product Development & Marketing Assistance', aliases: ['Startup Odisha – Product Development and Marketing / Publicity Assistance'] },
        { canonical: 'MeitY TIDE 2.0 (Incubator Support)', aliases: ['TIDE 2.0'] },
        { canonical: 'SAMRIDH Scheme', aliases: ['SAMRIDH Cohort 3'] },
    ];

    const getMergeKey = (item) => item.recordFingerprint || `${item.name || 'unknown'}::${item.body || 'unknown'}::${item.link || 'nolink'}`;
    const normalizeMergeName = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

    function getPreferenceScore(item) {
        const sourceType = item.sourceMeta?.sourceType || '';
        const sourceBoost = { live: 50, manual: 35, integrity: 30, legacy: 15, review: 5, unknown: 0 }[sourceType] ?? 0;
        const statusBoost = item.status === 'Closed' ? -10 : item.status === 'Verify Manually' ? -6 : 4;
        const linkBoost = item.linkStatus === 'verified' ? 8 : item.linkStatus === 'probable' ? 2 : item.linkStatus === 'broken' ? -12 : 0;
        const confidenceBoost = Math.round((item.confidence || 0) * 10);
        return sourceBoost + statusBoost + linkBoost + confidenceBoost;
    }

    function findExistingMatch(store, candidate) {
        return Object.values(store).find((item) =>
            (item.recordFingerprint && candidate.recordFingerprint && item.recordFingerprint === candidate.recordFingerprint) ||
            (item.name === candidate.name && item.body === candidate.body) ||
            (item.link === candidate.link && item.name === candidate.name),
        );
    }

    const merged = {};
    existingData.forEach(item => { merged[getMergeKey(item)] = { ...item }; });

    const CURATED_FIELDS = ['name', 'body', 'maxAward', 'description', 'category'];
    scrapedData.forEach(newItem => {
        const existingMatch = findExistingMatch(merged, newItem);
        if (existingMatch && existingMatch.link === newItem.link) {
            const preserved = {};
            CURATED_FIELDS.forEach(f => { if (existingMatch[f]) preserved[f] = existingMatch[f]; });
            if (getMergeKey(existingMatch) !== getMergeKey(newItem)) delete merged[getMergeKey(existingMatch)];
            merged[getMergeKey(newItem)] = { ...existingMatch, ...newItem, ...preserved };
        } else if (existingMatch) {
            delete merged[getMergeKey(existingMatch)];
            const preserved = {};
            CURATED_FIELDS.forEach(f => { if (existingMatch[f]) preserved[f] = existingMatch[f]; });
            merged[getMergeKey(newItem)] = { ...existingMatch, ...newItem, ...preserved };
        } else {
            merged[getMergeKey(newItem)] = newItem;
        }
    });

    verifiedStatic.forEach(v => {
        const existingMatch = findExistingMatch(merged, v);
        if (existingMatch) {
            merged[getMergeKey(existingMatch)] = {
                ...existingMatch,
                linkStatus: v.linkStatus,
                status: v.status,
                lastScraped: v.lastScraped,
                sourceMeta: v.sourceMeta || existingMatch.sourceMeta,
                confidence: v.confidence ?? existingMatch.confidence,
            };
        }
    });

    const activeScrapedKeys = new Set(scrapedData.map((item) => getMergeKey(item)));
    Object.values(merged).forEach(item => {
        if (item.dataSource && item.dataSource.startsWith('scraper:') && !activeScrapedKeys.has(getMergeKey(item))) {
            item.status = 'Closed';
            item.deadline = 'Expired / Removed from source';
        }
    });

    RETIRED_ALIAS_GROUPS.forEach((group) => {
        const records = Object.values(merged);
        const canonicalRecord = records.find((item) => item.name === group.canonical);
        if (!canonicalRecord) return;
        group.aliases.forEach((alias) => {
            const aliasRecord = records.find((item) => item.name === alias);
            if (!aliasRecord) return;
            const canonicalSourceType = canonicalRecord.sourceMeta?.sourceType || '';
            if (canonicalSourceType === 'live' || canonicalSourceType === 'manual' || canonicalRecord.dataSource?.startsWith('scraper:')) {
                delete merged[getMergeKey(aliasRecord)];
            }
        });
    });

    const groupedKeys = new Map();
    Object.entries(merged).forEach(([key, item]) => {
        const normalizedName = normalizeMergeName(item.name);
        const groupKey = `${item.link || 'nolink'}::${item.body || 'nobody'}::${normalizedName}`;
        if (!groupedKeys.has(groupKey)) groupedKeys.set(groupKey, []);
        groupedKeys.get(groupKey).push({ key, item });
    });

    groupedKeys.forEach((entries) => {
        if (entries.length < 2) return;
        entries.sort((a, b) => getPreferenceScore(b.item) - getPreferenceScore(a.item));
        const winner = entries[0];
        entries.slice(1).forEach(({ key }) => { if (key !== winner.key) delete merged[key]; });
    });

    const nameGroups = new Map();
    Object.entries(merged).forEach(([key, item]) => {
        const normalizedName = normalizeMergeName(item.name);
        if (!normalizedName) return;
        if (!nameGroups.has(normalizedName)) nameGroups.set(normalizedName, []);
        nameGroups.get(normalizedName).push({ key, item });
    });

    nameGroups.forEach((entries) => {
        if (entries.length < 2) return;
        const preferred = [...entries].sort((a, b) => getPreferenceScore(b.item) - getPreferenceScore(a.item))[0];
        const preferredType = preferred.item.sourceMeta?.sourceType || '';
        if (!['live', 'manual', 'integrity'].includes(preferredType)) return;
        entries.forEach(({ key, item }) => {
            const sourceType = item.sourceMeta?.sourceType || '';
            if (key !== preferred.key && ['review', 'legacy', 'unknown'].includes(sourceType)) {
                delete merged[key];
            }
        });
    });

    return Object.values(merged);
}

// --- Main Orchestrator ---

async function orchestrate() {
    console.log('-----------------------------------------------');
    console.log('🤖 ABIF Radar - NextGen Discovery Engine 🤖');
    console.log(`  ${new Date().toISOString()}`);
    console.log('-----------------------------------------------');

    const healthRuns = [];
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
    } catch (err) {
        console.error('❌ Failed to launch Puppeteer:', err.message);
        return;
    }

    // -- Tier A: Real live scrapers --
    console.log('--- Executing Tier-A Scrapers ---');
    const biracRun = await collectSourceRecords({ browser, sourceId: 'scraper:birac', datasetSourceId: 'scraper:birac', label: 'BIRAC live collector', collectionMode: 'live_dom', collector: scrapeBirac });
    const dstRun = await collectSourceRecords({ browser, sourceId: 'scraper:dst', datasetSourceId: 'scraper:dst', label: 'DST live collector', collectionMode: 'live_dom', collector: scrapeDST });
    healthRuns.push(biracRun.run, dstRun.run);
    const allScraped = [...biracRun.records, ...dstRun.records];

    // -- Tier C: React SPA scrapers --
    console.log('\n--- Executing Tier-C Scrapers (SPA) ---');
    const sisfsRun = await collectSourceRecords({ browser, sourceId: 'scraper:sisfs', datasetSourceId: 'scraper:sisfs', label: 'SISFS SPA collector', collectionMode: 'live_spa', collector: scrapeSISFS });
    const sbifRun = await collectSourceRecords({ browser, sourceId: 'scraper:sbif', datasetSourceId: 'scraper:sbif', label: 'SBI Foundation SPA collector', collectionMode: 'live_spa', collector: scrapeSBIFoundation });
    healthRuns.push(sisfsRun.run, sbifRun.run);
    allScraped.push(...sisfsRun.records, ...sbifRun.records);

    // -- Tier B+: Official Policies --
    console.log('\n--- Executing Tier-B+ Scrapers (Official Policies) ---');
    const nidhiRun = await collectSourceRecords({ browser, sourceId: 'scraper:nidhi', datasetSourceId: 'scraper:nidhi', label: 'NIDHI programme collector', collectionMode: 'official_scheme_page', collector: scrapeNidhiPrograms });
    const aimRun = await collectSourceRecords({ browser, sourceId: 'scraper:aim', datasetSourceId: 'scraper:aim', label: 'AIM AIC collector', collectionMode: 'official_scheme_page', collector: scrapeAIMAIC });
    const startupOdishaRun = await collectSourceRecords({ browser, sourceId: 'scraper:startupodisha', datasetSourceId: 'scraper:startupodisha', label: 'Startup Odisha incentives collector', collectionMode: 'official_policy_page', collector: scrapeStartupOdishaIncentives });
    const manageRun = await collectSourceRecords({ browser, sourceId: 'scraper:manage', datasetSourceId: 'scraper:manage', label: 'MANAGE-CIA programme collector', collectionMode: 'official_program_page', collector: scrapeManageCIA });
    const iigRun = await collectSourceRecords({ browser, sourceId: 'scraper:iig', datasetSourceId: 'scraper:iig', label: 'IIG CSR collector', collectionMode: 'official_portal_page', collector: scrapeIIGCSR });
    healthRuns.push(nidhiRun.run, aimRun.run, startupOdishaRun.run, manageRun.run, iigRun.run);
    allScraped.push(...nidhiRun.records, ...aimRun.records, ...startupOdishaRun.records, ...manageRun.records, ...iigRun.records);

    // -- Add SIDBI static records --
    const sidbiSeedRun = captureRecordSet({
        sourceId: 'seed:sidbi', datasetSourceId: 'scraper:sidbi', label: 'SIDBI seeded records', collectionMode: 'static_seed',
        rawRecords: getStaticRecords().filter(r => r.dataSource === 'scraper:sidbi'),
    });
    healthRuns.push(sidbiSeedRun.run);
    allScraped.push(...sidbiSeedRun.records);

    await browser.close();
    console.log(`\n✅ Tier A, B+, and C scraped: ${allScraped.length} entries`);

    // -- Read existing data --
    let existingData = [];
    if (fs.existsSync(DATA_FILE)) {
        try {
            const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            existingData = Array.isArray(raw) ? raw : [];
        } catch (e) {
            console.error('  Could not parse existing data. Starting fresh.', e.message);
        }
    }
    const existingNormalizationRun = captureRecordSet({ sourceId: 'dataset:existing', label: 'Existing dataset normalization', collectionMode: 'existing_dataset', rawRecords: existingData });
    healthRuns.push(existingNormalizationRun.run);
    existingData = existingNormalizationRun.records;

    const targetStaticSeedRun = captureRecordSet({
        sourceId: 'seed:manual-static', label: 'Manual official seed records', collectionMode: 'static_seed',
        rawRecords: getStaticRecords().filter(r => r.dataSource !== 'scraper:sidbi'),
    });
    healthRuns.push(targetStaticSeedRun.run);
    const targetStaticRecords = targetStaticSeedRun.records;

    targetStaticRecords.forEach(tsr => {
        if (!existingData.some(e => e.recordFingerprint === tsr.recordFingerprint || (e.name === tsr.name && e.body === tsr.body) || (e.link === tsr.link && e.name === tsr.name))) {
            existingData.push(tsr);
        }
    });

    // -- Tier B Static URL verification --
    const scrapedLinks = new Set(allScraped.map(x => x.link));
    const staticToVerify = existingData.filter(item => {
        if (item.dataSource?.startsWith('scraper:') && item.dataSource !== 'scraper:sidbi') return false;
        return !scrapedLinks.has(item.link);
    });

    let verifyBrowser;
    let verifiedStatic = [];
    let verifyError = null;
    try {
        verifyBrowser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
        verifiedStatic = await verifyStaticRecords(verifyBrowser, staticToVerify);
    } catch (e) {
        console.error('  ❌ Link verification browser failed:', e.message);
        verifyError = e.message;
        verifiedStatic = staticToVerify;
    } finally {
        if (verifyBrowser) await verifyBrowser.close();
    }
    const verifiedStaticRun = captureRecordSet({ sourceId: 'verify:static-links', label: 'Static record link verification', collectionMode: 'link_verification', rawRecords: verifiedStatic, error: verifyError });
    healthRuns.push(verifiedStaticRun.run);
    verifiedStatic = verifiedStaticRun.records;

    // -- Merge everything --
    if (allScraped.length < 5) {
        const failureHealth = buildSourceHealthReport({ runs: healthRuns, finalData: [] });
        fs.writeFileSync(SOURCE_HEALTH_FILE, JSON.stringify(failureHealth, null, 2));
        console.error(`\n  ❌ CRITICAL FAILURE: Scrapers only yielded ${allScraped.length} entries (expected 5+). Failing CI/CD run.`);
        process.exit(1);
    }

    const mergedData = mergeData(existingData, allScraped, verifiedStatic);
    const finalNormalizationRun = captureRecordSet({ sourceId: 'dataset:final', label: 'Final dataset normalization', collectionMode: 'merged_dataset', rawRecords: mergedData });
    healthRuns.push(finalNormalizationRun.run);
    const finalData = finalNormalizationRun.records;

    // -- Generate AI Strategic Report --
    const reportPath = path.join(PUBLIC_DATA_DIR, 'research_report.json');
    const strategicReportIncubator = await generateStrategicReport(finalData, 'incubator');
    const strategicReportStartup = await generateStrategicReport(finalData, 'startup');
    fs.writeFileSync(reportPath, JSON.stringify({ incubator: strategicReportIncubator, startup: strategicReportStartup }, null, 2));

    // -- Write remaining artifacts --
    const sourceHealth = buildSourceHealthReport({ runs: healthRuns, finalData });
    fs.writeFileSync(SOURCE_HEALTH_FILE, JSON.stringify(sourceHealth, null, 2));
    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2));

    console.log('\n-----------------------------------------------');
    console.log(`  ✅ Done! Saved ${finalData.length} opportunities.`);
    console.log(`    Verified links: ${finalData.filter(x => x.linkStatus === 'verified').length} | Broken: ${finalData.filter(x => x.linkStatus === 'broken').length}`);
    console.log('-----------------------------------------------\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    orchestrate().then(() => process.exit(0));
}
