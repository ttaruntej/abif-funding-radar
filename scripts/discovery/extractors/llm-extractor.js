import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

/**
 * Parses a raw block of scraped text and attempts to extract a structured opportunity.
 * Returns null if the text does not contain a coherent funding/support opportunity.
 */
export async function extractOpportunityFromText(rawText, sourceContext) {
    if (!genAI) {
        console.warn('GEMINI_API_KEY not found. LLM Extractor disabled.');
        return null;
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `You are a strict data extraction AI for the ABIF Funding Radar.
Your task is to read the following raw webpage text and extract details about any startup funding, grants, incubator programs, or accelerator support.

RAW TEXT:
"""
${rawText.substring(0, 10000)} // Limit to 10k chars to save tokens/context
"""

SOURCE CONTEXT:
${JSON.stringify(sourceContext)}

Extract the opportunity into the following JSON schema. If the text does NOT describe an open or closed funding/support opportunity, return a JSON object with only "isOpportunity": false.

SCHEMA:
{
    "isOpportunity": true,
    "name": "Full name of the grant/program",
    "body": "The organization providing the support",
    "description": "A 1-2 sentence concise summary of what this is",
    "maxAward": "e.g., 'Up to ₹50 Lakhs' or 'Equity-free grant', or 'Check Website'",
    "deadline": "Format strictly as DD-MM-YYYY, or 'Rolling', or 'Check Website'. Return 'Check Website' if ambiguous.",
    "targetAudience": ["startup", "incubator"], // Array of who can apply
    "sectors": ["Agnostic", "DeepTech", "AgriTech", "etc"], // Array of sectors
    "stages": ["Ideation", "Prototype", "Seed", "Scale-up"],
    "criticalEligibility": ["Key eligibility highlight 1"] // Optional array
}
`;

        const result = await model.generateContent(prompt);
        const jsonStr = result.response.text().replace(/```json|```/g, "").trim();
        const extracted = JSON.parse(jsonStr);

        if (!extracted.isOpportunity) {
            return null;
        }

        delete extracted.isOpportunity;

        return {
            ...extracted,
            link: sourceContext.url || 'Check Website',
            dataSource: sourceContext.sourceId || 'auto:llm',
            linkStatus: 'probable',
            status: 'Check Website', // The dateToStatus logic can overwrite this later
        };
    } catch (err) {
        console.error('LLM Extraction failed:', err.message);
        return null;
    }
}
