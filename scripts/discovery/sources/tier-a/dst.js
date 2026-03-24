import * as cheerio from 'cheerio';
import { setupPageInterception, chunkArray, withRetry } from '../../utils/puppeteer-helpers.js';
import { cleanName, isUsableOpportunityName } from '../../utils/string-helpers.js';
import { formatDeadline, extractDeadlineDate, dateToStatus } from '../../utils/date-helpers.js';

export async function scrapeDST(browser) {
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
                    console.warn(`    ⚠ DST detail page failed for "${name}": ${e.message}`);
                }

                // Determine category: if it mentions "India-France", "Indo-", etc. → international
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
                console.log(`  ✓ ${status.padEnd(12)} | ${name.substring(0, 55)}`);
            }));
        }
    } catch (e) {
        console.error('  ❌ DST scraper failed:', e.message);
    }

    return results;
}
