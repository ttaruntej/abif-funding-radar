export function cleanName(raw) {
    return raw
        .replace(/\s+/g, ' ')
        .replace(/\u2026/g, '...')
        .replace(/\.{3,}$/g, '')
        .replace(/\.{2,}$/g, '')
        .replace(/Last\s*Date\s*:.*/i, '')
        .replace(/Extended\s*Last\s*date.*/i, '')
        .replace(/\s*:\s*\d{1,2}.*\d{4}.*$/, '')
        .replace(/\(\s*new\s*tab\s*\)/i, '')
        .trim();
}

export function isUsableOpportunityName(name) {
    if (!name || name.length < 12) return false;
    if (/^click here/i.test(name)) return false;
    if (/project proposal format/i.test(name)) return false;
    if (/^(home|details|read more|apply now)$/i.test(name)) return false;
    return /[a-z]{3}/i.test(name);
}

export function normalizeTextContent(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

export function clipText(text, maxLength = 280) {
    const normalized = normalizeTextContent(text);
    if (normalized.length <= maxLength) return normalized;

    const clipped = normalized.slice(0, maxLength);
    const sentenceEnd = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('; '));
    if (sentenceEnd > maxLength * 0.55) {
        return clipped.slice(0, sentenceEnd + 1).trim();
    }

    const wordEnd = clipped.lastIndexOf(' ');
    return `${clipped.slice(0, wordEnd > 40 ? wordEnd : maxLength).trim()}...`;
}

export function findLongestParagraph($, selectors = 'main p, article p, .entry-content p, .site-content p, p') {
    const paragraphs = $(selectors)
        .map((_, el) => normalizeTextContent($(el).text()))
        .get()
        .filter((text) => text.length > 80 && !/share on|facebook|twitter|linkedin|screen reader/i.test(text));

    return paragraphs[0] || '';
}

export function extractTextBlock(sourceText, startMarker, endMarkers = []) {
    const normalized = normalizeTextContent(sourceText);
    if (!normalized) return '';

    const lower = normalized.toLowerCase();
    const startIdx = lower.indexOf(startMarker.toLowerCase());
    if (startIdx < 0) return '';

    let endIdx = normalized.length;
    for (const marker of endMarkers) {
        const markerIdx = lower.indexOf(marker.toLowerCase(), startIdx + startMarker.length);
        if (markerIdx > startIdx && markerIdx < endIdx) {
            endIdx = markerIdx;
        }
    }

    return normalizeTextContent(normalized.slice(startIdx, endIdx))
        .replace(/&#8216;|&#8217;/g, "'")
        .replace(/&amp;/g, '&');
}

export function extractAnchorHref($, baseUrl, matcher) {
    let resolved = null;
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = normalizeTextContent($(el).text());
        if (!matcher({ href, text })) return;

        try {
            resolved = new URL(href, baseUrl).toString();
            return false;
        } catch {
            return null;
        }
    });

    return resolved;
}
