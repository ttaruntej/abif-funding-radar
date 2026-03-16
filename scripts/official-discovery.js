/**
 * ABIF Funding Radar - Automated Scraper
 *
 * Tiers:
 *   A — Real live scrapers (BIRAC, DST)
 *   B — Smart static records with live link verification
 *   C — Puppeteer full-render for React SPAs (SISFS, SBI Foundation)
 *   D — Dead-link detection and flagging
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import {
    buildSourceHealthReport,
    normalizeOpportunityRecord,
    validateOpportunityRecord,
} from './lib/record-governor.js';

dotenv.config();

// -- Gemini Integration --------------------------------------------------------
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DATA_DIR = path.join(__dirname, '../public/data');
const DATA_FILE = path.join(PUBLIC_DATA_DIR, 'opportunities.json');
const SOURCE_HEALTH_FILE = path.join(PUBLIC_DATA_DIR, 'source_health.json');

const RETIRED_RECORD_SIGNATURES = [
    {
        names: ['IDFC FIRST Bank IGNITE Accelerator'],
        links: ['https://www.idfcfirstbank.com/csr'],
    },
    {
        names: ['Infosys Social Innovation & Entrepreneurship CSR'],
        links: ['https://www.infosys.com/infosys-foundation/grants.html'],
    },
    {
        names: ['MeitY Blockchain India Challenge'],
        links: ['https://www.msh.gov.in/'],
    },
    {
        names: ['Rockefeller Foundation Global Impact Incubator'],
        links: ['https://www.rockefellerfoundation.org/grant-opportunities/'],
    },
    {
        names: ['SAREP Partnership Fund'],
        links: ['https://www.sarepenergy.net/'],
    },
];

const KNOWN_RECORD_REMEDIATIONS = [
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
    {
        names: ['SAMRIDH Cohort 3'],
        links: ['https://www.msh.gov.in/samridh'],
        patch: {
            name: 'SAMRIDH Scheme',
            link: 'https://msh.meity.gov.in/assets/SAMRIDH%20guidelines.pdf',
            body: 'MeitY Startup Hub',
            description: 'Official SAMRIDH scheme guidelines for accelerator-led support and matched investment for startups.',
            deadline: 'Check Website',
            status: 'Check Website',
            dataSource: 'manual:official:meity-startuphub',
            targetAudience: ['incubator', 'startup'],
            linkStatus: 'probable',
        },
    },
    {
        names: ['MSME Incubation Scheme'],
        links: ['https://msme.gov.in/technology-incubation'],
        patch: {
            link: 'https://msme.gov.in/incubation',
            description: 'Official Ministry of MSME incubation support page for innovators, host institutes, and incubation projects.',
            deadline: 'Check Website',
            status: 'Check Website',
            dataSource: 'manual:official:msme',
            targetAudience: ['incubator', 'startup'],
            linkStatus: 'probable',
        },
    },
    {
        names: ['MeitY TIDE 2.0 (Incubator Support)'],
        links: ['https://vc.meity.gov.in/tide2.0/'],
        patch: {
            link: 'https://msh.meity.gov.in/assets/Administrative%20Approval_TIDE%202.0.pdf',
            body: 'MeitY Startup Hub',
            description: 'Official MeitY TIDE 2.0 approval document outlining incubator support for ICT and electronics startups.',
            deadline: 'Check Website',
            status: 'Check Website',
            dataSource: 'manual:official:meity-startuphub',
            targetAudience: ['incubator', 'startup'],
            linkStatus: 'probable',
        },
    },
    {
        names: ['STPI Next Generation Incubation Scheme (NGIS) / LEAP Ahead'],
        links: ['https://www.stpi.in/en/next-generation-incubation-scheme'],
        patch: {
            link: 'https://stpi.in/index.php/en/schemes/ngis-scheme',
            description: 'Official STPI NGIS scheme page for startup incubation, seed support, and LEAP Ahead challenge tracks.',
            status: 'Check Website',
            dataSource: 'manual:official:stpi',
            targetAudience: ['incubator', 'startup'],
            linkStatus: 'probable',
        },
    },
    {
        names: ['NABARD AgriSURE Fund (Direct Scheme)'],
        links: ['https://nabventures.in/agrisure/'],
        patch: {
            link: 'https://nabventures.in/agrisure.aspx',
            description: 'Official AgriSURE Fund page for NABVENTURES-backed investment support in agriculture and allied sectors.',
            deadline: 'Check Website',
            status: 'Check Website',
            dataSource: 'manual:official:nabventures',
            linkStatus: 'probable',
        },
    },
    {
        names: ['ADB FinTech Institute'],
        links: ['https://www.adb.org/what-we-do/sectors/finance/fintech'],
        patch: {
            name: 'ADB Ventures',
            link: 'https://ventures.adb.org/',
            body: 'Asian Development Bank',
            maxAward: 'Catalytic capital and venture support',
            deadline: 'Check Website',
            description: 'ADB Ventures supports climate and development-focused startups with catalytic capital, pilots, and ecosystem partnerships across Asia and the Pacific.',
            category: 'international',
            status: 'Check Website',
            dataSource: 'manual:official:adb',
            targetAudience: ['startup'],
            sectors: ['ClimateTech', 'FinTech', 'AgriTech'],
            stages: ['Seed', 'Early Traction', 'Scale-up'],
            linkStatus: 'probable',
        },
    },
    {
        names: ['Clean Energy International Incubation Centre'],
        links: ['https://socialalpha.org/ceiic/'],
        patch: {
            name: 'Clean Energy International Incubation Centre (CEIIC)',
            link: 'https://ceiic.socialalpha.org/',
            body: 'Social Alpha / Tata Trusts',
            maxAward: 'Program support and venture access',
            deadline: 'Check Website',
            description: 'CEIIC supports clean energy innovators through venture building, pilot enablement, mentorship, and market access.',
            category: 'csr',
            status: 'Check Website',
            dataSource: 'manual:official:socialalpha',
            targetAudience: ['startup', 'incubator'],
            sectors: ['CleanTech', 'Energy', 'ClimateTech'],
            stages: ['Prototype', 'Seed', 'Early Traction'],
            linkStatus: 'probable',
        },
    },
    {
        names: ['GIZ-FCDO StartUpWave', 'GIZ–FCDO StartUpWave', 'GIZâ€“FCDO StartUpWave'],
        links: ['https://www.giz.de/en/worldwidegiz/india.html'],
        patch: {
            name: 'StartupWave Virtual Incubation Platform',
            link: 'https://startupwave.co/',
            body: 'StartupWave / Intellecap',
            maxAward: 'Platform support and partner opportunities',
            deadline: 'Rolling',
            description: 'StartupWave is a virtual incubation platform connecting entrepreneurs with mentors, incubators, investors, and ecosystem programs.',
            category: 'international',
            status: 'Rolling',
            dataSource: 'manual:official:startupwave',
            targetAudience: ['startup'],
            sectors: ['Agnostic'],
            stages: ['Ideation', 'Prototype', 'Seed'],
            linkStatus: 'probable',
        },
    },
    {
        names: ['Lemelson Foundation ASME iShow'],
        links: ['https://ishow.asme.org/'],
        patch: {
            name: 'ASME iShow Accelerator',
            link: 'https://www.asme.org/about-asme/media-inquiries/press-releases/social-ventures%2C-hardware-innovators%2C-and-mentors-worldwide-invited-to-apply-for-2025-asme-ishow-accelerator',
            body: 'ASME',
            maxAward: '$15,000 award package',
            deadline: 'Check Website',
            description: 'ASME iShow is a global hardware innovation accelerator for ventures building socially impactful products and engineering solutions.',
            category: 'international',
            status: 'Check Website',
            dataSource: 'manual:official:asme',
            targetAudience: ['startup'],
            sectors: ['Hardware', 'Social Impact', 'DeepTech'],
            stages: ['Prototype', 'Seed', 'Early Traction'],
            linkStatus: 'probable',
        },
    },
    {
        names: ['World Bank Group Startup Financing'],
        links: ['https://www.ifc.org/en/what-we-do/sector-expertise/disruptive-technologies-and-funds'],
        patch: {
            name: 'IFC Startup Catalyst',
            link: 'https://www.ifc.org/en/what-we-do/sector-expertise/venture-capital/startup-catalyst',
            body: 'IFC / World Bank Group',
            maxAward: 'Fund and venture support',
            deadline: 'Check Website',
            description: 'IFC Startup Catalyst supports emerging-market startups and venture ecosystems through blended capital, fund backing, and ecosystem partnerships.',
            category: 'international',
            status: 'Check Website',
            dataSource: 'manual:official:ifc',
            targetAudience: ['startup'],
            sectors: ['Agnostic', 'FinTech', 'ClimateTech'],
            stages: ['Seed', 'Early Traction', 'Scale-up'],
            linkStatus: 'probable',
        },
    },
    {
        names: ['HDFC Bank Parivartan Start-up Grants (FY26)'],
        links: ['https://www.hdfcbank.com/personal/useful-links/social-initiatives/parivartan'],
        patch: {
            name: 'HDFC Bank Parivartan Start-up Grants',
            link: 'https://www.hdfcbank.com/personal/about-us/news-room/press-release/2024/hdfc-bank-parivartan-announces-startup-grants-for-30-incubators',
            body: 'HDFC Bank Parivartan',
            deadline: 'Check Website',
            description: 'HDFC Bank Parivartan startup grants support incubators and social-impact startups working across livelihood, healthcare, and education themes.',
            status: 'Check Website',
            dataSource: 'manual:csr:hdfc',
            targetAudience: ['incubator', 'startup'],
            linkStatus: 'probable',
        },
    },
];

function normalizeRemediationName(value = '') {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeRemediationLink(value = '') {
    return String(value).trim().toLowerCase();
}

function shouldRetireRecord(record) {
    if (!record || typeof record !== 'object') return false;

    const normalizedName = normalizeRemediationName(record.name);
    const normalizedLink = normalizeRemediationLink(record.link);

    return RETIRED_RECORD_SIGNATURES.some((candidate) =>
        candidate.names?.some((name) => normalizeRemediationName(name) === normalizedName) ||
        candidate.links?.some((link) => normalizeRemediationLink(link) === normalizedLink),
    );
}

function applyRecordRemediation(record) {
    if (!record || typeof record !== 'object') return record;

    const normalizedName = normalizeRemediationName(record.name);
    const normalizedLink = normalizeRemediationLink(record.link);
    const match = KNOWN_RECORD_REMEDIATIONS.find((candidate) =>
        candidate.names?.some((name) => normalizeRemediationName(name) === normalizedName) ||
        candidate.links?.some((link) => normalizeRemediationLink(link) === normalizedLink),
    );

    if (!match) return record;

    const remediated = {
        ...record,
        ...match.patch,
    };

    if (String(record.linkStatus || '').toLowerCase() === 'verified') {
        remediated.linkStatus = 'verified';
    }

    return remediated;
}

function flattenValidationIssues(validation) {
    return [...validation.errors, ...validation.warnings].map((issue) => ({
        code: issue.code,
        detail: issue.detail,
    }));
}

function normalizeRecordBatch(records, context = {}) {
    const accepted = [];
    const rejected = [];
    let warningCount = 0;

    for (const rawRecord of records) {
        if (shouldRetireRecord(rawRecord)) {
            continue;
        }

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

function buildRunSummary({
    sourceId,
    datasetSourceId,
    label,
    collectionMode,
    startedAt,
    rawCount,
    normalized,
    error = null,
}) {
    const finishedAt = new Date().toISOString();

    return {
        sourceId,
        datasetSourceId,
        label,
        collectionMode,
        startedAt,
        finishedAt,
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

    const normalized = normalizeRecordBatch(rawRecords, {
        sourceId,
        collectionMode,
        collectedAt: startedAt,
    });

    return {
        records: normalized.accepted,
        run: buildRunSummary({
            sourceId,
            datasetSourceId,
            label,
            collectionMode,
            startedAt,
            rawCount: rawRecords.length,
            normalized,
            error,
        }),
    };
}

function captureRecordSet({ sourceId, datasetSourceId, label, collectionMode, rawRecords, error = null }) {
    const startedAt = new Date().toISOString();
    const normalized = normalizeRecordBatch(rawRecords, {
        sourceId,
        collectionMode,
        collectedAt: startedAt,
    });

    return {
        records: normalized.accepted,
        run: buildRunSummary({
            sourceId,
            datasetSourceId,
            label,
            collectionMode,
            startedAt,
            rawCount: rawRecords.length,
            normalized,
            error,
        }),
    };
}

// --- Core Execution Utilities (V3 Performance) ------------------------------

/**
 * Array Chunker for Controlled Concurrency
 */
function chunkArray(array, size) {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

/**
 * Generic Retry Wrapper for Flaky Network Calls
 */
async function withRetry(operation, maxRetries = 2, delayMs = 2000) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await operation();
        } catch (e) {
            lastError = e;
            if (i < maxRetries) {
                await new Promise(res => setTimeout(res, delayMs));
            }
        }
    }
    throw lastError;
}

/**
 * Blocks heavy/unnecessary assets from downloading (CSS, Fonts, Images, Media)
 * Slashes individual page load times from ~20s to < 3s.
 */
async function setupPageInterception(page) {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const type = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media', 'other'].includes(type) && !req.url().includes('captcha')) {
            req.abort();
        } else {
            req.continue();
        }
    });
}

async function probeDirectHttpLink(url) {
    try {
        const response = await fetch(url, {
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(15000),
        });
        return {
            status: response.status,
            ok: response.ok,
            error: null,
        };
    } catch (error) {
        return {
            status: 0,
            ok: false,
            error: error.message,
        };
    }
}

// --- Date / Status Helpers --------------------------------------------------

const MONTHS = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * Extracts the LAST / DEADLINE date from raw text.
 * Specifically searches for "Last Date", "Last date to apply", "Extended Last date" etc.
 * Never guesses the highest date on the page randomly.
 */
function extractDeadlineDate(text) {
    if (!text) return null;

    // Strategy 1: Look for "Last Date[ :-–]" or similar deadline keywords followed by a date
    const lastDateSection = text.match(/(?:last\s*date|deadline|closing\s*date|closes\s*by|due\s*date|apply\s*by)[^\d]*(\d{1,2}(?:st|nd|rd|th)?[-\/\s,]+(?:\d{1,2}[-\/]|[a-z]+\s*)\d{4})/i);
    if (lastDateSection) {
        const d = parseSingleDate(lastDateSection[1]);
        if (d) return d;
    }

    return null; // Fallback to Rolling instead of wildly guessing future dates
}

function parseSingleDate(str) {
    if (!str) return null;
    str = str.trim();

    // DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (dmyMatch) {
        const [_, d, m, y] = dmyMatch;
        return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    }

    // DDth Month, YYYY or DD Month YYYY
    const nlMatch = str.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december),?\s+(\d{4})/i);
    if (nlMatch) {
        const month = String(MONTHS[nlMatch[2].toLowerCase()]).padStart(2, '0');
        const day = nlMatch[1].padStart(2, '0');
        return new Date(`${nlMatch[3]}-${month}-${day}`);
    }

    return null;
}

function dateToStatus(deadlineDate) {
    if (!deadlineDate) return 'Rolling';
    const today = new Date();
    const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Closed';
    if (diffDays <= 14) return 'Closing Soon';
    return 'Open';
}

function determineStatus(text) {
    if (!text) return 'Rolling';
    const lower = text.toLowerCase();
    if (lower.includes('rolling') || lower.includes('throughout the year') || lower.includes('open all year')) return 'Rolling';
    const d = extractDeadlineDate(text);
    return dateToStatus(d);
}

function formatDeadline(text) {
    if (!text) return 'Rolling';
    const d = extractDeadlineDate(text);
    if (!d) return text.trim().replace(/\s+/g, ' ');
    // Format as DD-MM-YYYY
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function cleanName(raw) {
    return raw
        .replace(/\s+/g, ' ')
        .replace(/\u2026/g, '...')
        .replace(/\.{3,}$/g, '')
        .replace(/\.{2,}$/g, '')
        .replace(/Last\s*Date\s*:.*/i, '')
        .replace(/Extended\s*Last\s*date.*/i, '')
        .replace(/\s*:\s*\d{1,2}.*\d{4}.*$/, '')
        .replace(/\(\s*new\s*tab\s*\)/i, '')
        .trim();
}

function isUsableOpportunityName(name) {
    if (!name || name.length < 12) return false;
    if (/^click here/i.test(name)) return false;
    if (/project proposal format/i.test(name)) return false;
    if (/^(home|details|read more|apply now)$/i.test(name)) return false;
    return /[a-z]{3}/i.test(name);
}

function normalizeTextContent(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function clipText(text, maxLength = 280) {
    const normalized = normalizeTextContent(text);
    if (normalized.length <= maxLength) return normalized;

    const clipped = normalized.slice(0, maxLength);
    const sentenceEnd = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('; '));
    if (sentenceEnd > maxLength * 0.55) {
        return clipped.slice(0, sentenceEnd + 1).trim();
    }

    const wordEnd = clipped.lastIndexOf(' ');
    return `${clipped.slice(0, wordEnd > 40 ? wordEnd : maxLength).trim()}...`;
}

function findLongestParagraph($, selectors = 'main p, article p, .entry-content p, .site-content p, p') {
    const paragraphs = $(selectors)
        .map((_, el) => normalizeTextContent($(el).text()))
        .get()
        .filter((text) => text.length > 80 && !/share on|facebook|twitter|linkedin|screen reader/i.test(text));

    return paragraphs[0] || '';
}

function extractTextBlock(sourceText, startMarker, endMarkers = []) {
    const normalized = normalizeTextContent(sourceText);
    if (!normalized) return '';

    const lower = normalized.toLowerCase();
    const startIdx = lower.indexOf(startMarker.toLowerCase());
    if (startIdx < 0) return '';

    let endIdx = normalized.length;
    for (const marker of endMarkers) {
        const markerIdx = lower.indexOf(marker.toLowerCase(), startIdx + startMarker.length);
        if (markerIdx > startIdx && markerIdx < endIdx) {
            endIdx = markerIdx;
        }
    }

    return normalizeTextContent(normalized.slice(startIdx, endIdx))
        .replace(/&#8216;|&#8217;/g, "'")
        .replace(/&amp;/g, '&');
}

function extractAnchorHref($, baseUrl, matcher) {
    let resolved = null;

    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = normalizeTextContent($(el).text());
        if (!matcher({ href, text })) return;

        try {
            resolved = new URL(href, baseUrl).toString();
            return false;
        } catch {
            return null;
        }
    });

    return resolved;
}

// --- TIER A: BIRAC -----------------------------------------------------------

async function scrapeBirac(browser) {
    console.log('\n--- [Tier A] Scraping BIRAC ---');
    const listingUrl = 'https://birac.nic.in/cfp.php';
    const results = [];

    try {
        const page = await browser.newPage();
        await setupPageInterception(page);
        await page.setDefaultNavigationTimeout(60000);
        await withRetry(() => page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }));

        const $ = cheerio.load(await page.content());
        await page.close();

        const rows = [];
        $('table#current tbody tr').each((_, el) => {
            const anchor = $(el).find('td:nth-child(2) a').first();
            const rawName = anchor.text().trim();
            if (!rawName) return;

            const relHref = anchor.attr('href') || '';
            const detailLink = relHref.startsWith('http') ? relHref : `https://birac.nic.in/${relHref}`;
            const rawText = $(el).find('td:nth-child(2)').text().trim();

            rows.push({ rawName, rawText, detailLink });
        });

        console.log(`  Found ${rows.length} current BIRAC CFPs. Fetching detail pages concurrently (in batches of 5)...`);

        const chunks = chunkArray(rows, 5);
        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (row) => {
                const name = cleanName(row.rawName);
                if (!isUsableOpportunityName(name)) return;
                const deadlineStr = formatDeadline(row.rawText);
                const status = determineStatus(row.rawText);
                let applyLink = row.detailLink;
                let linkStatus = 'probable';

                try {
                    const dp = await browser.newPage();
                    await setupPageInterception(dp);
                    await withRetry(() => dp.goto(row.detailLink, { waitUntil: 'domcontentloaded', timeout: 25000 }));

                    const $d = cheerio.load(await dp.content());
                    await dp.close();

                    const extSelectors = [
                        'a[href*="apply"]', 'a[href*="form"]', 'a[href*="google"]',
                        'a[href*="submission"]', 'a[href*="register"]', 'a[href*="innovatein"]',
                        'a:contains("Apply")', 'a:contains("Submit")', 'a:contains("Application Form")',
                        'a:contains("Apply Online")', 'a:contains("Click here to apply")',
                    ];
                    for (const sel of extSelectors) {
                        const href = $d(sel).first().attr('href');
                        if (href && href.startsWith('http') && !href.includes('birac.nic.in')) {
                            applyLink = href;
                            linkStatus = 'verified';
                            break;
                        }
                    }
                } catch (e) {
                    console.warn(`    ? Detail page failed for "${name}": ${e.message}`);
                }

                results.push({
                    name,
                    body: 'BIRAC (DBT)',
                    maxAward: 'Grant (competitive scale)',
                    deadline: deadlineStr,
                    link: applyLink,
                    description: `BIRAC Call for Proposal. Visit the link to see full details and eligibility.`,
                    category: 'national',
                    status,
                    linkStatus,
                    dataSource: 'scraper:birac',
                    lastScraped: new Date().toISOString(),
                    targetAudience: ['startup'],
                    sectors: ['BioTech', 'MedTech', 'AgriTech'],
                    stages: ['Ideation', 'Seed', 'Early Traction']
                });
                console.log(`  ? ${status.padEnd(12)} | ${name.substring(0, 55)}`);
            }));
        }
    } catch (e) {
        console.error('  ? BIRAC scraper failed:', e.message);
    }

    return results;
}

// --- TIER A: DST Active Calls ------------------------------------------------

async function scrapeDST(browser) {
    console.log('\n--- [Tier A] Scraping DST (onlinedst.gov.in) ---');
    const listingUrl = 'https://onlinedst.gov.in/';
    const results = [];

    try {
        const page = await browser.newPage();
        await setupPageInterception(page);
        await withRetry(() => page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }));
        const $ = cheerio.load(await page.content());
        await page.close();

        // Find the "Active Calls" section by heading text, then collect all anchor links
        const entries = new Map();

        $('a[href*="Projectproposalformat.aspx"]').each((_, el) => {
            const rawName = $(el).text().trim();
            const href = $(el).attr('href') || '';
            const link = href.startsWith('http') ? href : `https://onlinedst.gov.in/${href.replace(/^\//, '')}`;
            if (!/Projectproposalformat\.aspx\?Id=\d+/i.test(link)) return;

            const name = cleanName(rawName);
            if (!isUsableOpportunityName(name)) return;
            if (!name || !href) return;

            entries.set(link, { name, link });
        });

        const entryList = [...entries.values()];
        console.log(`  Found ${entryList.length} DST active calls. Fetching details concurrently...`);

        const chunks = chunkArray(entryList, 5);
        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (entry) => {
                const name = cleanName(entry.name);
                if (!isUsableOpportunityName(name)) return;

                // Try to fetch deadline from the detail page
                let deadlineStr = 'Check website for details';
                let status = 'Open';
                let maxAward = 'Varies';

                try {
                    const dp = await browser.newPage();
                    await setupPageInterception(dp);
                    await withRetry(() => dp.goto(entry.link, { waitUntil: 'domcontentloaded', timeout: 20000 }));
                    const html = await dp.content();
                    await dp.close();

                    const $d = cheerio.load(html);
                    const bodyText = $d('body').text();

                    const d = extractDeadlineDate(bodyText);
                    if (d) {
                        deadlineStr = formatDeadline(bodyText);
                        status = dateToStatus(d);
                    } else if (bodyText.toLowerCase().includes('throughout the year') || bodyText.toLowerCase().includes('rolling')) {
                        deadlineStr = 'Rolling (Open All Year)';
                        status = 'Rolling';
                    }

                    // Try to extract funding amount
                    const amountMatch = bodyText.match(/(?:grant|funding|support|amount)[^\n]*?(?:Rs\.?|INR|EUR|USD)\s*[\d,]+(?:\s*(?:lakh|crore|million|thousand))?/i);
                    if (amountMatch) maxAward = amountMatch[0].replace(/\s+/g, ' ').trim().substring(0, 60);

                } catch (e) {
                    console.warn(`    ? DST detail page failed for "${name}": ${e.message}`);
                }

                // Determine category: if it mentions "India-France", "Indo-", etc. ? international
                const cat = /indo-|india-france|india.netherlands|bilateral|international/i.test(name) ? 'international' : 'national';

                results.push({
                    name,
                    body: 'DST (MoST)',
                    maxAward,
                    deadline: deadlineStr,
                    link: entry.link,
                    description: `DST active call for proposals. See the portal for full guidelines and eligibility.`,
                    category: cat,
                    status,
                    linkStatus: 'verified',
                    dataSource: 'scraper:dst',
                    lastScraped: new Date().toISOString(),
                    targetAudience: ['startup'],
                    sectors: ['DeepTech', 'Hardware', 'Agnostic'],
                    stages: ['Seed', 'Early Traction', 'Scale-up']
                });
                console.log(`  ? ${status.padEnd(12)} | ${name.substring(0, 55)}`);
            }));
        }
    } catch (e) {
        console.error('  ? DST scraper failed:', e.message);
    }

    return results;
}

// --- TIER C: SISFS (React SPA) ----------------------------------------------

async function scrapeSISFS(browser) {
    console.log('\n--- [Tier C] Scraping SISFS (React SPA) ---');
    const url = 'https://seedfund.startupindia.gov.in/';

    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
        const $ = cheerio.load(await page.content());
        await page.close();

        const bodyText = $('body').text();
        // More robust: Only assume closed if it specifically says 'currently not accepting' near 'applications'
        // Avoid generic 'closed' matches for past cohorts.
        const isHardClosed = /applications\s+are\s+(?:currently\s+)?closed/i.test(bodyText) || /not\s+accepting\s+new\s+applications/i.test(bodyText);
        const status = isHardClosed ? 'Closed' : 'Rolling';

        console.log(`  ? SISFS status: ${status}`);
        return [
            {
                name: 'Startup India Seed Fund Scheme (SISFS) for Startups',
                body: 'DPIIT / Startup India',
                maxAward: 'Up to ?50 Lakhs',
                deadline: 'Rolling (Open All Year)',
                link: url,
                description: 'Financial assistance to startups for proof of concept, prototype development, product trials, market entry, and commercialization.',
                category: 'national',
                status,
                linkStatus: 'verified',
                dataSource: 'scraper:sisfs',
                lastScraped: new Date().toISOString(),
                targetAudience: ['startup'],
                sectors: ['Agnostic'],
                stages: ['Ideation', 'Prototype', 'Seed']
            },
            {
                name: 'SISFS Incubator Grant (To act as Seed Fund partner)',
                body: 'DPIIT / Startup India',
                maxAward: 'Up to ?5 Crores',
                deadline: 'Rolling (Open All Year)',
                link: url,
                description: 'Grant given to eligible incubators (operational > 2-3 years) to distribute seed funding to startups under the SISFS track.',
                category: 'national',
                status,
                linkStatus: 'verified',
                dataSource: 'scraper:sisfs:incubator',
                lastScraped: new Date().toISOString(),
                targetAudience: ['incubator'],
                sectors: ['Agnostic'],
                stages: ['All Stages']
            }
        ];
    } catch (e) {
        console.error('  ? SISFS scraper failed:', e.message);
        return [];
    }
}

// --- TIER C: SBI Foundation (React SPA) -------------------------------------

async function scrapeSBIFoundation(browser) {
    console.log('\n--- [Tier C] Scraping SBI Foundation (React SPA) ---');
    const url = 'https://sbifoundation.in/';

    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForSelector('body', { timeout: 10000 });

        const $ = cheerio.load(await page.content());
        await page.close();
        const bodyText = $('body').text().toLowerCase();

        // Check if "Innovators for Bharat" or similar program is mentioned + look for deadline
        const deadline = extractDeadlineDate($('body').text());
        const deadlineStr = deadline ? formatDeadline($('body').text()) : '31-05-2026';
        const status = dateToStatus(deadline) || 'Open';

        // Try to find the apply link
        let applyLink = url;
        $('a').each((_, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().toLowerCase();
            if ((text.includes('apply') || text.includes('innovator') || text.includes('programme')) && href.startsWith('http')) {
                applyLink = href;
                return false; // break
            }
        });

        console.log(`  ? SBI Foundation status: ${status}, link: ${applyLink}`);
        return [{
            name: 'SBI Foundation – Innovators for Bharat',
            body: 'SBI Foundation CSR',
            maxAward: '?25 Lakhs',
            deadline: deadlineStr,
            link: applyLink,
            description: 'Innovators for Bharat supports social innovators with funding, mentorship, and market linkages.',
            category: 'csr',
            status,
            linkStatus: applyLink !== url ? 'verified' : 'probable',
            dataSource: 'scraper:sbif',
            lastScraped: new Date().toISOString(),
            targetAudience: ['incubator', 'startup'],
            sectors: ['Social Impact', 'EdTech', 'HealthTech'],
            stages: ['Seed', 'Scale-up']
        }];
    } catch (e) {
        console.error('  ? SBI Foundation scraper failed:', e.message);
        return [];
    }
}

// --- TIER B+: Official Policy / Scheme Collectors ---------------------------

async function scrapeNidhiPrograms() {
    console.log('\n--- [Tier B+] Scraping NIDHI Programme Pages ---');
    const pages = [
        {
            url: 'https://nidhi.dst.gov.in/nidhitbi/',
            name: 'NIDHI-TBI',
            body: 'DST (MoST)',
            maxAward: 'Incubator support via DST call-for-proposals',
            status: 'Check Website',
            deadline: 'Check Website',
            targetAudience: ['incubator'],
            sectors: ['DeepTech', 'Agnostic'],
            stages: ['All Stages'],
            criticalEligibility: [
                'Applications are invited for establishing NIDHI-TBIs through DST call-for-proposals',
                'Typically hosted by academic, technical, or management institutions',
                'Startups apply to participating TBIs after incubator selection',
            ],
        },
        {
            url: 'https://nidhi.dst.gov.in/nidhieir/',
            name: 'NIDHI-EIR',
            body: 'DST (via NSTEDB)',
            maxAward: 'INR 10,000 - INR 30,000 / month',
            status: 'Rolling',
            deadline: 'Rolling (Centre-based intake)',
            targetAudience: ['startup'],
            sectors: ['Agnostic'],
            stages: ['Ideation', 'Prototype'],
            criticalEligibility: [
                'Graduate students and innovators can apply through selected NIDHI-EIR Centres',
                'Support is typically available for up to 12 months',
                'Programme combines fellowship support with incubation and mentoring access',
            ],
        },
        {
            url: 'https://nidhi.dst.gov.in/nidhissp/',
            name: 'NIDHI Seed Support Program (NIDHI-SSP)',
            body: 'DST (MoST)',
            maxAward: 'Up to INR 100 lakh for startups',
            status: 'Check Website',
            deadline: 'Check Website',
            targetAudience: ['startup', 'incubator'],
            sectors: ['Agnostic'],
            stages: ['Prototype', 'Seed', 'Early Traction'],
            criticalEligibility: [
                'Incubators receive support in phased releases based on capability and need',
                'Deserving startups may receive up to INR 100 lakh through incubator channels',
                'Applications are accepted through periodic calls announced on the official portal',
            ],
        },
    ];

    const results = [];

    for (const pageConfig of pages) {
        try {
            const response = await fetch(pageConfig.url, { signal: AbortSignal.timeout(30000) });
            const html = await response.text();
            const $ = cheerio.load(html);
            const paragraphs = $('p')
                .map((_, el) => normalizeTextContent($(el).text()))
                .get()
                .filter((text) => text.length > 80);
            const description = clipText(paragraphs.slice(0, 2).join(' '), 340) || clipText(findLongestParagraph($), 260);
            const applyLink = extractAnchorHref($, pageConfig.url, ({ href, text }) =>
                /nidhi-eir\.in|e-pms|program-thermometer|incubators\.php/i.test(href) ||
                /click here|centres|apply|call-for-proposals/i.test(text),
            ) || pageConfig.url;

            results.push({
                ...pageConfig,
                link: pageConfig.url,
                applicationLink: applyLink,
                description,
                category: 'national',
                linkStatus: response.ok ? 'verified' : 'probable',
                dataSource: 'scraper:nidhi',
                lastScraped: new Date().toISOString(),
            });
            console.log(`  ? ${pageConfig.status.padEnd(12)} | ${pageConfig.name}`);
        } catch (e) {
            console.error(`  ? NIDHI collector failed for ${pageConfig.url}:`, e.message);
        }
    }

    return results;
}

async function scrapeAIMAIC() {
    console.log('\n--- [Tier B+] Scraping AIM AIC ---');
    const url = 'https://aim.gov.in/aic.php';

    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        const html = await response.text();
        const $ = cheerio.load(html);
        const description = clipText(findLongestParagraph($), 260);

        console.log('  ? Check Website | Atal Incubation Centre (AIC) Grant');
        return [{
            name: 'Atal Incubation Centre (AIC) Grant',
            body: 'AIM (NITI Aayog)',
            maxAward: 'Up to Rs. 10 Crores',
            deadline: 'Check Website',
            link: url,
            description,
            category: 'national',
            status: 'Check Website',
            linkStatus: response.ok ? 'verified' : 'probable',
            dataSource: 'scraper:aim',
            lastScraped: new Date().toISOString(),
            targetAudience: ['incubator'],
            sectors: ['Agnostic'],
            stages: ['All Stages'],
            criticalEligibility: [
                'Targeted at institutions establishing or operating incubation capacity',
                'Hosted through universities, institutions, corporates, and similar organizations',
                'Applicants should track AIM guidance and official AIC documentation for active calls',
            ],
        }];
    } catch (e) {
        console.error('  ? AIM AIC scraper failed:', e.message);
        return [];
    }
}

async function scrapeStartupOdishaIncentives() {
    console.log('\n--- [Tier B+] Scraping Startup Odisha Incentives ---');
    const url = 'https://startupodisha.gov.in/startup-incentives/';

    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        const html = await response.text();
        const bodyText = normalizeTextContent(
            html
                .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&#8216;|&#8217;/g, "'")
                .replace(/&amp;/g, '&'),
        );

        const monthlyAllowance = extractTextBlock(bodyText, 'Monthly allowance', [
            'Product Development and Marketing/ Publicity assistance',
            'Need based assistance',
        ]);
        const productSupport = extractTextBlock(bodyText, 'Product Development and Marketing/ Publicity assistance', [
            'Need based assistance',
            'Benefits to Startups working on Rural Impact',
            'Additional benefits to Women led Startups',
            'Fund Release Guideline',
        ]);

        const results = [
            {
                name: 'Startup Odisha – Monthly Sustenance Allowance',
                body: 'MSME Dept, Odisha',
                maxAward: 'Rs. 20,000 - Rs. 22,000 / month',
                deadline: 'Rolling (Policy-linked incentive)',
                link: url,
                description: clipText(monthlyAllowance, 320),
                category: 'state',
                status: 'Rolling',
                linkStatus: response.ok ? 'verified' : 'probable',
                dataSource: 'scraper:startupodisha',
                lastScraped: new Date().toISOString(),
                targetAudience: ['startup'],
                sectors: ['Agnostic'],
                stages: ['Ideation', 'Prototype'],
                criticalEligibility: [
                    'Startup must be recognized under Startup Odisha',
                    'Qualifies through funding, patent, government sanction letter, or revenue-run-rate conditions',
                    'Support is available for one year under the monthly allowance policy',
                ],
            },
            {
                name: 'Startup Odisha – Product Development & Marketing Assistance',
                body: 'MSME Dept, Odisha',
                maxAward: 'Up to Rs. 15 Lakhs',
                deadline: 'Rolling (Policy-linked incentive)',
                link: url,
                description: clipText(productSupport, 320),
                category: 'state',
                status: 'Rolling',
                linkStatus: response.ok ? 'verified' : 'probable',
                dataSource: 'scraper:startupodisha',
                lastScraped: new Date().toISOString(),
                targetAudience: ['startup'],
                sectors: ['Agnostic'],
                stages: ['Prototype', 'Seed'],
                criticalEligibility: [
                    'Startup must be recognized under Startup Odisha',
                    'Requires equity financing, government grant support, or defined revenue run-rate proof',
                    'Assistance is meant for introducing an innovated product in the market',
                ],
            },
        ];

        results.forEach((item) => {
            console.log(`  ? ${item.status.padEnd(12)} | ${item.name}`);
        });

        return results;
    } catch (e) {
        console.error('  ? Startup Odisha scraper failed:', e.message);
        return [];
    }
}

async function scrapeManageCIA() {
    console.log('\n--- [Tier B+] Scraping MANAGE-CIA Programmes ---');
    const programs = [
        {
            url: 'https://www.manage.gov.in/managecia/RKVYProg.aspx',
            name: 'MANAGE-CIA RKVY-RAFTAAR Agribusiness Incubation',
            body: 'MANAGE / Dept of Agriculture',
            maxAward: 'Up to Rs. 25 Lakhs (track dependent)',
            status: 'Check Website',
            deadline: 'Check Website',
            targetAudience: ['startup'],
            sectors: ['AgriTech', 'Rural Development'],
            stages: ['Ideation', 'Prototype', 'Seed'],
            description:
                'Official MANAGE-CIA RKVY-RAFTAAR programme hub covering agribusiness incubation support tracks such as SAIP, AOP, and SOP.',
            criticalEligibility: [
                'Agribusiness innovators should track the active MANAGE-CIA programme track and call details',
                'Programme supports agriculture and allied sector ventures through staged incubation pathways',
                'Applicants should use official MANAGE-CIA forms and cohort notices for the active intake',
            ],
        },
        {
            url: 'https://www.manage.gov.in/managecia/RKVYSAIP.aspx',
            name: 'MANAGE-CIA Startup Agri-Business Incubation Program (SAIP)',
            body: 'MANAGE / Dept of Agriculture',
            maxAward: 'Up to Rs. 25 Lakhs',
            status: 'Check Website',
            deadline: 'Check Website',
            targetAudience: ['startup'],
            sectors: ['AgriTech', 'Rural Development'],
            stages: ['MVP', 'Seed', 'Early Traction'],
            criticalEligibility: [
                'Potential startups should already have a minimum viable product in agriculture or allied sectors',
                'Funding is appraised against the business plan by the programme selection committee',
                'Applicants are expected to commercialize and scale their product or service through incubation support',
            ],
        },
        {
            url: 'https://www.manage.gov.in/managecia/RKVYAOP.aspx',
            name: 'MANAGE-CIA Agripreneurship Orientation Program (AOP)',
            body: 'MANAGE / Dept of Agriculture',
            maxAward: 'Up to Rs. 5 Lakhs',
            status: 'Check Website',
            deadline: 'Check Website',
            targetAudience: ['startup'],
            sectors: ['AgriTech', 'Rural Development'],
            stages: ['Ideation', 'Prototype'],
            criticalEligibility: [
                'Applicants should propose one innovative agribusiness idea based on technology, process, service, or business platform',
                'Applicants are expected to pursue the entrepreneurial opportunity full time',
                'An initial business plan or proposal is required for selection',
            ],
        },
        {
            url: 'https://www.manage.gov.in/managecia/RKVYSOP.aspx',
            name: 'MANAGE-CIA Student Orientation Program (SOP)',
            body: 'MANAGE / Dept of Agriculture',
            maxAward: 'Up to Rs. 4 Lakhs',
            status: 'Check Website',
            deadline: 'Check Website',
            targetAudience: ['startup'],
            sectors: ['AgriTech', 'Rural Development'],
            stages: ['Ideation', 'Prototype'],
            criticalEligibility: [
                'Only students currently enrolled in a recognized degree programme are eligible',
                'Applicants should propose one innovative agribusiness idea',
                'An initial business plan or proposal is expected at the application stage',
            ],
        },
    ];

    const results = [];

    for (const program of programs) {
        try {
            const response = await fetch(program.url, { signal: AbortSignal.timeout(30000) });
            const html = await response.text();
            const $ = cheerio.load(html);
            const descriptionSource = $('p')
                .map((_, el) => normalizeTextContent($(el).text()))
                .get()
                .filter((text) => text.length > 120)
                .slice(0, 3)
                .join(' ');
            const applyLink = extractAnchorHref($, program.url, ({ href }) => /forms\.gle|google/i.test(href));

            results.push({
                ...program,
                link: program.url,
                applicationLink: applyLink || program.url,
                description: clipText(descriptionSource || program.description, 340),
                category: 'national',
                linkStatus: response.ok ? 'verified' : 'probable',
                dataSource: 'scraper:manage',
                lastScraped: new Date().toISOString(),
            });
            console.log(`  ? ${program.status.padEnd(12)} | ${program.name}`);
        } catch (e) {
            console.error(`  ? MANAGE-CIA collector failed for ${program.url}:`, e.message);
        }
    }

    return results;
}

async function scrapeIIGCSR(browser) {
    console.log('\n--- [Tier B+] Scraping IIG CSR Technology Incubators ---');
    const portalUrl = 'https://indiainvestmentgrid.gov.in/opportunities/csr-projects';
    const rawUrl = `${portalUrl}?rawData=true&page=0`;

    function parseIIGDetailText(text) {
        const normalized = normalizeTextContent(text);
        const summaryMatch = normalized.match(/CSR ID:\s*\d+\s*(.+?)\s*Project Impact/i);
        const impactMatch = normalized.match(/Project Impact\s*(.+?)\s*Project Snapshot/i);
        const fundingMatch = normalized.match(/Funding Requirement \(in USD\)\s*([0-9.]+\s*(?:mn|bn|million|billion)?)/i);
        const locationMatch = normalized.match(/Project Location\|\s*(.+?)\s*(?:Map Data Terms|Address 1:|Contact Summary)/i);
        const statusMatch = normalized.match(/Funding Status\s*([A-Za-z ]+?)\s*(?:Other Funding Detail|Project Location\|)/i);
        const csrIdMatch = normalized.match(/CSR ID:\s*(\d+)/i);

        return {
            csrId: csrIdMatch?.[1] || null,
            summary: clipText(summaryMatch?.[1] || '', 340),
            impact: clipText(impactMatch?.[1] || '', 140),
            fundingRequirement: fundingMatch ? `USD ${fundingMatch[1].trim()}` : 'CSR Funding Requirement',
            location: normalizeTextContent(locationMatch?.[1] || ''),
            fundingStatus: normalizeTextContent(statusMatch?.[1] || ''),
        };
    }

    const results = [
        {
            name: 'India Investment Grid (IIG) – CSR Opportunities Portal',
            body: 'Invest India / Govt of India',
            maxAward: 'Varies by CSR project',
            deadline: 'Rolling (Portal listings)',
            link: portalUrl,
            description: 'Official Invest India CSR opportunity hub with live project listings across subsectors including technology incubators.',
            category: 'csr',
            status: 'Rolling',
            linkStatus: 'verified',
            dataSource: 'scraper:iig',
            lastScraped: new Date().toISOString(),
            targetAudience: ['incubator', 'startup'],
            sectors: ['Social Impact', 'Agnostic'],
            stages: ['All Stages'],
        },
    ];

    try {
        const projectLinks = new Map();

        try {
            const response = await fetch(rawUrl, {
                signal: AbortSignal.timeout(30000),
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });
            const html = await response.text();
            const $ = cheerio.load(html);
            const sections = $('section.dg-project-cards').toArray();
            let technologySection = null;

            for (const section of sections) {
                const title = normalizeTextContent($(section).find('.project-card-section small').first().text());
                if (/technology incubators/i.test(title)) {
                    technologySection = $(section);
                    break;
                }
            }

            if (technologySection) {
                technologySection.find('a[href*="/opportunities/csr-project/"]').each((_, el) => {
                    const href = $(el).attr('href') || '';
                    const text = normalizeTextContent($(el).text());
                    if (!href || !text || /view detail/i.test(text)) return;

                    const absoluteHref = new URL(href, portalUrl).toString();
                    const existing = projectLinks.get(absoluteHref);
                    if (!existing || text.length > existing.length) {
                        projectLinks.set(absoluteHref, text);
                    }
                });
            }
        } catch (rawFetchError) {
            console.warn(`  ? IIG raw fetch fallback triggered: ${rawFetchError.message}`);
        }

        if (projectLinks.size === 0) {
            let portalPage;
            try {
                portalPage = await browser.newPage();
                await portalPage.goto(portalUrl, { waitUntil: 'networkidle2', timeout: 60000 });

                const renderedLinks = await portalPage.evaluate(() => {
                    const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
                    const sections = Array.from(document.querySelectorAll('section.dg-project-cards'));
                    const technologySection = sections.find((section) => {
                        const heading = section.querySelector('.project-card-section small');
                        return heading && /technology incubators/i.test(normalize(heading.textContent || ''));
                    });
                    if (!technologySection) return [];

                    const strongestByHref = new Map();
                    Array.from(technologySection.querySelectorAll('a[href*="/opportunities/csr-project/"]')).forEach((anchor) => {
                        const href = anchor.getAttribute('href') || '';
                        const text = normalize(anchor.textContent || '');
                        if (!href || !text || /view detail/i.test(text)) return;

                        const current = strongestByHref.get(href);
                        if (!current || text.length > current.length) {
                            strongestByHref.set(href, text);
                        }
                    });

                    return Array.from(strongestByHref.entries()).map(([href, text]) => ({ href, text }));
                });

                renderedLinks.forEach(({ href, text }) => {
                    projectLinks.set(new URL(href, portalUrl).toString(), text);
                });
            } finally {
                if (portalPage) await portalPage.close();
            }
        }

        if (projectLinks.size === 0) {
            console.warn('  ? IIG collector could not locate the Technology Incubators section.');
            return results;
        }

        for (const [detailUrl, name] of [...projectLinks.entries()].slice(0, 10)) {
            let detailPage;
            try {
                detailPage = await browser.newPage();
                await setupPageInterception(detailPage);
                await withRetry(() => detailPage.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 45000 }));
                const detailTitle = normalizeTextContent(await detailPage.title()).replace(/\|\s*IIG$/i, '').trim();
                const detailText = await detailPage.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
                const parsed = parseIIGDetailText(detailText);
                const detailDescription = clipText(
                    [parsed.summary, parsed.impact ? `Impact: ${parsed.impact}` : '', parsed.location ? `Location: ${parsed.location}` : '']
                        .filter(Boolean)
                        .join(' '),
                    360,
                );
                const canonicalName = detailTitle && !/error page/i.test(detailTitle) ? detailTitle : name;
                const combinedText = `${canonicalName} ${parsed.summary}`.toLowerCase();
                const sectors = [];
                if (/agri|agricult|farm|crop|food/i.test(combinedText)) sectors.push('AgriTech');
                if (/deep science|deeptech|research|innovation/i.test(combinedText)) sectors.push('DeepTech');
                if (sectors.length === 0) sectors.push('Technology Incubators');

                results.push({
                    name: canonicalName,
                    body: 'Invest India / IIG CSR',
                    maxAward: parsed.fundingRequirement,
                    deadline: 'Rolling (Portal listing)',
                    link: detailUrl,
                    description: detailDescription || `CSR project listed under Technology Incubators on India Investment Grid.`,
                    category: 'csr',
                    status: /unfunded/i.test(parsed.fundingStatus) ? 'Rolling' : 'Check Website',
                    linkStatus: 'verified',
                    dataSource: 'scraper:iig',
                    lastScraped: new Date().toISOString(),
                    targetAudience: ['incubator', 'startup'],
                    sectors,
                    stages: ['All Stages'],
                    csrId: parsed.csrId,
                    sourceLocation: parsed.location || null,
                });
                console.log(`  ? Rolling      | ${canonicalName}`);
            } catch (detailError) {
                console.warn(`    ? IIG detail page failed for "${name}": ${detailError.message}`);
            } finally {
                if (detailPage) await detailPage.close();
            }
        }
    } catch (e) {
        console.error('  ? IIG CSR scraper failed:', e.message);
    }

    return results;
}

// --- TIER B: Verify Static Records ------------------------------------------

/**
 * For all static (manually curated) records, quickly ping their URL.
 * Updates: linkStatus ? 'verified' | 'broken', lastScraped timestamp.
 * Never changes name, body, maxAward, description, or category.
 */
async function verifyStaticRecords(browser, staticRecords) {
    console.log(`\n--- [Tier B] Verifying ${staticRecords.length} static records concurrently ---`);
    const updated = [];
    const chunks = chunkArray(staticRecords, 5);

    for (const chunk of chunks) {
        const settled = await Promise.allSettled(chunk.map(async (record) => {
            let linkStatus = record.linkStatus || 'probable';
            let status = record.status;
            let shouldTryDirectProbe = false;
            let page = null;

            try {
                page = await browser.newPage();
                await setupPageInterception(page);

                // Use a generous 30s timeout — many gov/intl sites are slow
                // Wrap in withRetry for transient network failures
                const response = await withRetry(() => page.goto(record.link, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000,
                }));

                const httpStatus = response ? response.status() : 0;

                if (httpStatus >= 200 && httpStatus < 400) {
                    linkStatus = 'verified';
                } else if (httpStatus >= 400) {
                    shouldTryDirectProbe = true;
                    console.warn(`  ? Browser HTTP ${httpStatus} for "${record.name}" ? retrying with direct probe`);
                }
                // Note: keep existing linkStatus if HTTP is unexpected (e.g. 0) — don't degrade
            } catch (e) {
                // Timeout = likely a slow site, not necessarily dead. Keep existing linkStatus.
                // Only mark broken for DNS failures (no such host).
                if (e.message.includes('net::ERR_NAME_NOT_RESOLVED') || e.message.includes('no such host')) {
                    linkStatus = 'broken';
                    status = 'Verify Manually';
                    console.warn(`  ? DNS failure: "${record.name}"`);
                } else {
                    shouldTryDirectProbe = true;
                    console.warn(`  ? Browser retry needed: "${record.name}" — ${e.message}`);
                }
            } finally {
                if (page) {
                    try {
                        await page.close();
                    } catch {
                        // Ignore cleanup failures; the record-level result has already been determined.
                    }
                }
            }

            if (shouldTryDirectProbe) {
                const directProbe = await probeDirectHttpLink(record.link);
                if (directProbe.ok && directProbe.status < 400) {
                    linkStatus = 'verified';
                } else if (directProbe.status >= 400 || (directProbe.error && /dns|not\s+resolved|enotfound/i.test(directProbe.error))) {
                    linkStatus = 'broken';
                    status = 'Verify Manually';
                    if (directProbe.status >= 400) {
                        console.warn(`  ? Direct probe HTTP ${directProbe.status} for "${record.name}" ? marked broken`);
                    } else {
                        console.warn(`  ? Direct probe failed for "${record.name}" ? marked broken`);
                    }
                } else {
                    console.warn(`  ? Direct probe inconclusive for "${record.name}" — keeping existing status`);
                }
            }

            // For non-rolling records: also check if deadline has passed
            if (record.deadline && record.status !== 'Rolling') {
                const d = extractDeadlineDate(record.deadline);
                if (d) status = dateToStatus(d);
            }

            updated.push({
                ...record,
                status,
                linkStatus,
                lastScraped: new Date().toISOString(),
            });

            const icon = linkStatus === 'verified' ? '?' : '?';
            console.log(`  ${icon} ${linkStatus.padEnd(8)} | ${record.name.substring(0, 55)}`);
        }));

        settled
            .filter((result) => result.status === 'rejected')
            .forEach((result) => {
                console.warn(`  ? Static verification worker failed: ${result.reason?.message || result.reason}`);
            });
    }

    return updated;
}

// --- STATIC RECORDS (SIDBI, INCUBATOR GRANTS, CSR) -------------------------

function getStaticRecords() {
    return [
        // SIDBI
        {
            name: 'SIDBI Revolving Fund for Technology Innovation (SRIJAN)',
            body: 'SIDBI',
            maxAward: 'Up to ?1 Crore',
            deadline: 'Rolling (Open All Year)',
            link: 'https://www.sidbi.in/en/srijan',
            description: 'Revolving fund for technology innovation supporting startups and MSMEs with debt financing.',
            category: 'national',
            status: 'Rolling',
            dataSource: 'scraper:sidbi',
            targetAudience: ['startup'],
            sectors: ['DeepTech', 'CleanTech', 'Hardware'],
            stages: ['Early Traction', 'Scale-up']
        },
        {
            name: 'SIDBI Make in India Soft Loan Fund for MSMEs (SMILE)',
            body: 'SIDBI',
            maxAward: '?25 Lakhs – ?5 Crores',
            deadline: 'Rolling (Open All Year)',
            link: 'https://www.sidbi.in/en/smile',
            description: 'Soft loan fund for MSMEs seeking to expand or modernize under the Make in India initiative.',
            category: 'national',
            status: 'Rolling',
            dataSource: 'scraper:sidbi',
            targetAudience: ['startup'],
            sectors: ['Manufacturing', 'Hardware'],
            stages: ['Early Traction', 'Scale-up']
        },
        // INCUBATOR & ACCELERATOR SPECIFIC
        {
            name: 'Atal Incubation Centre (AIC) Establishment Grant',
            body: 'Atal Innovation Mission (NITI Aayog)',
            maxAward: 'Up to ?10 Crores (over 5 years)',
            deadline: 'Varies',
            link: 'https://aim.gov.in/aic.php',
            description: 'Financial support of up to ?10 crores to eligible institutions/organizations to establish new Atal Incubation Centres.',
            category: 'national',
            status: 'Check Website',
            dataSource: 'manual:incubator',
            targetAudience: ['incubator'],
            sectors: ['Agnostic'],
            stages: ['All Stages']
        },
        {
            name: 'DST NIDHI - Technology Business Incubator (TBI)',
            body: 'DST (MoST)',
            maxAward: 'Grants & Operating Support',
            deadline: 'Varies',
            link: 'https://nidhi.dst.gov.in/nidhitbi/',
            description: 'Funding to set up TBIs and establish Seed Support Systems (SSS) which give incubators up to ?10 Cr to invest in their portfolio.',
            category: 'national',
            status: 'Check Website',
            dataSource: 'manual:incubator',
            targetAudience: ['incubator'],
            sectors: ['DeepTech', 'Tech'],
            stages: ['All Stages']
        },
        {
            name: 'MeitY TIDE 2.0 (Incubator Support)',
            body: 'MeitY Startup Hub',
            maxAward: 'Grants & Investment Support',
            deadline: 'Check Website',
            link: 'https://msh.meity.gov.in/assets/Administrative%20Approval_TIDE%202.0.pdf',
            description: 'Official MeitY TIDE 2.0 approval document outlining incubator support for ICT and electronics startups.',
            category: 'national',
            status: 'Check Website',
            dataSource: 'manual:official:meity-startuphub',
            targetAudience: ['incubator'],
            sectors: ['IT', 'Electronics', 'Tech'],
            stages: ['All Stages']
        },
        {
            name: 'SAMRIDH Scheme',
            body: 'MeitY Startup Hub',
            maxAward: 'Matched Funding Support',
            deadline: 'Check Website',
            link: 'https://msh.meity.gov.in/assets/SAMRIDH%20guidelines.pdf',
            description: 'Official SAMRIDH scheme guidelines for accelerator-led support and matched investment for startups.',
            category: 'national',
            status: 'Check Website',
            dataSource: 'manual:official:meity-startuphub',
            targetAudience: ['startup'],
            sectors: ['Digital', 'Hardware', 'Agnostic'],
            stages: ['All Stages']
        },
        {
            name: 'STPI Next Generation Incubation Scheme (NGIS) / LEAP Ahead',
            body: 'STPI (MeitY)',
            maxAward: 'Up to ?25 Lakhs',
            deadline: 'Varies by Challenge',
            link: 'https://stpi.in/index.php/en/schemes/ngis-scheme',
            description: 'Official STPI NGIS scheme page for startup incubation, seed support, and LEAP Ahead challenge tracks.',
            category: 'national',
            status: 'Check Website',
            dataSource: 'manual:official:stpi',
            targetAudience: ['incubator', 'startup'],
            sectors: ['Software', 'IT'],
            stages: ['Seed', 'Early Traction']
        },
        {
            name: 'MSME Incubation Scheme',
            body: 'Ministry of MSME',
            maxAward: 'Up to ?1 Crore',
            deadline: 'Check Website',
            link: 'https://msme.gov.in/incubation',
            description: 'Official Ministry of MSME incubation support page for innovators, host institutes, and incubation projects.',
            category: 'national',
            status: 'Check Website',
            dataSource: 'manual:official:msme',
            targetAudience: ['incubator', 'startup'],
            sectors: ['Manufacturing', 'Innovation', 'Agnostic'],
            stages: ['Prototype', 'Seed', 'Early Traction']
        },
        // CSR
        {
            name: 'India Investment Grid (IIG) – CSR Opportunities Portal',
            body: 'Invest India / Govt of India',
            maxAward: 'Varies by Corporate Partner',
            deadline: 'Rolling (Open All Year)',
            link: 'https://indiainvestmentgrid.gov.in/opportunities/csr',
            description: 'Official portal connecting Section 8 Incubators with corporate CSR mandates. Incubators can list projects to secure 2% CSR grants.',
            category: 'csr',
            status: 'Rolling',
            dataSource: 'manual:csr',
            targetAudience: ['incubator', 'startup'],
            sectors: ['Social Impact', 'Agnostic'],
            stages: ['All Stages']
        },
        // STATE SPECIFIC
        {
            name: 'Karnataka Elevate NXT 2026 (Deeptech)',
            body: 'KITS / Startup Karnataka',
            maxAward: 'Up to ?1 Crore',
            deadline: '24-02-2026',
            link: 'https://www.missionstartupkarnataka.org/elevate-karnataka',
            description: 'Grant-in-aid funding for Deeptech startups in AI, ML, IoT, Robotics, and Quantum Technologies. relocate to Karnataka if outside.',
            category: 'state',
            status: 'Check Website',
            dataSource: 'manual:state',
            targetAudience: ['startup'],
            sectors: ['DeepTech', 'AI', 'Robotics'],
            stages: ['Early Traction', 'Scale-up']
        },
        {
            name: 'Startup Odisha – Monthly Sustenance Allowance',
            body: 'MSME Dept, Odisha',
            maxAward: '?20,000 - ?22,000 / month',
            deadline: 'Rolling (Open All Year)',
            link: 'https://startupodisha.gov.in/startup-incentives/',
            description: 'One-year sustenance allowance for recognized startups. Additional 10% for women/SC/ST/PH founders.',
            category: 'state',
            status: 'Rolling',
            dataSource: 'manual:state',
            targetAudience: ['startup'],
            sectors: ['Agnostic'],
            stages: ['Ideation', 'Prototype']
        },
        {
            name: 'Startup Odisha – Product Development & Marketing Assistance',
            body: 'MSME Dept, Odisha',
            maxAward: 'Up to ?15 Lakhs',
            deadline: 'Rolling (Open All Year)',
            link: 'https://startupodisha.gov.in/startup-incentives/',
            description: 'Financial assistance for product development and marketing/publicity for recognized Odisha startups.',
            category: 'state',
            status: 'Rolling',
            dataSource: 'manual:state',
            targetAudience: ['startup'],
            sectors: ['Agnostic'],
            stages: ['Prototype', 'Seed']
        },
        // AGRITECH SPECIFIC
        {
            name: 'MANAGE-CIA RKVY-RAFTAAR Agribusiness Incubation',
            body: 'MANAGE / Dept of Agriculture',
            maxAward: 'Up to ?25 Lakhs',
            deadline: '31-03-2026',
            link: 'https://www.manage.gov.in/',
            description: 'Seed stage and idea stage funding for Agri-startups, students, and agripreneurs under the RKVY-RAFTAAR scheme.',
            category: 'national',
            status: 'Open',
            dataSource: 'manual:agritech',
            targetAudience: ['startup'],
            sectors: ['AgriTech', 'Rural Development'],
            stages: ['Ideation', 'Seed']
        },
        {
            name: 'StartupTN Agri-Tech Grant',
            body: 'StartupTN / Govt of Tamil Nadu',
            maxAward: '?10 Lakhs - ?25 Lakhs',
            deadline: '31-12-2026',
            link: 'https://startuptn.in/',
            description: 'Financial support for Agri-Tech startups focused on market expansion, innovation, or agricultural process improvement.',
            category: 'state',
            status: 'Open',
            dataSource: 'manual:agritech',
            targetAudience: ['startup'],
            sectors: ['AgriTech'],
            stages: ['Seed', 'Early Traction']
        },
        {
            name: 'Venture Challenge 9.0 (AIC Shiv Nadar University)',
            body: 'AIC-SNU',
            maxAward: '?5 Lakhs - ?1 Crore',
            deadline: '28-02-2026',
            link: 'https://aic.snu.edu.in/',
            description: 'Incubation and funding program for startups at various stages from prototype to scaling.',
            category: 'national',
            status: 'Check Website',
            dataSource: 'manual:incubator',
            targetAudience: ['startup'],
            sectors: ['Agnostic', 'Tech'],
            stages: ['Prototype', 'MVP', 'Scale-up']
        },
        {
            name: 'AFI Agri Cohort 25-26',
            body: 'Action For India',
            maxAward: 'Accelerator Support & Investment',
            deadline: '15-01-2026',
            link: 'https://actionforindia.org/',
            description: 'Accelerator program for climate-resilient farming, agri-fintech, and market linkages startups.',
            category: 'national',
            status: 'Open',
            dataSource: 'manual:agritech',
            targetAudience: ['startup'],
            sectors: ['AgriTech', 'ClimateTech'],
            stages: ['Early Traction', 'Growth']
        },
        {
            name: 'NABARD AgriSURE Fund (Direct Scheme)',
            body: 'NABVENTURES / MoA&FW',
            maxAward: 'Up to ?25 Crores',
            deadline: 'Check Website',
            link: 'https://nabventures.in/agrisure.aspx',
            description: 'Official AgriSURE Fund page for NABVENTURES-backed investment support in agriculture and allied sectors.',
            category: 'national',
            status: 'Check Website',
            dataSource: 'manual:official:nabventures',
            targetAudience: ['startup'],
            sectors: ['AgriTech', 'DeepTech'],
            stages: ['Seed', 'Early Traction', 'Scale-up']
        },
        {
            name: 'Startup Gujarat – Srujan Seed Support (S4)',
            body: 'i-Hub Gujarat',
            maxAward: '?2.5 Lakhs - ?10 Lakhs',
            deadline: '31-12-2026',
            link: 'https://ihubgujarat.in/srujan',
            description: 'Financial assistance for innovators and startups to progress from PoC to product/market stage.',
            category: 'state',
            status: 'Open',
            dataSource: 'manual:state',
            targetAudience: ['startup'],
            sectors: ['Agnostic'],
            stages: ['Prototype', 'MVP']
        },
        {
            name: 'KSUM Idea Grant / Productization Grant',
            body: 'Kerala Startup Mission',
            maxAward: '?2 Lakhs - ?12 Lakhs',
            deadline: 'Rolling (Check Cohorts)',
            link: 'https://grants.startupmission.in/',
            description: 'Grants for scaling budding entrepreneurs and startups to develop prototypes and products.',
            category: 'state',
            status: 'Rolling',
            dataSource: 'manual:state',
            targetAudience: ['startup'],
            sectors: ['Agnostic'],
            stages: ['Ideation', 'Prototype']
        }
    ];
}

// --- Data Merging -------------------------------------------------------------

/**
 * Merges scraped data into existing data.
 * Rules:
 *   - Scraped Tier-A/C entries update: status, deadline, linkStatus, link, lastScraped
 *   - Manually curated fields preserved: name, body, maxAward, description, category
 *   - Tier-B verified entries update: linkStatus, status, lastScraped only
 *   - Old entries with 'provider' field (wrong schema) are dropped
 */
function mergeData(existingData, scrapedData, verifiedStatic) {
    console.log('\n--- Merging data ---');
    const RETIRED_ALIAS_GROUPS = [
        {
            canonical: 'Atal Incubation Centre (AIC) Grant',
            aliases: ['Atal Incubation Centre (AIC) Establishment Grant'],
        },
        {
            canonical: 'NIDHI-TBI',
            aliases: ['DST NIDHI - TBI Support', 'DST NIDHI - Technology Business Incubator (TBI)'],
        },
        {
            canonical: 'India Investment Grid (IIG) – CSR Opportunities Portal',
            aliases: ['IIG - CSR Opportunities Portal'],
        },
        {
            canonical: 'MANAGE-CIA RKVY-RAFTAAR Agribusiness Incubation',
            aliases: ['MANAGE-CIA Agri-Business Incubation'],
        },
        {
            canonical: 'Startup Odisha – Product Development & Marketing Assistance',
            aliases: ['Startup Odisha – Product Development and Marketing / Publicity Assistance'],
        },
        {
            canonical: 'MeitY TIDE 2.0 (Incubator Support)',
            aliases: ['TIDE 2.0'],
        },
        {
            canonical: 'SAMRIDH Scheme',
            aliases: ['SAMRIDH Cohort 3'],
        },
    ];

    const getMergeKey = (item) => item.recordFingerprint || `${item.name || 'unknown'}::${item.body || 'unknown'}::${item.link || 'nolink'}`;
    const normalizeMergeName = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

    function getPreferenceScore(item) {
        const sourceType = item.sourceMeta?.sourceType || '';
        const sourceBoost = {
            live: 50,
            manual: 35,
            integrity: 30,
            legacy: 15,
            review: 5,
            unknown: 0,
        }[sourceType] ?? 0;
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
    existingData.forEach(item => {
        merged[getMergeKey(item)] = { ...item };
    });

    // Apply Tier-A/C scraped entries (full update except curated fields)
    const CURATED_FIELDS = ['name', 'body', 'maxAward', 'description', 'category'];
    scrapedData.forEach(newItem => {
        const existingMatch = findExistingMatch(merged, newItem);

        if (existingMatch && existingMatch.link === newItem.link) {
            // Preserve manually curated fields if they exist and are non-empty
            const preserved = {};
            CURATED_FIELDS.forEach(f => {
                if (existingMatch[f]) preserved[f] = existingMatch[f];
            });
            if (getMergeKey(existingMatch) !== getMergeKey(newItem)) {
                delete merged[getMergeKey(existingMatch)];
            }
            merged[getMergeKey(newItem)] = { ...existingMatch, ...newItem, ...preserved };
        } else if (existingMatch) {
            // Link changed — rekey
            delete merged[getMergeKey(existingMatch)];
            const preserved = {};
            CURATED_FIELDS.forEach(f => {
                if (existingMatch[f]) preserved[f] = existingMatch[f];
            });
            merged[getMergeKey(newItem)] = { ...existingMatch, ...newItem, ...preserved };
        } else {
            merged[getMergeKey(newItem)] = newItem;
        }
    });

    // Apply Tier-B verified status (only update linkStatus, status, lastScraped)
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

    // -- GHOST DATA KILLER (Strict Sync) --
    // If a record was historically sourced by a live scraper (e.g. scraper:birac),
    // but the scraper ran today and didn't return it, it means the call was removed from the live site.
    const activeScrapedKeys = new Set(scrapedData.map((item) => getMergeKey(item)));
    Object.values(merged).forEach(item => {
        if (item.dataSource && item.dataSource.startsWith('scraper:') && !activeScrapedKeys.has(getMergeKey(item))) {
            // The item has vanished from the source portal.
            item.status = 'Closed';
            item.deadline = 'Expired / Removed from source';
        }
    });

    // Collapse known legacy aliases once a canonical live/offical record exists.
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

    // Collapse same-link title variants caused by punctuation/ellipsis differences.
    const groupedKeys = new Map();
    Object.entries(merged).forEach(([key, item]) => {
        const normalizedName = normalizeMergeName(item.name);
        const groupKey = `${item.link || 'nolink'}::${item.body || 'nobody'}::${normalizedName}`;
        if (!groupedKeys.has(groupKey)) {
            groupedKeys.set(groupKey, []);
        }
        groupedKeys.get(groupKey).push({ key, item });
    });

    groupedKeys.forEach((entries) => {
        if (entries.length < 2) return;

        entries.sort((a, b) => getPreferenceScore(b.item) - getPreferenceScore(a.item));
        const winner = entries[0];

        entries.slice(1).forEach(({ key }) => {
            if (key !== winner.key) {
                delete merged[key];
            }
        });
    });

    // If a core/live record exists for a normalized opportunity name, drop weaker review/legacy shadows.
    const nameGroups = new Map();
    Object.entries(merged).forEach(([key, item]) => {
        const normalizedName = normalizeMergeName(item.name);
        if (!normalizedName) return;
        if (!nameGroups.has(normalizedName)) {
            nameGroups.set(normalizedName, []);
        }
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

// -- Strategic Knowledge Extraction Engine -------------------------------------
async function generateStrategicReport(data, audience = 'startup') {
    let active = data.filter(x => x.status !== 'Closed');

    // Filter active dataset based on audience preference for the report
    if (audience === 'incubator') {
        active = active.filter(x => x.targetAudience?.includes('incubator'));
    } else {
        // Startup report leans heavily on capital amount or general availability
        active = active.filter(x => !x.targetAudience?.includes('incubator') || x.targetAudience?.includes('startup'));
    }

    const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // -- Logic-based analytical summary (The Heuristic Fallback) --
    const analyzeLogic = () => {
        const sectors = {
            'Incubator R&D Hubs': active.filter(x => /nidhi|tide|samridh|bionest/i.test((x.name || '') + (x.body || '') + (x.description || ''))).length,
            'Ecosystem Enablers': active.filter(x => /ecosystem|accelerator|scale|grant/i.test((x.name || '') + (x.body || '') + (x.description || ''))).length,
            'CSR / Institutional': active.filter(x => /csr|foundation|hdfc|sbi/i.test((x.name || '') + (x.body || '') + (x.description || ''))).length,
            'General Tech / Startups': active.filter(x => /startup|seed/i.test((x.name || '') + (x.body || '') + (x.description || ''))).length
        };
        const topSector = Object.entries(sectors).sort((a, b) => b[1] - a[1])[0];
        const incubatorCount = active.filter(x => x.targetAudience?.includes('incubator')).length;
        const closingSoon = active.filter(x => x.status === 'Closing Soon').length;

        if (audience === 'incubator') {
            let executiveSummary = `As of ${dateStr}, the Indian incubator funding ecosystem shows a ${incubatorCount > 5 ? 'robust' : 'moderate'} activity level with ${incubatorCount} open programs directly supporting Section 8 operations. `;
            if (topSector && topSector[1] > 2) executiveSummary += `There is a significant tactical focus on ${topSector[0]}, which accounts for a major portion of current open calls. `;
            if (closingSoon > 0) executiveSummary += `Urgency is currently elevated with ${closingSoon} ecosystem programs entering their final week of application. `;

            return {
                title: `ABIF Incubator Funding Analysis ${new Date().getFullYear()}`,
                generatedAt: new Date().toISOString(),
                executiveSummary,
                keyTrends: [
                    {
                        trend: "Section 8 Operational Support",
                        detail: `${incubatorCount} active programs currently offer direct support for incubator operations, HR, or cohort management.`
                    },
                    {
                        trend: "Sectoral Dominance",
                        detail: `${topSector ? topSector[0] : 'General Tech'} remains a primary driver of new capital calls in this current cycle.`
                    },
                    {
                        trend: "Strategic Shifts",
                        detail: incubatorCount > 5 ? "Expansion noted in central government calls (BIRAC/DST/MeitY) for deep-science R&D infrastructure." : "Stable funding landscape with a pivot toward CSR and State-specific rolling grants for enablers."
                    }
                ],
                actionableRecommendations: [
                    closingSoon > 0 ? `Immediately prioritize "Closing Soon" calls from ${active.find(x => x.status === 'Closing Soon' && x.targetAudience?.includes('incubator'))?.body || 'Government Providers'}.` : "Begin drafting concept notes for the upcoming summer Q2 capability expansion cycles.",
                    "Review MeitY TIDE 2.0 / SAMRIDH eligibility for institutional setup and matched funding access.",
                    "Conduct technical readiness and impact audits for impending CSR matchmaking calls."
                ],
                briefingFooter: `Synthesized by ABIF Research Engine v2.1 • Logic Fallback Mode • Verified ${timestamp}`
            };
        } else {
            let executiveSummary = `As of ${dateStr}, the Indian startup funding ecosystem maintains a steady pace with ${active.length} active opportunities. `;
            if (topSector && topSector[1] > 2) executiveSummary += `A major concentration of capital is directed towards ${topSector[0]}. `;
            if (closingSoon > 0) executiveSummary += `Founders should note ${closingSoon} grants closing imminently. `;

            return {
                title: `ABIF Startup Funding Analysis ${new Date().getFullYear()}`,
                generatedAt: new Date().toISOString(),
                executiveSummary,
                keyTrends: [
                    {
                        trend: "Capital Concentration",
                        detail: `${active.length} active programs provide direct equity free capital or seed support to startups.`
                    },
                    {
                        trend: "Sectoral Focus",
                        detail: `${topSector ? topSector[0] : 'General Tech'} dominates current funding priorities for startups.`
                    },
                    {
                        trend: 'Ecosystem Velocity',
                        detail: closingSoon > 5 ? "High urgency cycle; multiple central grants closing soon." : "Steady state funding; rolling grants provide continuous application windows."
                    }
                ],
                actionableRecommendations: [
                    closingSoon > 0 ? `Fast-track applications for the ${closingSoon} grants closing this week.` : "Prepare investor readiness dossiers for upcoming state grants.",
                    "Match startup stage with grant requirements carefully to prevent high rejection rates.",
                    "Leverage rolling state grants as a constant baseline for early-stage portfolio companies."
                ],
                briefingFooter: `Synthesized by ABIF Research Engine v2.1 • Logic Fallback Mode • Verified ${timestamp}`
            };
        }
    };

    // -- Real AI: Gemini Integration --
    if (genAI) {
        console.log('\n--- Consulting Gemini (Deep Intelligence) ---');
        try {
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: { responseMimeType: "application/json" }
            });

            // Extract just the core info to keep token count low
            const subset = active.map(o => ({
                name: o.name,
                provider: o.body,
                award: o.maxAward,
                category: o.category,
                deadline: o.deadline,
                status: o.status
            })).slice(0, 50);

            const prompt = audience === 'incubator'
                ? `You are a strategic intelligence analyst for ABIF, advising Section 8 Incubators and Host Institutes in India.
            Your goal is to identify funding that supports INCREASING INCUBATOR EFFICIENCY, OPERATIONAL RELIABILITY, and ECOSYSTEM IMPACT, not just standalone startup funding.
            Analyze these ${subset.length} active funding opportunities: ${JSON.stringify(subset)}
            
            Generate a Strategic Research Report expressly for Incubator Managers and Section 8 Directors.
            Your response must be a JSON object with this EXACT schema:
            {
                "title": "ABIF Incubator Funding Analysis ${new Date().getFullYear()}",
                "generatedAt": "ISO Timestamp",
                "executiveSummary": "A human-like, professional 2-3 sentence overview of the current funding climate specifically highlighting opportunities for incubator capacity building, operational grants, and ecosystem support programs (like NIDHI, BioNEST, TIDE 2.0).",
                "keyTrends": [
                    {"trend": "Trend Name", "detail": "Detailed insight about what providers like BIRAC/DST/MeitY are offering to incubators for infrastructure, operational support, or HR."}
                ],
                "actionableRecommendations": [
                    "Recommendation 1 starting with a verb (e.g. Audit your NIDHI PRAYAS eligibility to maintain operational influx)",
                    "Recommendation 2 starting with a verb",
                    "Recommendation 3 starting with a verb"
                ],
                "briefingFooter": "Synthesized by ABIF Neural Engine (Powered by Gemini 2.5 Flash) • Verified ${timestamp}"
            }
            
            Be insightful. Mention specific incubator support programs like MeitY TIDE, DST NIDHI, or BIRAC BioNEST if they are active. 
            Prioritize highlighting opportunities that provide direct operational funding to setup Section 8 infrastructure.`
                : `You are a strategic intelligence analyst for ABIF, advising early-stage deep-tech and agritech founders in India.
            Your goal is to identify funding that supports STARTUP RUNWAY, PRODUCT DEVELOPMENT, and MARKET ENTRY.
            Analyze these ${subset.length} active funding opportunities: ${JSON.stringify(subset)}
            
            Generate a Strategic Research Report expressly for Startup Founders.
            Your response must be a JSON object with this EXACT schema:
            {
                "title": "ABIF Startup Funding Analysis ${new Date().getFullYear()}",
                "generatedAt": "ISO Timestamp",
                "executiveSummary": "A human-like, professional 2-3 sentence overview of the current startup funding climate highlighting seed capital, equity-free grants, and major accelerators.",
                "keyTrends": [
                    {"trend": "Trend Name", "detail": "Detailed insight about where the capital is flowing, e.g., sectors receiving the most grants."}
                ],
                "actionableRecommendations": [
                    "Recommendation 1 starting with a verb (e.g. Accelerate applications for state-sponsored seed funds)",
                    "Recommendation 2 starting with a verb",
                    "Recommendation 3 starting with a verb"
                ],
                "briefingFooter": "Synthesized by ABIF Neural Engine (Powered by Gemini 2.5 Flash) • Verified ${timestamp}"
            }
            
            Be insightful. Help founders prioritize their grant applications based on closing dates and award sizes.`;

            const result = await model.generateContent(prompt);
            const rawResponse = result.response.text();

            // Clean markdown if present and parse
            const jsonStr = rawResponse.replace(/```json|```/g, "").trim();
            const geminiReport = JSON.parse(jsonStr);

            console.log('  ? Gemini synthesis complete.');
            return geminiReport;
        } catch (err) {
            console.error('  ? Gemini API failed. Falling back to Logic Engine.', err.message);
            return analyzeLogic();
        }
    }

    // Default to logic if no API key
    return analyzeLogic();
}
// --- Main ---------------------------------------------------------------------

async function runScrapers() {
    console.log('-----------------------------------------------');
    console.log('  ABIF Funding Radar - Automated Scraper');
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
        console.error('? Failed to launch Puppeteer:', err.message);
        return; // don't exit(1) — let process end naturally with code 0
    }

    // -- Tier A: Real live scrapers --
    const biracRun = await collectSourceRecords({
        browser,
        sourceId: 'scraper:birac',
        datasetSourceId: 'scraper:birac',
        label: 'BIRAC live collector',
        collectionMode: 'live_dom',
        collector: scrapeBirac,
    });
    const dstRun = await collectSourceRecords({
        browser,
        sourceId: 'scraper:dst',
        datasetSourceId: 'scraper:dst',
        label: 'DST live collector',
        collectionMode: 'live_dom',
        collector: scrapeDST,
    });
    healthRuns.push(biracRun.run, dstRun.run);
    const allScraped = [...biracRun.records, ...dstRun.records];

    // -- Tier C: React SPA scrapers --
    const sisfsRun = await collectSourceRecords({
        browser,
        sourceId: 'scraper:sisfs',
        datasetSourceId: 'scraper:sisfs',
        label: 'SISFS SPA collector',
        collectionMode: 'live_spa',
        collector: scrapeSISFS,
    });
    const sbifRun = await collectSourceRecords({
        browser,
        sourceId: 'scraper:sbif',
        datasetSourceId: 'scraper:sbif',
        label: 'SBI Foundation SPA collector',
        collectionMode: 'live_spa',
        collector: scrapeSBIFoundation,
    });
    healthRuns.push(sisfsRun.run, sbifRun.run);
    allScraped.push(...sisfsRun.records, ...sbifRun.records);

    const nidhiRun = await collectSourceRecords({
        browser,
        sourceId: 'scraper:nidhi',
        datasetSourceId: 'scraper:nidhi',
        label: 'NIDHI programme collector',
        collectionMode: 'official_scheme_page',
        collector: scrapeNidhiPrograms,
    });
    const aimRun = await collectSourceRecords({
        browser,
        sourceId: 'scraper:aim',
        datasetSourceId: 'scraper:aim',
        label: 'AIM AIC collector',
        collectionMode: 'official_scheme_page',
        collector: scrapeAIMAIC,
    });
    const startupOdishaRun = await collectSourceRecords({
        browser,
        sourceId: 'scraper:startupodisha',
        datasetSourceId: 'scraper:startupodisha',
        label: 'Startup Odisha incentives collector',
        collectionMode: 'official_policy_page',
        collector: scrapeStartupOdishaIncentives,
    });
    const manageRun = await collectSourceRecords({
        browser,
        sourceId: 'scraper:manage',
        datasetSourceId: 'scraper:manage',
        label: 'MANAGE-CIA programme collector',
        collectionMode: 'official_program_page',
        collector: scrapeManageCIA,
    });
    const iigRun = await collectSourceRecords({
        browser,
        sourceId: 'scraper:iig',
        datasetSourceId: 'scraper:iig',
        label: 'IIG CSR collector',
        collectionMode: 'official_portal_page',
        collector: scrapeIIGCSR,
    });
    healthRuns.push(nidhiRun.run, aimRun.run, startupOdishaRun.run, manageRun.run, iigRun.run);
    allScraped.push(
        ...nidhiRun.records,
        ...aimRun.records,
        ...startupOdishaRun.records,
        ...manageRun.records,
        ...iigRun.records,
    );

    // -- Add SIDBI static records NOW — before building scrapedLinks --
    // This ensures SIDBI is explicitly excluded from Tier-B URL verification
    // (since its URLs are stable and we don't need to ping them).
    const sidbiSeedRun = captureRecordSet({
        sourceId: 'seed:sidbi',
        datasetSourceId: 'scraper:sidbi',
        label: 'SIDBI seeded records',
        collectionMode: 'static_seed',
        rawRecords: getStaticRecords().filter(r => r.dataSource === 'scraper:sidbi'),
    });
    healthRuns.push(sidbiSeedRun.run);
    allScraped.push(...sidbiSeedRun.records);

    await browser.close();
    console.log(`\n  Tier A+C scraped: ${allScraped.length} entries`);

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
    const existingNormalizationRun = captureRecordSet({
        sourceId: 'dataset:existing',
        label: 'Existing dataset normalization',
        collectionMode: 'existing_dataset',
        rawRecords: existingData,
    });
    healthRuns.push(existingNormalizationRun.run);
    existingData = existingNormalizationRun.records;

    // -- Inject Incubator/CSR static targets into existingData so Tier B verifies them --
    const targetStaticSeedRun = captureRecordSet({
        sourceId: 'seed:manual-static',
        label: 'Manual official seed records',
        collectionMode: 'static_seed',
        rawRecords: getStaticRecords().filter(r => r.dataSource !== 'scraper:sidbi'),
    });
    healthRuns.push(targetStaticSeedRun.run);
    const targetStaticRecords = targetStaticSeedRun.records;

    // Merge new static records into existingData if they aren't already there
    targetStaticRecords.forEach(tsr => {
        if (!existingData.some(e =>
            e.recordFingerprint === tsr.recordFingerprint ||
            (e.name === tsr.name && e.body === tsr.body) ||
            (e.link === tsr.link && e.name === tsr.name),
        )) {
            existingData.push(tsr);
        }
    });

    // -- Tier B: Verify all static records (those without lastScraped or not covered by Tier A/C) --
    const scrapedLinks = new Set(allScraped.map(x => x.link));
    const staticToVerify = existingData.filter(item => {
        if (item.dataSource?.startsWith('scraper:') && item.dataSource !== 'scraper:sidbi') return false;
        return !scrapedLinks.has(item.link);
    });

    // Launch a new browser instance for link verification
    let verifyBrowser;
    let verifiedStatic = [];
    let verifyError = null;
    try {
        verifyBrowser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        verifiedStatic = await verifyStaticRecords(verifyBrowser, staticToVerify);
    } catch (e) {
        console.error('  ? Link verification browser failed:', e.message);
        verifyError = e.message;
        verifiedStatic = staticToVerify; // keep as-is
    } finally {
        if (verifyBrowser) await verifyBrowser.close();
    }
    const verifiedStaticRun = captureRecordSet({
        sourceId: 'verify:static-links',
        label: 'Static record link verification',
        collectionMode: 'link_verification',
        rawRecords: verifiedStatic,
        error: verifyError,
    });
    healthRuns.push(verifiedStaticRun.run);
    verifiedStatic = verifiedStaticRun.records;

    // -- Merge everything --
    if (allScraped.length < 5) {
        const failureHealth = buildSourceHealthReport({ runs: healthRuns, finalData: [] });
        fs.writeFileSync(SOURCE_HEALTH_FILE, JSON.stringify(failureHealth, null, 2));
        console.error(`\n  ? CRITICAL FAILURE: Scrapers only yielded ${allScraped.length} entries (expected 5+).`);
        console.error('  This indicates a fundamental block (firewall, layout change, headless detection).');
        console.error('  Failing the CI/CD run to prevent silent data rot.');
        process.exit(1);
    }

    const mergedData = mergeData(existingData, allScraped, verifiedStatic);
    const finalNormalizationRun = captureRecordSet({
        sourceId: 'dataset:final',
        label: 'Final dataset normalization',
        collectionMode: 'merged_dataset',
        rawRecords: mergedData,
    });
    healthRuns.push(finalNormalizationRun.run);
    const finalData = finalNormalizationRun.records;

    // -- Generate AI Strategic Report --
    const reportPath = path.join(PUBLIC_DATA_DIR, 'research_report.json');
    const strategicReportIncubator = await generateStrategicReport(finalData, 'incubator');
    const strategicReportStartup = await generateStrategicReport(finalData, 'startup');

    const combinedReport = {
        incubator: strategicReportIncubator,
        startup: strategicReportStartup
    };

    fs.writeFileSync(reportPath, JSON.stringify(combinedReport, null, 2));

    // -- Write source health artifact --
    const sourceHealth = buildSourceHealthReport({ runs: healthRuns, finalData });
    fs.writeFileSync(SOURCE_HEALTH_FILE, JSON.stringify(sourceHealth, null, 2));

    // -- Write output --
    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2));
    const broken = finalData.filter(x => x.linkStatus === 'broken').length;
    const verified = finalData.filter(x => x.linkStatus === 'verified').length;
    const closing = finalData.filter(x => x.status === 'Closing Soon').length;
    const inferred = finalData.filter(x => x.sourceMeta?.inferredDataSource).length;
    const lowConfidence = finalData.filter(x => typeof x.confidence === 'number' && x.confidence < 0.55).length;

    console.log('\n-----------------------------------------------');
    console.log(`  ? Done! Saved ${finalData.length} opportunities.`);
    console.log(`    Verified links: ${verified} | Broken: ${broken} | Closing Soon: ${closing}`);
    console.log(`    Inferred provenance: ${inferred} | Low confidence: ${lowConfidence}`);
    console.log('-----------------------------------------------\n');
}

runScrapers();

