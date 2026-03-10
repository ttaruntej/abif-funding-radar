import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';

dotenv.config();
puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../public/data/opportunities.json');

// --- GOLD STANDARD STATIC RECORDS (Institutional Grants) ---
const STATIC_RECORDS = [
    {
        name: 'SIDBI SRIJAN Revolving Fund',
        body: 'SIDBI',
        maxAward: 'Up to ₹1 Crore',
        deadline: 'Rolling',
        link: 'https://www.sidbi.in/en/srijan',
        description: 'Revolving fund for technology innovation supporting startups and MSMEs with debt financing.',
        targetAudience: ['startup'],
        category: 'national',
        criticalEligibility: [
            "Must be a private limited company",
            "Must have a commercially viable prototype",
            "Institutional debt-to-equity ratio must be < 2:1"
        ]
    },
    {
        name: 'Atal Incubation Centre (AIC) Grant',
        body: 'AIM (NITI Aayog)',
        maxAward: 'Up to ₹10 Crores',
        deadline: 'Check Portal',
        link: 'https://aim.gov.in/aic.php',
        description: 'Establishment grant for new incubation centres to support the Indian innovation ecosystem.',
        targetAudience: ['incubator'],
        category: 'national',
        criticalEligibility: [
            "Entity must be at least 3 years old",
            "Requires 10,000 sq. ft. of dedicated space",
            "Matching contribution required from host institution"
        ]
    },
    {
        name: 'DST NIDHI - TBI Support',
        body: 'DST (MoST)',
        maxAward: 'Varies',
        deadline: 'Varies',
        link: 'https://nidhi.dst.gov.in/',
        description: 'National initiative for developing and harnessing innovations via Technology Business Incubators.',
        targetAudience: ['incubator'],
        category: 'national',
        criticalEligibility: [
            "Must be a Section 8 (not-for-profit) company",
            "Focus on technology and knowledge-based ventures",
            "Must have a dedicated core team"
        ]
    },
    {
        name: 'IIG - CSR Opportunities Portal',
        body: 'Invest India',
        maxAward: 'CSR Grants',
        deadline: 'Rolling',
        link: 'https://indiainvestmentgrid.gov.in/opportunities/csr',
        description: 'Official portal connecting Section 8 Incubators with corporate CSR mandates.',
        targetAudience: ['incubator', 'startup'],
        category: 'csr',
        criticalEligibility: [
            "Requires a valid CSR-1 certificate",
            "Must have 80G and 12A registration",
            "Impact assessment report mandatory for past grants"
        ]
    }
];

async function verifyIntegrity() {
    console.log('🛡️ ABIF Integrity Guard: Verifying Gold Standard Records...');
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });

    try {
        const existingData = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) : [];
        const merged = [...existingData];

        for (const record of STATIC_RECORDS) {
            console.log(`🔍 Checking: ${record.name}`);
            let linkStatus = 'probable';

            try {
                const page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
                const response = await page.goto(record.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
                linkStatus = (response && response.status() < 400) ? 'verified' : 'broken';
                await page.close();
            } catch (e) {
                console.warn(`⚠️  Link timeout for ${record.name}, keeping existing status.`);
            }

            // Sync with existing database
            const idx = merged.findIndex(m => m.name === record.name);
            const entry = {
                ...record,
                linkStatus,
                dataSource: 'integrity-guard',
                lastScraped: new Date().toISOString()
            };

            if (idx > -1) {
                merged[idx] = { ...merged[idx], ...entry };
            } else {
                merged.push(entry);
            }
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2));
        console.log('✅ Integrity Audit Complete. Database Synchronized.');

    } catch (error) {
        console.error('❌ Integrity Guard failed:', error.message);
    } finally {
        await browser.close();
    }
}

verifyIntegrity();
