import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REVIEW_QUEUE_FILE = path.join(__dirname, '../public/data/review_queue.json');
const OUTPUT_FILE = path.join(__dirname, '../public/data/review_artifacts.json');
const MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_LIMIT = 8;
const USER_AGENT = 'ABIF-V2-Artifact-Reviewer/1.0';

const argLimit = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = argLimit ? Number(argLimit.split('=')[1]) : DEFAULT_LIMIT;

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
let geminiDisabledReason = null;

function normalizeUrl(baseUrl, href) {
    try {
        return new URL(href, baseUrl).toString();
    } catch {
        return null;
    }
}

function getArtifactScore(url, text = '', itemName = '') {
    const lowerUrl = String(url).toLowerCase();
    const lowerText = String(text).toLowerCase();
    const itemTokens = String(itemName)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 4);
    let score = 0;

    if (lowerUrl.endsWith('.pdf')) score += 50;
    if (/\.(png|jpg|jpeg|webp)$/i.test(lowerUrl)) score += 35;
    if (/(guideline|brochure|notification|cfp|call|scheme|pdf|download|apply)/i.test(lowerUrl)) score += 20;
    if (/(guideline|brochure|notification|call|proposal|pdf|download|apply)/i.test(lowerText)) score += 20;
    if (/(code of conduct|privacy|cookie|terms)/i.test(`${lowerText} ${lowerUrl}`)) score -= 25;

    for (const token of itemTokens) {
        if (lowerUrl.includes(token) || lowerText.includes(token)) score += 8;
    }

    return score;
}

function extractArtifactCandidates(html, baseUrl, itemName) {
    const $ = cheerio.load(html);
    const seen = new Set();
    const candidates = [];

    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const label = $(el).text().trim();
        const resolved = normalizeUrl(baseUrl, href);
        if (!resolved || seen.has(resolved)) return;

        const lowerUrl = resolved.toLowerCase();
        const looksLikeArtifact = /\.(pdf|png|jpg|jpeg|webp)$/i.test(lowerUrl);
        const looksDocumentLike = /(guideline|brochure|notification|cfp|call|proposal|download|apply)/i.test(`${label} ${lowerUrl}`);

        if (!looksLikeArtifact && !looksDocumentLike) return;

        seen.add(resolved);
        candidates.push({
            url: resolved,
            label: label || null,
            score: getArtifactScore(resolved, label, itemName),
        });
    });

    return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
}

async function fetchUrl(url) {
    const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(30000),
    });

    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
        ok: response.ok,
        status: response.status,
        url: response.url,
        contentType,
        buffer,
    };
}

async function fetchLandingPage(item) {
    try {
        const result = await fetchUrl(item.link);
        const isHtml = /text\/html|application\/xhtml\+xml/i.test(result.contentType);
        const isArtifact = /application\/pdf|image\//i.test(result.contentType);

        if (isArtifact) {
            return {
                ok: result.ok,
                status: result.status,
                finalUrl: result.url,
                artifactDirect: {
                    url: result.url,
                    label: item.name,
                    mimeType: result.contentType,
                    sizeBytes: result.buffer.length,
                    buffer: result.buffer,
                },
                pageSnippet: '',
                artifactCandidates: [],
            };
        }

        const html = isHtml ? result.buffer.toString('utf8') : '';
        const bodyText = isHtml ? cheerio.load(html)('body').text().replace(/\s+/g, ' ').trim() : '';

        return {
            ok: result.ok,
            status: result.status,
            finalUrl: result.url,
            pageSnippet: bodyText.substring(0, 4000),
            artifactCandidates: isHtml ? extractArtifactCandidates(html, result.url, item.name) : [],
            artifactDirect: null,
        };
    } catch (error) {
        return {
            ok: false,
            status: null,
            finalUrl: item.link,
            pageSnippet: '',
            artifactCandidates: [],
            artifactDirect: null,
            error: error.message,
        };
    }
}

async function fetchArtifact(candidate) {
    try {
        const result = await fetchUrl(candidate.url);
        if (!result.ok) {
            return { ok: false, status: result.status, url: candidate.url, error: `HTTP ${result.status}` };
        }

        if (result.buffer.length > MAX_BYTES) {
            return { ok: false, status: result.status, url: candidate.url, error: `Artifact too large (${result.buffer.length} bytes)` };
        }

        return {
            ok: true,
            status: result.status,
            url: result.url,
            mimeType: result.contentType || 'application/octet-stream',
            sizeBytes: result.buffer.length,
            buffer: result.buffer,
            label: candidate.label,
        };
    } catch (error) {
        return { ok: false, status: null, url: candidate.url, error: error.message };
    }
}

function cleanJsonResponse(text) {
    return text.replace(/```json|```/g, '').trim();
}

function buildFallbackAnalysis(item, artifact, reason) {
    const sourceLink = artifact?.url || item.link || null;
    const notes = reason
        ? `Fallback heuristic used because Gemini extraction is unavailable: ${reason}`
        : 'Fallback heuristic used because no model extraction was attempted.';

    return {
        status: 'fallback',
        summary: `${item.name} requires manual verification from the official source before publication.`,
        deadline: item.deadline || null,
        targetAudience: null,
        criticalEligibility: [],
        applicationLink: sourceLink,
        publicationDecision: 'manual_review',
        confidence: 0.2,
        notes,
    };
}

async function analyzeArtifact(item, pageSnippet, artifact) {
    if (geminiDisabledReason) {
        return buildFallbackAnalysis(item, artifact, geminiDisabledReason);
    }

    if (!genAI) {
    return buildFallbackAnalysis(item, artifact, 'GEMINI_API_KEY is not configured in the current stack.');
    }

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
    });

    const parts = [
        {
            text:
                `You are reviewing an official opportunity artifact for ABIF Funding Tracker.\n` +
                `Return strict JSON with keys: summary, deadline, targetAudience, criticalEligibility, applicationLink, publicationDecision, confidence, notes.\n` +
                `criticalEligibility must be an array of short strings. confidence must be a number from 0 to 1.\n` +
                `Use null when information is unavailable.`,
        },
        {
            text:
                `Record metadata:\n${JSON.stringify({
                    name: item.name,
                    body: item.body,
                    category: item.category,
                    source: item.dataSource,
                    pageUrl: item.link,
                }, null, 2)}`,
        },
    ];

    if (pageSnippet) {
        parts.push({ text: `Landing page excerpt:\n${pageSnippet}` });
    }

    if (artifact?.buffer && artifact.mimeType) {
        parts.push({
            inlineData: {
                data: artifact.buffer.toString('base64'),
                mimeType: artifact.mimeType,
            },
        });
    }

    try {
        const result = await model.generateContent(parts);
        const text = cleanJsonResponse(result.response.text());
        return {
            status: 'completed',
            ...JSON.parse(text),
        };
    } catch (error) {
        if (/403|forbidden|leaked/i.test(error.message)) {
            geminiDisabledReason = error.message;
        }
        return buildFallbackAnalysis(item, artifact, error.message);
    }
}

function pickCandidates(queue) {
    return [...queue.items]
        .filter((item) => item.artifactReviewRecommended)
        .sort((a, b) => (b.reviewPriority || 0) - (a.reviewPriority || 0))
        .slice(0, LIMIT);
}

async function reviewItem(item) {
    const landing = await fetchLandingPage(item);

    let selectedArtifact = landing.artifactDirect;
    if (!selectedArtifact && landing.artifactCandidates.length > 0) {
        selectedArtifact = await fetchArtifact(landing.artifactCandidates[0]);
    }

    const analysis = await analyzeArtifact(item, landing.pageSnippet, selectedArtifact?.ok === false ? null : selectedArtifact);

    return {
        name: item.name,
        sourceLink: item.link,
        dataSource: item.dataSource,
        reviewPriority: item.reviewPriority,
        landingPage: {
            status: landing.status,
            ok: landing.ok,
            finalUrl: landing.finalUrl,
            error: landing.error || null,
        },
        artifactCandidates: landing.artifactCandidates,
        selectedArtifact: selectedArtifact
            ? {
                  url: selectedArtifact.url,
                  mimeType: selectedArtifact.mimeType || null,
                  sizeBytes: selectedArtifact.sizeBytes || null,
                  status: selectedArtifact.status || null,
                  error: selectedArtifact.error || null,
              }
            : null,
        analysis,
    };
}

async function main() {
    if (!fs.existsSync(REVIEW_QUEUE_FILE)) {
        throw new Error(`Missing review queue file: ${REVIEW_QUEUE_FILE}`);
    }

    const queue = JSON.parse(fs.readFileSync(REVIEW_QUEUE_FILE, 'utf8'));
    const selectedItems = pickCandidates(queue);
    const results = [];

    for (const item of selectedItems) {
        console.log(`Reviewing artifacts for: ${item.name}`);
        results.push(await reviewItem(item));
    }

    const output = {
        generatedAt: new Date().toISOString(),
        reviewedCount: results.length,
        geminiConfigured: Boolean(genAI),
        geminiOperational: Boolean(genAI) && !geminiDisabledReason,
        geminiDisabledReason,
        limit: LIMIT,
        items: results,
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`Artifact review records saved: ${results.length}`);
}

main();
