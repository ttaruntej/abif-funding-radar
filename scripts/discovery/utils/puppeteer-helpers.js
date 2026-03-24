/**
 * Array Chunker for Controlled Concurrency
 */
export function chunkArray(array, size) {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

/**
 * Generic Retry Wrapper for Flaky Network Calls
 */
export async function withRetry(operation, maxRetries = 2, delayMs = 2000) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await operation();
        } catch (e) {
            lastError = e;
            if (i < maxRetries) {
                await new Promise(res => setTimeout(res, delayMs));
            }
        }
    }
    throw lastError;
}

/**
 * Blocks heavy/unnecessary assets from downloading (CSS, Fonts, Images, Media)
 * Slashes individual page load times from ~20s to < 3s.
 */
export async function setupPageInterception(page) {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const type = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media', 'other'].includes(type) && !req.url().includes('captcha')) {
            req.abort();
        } else {
            req.continue();
        }
    });
}

export async function probeDirectHttpLink(url) {
    try {
        const response = await fetch(url, {
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(15000),
        });
        return {
            status: response.status,
            ok: response.ok,
            error: null,
        };
    } catch (error) {
        return {
            status: 0,
            ok: false,
            error: error.message,
        };
    }
}
