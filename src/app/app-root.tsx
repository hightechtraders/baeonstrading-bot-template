// ==========================================
// FILE: src/app/app-root.tsx
// ==========================================
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import ErrorBoundary from '@/components/error-component/error-boundary';
import ErrorComponent from '@/components/error-component/error-component';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { TradingPreloader } from '@/components/trading-preloader/TradingPreloader';
import { LandingPage } from '@/components/LandingPage';
import './app-root.scss';

const AppContent = lazy(() => import('./app-content'));

const AppRootLoader = () => {
    return (
        <TradingPreloader 
            appName="TraderScore" 
            subtitle="TraderScore Trading Workspace" 
            minLoadingTime={1200} 
        />
    );
};

const ErrorComponentWrapper = observer(() => {
    const { common } = useStore();

    if (!common.error) return null;

    return (
        <ErrorComponent
            header={common.error?.header}
            message={common.error?.message}
            redirect_label={common.error?.redirect_label}
            redirectOnClick={common.error?.redirectOnClick}
            should_clear_error_on_click={common.error?.should_clear_error_on_click}
            setError={common.setError}
            redirect_to={common.error?.redirect_to}
            should_redirect={common.error?.should_redirect}
        />
    );
});

const AppRoot = () => {
    const store = useStore();
    const api_base_initialized = useRef(false);
    const [is_api_initialized, setIsApiInitialized] = useState(false);

    // 1. Check if we have active tokens or if the user has already initiated login before
    const [isAuthenticated] = useState<boolean>(() => {
        const search = window.location.search;
        const hasUrlAuth = search.includes('token') || search.includes('acct');
        const hasLoggedInBefore = localStorage.getItem('has_logged_in') === 'true';

        const urlParams = new URLSearchParams(search);
        for (const [key, value] of urlParams.entries()) {
            if (key.includes('token') || key.startsWith('acct')) {
                localStorage.setItem(key, value);
                localStorage.setItem('has_logged_in', 'true'); // Lock out landing page forever once tokens appear
                if (key.includes('token1') || key === 'token') {
                    localStorage.setItem('authToken', value);
                }
                if (key.startsWith('acct1') || key === 'acct') {
                    localStorage.setItem('active_loginid', value);
                }
            }
        }

        const clientAccounts = localStorage.getItem('client.accounts');
        const activeLoginId = localStorage.getItem('active_loginid');
        const authToken = localStorage.getItem('authToken');
        
        return !!(clientAccounts || activeLoginId || authToken || hasUrlAuth || hasLoggedInBefore);
    });

    // 2. Initialize API and clean URL parameters once on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        let tokenFound = false;

        for (const [key, value] of urlParams.entries()) {
            if (key.includes('token') || key.startsWith('acct')) {
                localStorage.setItem(key, value);
                localStorage.setItem('has_logged_in', 'true');
                tokenFound = true;
            }
        }

        if (tokenFound || window.location.search.includes('token') || window.location.search.includes('acct')) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const timeoutId = setTimeout(() => {
            if (!api_base_initialized.current) {
                setIsApiInitialized(true);
            }
        }, 1500);

        const initializeApi = async () => {
            if (!api_base_initialized.current) {
                try {
                    await api_base.init();
                    api_base
