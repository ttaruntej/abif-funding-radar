import * as cheerio from 'cheerio';
import { setupPageInterception, withRetry } from '../../utils/puppeteer-helpers.js';
import { normalizeTextContent, clipText, extractAnchorHref, findLongestParagraph, extractTextBlock } from '../../utils/string-helpers.js';

export async function scrapeNidhiPrograms() {
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
                /click here|centres|apply|call-for-proposals/i.test(text)
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
            console.log(`  ✓ ${pageConfig.status.padEnd(12)} | ${pageConfig.name}`);
        } catch (e) {
            console.error(`  ❌ NIDHI collector failed for ${pageConfig.url}:`, e.message);
        }
    }

    return results;
}

export async function scrapeAIMAIC() {
    console.log('\n--- [Tier B+] Scraping AIM AIC ---');
    const url = 'https://aim.gov.in/aic.php';

    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        const html = await response.text();
        const $ = cheerio.load(html);
        const description = clipText(findLongestParagraph($), 260);

        console.log('  ✓ Check Website | Atal Incubation Centre (AIC) Grant');
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
        console.error('  ❌ AIM AIC scraper failed:', e.message);
        return [];
    }
}

export async function scrapeStartupOdishaIncentives() {
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
                .replace(/&amp;/g, '&')
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
            console.log(`  ✓ ${item.status.padEnd(12)} | ${item.name}`);
        });

        return results;
    } catch (e) {
        console.error('  ❌ Startup Odisha scraper failed:', e.message);
        return [];
    }
}

export async function scrapeManageCIA() {
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
            console.log(`  ✓ ${program.status.padEnd(12)} | ${program.name}`);
        } catch (e) {
            console.error(`  ❌ MANAGE-CIA collector failed for ${program.url}:`, e.message);
        }
    }

    return results;
}

export async function scrapeIIGCSR(browser) {
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
            console.warn(`  ⚠ IIG raw fetch fallback triggered: ${rawFetchError.message}`);
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
            console.warn('  ⚠ IIG collector could not locate the Technology Incubators section.');
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
                    360
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
                console.log(`  ✓ Rolling      | ${canonicalName}`);
            } catch (detailError) {
                console.warn(`    ⚠ IIG detail page failed for "${name}": ${detailError.message}`);
            } finally {
                if (detailPage) await detailPage.close();
            }
        }
    } catch (e) {
        console.error('  ❌ IIG CSR scraper failed:', e.message);
    }

    return results;
}
