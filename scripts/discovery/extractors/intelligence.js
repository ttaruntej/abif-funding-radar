import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// -- Logic-based analytical summary (The Heuristic Fallback) --
function analyzeLogic(active, audience, timestamp, dateStr) {
    const sectors = {
        'Incubator R&D Hubs': active.filter(x => /nidhi|tide|samridh|bionest/i.test((x.name || '') + (x.body || '') + (x.description || ''))).length,
        'Ecosystem Enablers': active.filter(x => /ecosystem|accelerator|scale|grant/i.test((x.name || '') + (x.body || '') + (x.description || ''))).length,
        'CSR / Institutional': active.filter(x => /csr|foundation|hdfc|sbi/i.test((x.name || '') + (x.body || '') + (x.description || ''))).length,
        'General Tech / Startups': active.filter(x => /startup|seed/i.test((x.name || '') + (x.body || '') + (x.description || ''))).length
    };
    const topSector = Object.entries(sectors).sort((a, b) => b[1] - a[1])[0];
    const incubatorCount = active.filter(x => x.targetAudience?.includes('incubator')).length;
    const closingSoon = active.filter(x => x.status === 'Closing Soon').length;

    if (audience === 'incubator') {
        let executiveSummary = `As of ${dateStr}, the Indian incubator funding ecosystem shows a ${incubatorCount > 5 ? 'robust' : 'moderate'} activity level with ${incubatorCount} open programs directly supporting Section 8 operations. `;
        if (topSector && topSector[1] > 2) executiveSummary += `There is a significant tactical focus on ${topSector[0]}, which accounts for a major portion of current open calls. `;
        if (closingSoon > 0) executiveSummary += `Urgency is currently elevated with ${closingSoon} ecosystem programs entering their final week of application. `;

        return {
            title: `ABIF Incubator Funding Analysis ${new Date().getFullYear()}`,
            generatedAt: new Date().toISOString(),
            executiveSummary,
            keyTrends: [
                {
                    trend: "Section 8 Operational Support",
                    detail: `${incubatorCount} active programs currently offer direct support for incubator operations, HR, or cohort management.`
                },
                {
                    trend: "Sectoral Dominance",
                    detail: `${topSector ? topSector[0] : 'General Tech'} remains a primary driver of new capital calls in this current cycle.`
                },
                {
                    trend: "Strategic Shifts",
                    detail: incubatorCount > 5 ? "Expansion noted in central government calls (BIRAC/DST/MeitY) for deep-science R&D infrastructure." : "Stable funding landscape with a pivot toward CSR and State-specific rolling grants for enablers."
                }
            ],
            actionableRecommendations: [
                closingSoon > 0 ? `Immediately prioritize "Closing Soon" calls from ${active.find(x => x.status === 'Closing Soon' && x.targetAudience?.includes('incubator'))?.body || 'Government Providers'}.` : "Begin drafting concept notes for the upcoming summer Q2 capability expansion cycles.",
                "Review MeitY TIDE 2.0 / SAMRIDH eligibility for institutional setup and matched funding access.",
                "Conduct technical readiness and impact audits for impending CSR matchmaking calls."
            ],
            briefingFooter: `Synthesized by ABIF Research Engine v2.1 • Logic Fallback Mode • Verified ${timestamp}`
        };
    } else {
        let executiveSummary = `As of ${dateStr}, the Indian startup funding ecosystem maintains a steady pace with ${active.length} active opportunities. `;
        if (topSector && topSector[1] > 2) executiveSummary += `A major concentration of capital is directed towards ${topSector[0]}. `;
        if (closingSoon > 0) executiveSummary += `Founders should note ${closingSoon} grants closing imminently. `;

        return {
            title: `ABIF Startup Funding Analysis ${new Date().getFullYear()}`,
            generatedAt: new Date().toISOString(),
            executiveSummary,
            keyTrends: [
                {
                    trend: "Capital Concentration",
                    detail: `${active.length} active programs provide direct equity free capital or seed support to startups.`
                },
                {
                    trend: "Sectoral Focus",
                    detail: `${topSector ? topSector[0] : 'General Tech'} dominates current funding priorities for startups.`
                },
                {
                    trend: 'Ecosystem Velocity',
                    detail: closingSoon > 5 ? "High urgency cycle; multiple central grants closing soon." : "Steady state funding; rolling grants provide continuous application windows."
                }
            ],
            actionableRecommendations: [
                closingSoon > 0 ? `Fast-track applications for the ${closingSoon} grants closing this week.` : "Prepare investor readiness dossiers for upcoming state grants.",
                "Match startup stage with grant requirements carefully to prevent high rejection rates.",
                "Leverage rolling state grants as a constant baseline for early-stage portfolio companies."
            ],
            briefingFooter: `Synthesized by ABIF Research Engine v2.1 • Logic Fallback Mode • Verified ${timestamp}`
        };
    }
}

export async function generateStrategicReport(data, audience = 'startup') {
    let active = data.filter(x => x.status !== 'Closed');

    // Filter active dataset based on audience preference for the report
    if (audience === 'incubator') {
        active = active.filter(x => x.targetAudience?.includes('incubator'));
    } else {
        // Startup report leans heavily on capital amount or general availability
        active = active.filter(x => !x.targetAudience?.includes('incubator') || x.targetAudience?.includes('startup'));
    }

    const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (genAI) {
        console.log('\n--- Consulting Gemini (Deep Intelligence) ---');
        try {
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: { responseMimeType: "application/json" }
            });

            // Extract just the core info to keep token count low
            const subset = active.map(o => ({
                name: o.name,
                provider: o.body,
                award: o.maxAward,
                category: o.category,
                deadline: o.deadline,
                status: o.status
            })).slice(0, 50);

            let prompt = '';
            if (audience === 'incubator') {
                prompt = `You are a strategic intelligence analyst for ABIF, advising Section 8 Incubators and Host Institutes in India.
Your goal is to identify funding that supports INCREASING INCUBATOR EFFICIENCY, OPERATIONAL RELIABILITY, and ECOSYSTEM IMPACT, not just standalone startup funding.
Analyze these ${subset.length} active funding opportunities: ${JSON.stringify(subset)}

Generate a Strategic Research Report expressly for Incubator Managers and Section 8 Directors.
Your response must be a JSON object with this EXACT schema:
{
    "title": "ABIF Incubator Funding Analysis ${new Date().getFullYear()}",
    "generatedAt": "ISO Timestamp",
    "executiveSummary": "A human-like, professional 2-3 sentence overview of the current funding climate specifically highlighting opportunities for incubator capacity building, operational grants, and ecosystem support programs (like NIDHI, BioNEST, TIDE 2.0).",
    "keyTrends": [
        {"trend": "Trend Name", "detail": "Detailed insight about what providers like BIRAC/DST/MeitY are offering to incubators for infrastructure, operational support, or HR."}
    ],
    "actionableRecommendations": [
        "Recommendation 1 starting with a verb (e.g. Audit your NIDHI PRAYAS eligibility to maintain operational influx)",
        "Recommendation 2 starting with a verb",
        "Recommendation 3 starting with a verb"
    ],
    "briefingFooter": "Synthesized by ABIF Neural Engine (Powered by Gemini 2.5 Flash) • Verified ${timestamp}"
}

Be insightful. Mention specific incubator support programs like MeitY TIDE, DST NIDHI, or BIRAC BioNEST if they are active. 
Prioritize highlighting opportunities that provide direct operational funding to setup Section 8 infrastructure.`;
            } else {
                prompt = `You are a strategic intelligence analyst for ABIF, advising early-stage deep-tech and agritech founders in India.
Your goal is to identify funding that supports STARTUP RUNWAY, PRODUCT DEVELOPMENT, and MARKET ENTRY.
Analyze these ${subset.length} active funding opportunities: ${JSON.stringify(subset)}

Generate a Strategic Research Report expressly for Startup Founders.
Your response must be a JSON object with this EXACT schema:
{
    "title": "ABIF Startup Funding Analysis ${new Date().getFullYear()}",
    "generatedAt": "ISO Timestamp",
    "executiveSummary": "A human-like, professional 2-3 sentence overview of the current startup funding climate highlighting seed capital, equity-free grants, and major accelerators.",
    "keyTrends": [
        {"trend": "Trend Name", "detail": "Detailed insight about where the capital is flowing, e.g., sectors receiving the most grants."}
    ],
    "actionableRecommendations": [
        "Recommendation 1 starting with a verb (e.g. Accelerate applications for state-sponsored seed funds)",
        "Recommendation 2 starting with a verb",
        "Recommendation 3 starting with a verb"
    ],
    "briefingFooter": "Synthesized by ABIF Neural Engine (Powered by Gemini 2.5 Flash) • Verified ${timestamp}"
}

Be insightful. Help founders prioritize their grant applications based on closing dates and award sizes.`;
            }

            const result = await model.generateContent(prompt);
            const rawResponse = result.response.text();

            const jsonStr = rawResponse.replace(/```json|```/g, "").trim();
            const geminiReport = JSON.parse(jsonStr);

            console.log('  ? Gemini synthesis complete.');
            return geminiReport;
        } catch (err) {
            console.error('  ? Gemini API failed. Falling back to Logic Engine.', err.message);
            return analyzeLogic(active, audience, timestamp, dateStr);
        }
    }

    return analyzeLogic(active, audience, timestamp, dateStr);
}
