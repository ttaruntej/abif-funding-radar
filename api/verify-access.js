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
    const SITE_PASSWORD = process.env.SITE_PASSWORD || 'abif2026';

    if (password === SITE_PASSWORD) {
        return res.status(200).json({ success: true, message: 'Authenticated' });
    } else {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
}
