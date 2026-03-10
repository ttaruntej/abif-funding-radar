import { useEffect, useRef, useState } from 'react';
import { triggerScraper, getScraperStatus } from '../services/api';
import ReactGA from "react-ga4";

const SYNC_STAGES = [
    {
        key: 'dispatch',
        label: 'Dispatch sync request',
        description: 'Ask the backend bridge to start a verified-source workflow.',
    },
    {
        key: 'queue',
        label: 'Wait for GitHub runner',
        description: 'GitHub Actions has accepted the run and is assigning capacity.',
    },
    {
        key: 'collect',
        label: 'Collect official sources',
        description: 'Pull opportunities from verified portals and source pages.',
    },
    {
        key: 'verify',
        label: 'Verify links and deadlines',
        description: 'Normalize statuses, deduplicate, and validate live links.',
    },
    {
        key: 'review',
        label: 'Build review queue',
        description: 'Flag lower-confidence records and artifact-heavy items for review.',
    },
    {
        key: 'reload',
        label: 'Refresh dashboard dataset',
        description: 'Reload the newest JSON so the frontend shows the updated radar.',
    },
];

const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const resolveActiveStageIndex = ({ syncRunId, serverStatus, elapsedTime, refreshSuccess, syncError }) => {
    if (refreshSuccess) return SYNC_STAGES.length - 1;
    if (syncError) return Math.min(SYNC_STAGES.length - 2, Math.max(0, Math.floor(elapsedTime / 12) + 1));
    if (!syncRunId) return 0;
    if (serverStatus === 'queued') return 1;
    if (serverStatus === 'in_progress') {
        if (elapsedTime < 10) return 2;
        if (elapsedTime < 22) return 3;
        if (elapsedTime < 36) return 4;
        return 5;
    }
    if (serverStatus === 'completed') return 5;
    return 0;
};

const buildSyncSteps = (state) => {
    const activeStageIndex = resolveActiveStageIndex(state);

    return SYNC_STAGES.map((stage, index) => {
        let status = 'pending';

        if (state.refreshSuccess) {
            status = 'complete';
        } else if (state.syncError) {
            if (index < activeStageIndex) status = 'complete';
            else if (index === activeStageIndex) status = 'error';
        } else if (index < activeStageIndex) {
            status = 'complete';
        } else if (index === activeStageIndex) {
            status = 'active';
        }

        return {
            ...stage,
            status,
        };
    });
};

const buildSyncSummary = (state) => {
    const { syncRunId, serverStatus, elapsedTime, refreshSuccess, syncError } = state;

    if (refreshSuccess) {
        return {
            title: 'Sync Finished',
            subtitle: 'Fresh verified-source data has been loaded into the dashboard.',
            tone: 'success',
        };
    }

    if (syncError) {
        return {
            title: 'Sync Needs Attention',
            subtitle: syncError,
            tone: 'error',
        };
    }

    if (!syncRunId) {
        return {
            title: 'Dispatching Sync',
            subtitle: 'Sending the workflow request through the backend bridge.',
            tone: 'active',
        };
    }

    if (serverStatus === 'queued') {
        return {
            title: 'Workflow Queued',
            subtitle: 'GitHub Actions has accepted the run and is waiting for a runner.',
            tone: 'active',
        };
    }

    if (elapsedTime < 10) {
        return {
            title: 'Collecting Sources',
            subtitle: 'Pulling records from official portals and verified source pages.',
            tone: 'active',
        };
    }

    if (elapsedTime < 22) {
        return {
            title: 'Verifying Records',
            subtitle: 'Checking links, deadlines, and normalized opportunity states.',
            tone: 'active',
        };
    }

    if (elapsedTime < 36) {
        return {
            title: 'Building Review Queue',
            subtitle: 'Separating publishable records from items that need deeper review.',
            tone: 'active',
        };
    }

    return {
        title: 'Refreshing Dashboard',
        subtitle: 'Preparing the final dataset and waiting for the frontend to reload it.',
        tone: 'active',
    };
};

const buildSyncProgress = (state) => {
    if (state.refreshSuccess || state.syncError) return 100;

    const activeStageIndex = resolveActiveStageIndex(state);
    const stageBase = activeStageIndex * 16;
    const stagePulse = state.serverStatus === 'in_progress' ? Math.min(12, Math.floor((state.elapsedTime % 12) * 1.2)) : 4;

    return Math.min(96, 10 + stageBase + stagePulse);
};

export const useScraperSync = (addLog, loadData) => {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshSuccess, setRefreshSuccess] = useState(false);
    const [serverStatus, setServerStatus] = useState(null);
    const [syncStartTime, setSyncStartTime] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [cooldown, setCooldown] = useState(0);
    const [syncRunId, setSyncRunId] = useState(null);
    const [syncUpdatedAt, setSyncUpdatedAt] = useState(null);
    const [syncFinishedAt, setSyncFinishedAt] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [isSyncPanelVisible, setIsSyncPanelVisible] = useState(false);

    const pollIntervalRef = useRef(null);

    const clearPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    };

    useEffect(() => {
        if (!isRefreshing || !syncStartTime) return undefined;

        const interval = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - syncStartTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [isRefreshing, syncStartTime]);

    useEffect(() => {
        let timer;

        if (cooldown > 0) {
            timer = setInterval(() => setCooldown((value) => value - 1), 1000);
        }

        return () => clearInterval(timer);
    }, [cooldown]);

    useEffect(() => () => clearPolling(), []);

    const handleRefresh = async () => {
        if (isRefreshing || cooldown > 0) return;

        let baselineRunId = null;

        clearPolling();
        setIsSyncPanelVisible(true);
        setIsRefreshing(true);
        setRefreshSuccess(false);
        setServerStatus('queued');
        setSyncStartTime(Date.now());
        setElapsedTime(0);
        setCooldown(60);
        setSyncRunId(null);
        setSyncUpdatedAt(null);
        setSyncFinishedAt(null);
        setSyncError(null);

        addLog('Initiating verified source sync...', 'info');

        ReactGA.event({
            category: "Operations",
            action: "scraper_sync_triggered"
        });

        try {
            try {
                const initialStatus = await getScraperStatus();
                baselineRunId = initialStatus?.run_id || null;
            } catch (error) {
                baselineRunId = null;
            }

            await triggerScraper();

            let attempts = 0;
            pollIntervalRef.current = setInterval(async () => {
                attempts += 1;

                if (attempts > 36) {
                    clearPolling();
                    setIsRefreshing(false);
                    setSyncFinishedAt(new Date().toISOString());
                    setSyncError('The workflow took too long to confirm. You can close this panel and try again.');
                    addLog('Sync status timed out before completion.', 'error');
                    return;
                }

                try {
                    const statusData = await getScraperStatus();

                    if (statusData?.updated_at) {
                        setSyncUpdatedAt(statusData.updated_at);
                    }

                    if (!statusData?.run_id || statusData.run_id === baselineRunId) {
                        setServerStatus('queued');
                        return;
                    }

                    setSyncRunId(statusData.run_id);
                    setServerStatus(statusData.status);

                    if (statusData.status === 'completed') {
                        clearPolling();
                        setSyncFinishedAt(statusData.updated_at || new Date().toISOString());
                        setIsRefreshing(false);

                        if (statusData.conclusion === 'success') {
                            await loadData(true);
                            setRefreshSuccess(true);
                            addLog('Verified source sync completed successfully.', 'success');
                        } else {
                            const failureMessage = `Sync finished with conclusion: ${statusData.conclusion || 'unknown'}.`;
                            setSyncError(failureMessage);
                            addLog(failureMessage, 'error');
                            setServerStatus(statusData.conclusion || 'failed');
                        }
                    }
                } catch (error) {
                    console.error('Polling error:', error);
                }
            }, 5000);
        } catch (error) {
            clearPolling();
            setIsRefreshing(false);
            setSyncFinishedAt(new Date().toISOString());
            setSyncError('The sync request could not be started from the frontend.');
            addLog('Trigger failed', 'error');
        }
    };

    const dismissSyncPanel = () => setIsSyncPanelVisible(false);

    const syncState = {
        syncRunId,
        serverStatus,
        elapsedTime,
        refreshSuccess,
        syncError,
    };

    return {
        isRefreshing,
        refreshSuccess,
        serverStatus,
        elapsedTime,
        syncProgress: buildSyncProgress(syncState),
        cooldown,
        handleRefresh,
        getScraperMessage: () => buildSyncSummary(syncState).subtitle,
        syncSteps: buildSyncSteps(syncState),
        syncSummary: buildSyncSummary(syncState),
        syncRunId,
        syncUpdatedAt,
        syncFinishedAt,
        syncStartTime,
        syncError,
        isSyncPanelVisible,
        dismissSyncPanel,
        formatSyncDuration: formatDuration,
    };
};
