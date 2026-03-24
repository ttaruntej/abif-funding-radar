import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractOpportunityFromText } from '../extractors/llm-extractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STAGING_FILE = path.join(__dirname, '../../../public/data/opportunities_staging.json');

const PORT = process.env.INGEST_PORT || 3001;

// Ensure staging file exists
if (!fs.existsSync(STAGING_FILE)) {
    fs.writeFileSync(STAGING_FILE, JSON.stringify([], null, 2));
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    if (req.method === 'POST' && req.url === '/api/ingest/email') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                const rawText = payload.text || payload.content || payload.body || '';
                const subject = payload.subject || 'Unknown Subject';
                const from = payload.from || 'Unknown Sender';

                console.log(`\n📨 [Ingest] Received email webhook from: ${from} | Subject: ${subject}`);

                if (!rawText) {
                    res.writeHead(400);
                    return res.end(JSON.stringify({ error: 'No text content provided.' }));
                }

                console.log(`🧠 [Ingest] Forwarding ${rawText.length} bytes to LLM Extractor...`);

                const opportunity = await extractOpportunityFromText(rawText, {
                    sourceId: `email_webhook`,
                    url: payload.url || `email://${encodeURIComponent(from)}`
                });

                if (opportunity) {
                    console.log(`✅ [Ingest] Successfully extracted opportunity: ${opportunity.name}`);

                    // Save to staging file
                    const currentData = JSON.parse(fs.readFileSync(STAGING_FILE, 'utf-8'));
                    currentData.push(opportunity);
                    fs.writeFileSync(STAGING_FILE, JSON.stringify(currentData, null, 2));

                    res.writeHead(201);
                    return res.end(JSON.stringify({ message: 'Opportunity extracted and staged.', opportunity }));
                } else {
                    console.log(`💤 [Ingest] No relevant funding opportunity found in text.`);
                    res.writeHead(200);
                    return res.end(JSON.stringify({ message: 'Processed successfully, but no opportunity matched schema.' }));
                }
            } catch (err) {
                console.error(`❌ [Ingest] Processing error:`, err);
                res.writeHead(500);
                return res.end(JSON.stringify({ error: 'Internal server error during LLM extraction.' }));
            }
        });
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

server.listen(PORT, () => {
    console.log(`🚀 [ABIF Ingest Node] Webhook receiver online at http://localhost:${PORT}`);
    console.log(`📡 Ready to receive zero-day ecosystem newsletter payloads at POST /api/ingest/email`);
});
