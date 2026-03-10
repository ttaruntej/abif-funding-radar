import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    // Enable CORS for frontend clients
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { feedback, userEmail, timestamp } = req.body;

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    try {
        await transporter.sendMail({
            from: `"ABIF Feedback Radar" <${process.env.SMTP_FROM}>`,
            to: "tbimanager@abif.iitkgp.ac.in",
            subject: `[Suggestion] Funding Tracker Ecosystem Insight - ${new Date().toLocaleDateString()}`,
            html: `
                <div style="font-family: 'Inter', sans-serif; background-color: #f8fafc; padding: 40px; border-radius: 20px;">
                    <h1 style="font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.05em; color: #0f172a; margin-bottom: 24px;">Strategic Feedback Identified</h1>
                    
                    <div style="background-color: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <p style="font-weight: 700; font-size: 14px; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Suggestion Content:</p>
                        <p style="font-size: 16px; line-height: 1.6; font-style: italic; color: #1e293b; margin-bottom: 24px;">
                            "${feedback}"
                        </p>
                        
                        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px;">
                            <p style="font-size: 12px; font-weight: 700; color: #64748b; margin: 0;"><strong>Sender Intelligence:</strong> ${userEmail}</p>
                            <p style="font-size: 11px; color: #94a3b8; margin-top: 4px;"><strong>Time Recorded:</strong> ${new Date(timestamp).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} IST</p>
                        </div>
                    </div>
                    
                    <p style="text-align: center; margin-top: 32px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.2em;">
                        ABIF IIT KHARAGPUR • NEURAL FUNDING SUBSYSTEM
                    </p>
                </div>
            `,
        });

        return res.status(200).json({ message: 'Feedback sent successfully' });
    } catch (error) {
        console.error('Feedback Email Error:', error);
        return res.status(500).json({ error: 'Failed to send feedback email' });
    }
}
