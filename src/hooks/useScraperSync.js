import { useEffect, useRef, useState } from 'react';
import { triggerScraper, getScraperStatus, SYNC_WORKFLOW_URL } from '../services/api';
import ReactGA from "react-ga4";

const SYNC_STAGES = [
    {
        key: 'dispatch',
        label: 'Launch workflow',
        description: 'Open the GitHub Actions workflow and start a verified-source run.',
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
    if (!syncRunId || serverStatus === 'awaiting_launch') return 0;
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
    const { syncRunId, serverStatus, elapsedTime, refreshSuccess, syncError, launchMode } = state;

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
        if (launchMode === 'github') {
            return {
                title: 'Awaiting GitHub Launch',
                subtitle: 'Click "Run workflow" in the GitHub tab. This panel will detect the new run automatically.',
                tone: 'active',
            };
        }

        return {
            title: 'Dispatching Sync',
            subtitle: 'Requesting the direct relay to start the GitHub workflow.',
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
    const [launchMode, setLaunchMode] = useState(null);

    const pollIntervalRef = useRef(null);

    const clearPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    };

    const initializeSyncState = (mode) => {
        clearPolling();
        setLaunchMode(mode);
        setIsSyncPanelVisible(true);
        setIsRefreshing(true);
        setRefreshSuccess(false);
        setServerStatus(mode === 'github' ? 'awaiting_launch' : 'queued');
        setSyncStartTime(Date.now());
        setElapsedTime(0);
        setSyncRunId(null);
        setSyncUpdatedAt(null);
        setSyncFinishedAt(null);
        setSyncError(null);
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

    const startPolling = (baselineRunId, mode) => {
        const pollIntervalMs = mode === 'github' ? 15000 : 5000;
        const maxAttempts = mode === 'github' ? 24 : 36;
        let attempts = 0;
        let detectedRunId = null;

        pollIntervalRef.current = setInterval(async () => {
            attempts += 1;

            if (attempts > maxAttempts) {
                clearPolling();
                setIsRefreshing(false);
                setSyncFinishedAt(new Date().toISOString());
                setServerStatus(null);
                setSyncError(
                    mode === 'github'
                        ? 'No new GitHub sync run was detected. Open the workflow page, click "Run workflow", or try the direct relay.'
                        : 'The workflow took too long to confirm. You can close this panel and try again.'
                );
                addLog(
                    mode === 'github'
                        ? 'No new GitHub sync run was detected.'
                        : 'Sync status timed out before completion.',
                    'error'
                );
                return;
            }

            try {
                const statusData = await getScraperStatus();

                if (statusData?.updated_at) {
                    setSyncUpdatedAt(statusData.updated_at);
                }

                if (!statusData?.run_id || statusData.run_id === baselineRunId) {
                    setServerStatus(mode === 'github' ? 'awaiting_launch' : 'queued');
                    return;
                }

                if (!detectedRunId) {
                    detectedRunId = statusData.run_id;
                    if (mode === 'github' && cooldown === 0) {
                        setCooldown(60);
                        addLog('GitHub sync workflow detected. Monitoring live run.', 'info');
                    }
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
        }, pollIntervalMs);
    };

    const openGitHubSyncWorkflow = async () => {
        if (isRefreshing || cooldown > 0) return;

        let baselineRunId = null;
        const workflowWindow = typeof window !== 'undefined'
            ? window.open(SYNC_WORKFLOW_URL, '_blank', 'noopener,noreferrer')
            : null;

        initializeSyncState('github');
        addLog('Opening GitHub sync workflow. Click "Run workflow" in the new tab.', 'info');

        ReactGA.event({
            category: "Operations",
            action: "scraper_sync_github_opened"
        });

        try {
            try {
                const initialStatus = await getScraperStatus();
                baselineRunId = initialStatus?.run_id || null;
                if (initialStatus?.updated_at) {
                    setSyncUpdatedAt(initialStatus.updated_at);
                }
            } catch (error) {
                baselineRunId = null;
            }

            if (!workflowWindow) {
                addLog('GitHub tab was blocked. Use the workflow link in the sync panel.', 'error');
            }

            startPolling(baselineRunId, 'github');
        } catch (error) {
            clearPolling();
            setIsRefreshing(false);
            setCooldown(0);
            setServerStatus(null);
            setSyncFinishedAt(new Date().toISOString());
            setSyncError(error.message || 'The GitHub workflow page could not be opened.');
            addLog(`GitHub sync launch failed: ${error.message || 'unknown error'}`, 'error');
        }
    };

    const handleRefresh = async () => {
        const canSwitchFromGitHub = isRefreshing && launchMode === 'github' && !syncRunId && cooldown === 0;
        if ((isRefreshing && !canSwitchFromGitHub) || cooldown > 0) return;

        let baselineRunId = null;
        initializeSyncState('relay');
        addLog('Initiating verified source sync via direct relay...', 'info');

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
            setCooldown(60);
            startPolling(baselineRunId, 'relay');
        } catch (error) {
            clearPolling();
            setIsRefreshing(false);
            setCooldown(0);
            setServerStatus(null);
            setSyncFinishedAt(new Date().toISOString());
            setSyncError(error.message || 'The sync request could not be started from the frontend.');
            addLog(`Trigger failed: ${error.message || 'unknown error'}`, 'error');
        }
    };

    const dismissSyncPanel = () => setIsSyncPanelVisible(false);

    const syncState = {
        syncRunId,
        serverStatus,
        elapsedTime,
        refreshSuccess,
        syncError,
        launchMode,
    };

    return {
        isRefreshing,
        refreshSuccess,
        serverStatus,
        elapsedTime,
        syncProgress: buildSyncProgress(syncState),
        cooldown,
        handleRefresh,
        openGitHubSyncWorkflow,
        syncLaunchMode: launchMode,
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
