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
            minLoadingTime={2000} 
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

    // Track authentication state directly inside AppRoot
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        const hasToken = !!localStorage.getItem('authToken');
        const hasTokenInUrl = window.location.search.includes('token') || window.location.search.includes('acct');
        return hasToken || hasTokenInUrl;
    });

    // Initialize API & Capture OAuth Tokens safely
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        let primaryToken = '';

        // Target the primary token parameter returned by Deriv OAuth
        for (const [key, value] of urlParams.entries()) {
            if ((key === 'token1' || key === 'token') && value) {
                primaryToken = value;
                break;
            }
        }

        // Fallback search if token1 isn't explicitly named
        if (!primaryToken) {
            for (const [key, value] of urlParams.entries()) {
                if (key.includes('token') && value && value.length > 10) {
                    primaryToken = value;
                    break;
                }
            }
        }

        if (primaryToken) {
            localStorage.setItem('authToken', primaryToken);
            setIsAuthenticated(true);
            // Clean the token query params out of the browser address bar immediately
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const timeoutId = setTimeout(() => {
            if (!is_api_initialized) {
                setIsApiInitialized(true);
            }
        }, 5000);

        const initializeApi = async () => {
            if (!api_base_initialized.current) {
                try {
                    await api_base.init();
                    api_base_initialized.current = true;
                } catch (error) {
                    console.error('API initialization failed:', error);
                    // Clear broken tokens so users don't get trapped in a persistent error loop
                    localStorage.removeItem('authToken');
                    setIsAuthenticated(false);
                    api_base_initialized.current = false;
                } finally {
                    setIsApiInitialized(true);
                    clearTimeout(timeoutId);
                }
            }
        };

        initializeApi();
        return () => clearTimeout(timeoutId);
    }, []);

    // Login handler: triggers direct secure OAuth redirect to Deriv
    const handleLogin = () => {
        const appId = '1089'; 
        const redirectUrl = encodeURIComponent(window.location.origin + '/');
        window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&brand=deriv&l=EN&redirect_uri=${redirectUrl}`;
    };

    // Signup handler: opens Deriv's account creation portal safely in a new tab
    const handleSignup = () => {
        window.open('https://track.deriv.com/', '_blank');
    };

    // If not authenticated, render landing page in a fixed full-screen container with both actions
    if (!isAuthenticated) {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, backgroundColor: '#0b0e14', overflowY: 'auto' }}>
                <LandingPage onLogin={handleLogin} onSignup={handleSignup} />
            </div>
        );
    }

    if (!store || !is_api_initialized) return <AppRootLoader />;

    return (
        <Suspense fallback={<AppRootLoader />}>
            <ErrorBoundary root_store={store}>
                <ErrorComponentWrapper />
                <AppContent />
            </ErrorBoundary>
        </Suspense>
    );
};

export default AppRoot;
