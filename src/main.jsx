import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import UserManual from './UserManual.jsx'
import './index.css'
import ReactGA from "react-ga4";

// Initialize GA4 with a placeholder ID. 
// Replace 'G-XXXXXXXXXX' with your actual Measurement ID from Google Analytics.
ReactGA.initialize("G-03BZC683SZ");

const MANUAL_ROUTES = new Set(['/user_manual', '/user-manual']);

const normalizeRoute = (value = '') => {
    const cleaned = value.toLowerCase().replace(/\/+$/, '');
    return cleaned === '' ? '/' : cleaned;
};

const resolveRoute = () => {
    const path = normalizeRoute(window.location.pathname);
    const hashPath = normalizeRoute(window.location.hash.replace(/^#/, ''));
    const page = (new URLSearchParams(window.location.search).get('page') || '').toLowerCase();
    const queryRoute = page ? normalizeRoute(`/${page}`) : '/';

    const segments = path.split('/').filter(Boolean);
    const projectRelativePath = segments.length > 1
        ? normalizeRoute(`/${segments.slice(1).join('/')}`)
        : path;

    return [path, projectRelativePath, hashPath, queryRoute].some((candidate) => MANUAL_ROUTES.has(candidate));
};

const Root = () => {
    const [locationKey, setLocationKey] = useState(() => window.location.href);
    const isUserManualPage = useMemo(() => resolveRoute(), [locationKey]);

    useEffect(() => {
        const syncRoute = () => setLocationKey(window.location.href);
        window.addEventListener('popstate', syncRoute);
        window.addEventListener('hashchange', syncRoute);

        return () => {
            window.removeEventListener('popstate', syncRoute);
            window.removeEventListener('hashchange', syncRoute);
        };
    }, []);

    useEffect(() => {
        const page = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        ReactGA.send({ hitType: "pageview", page });
    }, [locationKey]);

    return (
        <React.StrictMode>
            {isUserManualPage ? <UserManual /> : <App />}
        </React.StrictMode>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
