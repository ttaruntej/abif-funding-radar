import * as cheerio from 'cheerio';

export async function scrapeSISFS(browser) {
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

        console.log(`  ✓ SISFS status: ${status}`);
        return [
            {
                name: 'Startup India Seed Fund Scheme (SISFS) for Startups',
                body: 'DPIIT / Startup India',
                maxAward: 'Up to ₹50 Lakhs',
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
                maxAward: 'Up to ₹5 Crores',
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
        console.error('  ❌ SISFS scraper failed:', e.message);
        return [];
    }
}
