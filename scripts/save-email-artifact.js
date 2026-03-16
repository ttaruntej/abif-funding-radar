import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'opportunities.json');
const ARTIFACT_PATH = 'C:\\Users\\ABIF IIT KHARAGPUR\\.gemini\\antigravity\\brain\\7dd087ed-6498-4452-a9c6-f51636e737a1\\email_preview.md';
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://ttaruntej.github.io/abif-funding-radar/';
const PUBLIC_GITHUB_REPO_URL = process.env.PUBLIC_GITHUB_REPO_URL || 'https://github.com/ttaruntej/abif-funding-radar';

async function generatePreview() {
    const { GEMINI_API_KEY } = process.env;

    if (!fs.existsSync(DATA_FILE)) {
        console.error('Data file not found.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const incubatorOpps = data.filter(x =>
        x.targetAudience && x.targetAudience.includes('incubator') && x.status !== 'Closed'
    ).slice(0, 2);

    // --- AI GENERATION ---
    let aiIntro = `<p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 24px;">I have compiled my latest deep-scan across the Indian funding ecosystem. Here are the active mandates specifically relevant for your portfolio startups and incubator initiatives today:</p>`;

    let generatedAiText = "I have compiled my latest deep-scan across the Indian funding ecosystem. Here are the active mandates specifically relevant for your portfolio startups and incubator initiatives today:";

    if (GEMINI_API_KEY) {
        try {
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const prompt = `You are the ABIF Funding Intelligence Agent. Write a short, genuine, and encouraging 2-sentence email introduction addressed to Indian Incubator and Accelerator Managers. 
            Summarize the state of these active funding opportunities: ${JSON.stringify(incubatorOpps.map(o => o.name))}. 
            Make it sound professional, premium, and highlight the value of acting on these grants. Do not use generic greetings like "Dear XYZ". Start directly with the insight.`;

            const result = await model.generateContent(prompt);
            generatedAiText = result.response.text().trim().replace(/\n/g, '<br/>');
            aiIntro = `<p style="font-size: 16px; line-height: 1.6; color: #334155; margin-bottom: 24px; font-weight: 500;">${generatedAiText}</p>`;
        } catch (e) {
            console.warn('AI Generation failed, using default.');
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
            <span style="color: #64748b; font-size: 14px; font-weight: 500;">${new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
        
        ${aiIntro}

        <div style="height: 1px; background-color: #e2e8f0; margin: 30px 0;"></div>`;

    incubatorOpps.forEach((opp, i) => {
        let statusColor = opp.status === 'Closing Soon' ? '#ef4444' : opp.status === 'Open' ? '#10b981' : '#3b82f6';
        let statusBg = opp.status === 'Closing Soon' ? '#fef2f2' : opp.status === 'Open' ? '#ecfdf5' : '#eff6ff';
        htmlContent += `
        <div style="margin-bottom: 24px; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; background-color: #f8fafc;">
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
        </div>`;
    });

    htmlContent += `
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 15px; color: #334155; margin: 0 0 15px 0; font-weight: 500;">Ready to scan the full ecosystem?</p>
        <a href="${PUBLIC_SITE_URL}" style="display: inline-block; border: 2px solid #cbd5e1; color: #475569; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 24px; border-radius: 8px; margin-bottom: 24px;">Access Deal Flow Radar</a>
        
        <p style="font-size: 12px; color: #94a3b8; margin: 0; padding-top: 20px; border-top: 1px dashed #cbd5e1;">Sent securely via ABIF AI Agent System &bull; <a href="${PUBLIC_GITHUB_REPO_URL}" style="color: #94a3b8; text-decoration: underline;">GitHub</a></p>
    </div>
</div>`;

    const mdContent = `# Email Preview: Premium AI Dispatch\n\nThis is a preview of the email generated for incubator managers, featuring dynamic AI intelligence and a modernized layout.\n\n### 🧠 AI Generated Intro\n\n> ${generatedAiText}\n\n### 📧 Full Email HTML (Source Code View)\n\n\`\`\`html\n${htmlContent}\n\`\`\`\n\n### 🎨 Visual Structure\n- **Header**: Dark Slate with Blue accent\n- **Live Badge**: Dynamic date and "Live Dispatch" marker\n- **AI Insights**: Encouraging, professional summary\n- **Grant Cards**: Clean borders, easy-to-read tables, CTA buttons\n- **Footer**: Centralized access link to the live radar\n`;

    fs.writeFileSync(ARTIFACT_PATH, mdContent);
    console.log('Artifact created at:', ARTIFACT_PATH);
}

generatePreview();
