export default async function handler(req, res) {
    // Enable CORS for frontend clients (Localhost & GitHub Pages)
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*') // Allow all origins
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate')
    res.setHeader('Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    const GH_TOKEN = process.env.GH_TOKEN || process.env.GH_PAT;
    const REPO_OWNER = process.env.GH_REPO_OWNER || 'ttaruntej';
    const REPO_NAME = process.env.GH_REPO_NAME || 'ABIF-Funding-Tracker';
    const WORKFLOW_ID = 'send-email.yml';

    if (!GH_TOKEN) {
        return res.status(500).json({ error: 'GitHub Authentication Token (GH_TOKEN or GH_PAT) not configured in Vercel' });
    }

    const headers = {
        'Authorization': `Bearer ${GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };

    if (req.method === 'POST') {
        let { target_emails, mode, filters } = req.body || {};

        // Basic Sanitization: Extract valid emails only
        if (target_emails) {
            const emailArray = target_emails.split(',')
                .map(e => e.trim())
                .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
            target_emails = emailArray.slice(0, 10).join(','); // Limit to 10 recipients for safety
        }

        if (!target_emails) {
            return res.status(400).json({ error: 'At least one valid email recipient is required' });
        }

        try {
            const response = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/dispatches`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        ref: 'main',
                        inputs: {
                            target_emails: target_emails,
                            mode: mode || 'standard',
                            filters: JSON.stringify(filters || {})
                        }
                    }),
                }
            );

            if (response.status === 204) {
                return res.status(200).json({ message: 'Email Action Triggered' });
            }
            const errorData = await response.json();
            return res.status(response.status).json({ error: errorData.message });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to trigger email action' });
        }
    }

    if (req.method === 'GET') {
        const { action } = req.query;

        // NEW: Live Metadata Fetch (Bypasses GitHub Pages build lag)
        if (action === 'fetch_meta') {
            try {
                const response = await fetch(
                    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/public/data/last_dispatch_meta.json`,
                    { headers }
                );

                if (!response.ok) return res.status(response.status).json({ error: 'Meta file not found yet' });

                const data = await response.json();
                // GitHub returns content as base64
                const content = Buffer.from(data.content, 'base64').toString('utf-8');
                return res.status(200).json(JSON.parse(content));
            } catch (error) {
                return res.status(500).json({ error: 'Failed to fetch live metadata' });
            }
        }

        // Standard Workflow Status Check
        try {
            const response = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/runs?per_page=1`,
                { headers }
            );
            const data = await response.json();
            const lastRun = data.workflow_runs?.[0];

            if (!lastRun) {
                return res.status(200).json({ status: 'unknown' });
            }

            return res.status(200).json({
                status: lastRun.status,
                conclusion: lastRun.conclusion,
                updated_at: lastRun.updated_at,
                run_id: lastRun.id
            });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch status' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
