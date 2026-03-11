import { useEffect, useRef, useState } from 'react';
import { triggerScraper, getScraperStatus, SYNC_WORKFLOW_URL } from '../services/api';
import ReactGA from "react-ga4";

const SYNC_STAGES = [
    {
        key: 'dispatch',
        label: 'Start refresh',
        description: 'Send a secure request to refresh the opportunity list.',
    },
    {
        key: 'queue',
        label: 'Reserve capacity',
        description: 'The refresh request has been accepted and placed in line.',
    },
    {
        key: 'collect',
        label: 'Gather opportunities',
        description: 'Collect opportunities from trusted funding and partner pages.',
    },
    {
        key: 'verify',
        label: 'Confirm details',
        description: 'Review dates, links, and listing details for clarity.',
    },
    {
        key: 'review',
        label: 'Prepare review list',
        description: 'Separate ready-to-share opportunities from items needing a second look.',
    },
    {
        key: 'reload',
        label: 'Update live list',
        description: 'Apply the latest opportunities to the live list.',
    },
];

const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getOpportunityKey = (opportunity = {}) => (
    [opportunity.name, opportunity.body, opportunity.link]
        .filter(Boolean)
        .join('::')
        .toLowerCase()
);

const summarizeSyncFindings = (previousOpportunities = [], nextOpportunities = []) => {
    const previousKeys = new Set(
        previousOpportunities
            .map(getOpportunityKey)
            .filter(Boolean)
    );
    const seenNewKeys = new Set();
    const newItems = [];

    nextOpportunities.forEach((opportunity) => {
        const key = getOpportunityKey(opportunity);
        if (!key || previousKeys.has(key) || seenNewKeys.has(key)) return;

        seenNewKeys.add(key);
        newItems.push({
            name: opportunity.name || 'Untitled opportunity',
            body: opportunity.body || 'Verified source',
            status: opportunity.status || 'Updated',
            deadline: opportunity.deadline || 'Check portal',
        });
    });

    return {
        totalBefore: previousOpportunities.length,
        totalAfter: nextOpportunities.length,
        newCount: newItems.length,
        newItems: newItems.slice(0, 5),
    };
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
    const { syncRunId, serverStatus, elapsedTime, refreshSuccess, syncError, launchMode, syncFindings } = state;

    if (refreshSuccess) {
        const newCount = syncFindings?.newCount || 0;
        return {
            title: newCount > 0 ? 'Update Complete' : 'Refresh Complete',
            subtitle: newCount > 0
                ? `${newCount} new opportunit${newCount === 1 ? 'y was' : 'ies were'} added to the opportunity list.`
                : 'No new opportunities were added in this refresh.',
            tone: 'success',
        };
    }

    if (syncError) {
        return {
            title: 'Update Needs Review',
            subtitle: syncError,
            tone: 'error',
        };
    }

    if (!syncRunId) {
        return {
            title: 'Starting Refresh',
            subtitle: launchMode === 'github'
                ? 'Waiting for the refresh to begin.'
                : 'Sending the refresh request and waiting for confirmation.',
            tone: 'active',
        };
    }

    if (serverStatus === 'queued') {
        return {
            title: 'Refresh Queued',
            subtitle: 'The request was accepted and is waiting for processing capacity.',
            tone: 'active',
        };
    }

    if (elapsedTime < 10) {
        return {
            title: 'Gathering Opportunities',
            subtitle: 'Collecting opportunities from trusted funding and partner pages.',
            tone: 'active',
        };
    }

    if (elapsedTime < 22) {
        return {
            title: 'Confirming Details',
            subtitle: 'Checking dates, links, and listing details.',
            tone: 'active',
        };
    }

    if (elapsedTime < 36) {
        return {
            title: 'Preparing Review List',
            subtitle: 'Sorting ready-to-share opportunities from items that need review.',
            tone: 'active',
        };
    }

    return {
        title: 'Updating Live List',
        subtitle: 'Applying the latest results to the live opportunity list.',
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

export const useScraperSync = (addLog, loadData, opportunities = []) => {
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
    const [syncFindings, setSyncFindings] = useState(null);
    const [isSyncPanelVisible, setIsSyncPanelVisible] = useState(false);
    const [isSyncPanelMinimized, setIsSyncPanelMinimized] = useState(false);
    const [launchMode, setLaunchMode] = useState(null);

    const pollIntervalRef = useRef(null);
    const previousOpportunitiesRef = useRef([]);

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
        setIsSyncPanelMinimized(false);
        setIsRefreshing(true);
        setRefreshSuccess(false);
        setServerStatus(mode === 'github' ? 'awaiting_launch' : 'queued');
        setSyncStartTime(Date.now());
        setElapsedTime(0);
        setSyncRunId(null);
        setSyncUpdatedAt(null);
        setSyncFinishedAt(null);
        setSyncError(null);
        setSyncFindings(null);
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
                        ? 'No new refresh activity was detected. Please try again.'
                        : 'This refresh is taking longer than expected. You can keep this panel open and try again.'
                );
                addLog(
                    mode === 'github'
                        ? 'No new refresh activity was detected.'
                        : 'Refresh took longer than expected.',
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
                        addLog('Refresh started. Tracking progress.', 'info');
                    }
                }

                setSyncRunId(statusData.run_id);
                setServerStatus(statusData.status);

                if (statusData.status === 'completed') {
                    clearPolling();
                    setSyncFinishedAt(statusData.updated_at || new Date().toISOString());
                    setIsRefreshing(false);

                    if (statusData.conclusion === 'success') {
                        const refreshedOpportunities = await loadData(true);

                        if (!Array.isArray(refreshedOpportunities)) {
                            setSyncError('The refresh finished, but the updated opportunity list could not be shown yet.');
                            addLog('Refresh finished, but the updated list could not be shown.', 'error');
                            setServerStatus('attention');
                            return;
                        }

                        setSyncFindings(summarizeSyncFindings(previousOpportunitiesRef.current, refreshedOpportunities));
                        setRefreshSuccess(true);
                        addLog('Opportunity list refreshed successfully.', 'success');
                    } else {
                        const failureMessage = `Refresh finished with result: ${statusData.conclusion || 'unknown'}.`;
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

        previousOpportunitiesRef.current = Array.isArray(opportunities) ? opportunities : [];
        initializeSyncState('github');
        addLog('Opening the update window. Start the refresh there.', 'info');

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
                addLog('The update window was blocked. Allow pop-ups and try again.', 'error');
            }

            startPolling(baselineRunId, 'github');
        } catch (error) {
            clearPolling();
            setIsRefreshing(false);
            setCooldown(0);
            setServerStatus(null);
            setSyncFinishedAt(new Date().toISOString());
            setSyncError(error.message || 'The update window could not be opened.');
            addLog(`Update window could not be opened: ${error.message || 'unknown error'}`, 'error');
        }
    };

    const handleRefresh = async () => {
        const canSwitchFromGitHub = isRefreshing && launchMode === 'github' && !syncRunId && cooldown === 0;
        if ((isRefreshing && !canSwitchFromGitHub) || cooldown > 0) return;

        let baselineRunId = null;
        previousOpportunitiesRef.current = Array.isArray(opportunities) ? opportunities : [];
        initializeSyncState('relay');
        addLog('Refreshing the opportunity list...', 'info');

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
            setSyncError(error.message || 'The refresh could not be started right now.');
            addLog(`Trigger failed: ${error.message || 'unknown error'}`, 'error');
        }
    };

    const dismissSyncPanel = () => {
        setIsSyncPanelVisible(false);
        setIsSyncPanelMinimized(false);
    };
    const toggleSyncPanelMinimized = () => setIsSyncPanelMinimized((value) => !value);
    const restoreSyncPanel = () => setIsSyncPanelMinimized(false);

    const syncState = {
        syncRunId,
        serverStatus,
        elapsedTime,
        refreshSuccess,
        syncError,
        launchMode,
        syncFindings,
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
        syncFindings,
        isSyncPanelVisible,
        isSyncPanelMinimized,
        dismissSyncPanel,
        toggleSyncPanelMinimized,
        restoreSyncPanel,
        formatSyncDuration: formatDuration,
    };
};
