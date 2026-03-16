import http from 'http';
import https from 'https';
import dotenv from 'dotenv';
import { URL } from 'url';

dotenv.config();

const PORT = 3000;
const REPO_OWNER = process.env.GH_REPO_OWNER || 'ttaruntej';
const REPO_NAME = process.env.GH_REPO_NAME || 'abif-funding-radar';
const GH_TOKEN = process.env.GH_TOKEN || process.env.GH_PAT;

if (!GH_TOKEN) {
    console.error('❌ Error: GH_TOKEN or GH_PAT not found in .env');
    process.exit(1);
}

const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    console.log(`📡 [Proxy] ${req.method} ${pathname}`);

    // common headers for GH API
    const ghHeaders = {
        'Authorization': `Bearer ${GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ABIF-Local-Proxy'
    };

    try {
        // --- 1. TRIGGER EMAIL (POST) ---
        if (pathname === '/api/trigger-email' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                const { target_emails, mode, filters } = JSON.parse(body);
                const workflowInputs = {
                    target_emails,
                    mode: mode || 'standard',
                    filters: JSON.stringify(filters || {})
                };

                const ghReq = https.request({
                    hostname: 'api.github.com',
                    path: `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/send-email.yml/dispatches`,
                    method: 'POST',
                    headers: ghHeaders
                }, (ghRes) => {
                    res.writeHead(ghRes.statusCode === 204 ? 200 : ghRes.statusCode, { 'Content-Type': 'application/json' });
                    if (ghRes.statusCode === 204) {
                        res.end(JSON.stringify({ message: 'Email Action Triggered (via Local Proxy)' }));
                    } else {
                        ghRes.pipe(res);
                    }
                });

                ghReq.write(JSON.stringify({ ref: 'main', inputs: workflowInputs }));
                ghReq.end();
            });
        }

        // --- 2. EMAIL STATUS / META (GET) ---
        else if (pathname === '/api/trigger-email' && req.method === 'GET') {
            const action = parsedUrl.searchParams.get('action');

            if (action === 'fetch_meta') {
                // Fetch meta from GH API (bypass storage lag)
                https.get({
                    hostname: 'api.github.com',
                    path: `/repos/${REPO_OWNER}/${REPO_NAME}/contents/public/data/last_dispatch_meta.json`,
                    headers: ghHeaders
                }, (ghRes) => {
                    let data = '';
                    ghRes.on('data', chunk => data += chunk);
                    ghRes.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            const content = Buffer.from(json.content, 'base64').toString('utf-8');
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(content);
                        } catch (e) {
                            res.writeHead(404, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Meta not found' }));
                        }
                    });
                });
            } else {
                // Fetch workflow status
                https.get({
                    hostname: 'api.github.com',
                    path: `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/send-email.yml/runs?per_page=1`,
                    headers: ghHeaders
                }, (ghRes) => {
                    let data = '';
                    ghRes.on('data', chunk => data += chunk);
                    ghRes.on('end', () => {
                        const json = JSON.parse(data);
                        const lastRun = json.workflow_runs?.[0];
                        if (!lastRun) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            return res.end(JSON.stringify({ status: 'unknown' }));
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            status: lastRun.status,
                            conclusion: lastRun.conclusion,
                            updated_at: lastRun.updated_at,
                            run_id: lastRun.id
                        }));
                    });
                });
            }
        }

        // --- 3. TRIGGER SYNC (POST) ---
        else if (pathname === '/api/trigger-sync' && req.method === 'POST') {
            const ghReq = https.request({
                hostname: 'api.github.com',
                path: `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/source-sync.yml/dispatches`,
                method: 'POST',
                headers: ghHeaders
            }, (ghRes) => {
                res.writeHead(ghRes.statusCode === 204 ? 200 : ghRes.statusCode, { 'Content-Type': 'application/json' });
                if (ghRes.statusCode === 204) {
                    res.end(JSON.stringify({ message: 'Verified source sync triggered (via Local Proxy)' }));
                } else {
                    ghRes.pipe(res);
                }
            });
            ghReq.write(JSON.stringify({ ref: 'main' }));
            ghReq.end();
        }

        // --- 4. SYNC STATUS (GET) ---
        else if (pathname === '/api/trigger-sync' && req.method === 'GET') {
            https.get({
                hostname: 'api.github.com',
                path: `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/source-sync.yml/runs?per_page=1`,
                headers: ghHeaders
            }, (ghRes) => {
                let data = '';
                ghRes.on('data', chunk => data += chunk);
                ghRes.on('end', () => {
                    const json = JSON.parse(data);
                    const lastRun = json.workflow_runs?.[0];
                    if (!lastRun) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ status: 'unknown' }));
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: lastRun.status,
                        conclusion: lastRun.conclusion,
                        updated_at: lastRun.updated_at,
                        run_id: lastRun.id
                    }));
                });
            });
        }

        // --- 5. VERIFY ACCESS (POST) ---
        else if (pathname === '/api/verify-access' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                const { password } = JSON.parse(body);
                const SITE_PASSWORD = process.env.SITE_PASSWORD || 'abif2026';

                if (password === SITE_PASSWORD) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Authenticated (via Local Proxy)' }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
                }
            });
        }

        else {

            res.writeHead(404);
            res.end('Not Found');
        }

    } catch (err) {
        console.error('❌ Proxy Error:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Proxy internal error' }));
    }
});

server.listen(PORT, () => {
    console.log(`🚀 [ABIF Proxy] Listening on http://localhost:${PORT}`);
    console.log(`ℹ️  This proxy handles requests locally to bypass network blocks while you are at the institution.`);
});
