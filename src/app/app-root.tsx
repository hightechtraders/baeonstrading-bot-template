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

    // Track whether the initial preloader phase has finished
    const [isPreloaded, setIsPreloaded] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsPreloaded(true);
        }, 3000); // 3 seconds preloader duration
        return () => clearTimeout(timer);
    }, []);

    // 1. STRICT OAUTH RETURN CHECK: Only authenticate if tokens are actively present in the URL right now.
    // This ensures visiting the raw link ALWAYS lands you on the Landing Page first.
    const [isAuthenticated] = useState<boolean>(() => {
        const search = window.location.search;
        const urlParams = new URLSearchParams(search);
        let tokenFound = false;

        for (const [key, value] of urlParams.entries()) {
            if (key.includes('token') || key.startsWith('acct')) {
                sessionStorage.setItem(key, value);
                tokenFound = true;
                if (key.includes('token1') || key === 'token') {
                    sessionStorage.setItem('authToken', value);
                }
                if (key.startsWith('acct1') || key === 'acct') {
                    sessionStorage.setItem('active_loginid', value);
                }
            }
        }

        const hasUrlTokens = search.includes('token') || search.includes('acct');
        return hasUrlTokens || tokenFound;
    });

    // 2. Initialize API and clean URL parameters after mounting
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (!api_base_initialized.current) {
                setIsApiInitialized(true);
            }
        }, 1500);

        const initializeApi = async () => {
            if (!api_base_initialized.current) {
                try {
                    await api_base.init();
                    api_base_initialized.current = true;
                } catch (error) {
                    console.error('API initialization failed:', error);
                } finally {
                    setIsApiInitialized(true);
                    clearTimeout(timeoutId);
                }
            }
        };

        if (isAuthenticated) {
            initializeApi();

            // Wait 3 seconds after entering the workspace to cleanly wipe tokens from the address bar
            const stripTimer = setTimeout(() => {
                const search = window.location.search;
                if (search.includes('token') || search.includes('acct')) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }, 3000);

            return () => clearTimeout(stripTimer);
        } else {
            setIsApiInitialized(true);
        }

        return () => clearTimeout(timeoutId);
    }, [isAuthenticated]);

    // Login Handler -> Sends user to Deriv OAuth
    const handleLogin = () => {
        const appId = '1089'; 
        const redirectUrl = encodeURIComponent(window.location.origin + '/');
        window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&brand=deriv&l=EN&redirect_uri=${redirectUrl}`;
    };

    // Signup Handler
    const handleSignup = () => {
        window.open('https://home.deriv.com/dashboard', '_blank');
    };

    // ==========================================
    // RENDER GUARDS
    // ==========================================

    // If the user is NOT authenticated (opened raw link without return tokens), show Landing Page
    if (!isAuthenticated) {
        if (!isPreloaded) {
            return (
                <TradingPreloader 
                    appName="TraderScore" 
                    subtitle="TraderScore Trading Workspace" 
                    minLoadingTime={3000} 
                />
            );
        }

        return (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, backgroundColor: '#0b0e14', overflowY: 'auto' }}>
                <LandingPage onLogin={handleLogin} onSignup={handleSignup} />
            </div>
        );
    }

    // If authenticated (just returned from Deriv) but API or store is still loading, show loader
    if (!store || !is_api_initialized) {
        return <AppRootLoader />;
    }

    // Fully authenticated and ready workspace view
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
