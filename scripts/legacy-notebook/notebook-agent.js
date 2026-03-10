import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// --- CONFIG ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const NOTEBOOK_ID = process.env.DISCOVERY_NOTEBOOK_ID;
const QUERIES_PATH = path.join(__dirname, 'query_strategy.json');
const DATA_FILE = path.join(__dirname, '../public/data/opportunities.json');
const LOCK_FILE = path.join(__dirname, 'discovery.lock');
const CHECKPOINT_FILE = path.join(__dirname, 'temp_discovery.json');

// --- UTILS ---

class DiscoveryLock {
    static acquire() {
        if (fs.existsSync(LOCK_FILE)) {
            const stats = fs.statSync(LOCK_FILE);
            const ageMs = Date.now() - stats.mtimeMs;
            const TWO_HOURS = 2 * 60 * 60 * 1000;

            if (ageMs < TWO_HOURS) {
                console.error(`WARNING: discovery lock active (age: ${Math.round(ageMs / 60000)}m). Aborting.`);
                process.exit(1);
            } else {
                console.warn('WARNING: stale lock detected. Overwriting lock.');
            }
        }

        fs.writeFileSync(LOCK_FILE, JSON.stringify({ startTime: new Date().toISOString() }));
        console.log('Lock acquired.');
    }

    static release() {
        if (fs.existsSync(LOCK_FILE)) {
            fs.unlinkSync(LOCK_FILE);
            console.log('Lock released.');
        }
    }
}

function saveCheckpoint(data) {
    let existing = [];

    if (fs.existsSync(CHECKPOINT_FILE)) {
        existing = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    }

    const updated = [...existing, ...data];
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(updated, null, 2));
    console.log(`Checkpoint saved. Total candidates: ${updated.length}`);
}

async function runDiscovery() {
    DiscoveryLock.acquire();

    if (!NOTEBOOK_ID) {
        console.error('DISCOVERY_NOTEBOOK_ID not found in .env');
        DiscoveryLock.release();
        return;
    }

    try {
        if (fs.existsSync(CHECKPOINT_FILE)) {
            fs.unlinkSync(CHECKPOINT_FILE);
        }

        const clusters = JSON.parse(fs.readFileSync(QUERIES_PATH, 'utf-8'));
        console.log(`Starting discovery loop for ${clusters.length} clusters.`);

        for (const cluster of clusters) {
            console.log(`\n[CLUSTER] ${cluster.name}`);

            // --- AI AGENT LIFECYCLE (Executed via Antigravity) ---
            console.log('   STEP 1: Cleaning Notebook...');
            // mcp_notebooklm_source_delete(all)

            console.log(`   STEP 2: Researching... "${cluster.query.substring(0, 50)}..."`);
            // mcp_notebooklm_research_start(deep) -> poll research_status

            console.log('   STEP 3: Importing Sources (Max 15)...');
            // mcp_notebooklm_research_import

            console.log('   STEP 4: Semantic Extraction (PDF gotcha extraction engaged)...');
            // mcp_notebooklm_notebook_query: "Extract JSON objects for each funding scheme mentioned in the sources.
            // For each scheme, find 'Critical Eligibility' (the hard disqualifiers)
            // hidden in long text (e.g. founder age, equity requirements, geographic limits, sector-specific bans).
            // Return them as a 'criticalEligibility' array in the JSON."

            const mockDiscovered = [];
            console.log(`   Extracted ${mockDiscovered.length} candidates.`);

            saveCheckpoint(mockDiscovered);
        }

        console.log('\nAll cycles complete. Running final AI audit and merge...');
        // loadCheckpoint() -> aiBatchDeduplicate -> merge into opportunities.json

        if (fs.existsSync(CHECKPOINT_FILE)) {
            fs.unlinkSync(CHECKPOINT_FILE);
        }
    } catch (error) {
        console.error('Discovery agent failed:', error.message);
    } finally {
        DiscoveryLock.release();
    }
}

// NOTE: This is a logic template for the AI orchestrator.
// Standard execution is disabled here to prevent accidental triggers.
console.log('ABIF Discovery Agent logic loaded.');
console.log('To run a manual discovery, the AI agent must orchestrate the MCP tools.');

const isDryRun = process.argv.includes('--dry-run');
if (isDryRun) {
    console.log('DRY RUN: simulating lock and loop...');
    runDiscovery();
}
