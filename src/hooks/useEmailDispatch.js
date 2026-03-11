import { useState, useEffect } from 'react';
import { triggerEmail, getEmailStatus, fetchDispatchMeta, EMAIL_WORKFLOW_URL } from '../services/api';
import ReactGA from "react-ga4";

const EMAIL_POLL_INTERVAL_MS = {
    github: 15000,
    relay: 5000,
};

const EMAIL_DETECTION_TIMEOUT_MS = {
    github: 6 * 60 * 1000,
    relay: 2 * 60 * 1000,
};

const EMAIL_COMPLETION_TIMEOUT_MS = {
    github: 12 * 60 * 1000,
    relay: 8 * 60 * 1000,
};

export const useEmailDispatch = (addLog) => {
    const [emailNotification, setEmailNotification] = useState(null);
    const [dispatching, setDispatching] = useState(false);
    const [launchMode, setLaunchMode] = useState(null);
    const [dispatchMeta, setDispatchMeta] = useState(null);
    const [lastEmailDispatchTs, setLastEmailDispatchTs] = useState(() => {
        try { return localStorage.getItem('lastEmailDispatchTs') || null; } catch (e) { return null; }
    });

    const [emailCooldown, setEmailCooldown] = useState(0);
    const hasRecipientInput = (target_emails) => typeof target_emails === 'string' && target_emails.trim() !== '';

    const loadDispatchMeta = async (isRefresh = false) => {
        try {
            const meta = await fetchDispatchMeta();
            if (meta) {
                setDispatchMeta(meta);
                if (isRefresh) addLog('Briefing history updated.', 'success');
            }
        } catch (e) {
            console.warn('Briefing history not available');
        }
    };

    useEffect(() => {
        loadDispatchMeta();

        const interval = setInterval(() => loadDispatchMeta(), 30000);
        return () => clearInterval(interval);
    }, []);

    const startCooldownTicker = () => {
        setEmailCooldown(60);
        const cooldownTimer = setInterval(() => {
            setEmailCooldown((value) => {
                if (value <= 1) {
                    clearInterval(cooldownTimer);
                    return 0;
                }
                return value - 1;
            });
        }, 1000);
    };

    const monitorDispatch = (baselineRunId, mode) => {
        const pollIntervalMs = EMAIL_POLL_INTERVAL_MS[mode] || EMAIL_POLL_INTERVAL_MS.relay;
        const detectionTimeoutMs = EMAIL_DETECTION_TIMEOUT_MS[mode] || EMAIL_DETECTION_TIMEOUT_MS.relay;
        const completionTimeoutMs = EMAIL_COMPLETION_TIMEOUT_MS[mode] || EMAIL_COMPLETION_TIMEOUT_MS.relay;
        const pollingStartedAt = Date.now();
        let detectedRunId = null;
        let runDetectedAt = null;

        const pollInterval = setInterval(async () => {
            const now = Date.now();

            if (!detectedRunId && now - pollingStartedAt > detectionTimeoutMs) {
                clearInterval(pollInterval);
                setDispatching(false);
                setLaunchMode(null);
                setEmailNotification({
                    type: 'error',
                    message: 'No new briefing activity was detected yet. It may still be waiting in line. Please try again.'
                });
                addLog('No new briefing activity was detected yet.', 'error');
                setTimeout(() => setEmailNotification(null), 6000);
                return;
            }

            if (detectedRunId && runDetectedAt && now - runDetectedAt > completionTimeoutMs) {
                clearInterval(pollInterval);
                setDispatching(false);
                setLaunchMode(null);
                setEmailNotification({
                    type: 'error',
                    message: 'This briefing is still running longer than usual. Please check again in a moment.'
                });
                addLog('Briefing is taking longer than usual.', 'error');
                setTimeout(() => setEmailNotification(null), 6000);
                return;
            }

            try {
                const statusData = await getEmailStatus();
                if (statusData.run_id && statusData.run_id !== baselineRunId) {
                    if (!detectedRunId) {
                        detectedRunId = statusData.run_id;
                        runDetectedAt = Date.now();
                        if (emailCooldown === 0) {
                            startCooldownTicker();
                        }
                        setEmailNotification({
                            type: 'in_progress',
                            message: mode === 'github'
                                ? 'Briefing started. Tracking progress...'
                                : 'Preparing briefing...'
                        });
                    }

                    if (statusData.status === 'completed') {
                        clearInterval(pollInterval);
                        setDispatching(false);
                        setLaunchMode(null);

                        if (statusData.conclusion === 'success') {
                            const nowTs = Date.now().toString();
                            setLastEmailDispatchTs(nowTs);
                            try { localStorage.setItem('lastEmailDispatchTs', nowTs); } catch (e) { }

                            setEmailNotification({ type: 'success', message: 'Briefing sent successfully!' });
                            addLog('Briefing sent successfully', 'success');
                            loadDispatchMeta(true);
                            setTimeout(() => setEmailNotification(null), 30000);
                        } else {
                            const failureMessage = `Run finished with result: ${statusData.conclusion || 'unknown'}.`;
                            setEmailNotification({ type: 'error', message: failureMessage });
                            addLog(failureMessage, 'error');
                            setTimeout(() => setEmailNotification(null), 7000);
                        }
                    }
                }
            } catch (e) {
                console.warn('Email polling issue:', e.message);
            }
        }, pollIntervalMs);
    };

    const openGitHubEmailWorkflow = async (target_emails, mode = 'standard', filters = {}) => {
        if (dispatching || emailCooldown > 0) return;
        if (!hasRecipientInput(target_emails)) {
            setEmailNotification({ type: 'error', message: 'At least one recipient email is required.' });
            addLog('Add at least one recipient before opening the briefing window.', 'error');
            return;
        }
        const workflowWindow = typeof window !== 'undefined'
            ? window.open(EMAIL_WORKFLOW_URL, '_blank', 'noopener,noreferrer')
            : null;
        try {
            setDispatching(true);
            setLaunchMode('github');
            setEmailNotification({ type: 'initializing', message: 'Opening the briefing window. Complete the send step there.' });
            addLog(`Opening the ${mode} briefing window.`, 'info');

            ReactGA.event({
                category: "Communication",
                action: "email_dispatch_github_opened",
                label: `${mode}:${target_emails}`
            });

            let baselineRunId;
            try {
                const initialStatus = await getEmailStatus();
                baselineRunId = initialStatus?.run_id;
            } catch (e) { }

            if (!workflowWindow) {
                addLog('The briefing window was blocked. Allow pop-ups and try again.', 'error');
            }

            if (mode === 'filtered') {
                addLog('Use the prepared selection in the briefing form.', 'info');
            }

            monitorDispatch(baselineRunId, 'github');
        } catch (err) {
            setDispatching(false);
            setLaunchMode(null);
            setEmailCooldown(0);
            setEmailNotification({ type: 'error', message: err.message || 'Unable to open the briefing window.' });
            addLog(`Briefing window could not be opened: ${err.message || 'unknown error'}`, 'error');
            setTimeout(() => setEmailNotification(null), 5000);
        }
    };

    const handleEmailTrigger = async (target_emails, mode = 'standard', filters = {}) => {
        const canSwitchFromGitHub = dispatching && launchMode === 'github' && emailCooldown === 0;
        if ((dispatching && !canSwitchFromGitHub) || emailCooldown > 0) return;
        if (!hasRecipientInput(target_emails)) {
            setEmailNotification({ type: 'error', message: 'At least one recipient email is required.' });
            addLog('Add at least one recipient before sending the briefing.', 'error');
            return;
        }
        try {
            setDispatching(true);
            setLaunchMode('relay');

            setEmailNotification({ type: 'initializing', message: 'Preparing secure delivery...' });
            addLog(`Preparing the ${mode} briefing for delivery.`, 'info');

            ReactGA.event({
                category: "Communication",
                action: "email_dispatch_triggered",
                label: `${mode}:${target_emails}`
            });

            let baselineRunId;
            try {
                const initialStatus = await getEmailStatus();
                baselineRunId = initialStatus?.run_id;
            } catch (e) { }

            await triggerEmail(target_emails, mode, filters);
            startCooldownTicker();
            setEmailNotification({ type: 'in_progress', message: 'Preparing briefing...' });
            monitorDispatch(baselineRunId, 'relay');
        } catch (err) {
            setDispatching(false);
            setLaunchMode(null);
            setEmailCooldown(0);
            setEmailNotification({ type: 'error', message: err.message || 'Unable to start briefing.' });
            addLog(`Briefing could not be started: ${err.message || 'unknown error'}`, 'error');
            setTimeout(() => setEmailNotification(null), 5000);
        }
    };

    return {
        emailNotification,
        dispatching,
        emailLaunchMode: launchMode,
        emailCooldown,
        lastEmailDispatchTs,
        dispatchMeta,
        loadDispatchMeta,
        handleEmailTrigger,
        openGitHubEmailWorkflow,
        setEmailNotification
    };
};
