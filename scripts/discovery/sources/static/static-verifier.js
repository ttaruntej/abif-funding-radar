import { setupPageInterception, chunkArray, withRetry, probeDirectHttpLink } from '../../utils/puppeteer-helpers.js';
import { extractDeadlineDate, dateToStatus } from '../../utils/date-helpers.js';

/**
 * For all static (manually curated) records, quickly ping their URL.
 * Updates: linkStatus → 'verified' | 'broken', lastScraped timestamp.
 * Never changes name, body, maxAward, description, or category.
 */
export async function verifyStaticRecords(browser, staticRecords) {
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
                    console.warn(`  ⚠ Browser HTTP ${httpStatus} for "${record.name}" → retrying with direct probe`);
                }
                // Note: keep existing linkStatus if HTTP is unexpected (e.g. 0) — don't degrade
            } catch (e) {
                // Timeout = likely a slow site, not necessarily dead. Keep existing linkStatus.
                // Only mark broken for DNS failures (no such host).
                if (e.message.includes('net::ERR_NAME_NOT_RESOLVED') || e.message.includes('no such host')) {
                    linkStatus = 'broken';
                    status = 'Verify Manually';
                    console.warn(`  ⚠ DNS failure: "${record.name}"`);
                } else {
                    shouldTryDirectProbe = true;
                    console.warn(`  ⚠ Browser retry needed: "${record.name}" — ${e.message}`);
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
                        console.warn(`  ⚠ Direct probe HTTP ${directProbe.status} for "${record.name}" → marked broken`);
                    } else {
                        console.warn(`  ⚠ Direct probe failed for "${record.name}" → marked broken`);
                    }
                } else {
                    console.warn(`  ⚠ Direct probe inconclusive for "${record.name}" — keeping existing status`);
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

            const icon = linkStatus === 'verified' ? '✓' : '⚠';
            console.log(`  ${icon} ${linkStatus.padEnd(8)} | ${record.name.substring(0, 55)}`);
        }));

        settled
            .filter((result) => result.status === 'rejected')
            .forEach((result) => {
                console.warn(`  ⚠ Static verification worker failed: ${result.reason?.message || result.reason}`);
            });
    }

    return updated;
}

// --- STATIC RECORDS (SIDBI, INCUBATOR GRANTS, CSR) -------------------------
export function getStaticRecords() {
    return [
        // SIDBI
        {
            name: 'SIDBI Revolving Fund for Technology Innovation (SRIJAN)',
            body: 'SIDBI',
            maxAward: 'Up to ₹1 Crore',
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
            maxAward: '₹25 Lakhs – ₹5 Crores',
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
            maxAward: 'Up to ₹10 Crores (over 5 years)',
            deadline: 'Varies',
            link: 'https://aim.gov.in/aic.php',
            description: 'Financial support of up to ₹10 crores to eligible institutions/organizations to establish new Atal Incubation Centres.',
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
            description: 'Funding to set up TBIs and establish Seed Support Systems (SSS) which give incubators up to ₹10 Cr to invest in their portfolio.',
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
            targetAudience: ['incubator', 'startup'],
            sectors: ['Digital', 'Hardware', 'Agnostic'],
            stages: ['All Stages'],
            criticalEligibility: ['Confirm that the current SAMRIDH intake accepts your accelerator or incubator as an implementation partner in this cycle.']
        },
        {
            name: 'STPI Next Generation Incubation Scheme (NGIS) / LEAP Ahead',
            body: 'STPI (MeitY)',
            maxAward: 'Up to ₹25 Lakhs',
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
            maxAward: 'Up to ₹1 Crore',
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
        // INTERNATIONAL / ECOSYSTEM SUPPORT
        {
            name: 'ADB Ventures',
            body: 'Asian Development Bank',
            maxAward: 'Catalytic capital and venture support',
            deadline: 'Check Website',
            link: 'https://ventures.adb.org/',
            description: 'ADB Ventures supports climate and development-focused startups and works through ecosystem partnerships, pilots, and venture support across Asia and the Pacific.',
            category: 'international',
            status: 'Check Website',
            dataSource: 'manual:official:adb',
            targetAudience: ['startup', 'incubator'],
            sectors: ['ClimateTech', 'FinTech', 'AgriTech'],
            stages: ['Seed', 'Early Traction', 'Scale-up'],
            criticalEligibility: ['Confirm that the live ADB Ventures intake or partner program accepts incubators, accelerators, or venture builders in the current cycle.']
        },
        {
            name: 'Youth Co:Lab',
            body: 'UNDP / Citi Foundation / AIM',
            maxAward: 'Program support and challenge-linked awards',
            deadline: 'Check Website',
            link: 'https://www.youthcolab.org/',
            description: 'Youth Co:Lab is a UNDP-led platform supporting youth entrepreneurship and strengthening innovation ecosystems through partner capacity building, venture support, and regional alliances.',
            category: 'international',
            status: 'Check Website',
            dataSource: 'manual:official:undp',
            targetAudience: ['startup', 'incubator'],
            sectors: ['Agnostic', 'Social Impact'],
            stages: ['Ideation', 'Prototype', 'Seed'],
            criticalEligibility: ['Check whether the live Youth Co:Lab intake is open to incubators or accelerators, or only to youth-led ventures in the current round.']
        },
        {
            name: 'StartupWave Virtual Incubation Platform',
            body: 'StartupWave / Intellecap',
            maxAward: 'Platform support and partner opportunities',
            deadline: 'Rolling',
            link: 'https://startupwave.co/',
            description: 'StartupWave is a virtual incubation platform connecting entrepreneurs with mentors, incubators, investors, and ecosystem programs.',
            category: 'international',
            status: 'Rolling',
            dataSource: 'manual:official:startupwave',
            targetAudience: ['startup', 'incubator'],
            sectors: ['Agnostic'],
            stages: ['Ideation', 'Prototype', 'Seed'],
            criticalEligibility: ['Confirm whether the active StartupWave intake is open to incubators, accelerators, or other ecosystem partners in addition to startups.']
        },
        {
            name: 'Clean Energy International Incubation Centre (CEIIC)',
            body: 'Social Alpha / Tata Trusts',
            maxAward: 'Program support and venture access',
            deadline: 'Check Website',
            link: 'https://ceiic.socialalpha.org/',
            description: 'CEIIC supports clean energy innovators through venture building, pilot enablement, mentorship, and market access.',
            category: 'csr',
            status: 'Check Website',
            dataSource: 'manual:official:socialalpha',
            targetAudience: ['startup', 'incubator'],
            sectors: ['CleanTech', 'Energy', 'ClimateTech'],
            stages: ['Prototype', 'Seed', 'Early Traction'],
            criticalEligibility: ['Verify whether the current CEIIC intake is open to ecosystem partners alongside startups for the active call.']
        },
        {
            name: 'IFC Startup Catalyst',
            body: 'IFC / World Bank Group',
            maxAward: 'Fund and venture support',
            deadline: 'Check Website',
            link: 'https://www.ifc.org/en/what-we-do/sector-expertise/venture-capital/startup-catalyst',
            description: 'IFC Startup Catalyst supports emerging-market venture ecosystems, including incubators, accelerators, seed funds, and startup support structures.',
            category: 'international',
            status: 'Check Website',
            dataSource: 'manual:official:ifc',
            targetAudience: ['startup', 'incubator'],
            sectors: ['Agnostic', 'FinTech', 'ClimateTech'],
            stages: ['Seed', 'Early Traction', 'Scale-up'],
            criticalEligibility: ['Primary access may be through accelerator, incubator, fund, or platform-level partnerships rather than a direct startup-style grant application.']
        },
        {
            name: 'UNIDO Global Cleantech Innovation Programme',
            body: 'UNIDO',
            maxAward: 'Check Website',
            deadline: 'Check Website',
            link: 'https://www.unido.org/sites/default/files/unido-publications/2024-10/UNIDO%20GCIP%20Cleantech%20Innovation%20Cluster%20Development%20Framework.pdf',
            description: 'UNIDO GCIP combines direct support for cleantech SMEs with the development and strengthening of cleantech innovation and entrepreneurship ecosystems.',
            category: 'international',
            status: 'Check Website',
            dataSource: 'manual:official:unido',
            targetAudience: ['startup', 'incubator'],
            sectors: ['ClimateTech', 'CleanTech', 'Sustainability'],
            stages: ['Ideation', 'Seed', 'Early Traction'],
            criticalEligibility: ['Confirm whether the current GCIP country track or accelerator intake is open in the geography relevant to your incubator or venture.']
        },
        {
            name: 'HDFC Bank Parivartan Start-up Grants',
            body: 'HDFC Bank Parivartan',
            maxAward: 'Check Website',
            deadline: 'Check Website',
            link: 'https://www.hdfcbank.com/personal/about-us/news-room/press-release/2024/hdfc-bank-parivartan-announces-startup-grants-for-30-incubators',
            description: 'HDFC Bank Parivartan startup grants support incubators and social-impact startups working across livelihood, healthcare, and education themes.',
            category: 'csr',
            status: 'Check Website',
            dataSource: 'manual:csr:hdfc',
            targetAudience: ['incubator', 'startup'],
            sectors: ['Social Impact', 'HealthTech', 'EdTech'],
            stages: ['Proof of Concept', 'Seed', 'Scale-up'],
            criticalEligibility: ['Confirm whether the active HDFC cycle is open to incubators as direct applicants, portfolio-backed applicants, or both.']
        },
        // STATE SPECIFIC
        {
            name: 'Karnataka Elevate NXT 2026 (Deeptech)',
            body: 'KITS / Startup Karnataka',
            maxAward: 'Up to ₹1 Crore',
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
            maxAward: '₹20,000 - ₹22,000 / month',
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
            maxAward: 'Up to ₹15 Lakhs',
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
            maxAward: 'Up to ₹25 Lakhs',
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
            maxAward: '₹10 Lakhs - ₹25 Lakhs',
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
            maxAward: '₹5 Lakhs - ₹1 Crore',
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
            maxAward: 'Up to ₹25 Crores',
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
            maxAward: '₹2.5 Lakhs - ₹10 Lakhs',
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
            maxAward: '₹2 Lakhs - ₹12 Lakhs',
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
