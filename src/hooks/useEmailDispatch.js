import { useState, useEffect } from 'react';
import { triggerEmail, getEmailStatus, fetchDispatchMeta, EMAIL_WORKFLOW_URL } from '../services/api';
import ReactGA from "react-ga4";

export const useEmailDispatch = (addLog) => {
    const [emailNotification, setEmailNotification] = useState(null);
    const [dispatching, setDispatching] = useState(false);
    const [launchMode, setLaunchMode] = useState(null);
    const [dispatchMeta, setDispatchMeta] = useState(null);
    const [lastEmailDispatchTs, setLastEmailDispatchTs] = useState(() => {
        try { return localStorage.getItem('lastEmailDispatchTs') || null; } catch (e) { return null; }
    });

    const [emailCooldown, setEmailCooldown] = useState(0);

    const loadDispatchMeta = async (isRefresh = false) => {
        try {
            const meta = await fetchDispatchMeta();
            if (meta) {
                setDispatchMeta(meta);
                if (isRefresh) addLog('Dispatch metadata synced', 'success');
            }
        } catch (e) {
            console.warn('Dispatch meta not available');
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
        const pollIntervalMs = mode === 'github' ? 15000 : 5000;
        const maxAttempts = mode === 'github' ? 24 : 20;
        let attempts = 0;
        let detectedRunId = null;

        const pollInterval = setInterval(async () => {
            attempts += 1;
            if (attempts > maxAttempts) {
                clearInterval(pollInterval);
                setDispatching(false);
                setLaunchMode(null);
                setEmailNotification({
                    type: 'error',
                    message: mode === 'github'
                        ? 'No new GitHub email run detected. Open the workflow and click Run workflow.'
                        : 'Dispatch status unconfirmed.'
                });
                addLog(mode === 'github' ? 'No new GitHub email run detected.' : 'Dispatch Timeout', 'error');
                setTimeout(() => setEmailNotification(null), 6000);
                return;
            }

            try {
                const statusData = await getEmailStatus();
                if (statusData.run_id && statusData.run_id !== baselineRunId) {
                    if (!detectedRunId) {
                        detectedRunId = statusData.run_id;
                        if (emailCooldown === 0) {
                            startCooldownTicker();
                        }
                        setEmailNotification({
                            type: 'in_progress',
                            message: mode === 'github'
                                ? 'GitHub workflow detected. Monitoring dispatch...'
                                : 'Synthesizing Strategic Briefing...'
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

                            setEmailNotification({ type: 'success', message: 'Intelligence briefing dispatched!' });
                            addLog('Briefing dispatched successfully', 'success');
                            loadDispatchMeta(true);
                            setTimeout(() => setEmailNotification(null), 30000);
                        } else {
                            const failureMessage = `Workflow finished with conclusion: ${statusData.conclusion || 'unknown'}.`;
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
        const workflowWindow = typeof window !== 'undefined'
            ? window.open(EMAIL_WORKFLOW_URL, '_blank', 'noopener,noreferrer')
            : null;
        try {
            setDispatching(true);
            setLaunchMode('github');
            setEmailNotification({ type: 'initializing', message: 'Open GitHub Actions and click Run workflow.' });
            addLog(`Opening ${mode} email workflow in GitHub`, 'info');

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
                addLog('GitHub tab was blocked. Use the workflow link in the modal.', 'error');
            }

            if (mode === 'filtered') {
                addLog('Paste the prepared filters JSON into the GitHub workflow inputs.', 'info');
            } else if (!target_emails || target_emails.trim() === '') {
                addLog('Leave recipients blank in GitHub to use the default stakeholder list.', 'info');
            }

            monitorDispatch(baselineRunId, 'github');
        } catch (err) {
            setDispatching(false);
            setLaunchMode(null);
            setEmailCooldown(0);
            setEmailNotification({ type: 'error', message: err.message || 'Failed to open GitHub workflow.' });
            addLog(`GitHub email launch failed: ${err.message || 'unknown error'}`, 'error');
            setTimeout(() => setEmailNotification(null), 5000);
        }
    };

    const handleEmailTrigger = async (target_emails, mode = 'standard', filters = {}) => {
        const canSwitchFromGitHub = dispatching && launchMode === 'github' && emailCooldown === 0;
        if ((dispatching && !canSwitchFromGitHub) || emailCooldown > 0) return;
        try {
            setDispatching(true);
            setLaunchMode('relay');

            setEmailNotification({ type: 'initializing', message: 'Connecting to direct relay...' });
            addLog(`Initiating ${mode} dispatch relay to stakeholder`, 'info');

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
            setEmailNotification({ type: 'in_progress', message: 'Synthesizing Strategic Briefing...' });
            monitorDispatch(baselineRunId, 'relay');
        } catch (err) {
            setDispatching(false);
            setLaunchMode(null);
            setEmailCooldown(0);
            setEmailNotification({ type: 'error', message: err.message || 'Failed to initiate dispatch.' });
            addLog(`Critical Dispatch Failure: ${err.message || 'unknown error'}`, 'error');
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
