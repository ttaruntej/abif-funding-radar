import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'opportunities.json');
const HISTORY_FILE = path.join(process.cwd(), 'public', 'data', 'last_email_sent.json');
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://ttaruntej.github.io/abif-funding-radar/';

async function sendEmail() {
    const {
        SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM,
        TARGET_EMAILS, GEMINI_API_KEY,
        DISPATCH_MODE, DISPATCH_FILTERS
    } = process.env;

    const mode = DISPATCH_MODE || 'standard';
    const filters = DISPATCH_FILTERS ? JSON.parse(DISPATCH_FILTERS) : {};

    const finalRecipients = TARGET_EMAILS && TARGET_EMAILS.trim() !== '' ? TARGET_EMAILS : '';

    // Require config to send email
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !finalRecipients) {
        console.log('  ℹ Email notification skipped: SMTP credentials or recipient emails not fully configured.');
        process.exit(1);
    }

    if (!fs.existsSync(DATA_FILE)) {
        console.error('  ✗ Data file not found. Run scraper first.');
        process.exit(1);
    }

    const currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    // --- DYNAMIC FILTERING LOGIC ---
    let targetOpps = [];
    if (mode === 'filtered') {
        console.log(`  🔍 Applying custom filters: ${JSON.stringify(filters)}`);
        targetOpps = currentData.filter(o => {
            const matchesAudience = !filters.activeAudience || filters.activeAudience === 'all' || (o.targetAudience || []).includes(filters.activeAudience);
            const matchesSector = !filters.activeSector || filters.activeSector === 'All Sectors' || (o.sectors || []).includes(filters.activeSector);
            const matchesCategory = !filters.activeCategory || filters.activeCategory === 'all' || (o.category || '').toLowerCase() === filters.activeCategory.toLowerCase();
            const matchesStatus = !filters.activeStatus || filters.activeStatus === 'all' || (filters.activeStatus === 'Open' ? ['Open', 'Closing Soon'].includes(o.status) : o.status === filters.activeStatus);
            const matchesSearch = !filters.searchQuery ||
                (o.name || '').toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
                (o.description || '').toLowerCase().includes(filters.searchQuery.toLowerCase());

            return matchesAudience && matchesSector && matchesCategory && matchesStatus && matchesSearch;
        });
    } else {
        // Default Standard Mode: Target Audience Focus
        const targetAudience = filters.activeAudience || 'incubator';
        if (targetAudience === 'all') {
            targetOpps = currentData.filter(x => x.status !== 'Closed');
        } else {
            targetOpps = currentData.filter(x =>
                x.targetAudience && x.targetAudience.includes(targetAudience) && x.status !== 'Closed'
            );
        }
    }

    if (targetOpps.length === 0) {
        console.log(`  ℹ No matching opportunities found for mode: ${mode}. Skipping email.`);
        process.exit(0);
    }

    // --- HISTORY TRACKING & DELTA ---
    let historyOpps = [];
    if (fs.existsSync(HISTORY_FILE)) {
        try {
            historyOpps = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        } catch (e) {
            console.warn('  ⚠ Could not read history file. Treating as first run.');
        }
    }

    const newItems = targetOpps.filter(curr => !historyOpps.some(hist => hist.name === curr.name));
    const closedItems = historyOpps.filter(hist => !currentData.some(curr => curr.name === hist.name && curr.status !== 'Closed'));

    console.log(`\n─── Delta Analysis: ${newItems.length} New, ${closedItems.length} Closed ───`);

    console.log(`\n─── Preparing ${mode.toUpperCase()} Email for ${targetOpps.length} Opportunities ───`);

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });

    // --- AI GENERATION ---
    let aiIntro = `<p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 24px;">Greetings! I am the <strong>AI Agent of Tarun Tej Thadana (TBI Manager, ABIF)</strong>. I have compiled the latest deep-scan across the Indian funding ecosystem for you. Here are the active mandates relevant for our incubator and portfolio initiatives:</p>`;
    let aiSubject = `📡 [ABIF Intelligence] ${newItems.length > 0 ? `NEW: ${newItems[0].name.slice(0, 20)}... + ` : ''}${targetOpps.length} Mandates for Tarun Tej`;

    if (GEMINI_API_KEY) {
        try {
            console.log('  🧠 Generating AI Briefing & Subject Line...');
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const audienceFocus = filters.activeAudience === 'startup' ? 'Startup' : 'Incubator';
            const filterContext = mode === 'filtered'
                ? `The user has applied specific filters: ${JSON.stringify(filters)}. Focus the briefing on this specific slice of the ecosystem targeting ${audienceFocus}s.`
                : `This is a standard broad scan for the ABIF ${audienceFocus} ecosystem.`;

            const today = new Date().toLocaleString('en-IN', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
            const prompt = `[ROLE] You are the ABIF AI Intelligence Agent. Your persona is objective, professional, and ecosystem-wide.
            [CRITICAL CONSTRAINT] YOU ARE FORBIDDEN FROM USING PERSONAL NAMES. DO NOT mention "Tarun", "Thadana", or any individual.
            [CRITICAL CONSTRAINT] YOU ARE FORBIDDEN FROM SAYING "Greetings, Tarun" or "Hello Tarun".
            [TASK] Generate an intelligence briefing for: ${today.split(' ')[1]} ${today.split(' ')[2]}.
            [SCOPE] The entire Indian Funding and AgriTech Ecosystem.
            [CONTEXT] ${filterContext}. Changes: ${newItems.length} new, ${closedItems.length} closed.
            [DATA] ${JSON.stringify(targetOpps.map(o => o.name))}.
            
            Format your response as a JSON object:
            {
              "subject": "A professional, ecosystem-wide subject line",
              "intro": "The professional intro text (HTML allowed). START with a neutral greeting like 'Ecosystem Intelligence Update:' or 'Greetings,'. Describe the scan as covering the entire Indian Funding and AgriTech Ecosystem. DO NOT mention any individual."
            }
            
            [TONE] Authoritative and objective.`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            // Basic JSON cleaning in case of markdown blocks
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(cleanJson);

            aiSubject = aiData.subject;
            aiIntro = `<div style="font-size: 16px; line-height: 1.6; color: #334155; margin-bottom: 24px; font-weight: 500;">${aiData.intro}</div>`;

            console.log('  ✓ AI generation successful.');
        } catch (e) {
            console.warn('  ⚠ AI generation failed. Falling back to default.', e.message);
        }
    }

    let htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 40px 30px; text-align: left; border-bottom: 4px solid #3b82f6;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">ABIF</h1>
                <p style="color: #94a3b8; font-size: 13px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin: 5px 0 0 0;">Funding Intelligence Radar</p>
            </div>

            <!-- Body -->
            <div style="padding: 40px 30px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                    <span style="background-color: #dbeafe; color: #2563eb; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Live Dispatch</span>
                    <span style="color: #64748b; font-size: 14px;">•</span>
                    <span style="color: #64748b; font-size: 14px; font-weight: 500;">${new Date().toLocaleString('en-IN', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                </div>
                
                ${aiIntro}

                <!-- Delta Highlights -->
                ${newItems.length > 0 || closedItems.length > 0 ? `
                <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 30px; border: 1px dashed #cbd5e1;">
                    <h4 style="margin: 0 0 12px 0; color: #1e293b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Intelligence Delta Analysis</h4>
                    ${newItems.length > 0 ? `
                        <div style="margin-bottom: 10px;">
                            <span style="color: #059669; font-weight: 700; font-size: 13px;">🆕 NEW DISCOVERIES:</span>
                            <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #475569; font-size: 13px;">
                                ${newItems.map(item => `<li>${item.name}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${closedItems.length > 0 ? `
                        <div>
                            <span style="color: #dc2626; font-weight: 700; font-size: 13px;">⚠️ RECENTLY CLOSED:</span>
                            <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #475569; font-size: 13px;">
                                ${closedItems.map(item => `<li>${item.name}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
                ` : ''}

                <div style="height: 1px; background-color: #e2e8f0; margin: 30px 0;"></div>
    `;

    targetOpps.forEach((opp, i) => {
        let statusColor = opp.status === 'Closing Soon' ? '#ef4444' : opp.status === 'Open' ? '#10b981' : '#3b82f6';
        let statusBg = opp.status === 'Closing Soon' ? '#fef2f2' : opp.status === 'Open' ? '#ecfdf5' : '#eff6ff';

        htmlContent += `
            <div style="margin-bottom: 24px; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; background-color: #f8fafc; transition: all 0.2s;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <h3 style="margin: 0; color: #0f172a; font-size: 18px; font-weight: 700; line-height: 1.4; width: 75%;">${opp.name}</h3>
                    <span style="background-color: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusColor}40; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">${opp.status}</span>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                    <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; width: 100px;">Provider</td>
                        <td style="padding: 6px 0; color: #334155; font-size: 14px; font-weight: 500;">${opp.body}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Capital</td>
                        <td style="padding: 6px 0; color: #10b981; font-size: 14px; font-weight: 700;">${opp.maxAward}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Deadline</td>
                        <td style="padding: 6px 0; color: #334155; font-size: 14px; font-weight: 600;">${opp.deadline}</td>
                    </tr>
                </table>
                
                <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">${opp.description}</p>
                
                <a href="${opp.link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 20px; border-radius: 8px;">Explore Mandate &rarr;</a>
            </div>
        `;
    });

    htmlContent += `
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="font-size: 15px; color: #334155; margin: 0 0 15px 0; font-weight: 500;">Ready to scan the full ecosystem?</p>
                <a href="${PUBLIC_SITE_URL}" style="display: inline-block; border: 2px solid #cbd5e1; color: #475569; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 24px; border-radius: 8px; margin-bottom: 24px;">Access Deal Flow Radar</a>
                
                <p style="font-size: 12px; color: #94a3b8; margin: 0; padding-top: 20px; border-top: 1px dashed #cbd5e1;">Sent securely via ABIF AI Agent System</p>
            </div>
        </div>
    `;

    try {
        const recipients = finalRecipients.split(',').map(e => e.trim()).filter(e => e).join(', ');

        const info = await transporter.sendMail({
            from: SMTP_FROM || '"ABIF AI Agent" <abif.tbimanager@gmail.com>',
            to: recipients,
            subject: aiSubject,
            html: htmlContent,
        });
        console.log(`  ✓ Email sent successfully to: ${recipients} (ID: ${info.messageId})`);

        // --- PERSISTENCE: Save current batch and metadata to history ---
        const dispatchMeta = {
            timestamp: new Date().toISOString(),
            recipients: recipients,
            subject: aiSubject,
            aiIntro: aiIntro,
            opportunityCount: targetOpps.length,
            opportunities: targetOpps.map(o => o.name),
            mode: mode,
            filters: filters
        };

        const META_FILE = path.join(process.cwd(), 'public', 'data', 'last_dispatch_meta.json');

        fs.writeFileSync(HISTORY_FILE, JSON.stringify(targetOpps, null, 2));
        fs.writeFileSync(META_FILE, JSON.stringify(dispatchMeta, null, 2));

        console.log('  ✓ History & Metadata updated for next dispatch.');

    } catch (error) {
        console.error('  ✗ Error sending email:', error);
        process.exit(1);
    }
}

sendEmail();
