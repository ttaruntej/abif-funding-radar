export default async function handler(req, res) {
    // Enable CORS for frontend clients (Localhost & GitHub Pages)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { password } = req.body || {};
    const REPO_OWNER = 'ttaruntej';
    const REPO_NAME = 'abif-funding-radar';
    const GH_TOKEN = process.env.GH_TOKEN || process.env.GH_PAT;

    if (!GH_TOKEN) {
        return res.status(500).json({ error: 'Server authentication misconfigured' });
    }

    try {
        // 1. Trigger GitHub Action to verify
        const trigger = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/auth-verify.yml/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GH_TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'ABIF-Vercel-Relay'
            },
            body: JSON.stringify({ ref: 'main', inputs: { password } })
        });

        if (trigger.status !== 204) {
            throw new Error('GitHub trigger failed');
        }

        // 2. Poll for the latest run result (max 25s)
        let attempts = 0;
        while (attempts < 20) {
            attempts++;
            await new Promise(r => setTimeout(r, 1200));

            const runsRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/auth-verify.yml/runs?per_page=1`, {
                headers: {
                    'Authorization': `Bearer ${GH_TOKEN}`,
                    'Accept': 'application/vnd.github+json',
                    'User-Agent': 'ABIF-Vercel-Relay'
                }
            });

            const runs = await runsRes.json();
            const lastRun = runs.workflow_runs?.[0];

            if (lastRun && (new Date() - new Date(lastRun.created_at)) < 60000 && lastRun.status === 'completed') {
                if (lastRun.conclusion === 'success') {
                    return res.status(200).json({ success: true });
                } else {
                    return res.status(401).json({ success: false });
                }
            }
        }

        return res.status(504).json({ success: false, error: 'Verification timed out' });

    } catch (err) {
        return res.status(500).json({ success: false, error: 'Relay failure' });
    }
}
