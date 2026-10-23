import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import ErrorBoundary from '@/components/error-component/error-boundary';
import ErrorComponent from '@/components/error-component/error-component';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { TradingPreloader } from '@/components/trading-preloader/TradingPreloader';
import { LandingPage } from '@/components/LandingPage'; // Import your landing page
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

    // Initialize API
    useEffect(() => {
        // Automatically grab any token passed back in the URL query string from Deriv
        const urlParams = new URLSearchParams(window.location.search);
        for (const [key, value] of urlParams.entries()) {
            if (key.includes('token') || key.startsWith('acct')) {
                localStorage.setItem('authToken', value);
                setIsAuthenticated(true);
            }
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

    // Handle the login button click from your landing page
    const handleLogin = () => {
        // Use your numeric App ID or your template's built-in login trigger method here
        const appId = '1089'; // Replace with your numeric Deriv App ID if not using public test ID
        const redirectUrl = encodeURIComponent(window.location.origin + '/');
        window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&brand=deriv&l=EN&redirect_uri=${redirectUrl}`;
    };

    // If the user is not authenticated, show your gorgeous TraderScore landing page covering the screen
    if (!isAuthenticated) {
        return <LandingPage onLogin={handleLogin} />;
    }

    if (!store || !is_api_initialized) return <AppRootLoader />;

    // Once authenticated, your full trading workspace renders seamlessly underneath!
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
