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
                        ? 'No new briefing activity was detected. Please try again.'
                        : 'Still checking briefing status.'
                });
                addLog(mode === 'github' ? 'No new briefing activity was detected.' : 'Briefing status check timed out.', 'error');
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
