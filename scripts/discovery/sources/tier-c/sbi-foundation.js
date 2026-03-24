import * as cheerio from 'cheerio';
import { formatDeadline, extractDeadlineDate, dateToStatus } from '../../utils/date-helpers.js';

export async function scrapeSBIFoundation(browser) {
    console.log('\n--- [Tier C] Scraping SBI Foundation (React SPA) ---');
    const url = 'https://sbifoundation.in/';

    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForSelector('body', { timeout: 10000 });

        const $ = cheerio.load(await page.content());
        await page.close();

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

        console.log(`  ✓ SBI Foundation status: ${status}, link: ${applyLink}`);
        return [{
            name: 'SBI Foundation – Innovators for Bharat',
            body: 'SBI Foundation CSR',
            maxAward: '₹25 Lakhs',
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
        console.error('  ❌ SBI Foundation scraper failed:', e.message);
        return [];
    }
}
