export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://abif-funding-tracker.vercel.app';
export const GITHUB_REPO_URL = 'https://github.com/ttaruntej/abif-funding-radar';
export const EMAIL_WORKFLOW_URL = `${GITHUB_REPO_URL}/actions/workflows/send-email.yml`;
export const SYNC_WORKFLOW_URL = `${GITHUB_REPO_URL}/actions/workflows/source-sync.yml`;

const GITHUB_WORKFLOW_API_BASE = 'https://api.github.com/repos/ttaruntej/abif-funding-radar/actions/workflows';
const GITHUB_RAW_DATA_BASE = 'https://raw.githubusercontent.com/ttaruntej/abif-funding-radar/main/public/data';
const API_TIMEOUT_MS = 8000;

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
        const liveRes = await fetchJsonWithTimeout(`${API_BASE_URL}/api/trigger-email?action=fetch_meta`, { method: 'GET' });
        if (liveRes.ok) return await liveRes.json();
    } catch (err) {
        console.warn('Live dispatch metadata unavailable from API host.');
    }

    try {
        const githubRes = await fetchJsonWithTimeout(`${GITHUB_RAW_DATA_BASE}/last_dispatch_meta.json`, { method: 'GET' });
        if (githubRes.ok) return await githubRes.json();
    } catch (err) {
        console.warn('GitHub raw dispatch metadata unavailable.');
    }

    try {
        const staticRes = await fetchJsonWithTimeout(`./data/last_dispatch_meta.json`, { method: 'GET' });
        if (staticRes.ok) return await staticRes.json();
    } catch (err) {
        console.warn('Static dispatch metadata unavailable.');
    }

    return null;
};

/**
 * Trigger & Status for Verified Source Sync
 */
export const triggerScraper = async () => {
    console.log('Triggering Scraper...');

    try {
        const res = await fetchJsonWithTimeout(`${API_BASE_URL}/api/trigger-sync`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start verified source sync');
        return data;
    } catch (err) {
        throw new Error(`Failed to start verified source sync. Open GitHub fallback: ${SYNC_WORKFLOW_URL}`);
    }
};

export const getScraperStatus = async () => {
    try {
        const res = await fetchJsonWithTimeout(`${API_BASE_URL}/api/trigger-sync`, { method: 'GET' });
        if (!res.ok) throw new Error('Sync status unreachable');
        return await res.json();
    } catch (err) {
        return await fetchLatestWorkflowRunFromGitHub('source-sync.yml');
    }
};

/**
 * Trigger & Status for Email Intelligence Dispatch
 */
export const triggerEmail = async (target_emails, mode = 'standard', filters = {}) => {
    console.log(`[API] Attempting to trigger email dispatch (${mode}) via backend relay...`);
    console.log(`Target URL: ${API_BASE_URL}/api/trigger-email`);

    try {
        const res = await fetchJsonWithTimeout(`${API_BASE_URL}/api/trigger-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_emails, mode, filters })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Email trigger declined by server');

        console.log('[API] Trigger response received:', data);
        return data;
    } catch (err) {
        console.error('[Detailed Error Log]:', {
            message: err.message,
            url: `${API_BASE_URL}/api/trigger-email`,
            stack: err.stack
        });
        throw new Error(`Connection Error: ${err.message}. Open GitHub fallback: ${EMAIL_WORKFLOW_URL}`);
    }
};

export const getEmailStatus = async () => {
    try {
        const res = await fetchJsonWithTimeout(`${API_BASE_URL}/api/trigger-email`, { method: 'GET' });
        if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn('Email status polling via API host failed:', err.message);
        return await fetchLatestWorkflowRunFromGitHub('send-email.yml');
    }
};
