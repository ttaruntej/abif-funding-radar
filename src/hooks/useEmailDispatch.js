import { useState, useEffect } from 'react';
import { triggerEmail, getEmailStatus, fetchDispatchMeta } from '../services/api';
import ReactGA from "react-ga4";

export const useEmailDispatch = (addLog) => {
    const [emailNotification, setEmailNotification] = useState(null);
    const [dispatching, setDispatching] = useState(false);
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

        // Optional: Periodic sync if the modal is open or periodically in background
        const interval = setInterval(() => loadDispatchMeta(), 30000);
        return () => clearInterval(interval);
    }, []);

    const handleEmailTrigger = async (target_emails, mode = 'standard', filters = {}) => {
        if (dispatching || emailCooldown > 0) return;
        try {
            setDispatching(true);
            setEmailCooldown(60); // Start 60s cooldown

            // Cooldown ticker
            const cooldownTimer = setInterval(() => {
                setEmailCooldown(c => {
                    if (c <= 1) {
                        clearInterval(cooldownTimer);
                        return 0;
                    }
                    return c - 1;
                });
            }, 1000);

            setEmailNotification({ type: 'initializing', message: 'Connecting to Dispatch Proxy...' });
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
            setEmailNotification({ type: 'in_progress', message: 'Synthesizing Strategic Briefing...' });

            let attempts = 0;
            const pollInterval = setInterval(async () => {
                attempts++;
                if (attempts > 20) {
                    clearInterval(pollInterval);
                    setDispatching(false);
                    setEmailNotification({ type: 'error', message: 'Dispatch status unconfirmed.' });
                    addLog('Dispatch Timeout', 'error');
                    setTimeout(() => setEmailNotification(null), 5000);
                    return;
                }

                try {
                    const statusData = await getEmailStatus();
                    if (statusData.run_id && statusData.run_id !== baselineRunId) {
                        if (statusData.status === 'completed') {
                            clearInterval(pollInterval);
                            setDispatching(false);
                            const nowTs = Date.now().toString();
                            setLastEmailDispatchTs(nowTs);
                            try { localStorage.setItem('lastEmailDispatchTs', nowTs); } catch (e) { }

                            setEmailNotification({ type: 'success', message: 'Intelligence briefing dispatched!' });
                            addLog(`Briefing Dispatched successfully`, 'success');
                            loadDispatchMeta(true); // Enhanced reload meta with logging after success
                            setTimeout(() => setEmailNotification(null), 30000);
                        }
                    }
                } catch (e) { }
            }, 5000);
        } catch (err) {
            setDispatching(false);
            setEmailNotification({ type: 'error', message: 'Failed to initiate dispatch.' });
            addLog('Critical Dispatch Failure', 'error');
            setTimeout(() => setEmailNotification(null), 5000);
        }
    };

    return {
        emailNotification,
        dispatching,
        emailCooldown,
        lastEmailDispatchTs,
        dispatchMeta,
        loadDispatchMeta,
        handleEmailTrigger,
        setEmailNotification
    };
};
