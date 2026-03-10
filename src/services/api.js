const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://abif-funding-tracker.vercel.app';

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
        console.error('❌ Data Load Error:', err);
        throw err;
    }
};

export const fetchResearchReport = async () => {
    try {
        const res = await fetch(`./data/research_report.json`);
        if (!res.ok) throw new Error(`REPORT FETCH FAILED: ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('❌ Report Load Error:', err);
        return null;
    }
};

export const fetchDispatchMeta = async () => {
    try {
        // High-Priority: Fetch Live Meta from Proxy (Bypasses GH Pages Build Lag)
        const res = await fetch(`${API_BASE_URL}/api/trigger-email?action=fetch_meta`);
        if (res.ok) return await res.json();

        // Fallback: Fetch from Static JSON (May be delayed by 2-3 mins)
        const staticRes = await fetch(`./data/last_dispatch_meta.json`);
        if (staticRes.ok) return await staticRes.json();

        return null;
    } catch (err) {
        console.warn('ℹ️ Live dispatch meta unreachable, check API status.');
        return null;
    }
};

/**
 * Trigger & Status for Verified Source Sync
 */
export const triggerScraper = async () => {
    console.log('📡 Triggering Scraper...');
    const res = await fetch(`${API_BASE_URL}/api/trigger-sync`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start verified source sync');
    return data;
};

export const getScraperStatus = async () => {
    const res = await fetch(`${API_BASE_URL}/api/trigger-sync`, { method: 'GET' });
    if (!res.ok) throw new Error('Sync status unreachable');
    return await res.json();
};

/**
 * Trigger & Status for Email Intelligence Dispatch
 */
export const triggerEmail = async (target_emails, mode = 'standard', filters = {}) => {
    console.log(`📡 [API] Attempting to trigger email dispatch (${mode}) via Vercel Proxy...`);
    console.log(`🔗 Target URL: ${API_BASE_URL}/api/trigger-email`);

    try {
        const res = await fetch(`${API_BASE_URL}/api/trigger-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_emails, mode, filters })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Email trigger declined by server');

        console.log('✅ [API] Trigger response received:', data);
        return data;
    } catch (err) {
        console.error('📋 [Detailed Error Log]:', {
            message: err.message,
            url: `${API_BASE_URL}/api/trigger-email`,
            stack: err.stack
        });
        throw new Error(`Connection Error: ${err.message}. Please check if the Vercel API is online.`);
    }
};

export const getEmailStatus = async () => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/trigger-email`, { method: 'GET' });
        if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
        return await res.json();
    } catch (err) {
        // Log locally but throw cleanly for the UI
        console.warn('⚠️ Email status polling issue:', err.message);
        throw err;
    }
};
