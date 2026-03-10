/**
 * Serverless Function to trigger or check GitHub Action status
 */
export default async function handler(req, res) {
    // Enable CORS for frontend clients (Localhost & GitHub Pages)
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*') // Allow all origins
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    const GH_TOKEN = process.env.GH_TOKEN;
    const REPO_OWNER = process.env.GH_REPO_OWNER || 'ttaruntej';
    const REPO_NAME = process.env.GH_REPO_NAME || 'abif-funding-radar';
    const WORKFLOW_ID = 'source-sync.yml';

    if (!GH_TOKEN) {
        return res.status(500).json({ error: 'GitHub Token not configured' });
    }

    const headers = {
        'Authorization': `Bearer ${GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };

    // TRIGGER VERIFIED SOURCE SYNC (POST)
    if (req.method === 'POST') {
        try {
            const response = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/dispatches`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ ref: 'main' }),
                }
            );

            if (response.status === 204) {
                return res.status(200).json({ message: 'Verified source sync triggered' });
            }
            const errorData = await response.json();
            return res.status(response.status).json({ error: errorData.message });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to trigger' });
        }
    }

    // CHECK STATUS (GET)
    if (req.method === 'GET') {
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
                status: lastRun.status, // in_progress, completed, queued
                conclusion: lastRun.conclusion, // success, failure, cancelled
                updated_at: lastRun.updated_at,
                run_id: lastRun.id
            });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch status' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
