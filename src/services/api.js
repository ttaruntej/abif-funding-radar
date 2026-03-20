const PROD_API_BASE_URL = 'https://abif-funding-radar-api.vercel.app';
const RAW_CONFIGURED_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim();
const CONFIGURED_API_BASE_URL = (RAW_CONFIGURED_API_BASE_URL || PROD_API_BASE_URL).replace(/\/$/, '');
const PREFER_LOCAL_API = import.meta.env.VITE_PREFER_LOCAL_API === 'true';
const LOCAL_API_BASE_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

const API_BASE_CANDIDATES = (() => {
    const orderedBases = [PROD_API_BASE_URL];
    const configuredIsLocal = LOCAL_API_BASE_PATTERN.test(CONFIGURED_API_BASE_URL);

    if (CONFIGURED_API_BASE_URL !== PROD_API_BASE_URL) {
        // Local API endpoints are opt-in during frontend dev to avoid noisy connection-refused errors.
        if (configuredIsLocal && !PREFER_LOCAL_API) {
            orderedBases.push(CONFIGURED_API_BASE_URL);
        } else {
            orderedBases.unshift(CONFIGURED_API_BASE_URL);
        }
    }

    return Array.from(new Set(orderedBases.map((base) => base.replace(/\/$/, ''))));
})();

export const API_BASE_URL = API_BASE_CANDIDATES[0];
export const GITHUB_REPO_URL = 'https://github.com/ttaruntej/abif-funding-radar';
export const EMAIL_WORKFLOW_URL = `${GITHUB_REPO_URL}/actions/workflows/send-email.yml`;
export const SYNC_WORKFLOW_URL = `${GITHUB_REPO_URL}/actions/workflows/source-sync.yml`;

const GITHUB_WORKFLOW_API_BASE = 'https://api.github.com/repos/ttaruntej/abif-funding-radar/actions/workflows';
const GITHUB_RAW_DATA_BASE = 'https://raw.githubusercontent.com/ttaruntej/abif-funding-radar/main/public/data';
const API_TIMEOUT_MS = 4000;
const ACCESS_TOKEN_STORAGE_KEY = 'site_access_token';
const AUTH_FLAG_STORAGE_KEY = 'site_auth';
const AUTH_EXPIRED_EVENT = 'abif-auth-expired';
let authExpiredNotified = false;

export const getAccessToken = () => {
    try {
        return sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || '';
    } catch (e) {
        return '';
    }
};

const buildAuthHeaders = (headers = {}) => {
    const token = getAccessToken();
    if (!token) {
        return { ...(headers || {}) };
    }

    return {
        ...(headers || {}),
        Authorization: `Bearer ${token}`
    };
};

const clearAuthSession = () => {
    try {
        sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
        sessionStorage.removeItem(AUTH_FLAG_STORAGE_KEY);
    } catch (e) { }
};

const authError = (message = 'Session expired. Please sign in again.') => {
    clearAuthSession();

    if (!authExpiredNotified && typeof window !== 'undefined') {
        authExpiredNotified = true;
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
            detail: { message }
        }));
        setTimeout(() => {
            authExpiredNotified = false;
        }, 500);
    }

    const error = new Error(message);
    error.code = 'AUTH';
    return error;
};

const isAuthError = (error) => error && error.code === 'AUTH';

const parseJsonSafe = async (response) => response.json().catch(() => ({}));

const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = API_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                ...(options.headers || {})
            }
        });
    } finally {
        clearTimeout(timer);
    }
};

const fetchFromApiWithFallback = async (path, options = {}, timeoutMs = API_TIMEOUT_MS) => {
    let lastError = null;

    for (const base of API_BASE_CANDIDATES) {
        try {
            return await fetchJsonWithTimeout(`${base}${path}`, options, timeoutMs);
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error(`Unable to reach API route: ${path}`);
};

const fetchLatestWorkflowRunFromGitHub = async (workflowId) => {
    const res = await fetchJsonWithTimeout(`${GITHUB_WORKFLOW_API_BASE}/${workflowId}/runs?per_page=1`, {
        method: 'GET'
    });

    if (!res.ok) {
        throw new Error(`GitHub workflow status check failed: ${res.status}`);
    }

    const data = await res.json();
    const lastRun = data.workflow_runs?.[0];

    if (!lastRun) {
        return { status: 'unknown' };
    }

    return {
        status: lastRun.status,
        conclusion: lastRun.conclusion,
        updated_at: lastRun.updated_at,
        run_id: lastRun.id
    };
};

const ensureAuthorizedOrThrow = async (response) => {
    if (response.status !== 401 && response.status !== 403) {
        return;
    }

    const payload = await parseJsonSafe(response);
    throw authError(payload.error || 'Session expired. Please sign in again.');
};

/**
 * Fetch local data files
 */
export const fetchOpportunities = async () => {
    try {
        const curatedRes = await fetch(`./data/publishable_opportunities.json`);
        if (curatedRes.ok) return await curatedRes.json();

        const fallbackRes = await fetch(`./data/opportunities.json`);
        if (!fallbackRes.ok) throw new Error(`JSON FETCH FAILED: ${fallbackRes.status}`);
        return await fallbackRes.json();
    } catch (err) {
        console.error('Data Load Error:', err);
        throw err;
    }
};

export const fetchResearchReport = async () => {
    try {
        const res = await fetch(`./data/research_report.json`);
        if (!res.ok) throw new Error(`REPORT FETCH FAILED: ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('Report Load Error:', err);
        return null;
    }
};

export const fetchDispatchMeta = async () => {
    try {
        const liveRes = await fetchFromApiWithFallback(`/api/trigger-email?action=fetch_meta`, {
            method: 'GET',
            headers: buildAuthHeaders()
        });
        await ensureAuthorizedOrThrow(liveRes);
        if (liveRes.ok) return await liveRes.json();
    } catch (err) {
        if (isAuthError(err)) throw err;
    }

    try {
        const githubRes = await fetchJsonWithTimeout(`${GITHUB_RAW_DATA_BASE}/last_dispatch_meta.json`, { method: 'GET' });
        if (githubRes.ok) return await githubRes.json();
    } catch (err) { }

    try {
        const staticRes = await fetchJsonWithTimeout(`./data/last_dispatch_meta.json`, { method: 'GET' });
        if (staticRes.ok) return await staticRes.json();
    } catch (err) { }

    return null;
};

/**
 * Trigger & Status for Verified Source Sync
 */
export const triggerScraper = async () => {
    console.log('Triggering Scraper...');
    let res;
    try {
        res = await fetchFromApiWithFallback(`/api/trigger-sync`, {
            method: 'POST',
            headers: buildAuthHeaders()
        });
    } catch (err) {
        throw new Error(`Failed to start sync: relay unreachable (${err.message || 'request failed'})`);
    }

    const data = await parseJsonSafe(res);
    if (res.ok) return data;
    if (res.status === 401 || res.status === 403) {
        throw authError(data.error || 'Session expired. Please sign in again.');
    }
    throw new Error(data.message || data.error || `Failed to start sync via relay (${res.status})`);
};

export const getScraperStatus = async () => {
    try {
        const res = await fetchFromApiWithFallback(`/api/trigger-sync`, {
            method: 'GET',
            headers: buildAuthHeaders()
        });

        await ensureAuthorizedOrThrow(res);

        if (!res.ok) throw new Error('Sync status unreachable');
        return await res.json();
    } catch (err) {
        if (isAuthError(err)) {
            throw err;
        }
        return await fetchLatestWorkflowRunFromGitHub('source-sync.yml');
    }
};

/**
 * Trigger & Status for Email Intelligence Dispatch
 */
export const triggerEmail = async (target_emails, mode = 'standard', filters = {}) => {
    let res;
    try {
        res = await fetchFromApiWithFallback(`/api/trigger-email`, {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ target_emails, mode, filters })
        });
    } catch (err) {
        console.error('[Detailed Error Log]:', { message: err.message, url: `${API_BASE_URL}/api/trigger-email` });
        throw new Error(`Failed to trigger email: relay unreachable (${err.message || 'request failed'})`);
    }

    const data = await parseJsonSafe(res);
    if (res.ok) {
        console.log('[API] Trigger response received:', data);
        return data;
    }

    if (res.status === 401 || res.status === 403) {
        throw authError(data.error || 'Session expired. Please sign in again.');
    }

    throw new Error(data.message || data.error || `Failed to trigger email via relay (${res.status})`);
};

export const getEmailStatus = async () => {
    try {
        const res = await fetchFromApiWithFallback(`/api/trigger-email`, {
            method: 'GET',
            headers: buildAuthHeaders()
        });

        await ensureAuthorizedOrThrow(res);

        if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
        return await res.json();
    } catch (err) {
        if (isAuthError(err)) {
            throw err;
        }
        return await fetchLatestWorkflowRunFromGitHub('send-email.yml');
    }
};

/**
 * Fetch Ecosystem Suggestions
 */
export const fetchSuggestions = async () => {
    try {
        const liveRes = await fetchFromApiWithFallback(`/api/send-feedback?action=fetch_suggestions`, {
            method: 'GET',
            headers: buildAuthHeaders()
        });
        await ensureAuthorizedOrThrow(liveRes);
        if (liveRes.ok) return await liveRes.json();
    } catch (err) {
        if (isAuthError(err)) throw err;
    }

    try {
        const githubRes = await fetchJsonWithTimeout(`${GITHUB_RAW_DATA_BASE}/suggestions.json`, { method: 'GET' });
        if (githubRes.ok) return await githubRes.json();
    } catch (err) { }

    try {
        const staticRes = await fetchJsonWithTimeout(`./data/suggestions.json`, { method: 'GET' });
        if (staticRes.ok) return await staticRes.json();
    } catch (err) { }

    return [];
};
