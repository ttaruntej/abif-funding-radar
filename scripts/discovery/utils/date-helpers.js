export const MONTHS = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export function parseSingleDate(str) {
    if (!str) return null;
    str = str.trim();

    // DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (dmyMatch) {
        const [_, d, m, y] = dmyMatch;
        return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    }

    // DDth Month, YYYY or DD Month YYYY
    const nlMatch = str.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december),?\s+(\d{4})/i);
    if (nlMatch) {
        const month = String(MONTHS[nlMatch[2].toLowerCase()]).padStart(2, '0');
        const day = nlMatch[1].padStart(2, '0');
        return new Date(`${nlMatch[3]}-${month}-${day}`);
    }

    return null;
}

export function extractDeadlineDate(text) {
    if (!text) return null;
    // Strategy 1: Look for "Last Date[ :-–]" or similar deadline keywords followed by a date
    const lastDateSection = text.match(/(?:last\s*date|deadline|closing\s*date|closes\s*by|due\s*date|apply\s*by)[^\d]*(\d{1,2}(?:st|nd|rd|th)?[-\/\s,]+(?:\d{1,2}[-\/]|[a-z]+\s*)\d{4})/i);
    if (lastDateSection) {
        const d = parseSingleDate(lastDateSection[1]);
        if (d) return d;
    }
    return null;
}

export function dateToStatus(deadlineDate) {
    if (!deadlineDate) return 'Rolling';
    const today = new Date();
    const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Closed';
    if (diffDays <= 14) return 'Closing Soon';
    return 'Open';
}

export function determineStatus(text) {
    if (!text) return 'Rolling';
    const lower = text.toLowerCase();
    if (lower.includes('rolling') || lower.includes('throughout the year') || lower.includes('open all year')) return 'Rolling';
    const d = extractDeadlineDate(text);
    return dateToStatus(d);
}

export function formatDeadline(text) {
    if (!text) return 'Rolling';
    const d = extractDeadlineDate(text);
    if (!d) return text.trim().replace(/\s+/g, ' ');
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}
