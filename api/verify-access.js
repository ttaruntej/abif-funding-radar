import crypto from 'node:crypto';

const parseAccessPasswords = () => {
    const raw = [
        process.env.ACCESS_PASSWORDS,
        process.env.ACCESS_PASSWORD,
        process.env.SITE_PASSWORD,
        process.env.ADMIN_PASSWORD
    ]
        .filter(Boolean)
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean);

    return Array.from(new Set(raw));
};

const safeEquals = (input, target) => {
    const inputBuffer = Buffer.from(String(input || ''));
    const targetBuffer = Buffer.from(String(target || ''));

    if (inputBuffer.length !== targetBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(inputBuffer, targetBuffer);
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { password } = req.body || {};
    if (typeof password !== 'string' || password.trim() === '') {
        return res.status(400).json({ success: false, error: 'Password is required' });
    }

    const configuredPasswords = parseAccessPasswords();
    if (configuredPasswords.length === 0) {
        return res.status(500).json({ success: false, error: 'Access password not configured' });
    }

    const isValid = configuredPasswords.some((candidate) => safeEquals(password, candidate));
    if (!isValid) {
        return res.status(401).json({ success: false, error: 'Invalid Access Key' });
    }

    return res.status(200).json({ success: true });
}
