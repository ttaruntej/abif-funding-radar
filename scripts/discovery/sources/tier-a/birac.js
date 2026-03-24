import * as cheerio from 'cheerio';
import { setupPageInterception, chunkArray, withRetry } from '../../utils/puppeteer-helpers.js';
import { cleanName, isUsableOpportunityName } from '../../utils/string-helpers.js';
import { formatDeadline, determineStatus } from '../../utils/date-helpers.js';

export async function scrapeBirac(browser) {
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
                    console.warn(`    ⚠ Detail page failed for "${name}": ${e.message}`);
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
                console.log(`  ✓ ${status.padEnd(12)} | ${name.substring(0, 55)}`);
            }));
        }
    } catch (e) {
        console.error('  ❌ BIRAC scraper failed:', e.message);
    }

    return results;
}
