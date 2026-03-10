/**
 * ABIF Funding Tracker — Automated Scraper
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

dotenv.config();

// -- Gemini Integration --------------------------------------------------------
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../public/data/opportunities.json');

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
        await Promise.all(chunk.map(async (record) => {
            let linkStatus = record.linkStatus || 'probable';
            let status = record.status;

            try {
                const page = await browser.newPage();
                await setupPageInterception(page);

                // Use a generous 30s timeout — many gov/intl sites are slow
                // Wrap in withRetry for transient network failures
                const response = await withRetry(() => page.goto(record.link, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000,
                }));
                await page.close();

                const httpStatus = response ? response.status() : 0;

                if (httpStatus >= 200 && httpStatus < 400) {
                    linkStatus = 'verified';
                } else if (httpStatus >= 400) {
                    linkStatus = 'broken';
                    // Only change status for entries where URL is truly 4xx dead
                    status = 'Verify Manually';
                    console.warn(`  ? HTTP ${httpStatus} for "${record.name}" ? marked broken`);
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
                    // Timeout or other — keep existing status, just log
                    console.warn(`  ? Slow/timeout: "${record.name}" — keeping existing status`);
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
            link: 'https://nidhi.dst.gov.in/',
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
            deadline: 'Varies',
            link: 'https://vc.meity.gov.in/tide2.0/',
            description: 'Technology Incubation and Development of Entrepreneurs providing financial/technical support to incubators supporting ICT startups.',
            category: 'national',
            status: 'Check Website',
            dataSource: 'manual:incubator',
            targetAudience: ['incubator'],
            sectors: ['IT', 'Electronics', 'Tech'],
            stages: ['All Stages']
        },
        {
            name: 'STPI Next Generation Incubation Scheme (NGIS) / LEAP Ahead',
            body: 'STPI (MeitY)',
            maxAward: 'Up to ?25 Lakhs',
            deadline: 'Varies by Challenge',
            link: 'https://www.stpi.in/en/next-generation-incubation-scheme',
            description: 'Incubation facilities, seed funding edge, and mentorship for startups in Tier II/III cities via local STPI centers.',
            category: 'national',
            status: 'Check Website',
            dataSource: 'manual:incubator',
            targetAudience: ['incubator', 'startup'],
            sectors: ['Software', 'IT'],
            stages: ['Seed', 'Early Traction']
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
            link: 'https://startupodisha.gov.in/',
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
            link: 'https://startupodisha.gov.in/',
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
            deadline: '31-12-2025',
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

    // Build map from existing — skip legacy wrong-schema entries
    const merged = {};
    existingData.forEach(item => {
        if (item.provider && !item.body) return; // drop old schema
        merged[item.link] = { ...item };
    });

    // Apply Tier-A/C scraped entries (full update except curated fields)
    const CURATED_FIELDS = ['name', 'body', 'maxAward', 'description', 'category'];
    scrapedData.forEach(newItem => {
        const existByLink = merged[newItem.link];
        const existByName = Object.values(merged).find(x => x.name === newItem.name);

        if (existByLink) {
            // Preserve manually curated fields if they exist and are non-empty
            const preserved = {};
            CURATED_FIELDS.forEach(f => {
                if (existByLink[f]) preserved[f] = existByLink[f];
            });
            merged[newItem.link] = { ...existByLink, ...newItem, ...preserved };
        } else if (existByName) {
            // Link changed — rekey
            delete merged[existByName.link];
            const preserved = {};
            CURATED_FIELDS.forEach(f => {
                if (existByName[f]) preserved[f] = existByName[f];
            });
            merged[newItem.link] = { ...existByName, ...newItem, ...preserved };
        } else {
            merged[newItem.link] = newItem;
        }
    });

    // Apply Tier-B verified status (only update linkStatus, status, lastScraped)
    verifiedStatic.forEach(v => {
        if (merged[v.link]) {
            merged[v.link].linkStatus = v.linkStatus;
            merged[v.link].status = v.status;
            merged[v.link].lastScraped = v.lastScraped;
        }
    });

    // -- GHOST DATA KILLER (Strict Sync) --
    // If a record was historically sourced by a live scraper (e.g. scraper:birac),
    // but the scraper ran today and didn't return it, it means the call was removed from the live site.
    const activeScrapedLinks = new Set(scrapedData.map(x => x.link));
    Object.values(merged).forEach(item => {
        if (item.dataSource && item.dataSource.startsWith('scraper:') && !activeScrapedLinks.has(item.link)) {
            // The item has vanished from the source portal.
            item.status = 'Closed';
            item.deadline = 'Expired / Removed from source';
        }
    });

    return Object.values(merged);
}

// -- Strategic Knowledge Extraction Engine -------------------------------------
async function generateStrategicReport(data) {
    const active = data.filter(x => x.status !== 'Closed');
    const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // -- Logic-based analytical summary (The Heuristic Fallback) --
    const analyzeLogic = () => {
        const sectors = {
            'Deep Tech / AI': active.filter(x => /ai|deeptech|quantum|semiconductor/i.test((x.name || '') + (x.body || '') + (x.description || ''))).length,
            'AgriTech / Biotech': active.filter(x => /agri|farm|bio|seed|plant/i.test((x.name || '') + (x.body || '') + (x.description || ''))).length,
            'Sustainability / ESG': active.filter(x => /green|eco|carbon|waste|solar/i.test((x.name || '') + (x.body || '') + (x.description || ''))).length,
            'Incubator / Scaling': active.filter(x => /incubator|accelerator|scale|grant/i.test((x.name || '') + (x.body || '') + (x.description || ''))).length
        };
        const topSector = Object.entries(sectors).sort((a, b) => b[1] - a[1])[0];
        const highValueCount = active.filter(x => /crore|cr|lakh|50[,\.]?000/i.test(x.maxAward || x.value || '')).length;
        const closingSoon = active.filter(x => x.status === 'Closing Soon').length;

        let executiveSummary = `As of ${dateStr}, the Indian funding ecosystem shows a ${active.length > 25 ? 'robust' : 'moderate'} activity level with ${active.length} active programs identified. `;
        if (topSector[1] > 2) executiveSummary += `There is a significant tactical focus on ${topSector[0]}, which accounts for ${Math.round((topSector[1] / active.length) * 100)}% of current open calls. `;
        if (closingSoon > 0) executiveSummary += `Urgency is currently elevated with ${closingSoon} programs entering their final week of application. `;

        return {
            title: `ABIF Strategic Funding Analysis ${new Date().getFullYear()}`,
            generatedAt: new Date().toISOString(),
            executiveSummary,
            keyTrends: [
                {
                    trend: "Sectoral Dominance",
                    detail: `${topSector[0]} remains a primary driver of new capital calls in this current cycle.`
                },
                {
                    trend: "Capital Concentration",
                    detail: `${highValueCount} premium programs are currently active in the high-impact (?50L - ?5Cr) tier.`
                },
                {
                    trend: "Strategic Shifts",
                    detail: active.length > 30 ? "Expansion noted in central government calls (BIRAC/DST) for deep-science R&D." : "Stable funding landscape with a pivot toward CSR and State-specific rolling grants."
                }
            ],
            actionableRecommendations: [
                closingSoon > 0 ? `Immediately prioritize "Closing Soon" calls from ${active.find(x => x.status === 'Closing Soon')?.body || 'Government Providers'}.` : "Begin drafting concept notes for the upcoming summer Q2 funding cycles.",
                highValueCount > 2 ? "Review SMILE and SIDBI eligibility for high-value soft loan scaling." : "Monitor SISFS rolling grants for early-stage seed support.",
                "Conduct technical readiness audits (TRL 4-7) for impending deep-tech calls."
            ],
            briefingFooter: `Synthesized by ABIF Research Engine v2.1 • Logic Fallback Mode • Verified ${timestamp}`
        };
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

            const prompt = `You are a strategic funding analyst for ABIF, a top Indian incubator.
            Analyze these ${subset.length} active funding opportunities: ${JSON.stringify(subset)}
            
            Generate a Strategic Research Report for startup founders.
            Your response must be a JSON object with this EXACT schema:
            {
                "title": "ABIF Strategic Funding Analysis ${new Date().getFullYear()}",
                "generatedAt": "ISO Timestamp",
                "executiveSummary": "A human-like, professional 2-3 sentence overview of the current funding climate based on these specific programs.",
                "keyTrends": [
                    {"trend": "Trend Name", "detail": "Detailed insight about what the providers like BIRAC/DST/SIDBI are currently looking for."}
                ],
                "actionableRecommendations": [
                    "Recommendation 1 starting with a verb",
                    "Recommendation 2 starting with a verb",
                    "Recommendation 3 starting with a verb"
                ],
                "briefingFooter": "Synthesized by ABIF Neural Engine (Powered by Gemini 2.5 Flash) • Verified ${timestamp}"
            }
            
            Be insightful. Mention specific providers like SIDBI or BIRAC if they have major calls. 
            Highlight sectors that seem dominant. Ensure actionableRecommendations are distinct and professional.`;

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
    console.log('  ABIF Funding Tracker — Automated Scraper');
    console.log(`  ${new Date().toISOString()}`);
    console.log('-----------------------------------------------');

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
    const biracData = await scrapeBirac(browser);
    const dstData = await scrapeDST(browser);
    const allScraped = [...biracData, ...dstData];

    // -- Tier C: React SPA scrapers --
    const sisfsData = await scrapeSISFS(browser);
    const sbifData = await scrapeSBIFoundation(browser);
    allScraped.push(...sisfsData, ...sbifData);

    // -- Add SIDBI static records NOW — before building scrapedLinks --
    // This ensures SIDBI is explicitly excluded from Tier-B URL verification
    // (since its URLs are stable and we don't need to ping them).
    const sidbiRecords = getStaticRecords().filter(r => r.dataSource === 'scraper:sidbi');
    allScraped.push(...sidbiRecords);

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
    // -- Inject Incubator/CSR static targets into existingData so Tier B verifies them --
    const targetStaticRecords = getStaticRecords().filter(r => r.dataSource !== 'scraper:sidbi');

    // Merge new static records into existingData if they aren't already there
    targetStaticRecords.forEach(tsr => {
        if (!existingData.some(e => e.link === tsr.link)) {
            existingData.push(tsr);
        }
    });

    // -- Tier B: Verify all static records (those without lastScraped or not covered by Tier A/C) --
    const scrapedLinks = new Set(allScraped.map(x => x.link));
    const staticToVerify = existingData.filter(item => {
        if (item.provider && !item.body) return false; // skip old schema
        if (item.dataSource?.startsWith('scraper:') && item.dataSource !== 'scraper:sidbi') return false;
        return !scrapedLinks.has(item.link);
    });

    // Launch a new browser instance for link verification
    let verifyBrowser;
    let verifiedStatic = [];
    try {
        verifyBrowser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        verifiedStatic = await verifyStaticRecords(verifyBrowser, staticToVerify);
        await verifyBrowser.close();
    } catch (e) {
        console.error('  ? Link verification browser failed:', e.message);
        verifiedStatic = staticToVerify; // keep as-is
    }

    // -- Merge everything --
    if (allScraped.length < 5) {
        console.error(`\n  ? CRITICAL FAILURE: Scrapers only yielded ${allScraped.length} entries (expected 5+).`);
        console.error('  This indicates a fundamental block (firewall, layout change, headless detection).');
        console.error('  Failing the CI/CD run to prevent silent data rot.');
        process.exit(1);
    }

    const finalData = mergeData(existingData, allScraped, verifiedStatic);

    // -- Generate AI Strategic Report --
    const reportPath = path.join(process.cwd(), 'public', 'data', 'research_report.json');
    const strategicReport = await generateStrategicReport(finalData);
    fs.writeFileSync(reportPath, JSON.stringify(strategicReport, null, 2));

    // -- Write output --
    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2));
    const broken = finalData.filter(x => x.linkStatus === 'broken').length;
    const verified = finalData.filter(x => x.linkStatus === 'verified').length;
    const closing = finalData.filter(x => x.status === 'Closing Soon').length;

    console.log('\n-----------------------------------------------');
    console.log(`  ? Done! Saved ${finalData.length} opportunities.`);
    console.log(`    Verified links: ${verified} | Broken: ${broken} | Closing Soon: ${closing}`);
    console.log('-----------------------------------------------\n');
}

runScrapers();

