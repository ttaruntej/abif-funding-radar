import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'opportunities.json');
const HISTORY_FILE = path.join(process.cwd(), 'public', 'data', 'last_email_sent.json');
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://ttaruntej.github.io/abif-funding-radar/';

async function generatePreview() {
    const { GEMINI_API_KEY } = process.env;

    if (!fs.existsSync(DATA_FILE)) {
        console.error('Data file not found.');
        return;
    }

    const currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const incubatorOpps = currentData.filter(x =>
        x.targetAudience && x.targetAudience.includes('incubator') && x.status !== 'Closed'
    );

    // --- HISTORY TRACKING & DELTA ---
    let historyOpps = [];
    if (fs.existsSync(HISTORY_FILE)) {
        historyOpps = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }

    const newItems = incubatorOpps.filter(curr => !historyOpps.some(hist => hist.name === curr.name));
    const closedItems = historyOpps.filter(hist => !currentData.some(curr => curr.name === hist.name && curr.status !== 'Closed'));

    // --- AI GENERATION ---
    let aiIntro = `<p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 24px;">The ABIF AI Intelligence Agent is currently scanning the ecosystem. Here are the active mandates identified during our comprehensive search across the Indian funding landscape:</p>`;
    let aiSubject = `📡 [Ecosystem Intelligence] ${incubatorOpps.length} Active Funding Mandates Detected`;

    if (GEMINI_API_KEY) {
        try {
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const today = new Date().toLocaleString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' });

            const prompt = `[ROLE] You are the ABIF AI Intelligence Agent. You provide neutral, ecosystem-wide intelligence.
            [MANDATORY OPENING] Your intro MUST start with: "Ecosystem Intelligence Update:"
            [FORBIDDEN] DO NOT MENTION "Tarun", "Thadana", or "Personalized Agent".
            [FORBIDDEN] DO NOT USE THE WORD "Your" when referring to the agent.
            [TASK] Provide a high-level briefing on the entire Indian Funding and AgriTech Ecosystem for ${today}.
            [CONTEXT] Standard broad-spectrum scan results for incubator-level mandates. Changes: ${newItems.length} new, ${closedItems.length} closed.
            [DATA] ${JSON.stringify(incubatorOpps.map(o => o.name).slice(0, 10))}.
            
            Format your response as a JSON object:
            {
              "subject": "Ecosystem Intel: [Brief Insight] ([Date])",
              "intro": "The professional intro text. Describe the scan as covering the entire Indian Funding and AgriTech Ecosystem."
            }
            
            [TONE] Authoritative and objective.`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(cleanJson);

            // --- Programmatic Sanitization (Second Layer of Defense) ---
            let sanitizedIntro = aiData.intro || '';

            if (!sanitizedIntro.startsWith('Ecosystem Intelligence Update:')) {
                sanitizedIntro = 'Ecosystem Intelligence Update: ' + sanitizedIntro.replace(/^(Greetings|Hello|Hi)([^,.]*)[,.]/i, '').trim();
            }

            sanitizedIntro = sanitizedIntro
                .replace(/Tarun|Thadana/gi, 'ABIF Strategic Teams')
                .replace(/your dedicated AI Agent|Tarun's AI Agent|your personalized AI Agent/gi, 'the ABIF AI Intelligence Agent')
                .replace(/Greetings[,.]/gi, 'Ecosystem Intelligence Update:')
                .replace(/of the ABIF[^.]*ecosystem/gi, 'of the Indian Funding and AgriTech Ecosystem');

            aiSubject = aiData.subject;
            aiIntro = `<div style="font-size: 16px; line-height: 1.6; color: #334155; margin-bottom: 24px; font-weight: 500;">${sanitizedIntro}</div>`;
        } catch (e) {
            console.warn('AI failed:', e.message);
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
        <div style="margin-bottom: 20px;">
            <span style="background-color: #dbeafe; color: #2563eb; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Live Dispatch</span>
            <span style="color: #64748b; font-size: 14px; margin: 0 5px;">•</span>
            <span style="color: #64748b; font-size: 14px; font-weight: 500;">${new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
        
        <div style="margin-bottom: 10px; font-size: 18px; font-weight: 700; color: #1e293b;">Subject: ${aiSubject}</div>
        
        ${aiIntro}

        <!-- Delta Highlights -->
        ${newItems.length > 0 || closedItems.length > 0 ? `
        <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 30px; border: 1px dashed #cbd5e1;">
            <h4 style="margin: 0 0 12px 0; color: #1e293b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Intelligence Delta Analysis</h4>
            ${newItems.length > 0 ? `
                <div style="margin-bottom: 10px;">
                    <span style="color: #059669; font-weight: 700; font-size: 13px;">🆕 NEW DISCOVERIES:</span>
                    <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #475569; font-size: 13px;">
                        ${newItems.slice(0, 5).map(item => `<li>${item.name}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${closedItems.length > 0 ? `
                <div>
                    <span style="color: #dc2626; font-weight: 700; font-size: 13px;">⚠️ RECENTLY CLOSED:</span>
                    <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #475569; font-size: 13px;">
                        ${closedItems.slice(0, 5).map(item => `<li>${item.name}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
        ` : ''}

        <div style="height: 1px; background-color: #e2e8f0; margin: 30px 0;"></div>`;

    incubatorOpps.slice(0, 5).forEach((opp, i) => {
        let statusColor = opp.status === 'Closing Soon' ? '#ef4444' : opp.status === 'Open' ? '#10b981' : '#3b82f6';
        let statusBg = opp.status === 'Closing Soon' ? '#fef2f2' : opp.status === 'Open' ? '#ecfdf5' : '#eff6ff';
        htmlContent += `
        <div style="margin-bottom: 24px; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; background-color: #f8fafc;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <h3 style="margin: 0; color: #0f172a; font-size: 18px; font-weight: 700; line-height: 1.4; width: 75%;">${opp.name}</h3>
                <span style="background-color: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusColor}40; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">${opp.status}</span>
            </div>
            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">${opp.description}</p>
        </div>`;
    });

    htmlContent += `
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 15px; color: #334155; margin: 0 0 15px 0; font-weight: 500;">Ready to scan the full ecosystem?</p>
        <a href="${PUBLIC_SITE_URL}" style="display: inline-block; border: 2px solid #cbd5e1; color: #475569; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 24px; border-radius: 8px; margin-bottom: 24px;">Access Deal Flow Radar</a>
        
        <p style="font-size: 12px; color: #94a3b8; margin: 0; padding-top: 20px; border-top: 1px dashed #cbd5e1;">Sent securely via ABIF AI Agent System</p>
    </div>
</div>`;

    fs.writeFileSync('email_preview.html', htmlContent);
    console.log('Preview generated: email_preview.html');
}

generatePreview();
