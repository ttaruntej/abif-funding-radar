import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const CURRENT_PUBLISHABLE_FILE = process.env.CURRENT_PUBLISHABLE_FILE
    || path.join(process.cwd(), 'public', 'data', 'publishable_opportunities.json');
const BASELINE_PUBLISHABLE_FILE = process.env.BASELINE_PUBLISHABLE_FILE
    || path.join(process.cwd(), 'public', 'data', 'publishable_opportunities.previous.json');
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://ttaruntej.github.io/abif-funding-radar/';

function readJsonArray(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return [];

    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn(`Could not read JSON array from ${filePath}: ${error.message}`);
        return [];
    }
}

function getOpportunityKey(opportunity = {}) {
    return [
        opportunity.name || opportunity.link || '',
    ]
        .join('')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildEmailHtml(newOpportunities) {
    const cards = newOpportunities.map((opportunity) => `
        <div style="margin-bottom: 20px; padding: 22px; border-radius: 14px; border: 1px solid #e2e8f0; background-color: #f8fafc;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                <h3 style="margin: 0; color: #0f172a; font-size: 18px; font-weight: 700; line-height: 1.35;">
                    ${escapeHtml(opportunity.name || 'Untitled opportunity')}
                </h3>
                <span style="flex-shrink: 0; background-color: #eff6ff; color: #2563eb; border: 1px solid rgba(37,99,235,0.2); padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;">
                    ${escapeHtml(opportunity.status || 'Open')}
                </span>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                <tr>
                    <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; width: 110px;">Provider</td>
                    <td style="padding: 6px 0; color: #334155; font-size: 14px; font-weight: 500;">${escapeHtml(opportunity.body || 'Not specified')}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Funding</td>
                    <td style="padding: 6px 0; color: #059669; font-size: 14px; font-weight: 700;">${escapeHtml(opportunity.maxAward || 'Check source')}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Deadline</td>
                    <td style="padding: 6px 0; color: #334155; font-size: 14px; font-weight: 600;">${escapeHtml(opportunity.deadline || 'Check source')}</td>
                </tr>
            </table>

            <p style="margin: 0 0 18px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                ${escapeHtml(opportunity.description || 'No summary available.')}
            </p>

            <a href="${escapeHtml(opportunity.link || PUBLIC_SITE_URL)}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 10px 18px; border-radius: 10px;">
                View Opportunity
            </a>
        </div>
    `).join('');

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 720px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 30px; border-bottom: 4px solid #2563eb;">
                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.03em;">ABIF Opportunity Update</h1>
                <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 13px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;">
                    Newly added opportunities from the latest refresh
                </p>
            </div>

            <div style="padding: 30px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 18px;">
                    <span style="background-color: #dbeafe; color: #2563eb; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">New opportunities</span>
                    <span style="color: #64748b; font-size: 13px; font-weight: 600;">${escapeHtml(new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}</span>
                </div>

                <p style="margin: 0 0 24px 0; color: #334155; font-size: 15px; line-height: 1.7;">
                    The latest refresh added <strong>${newOpportunities.length}</strong> new opportunit${newOpportunities.length === 1 ? 'y' : 'ies'} to the checked list.
                    Only the newly added items are included below.
                </p>

                ${cards}
            </div>

            <div style="background-color: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
                <a href="${escapeHtml(PUBLIC_SITE_URL)}" style="display: inline-block; border: 2px solid #cbd5e1; color: #475569; text-decoration: none; font-weight: 700; font-size: 14px; padding: 10px 24px; border-radius: 10px;">
                    Open Opportunity List
                </a>
            </div>
        </div>
    `;
}

async function main() {
    const currentOpportunities = readJsonArray(CURRENT_PUBLISHABLE_FILE);
    const previousOpportunities = readJsonArray(BASELINE_PUBLISHABLE_FILE);

    const previousKeys = new Set(previousOpportunities.map(getOpportunityKey).filter(Boolean));
    const newOpportunities = currentOpportunities.filter((opportunity) => {
        const key = getOpportunityKey(opportunity);
        return key && !previousKeys.has(key);
    });

    if (newOpportunities.length === 0) {
        console.log('No new publishable opportunities found in this refresh. Team alert skipped.');
        return;
    }

    const recipients = String(process.env.SYNC_ALERT_RECIPIENTS || '')
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean)
        .join(', ');

    const {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USER,
        SMTP_PASS,
        SMTP_FROM,
    } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !recipients) {
        console.error('Automatic team alert could not be sent because SMTP settings or recipients are missing.');
        process.exit(1);
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });

    const subject = `[ABIF Opportunity Update] ${newOpportunities.length} new opportunit${newOpportunities.length === 1 ? 'y' : 'ies'} added`;
    const html = buildEmailHtml(newOpportunities);

    const info = await transporter.sendMail({
        from: SMTP_FROM || '"ABIF Opportunity Update" <abif.tbimanager@gmail.com>',
        to: recipients,
        subject,
        html,
    });

    console.log(`Automatic team alert sent to: ${recipients}`);
    console.log(`Message ID: ${info.messageId}`);
    console.log(`New opportunities shared: ${newOpportunities.length}`);
}

main().catch((error) => {
    console.error('Failed to send automatic team alert:', error);
    process.exit(1);
});
