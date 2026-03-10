import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import ReactGA from "react-ga4";

// Initialize GA4 with a placeholder ID. 
// Replace 'G-XXXXXXXXXX' with your actual Measurement ID from Google Analytics.
ReactGA.initialize("G-03BZC683SZ");

const Root = () => {
    useEffect(() => {
        ReactGA.send({ hitType: "pageview", page: window.location.pathname });
    }, []);

    return (
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
