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
    let store;
    try {
        store = useStore();
    } catch (e) {
        store = null;
    }

    const api_base_initialized = useRef(false);
    const [is_api_initialized, setIsApiInitialized] = useState(false);

    // Track whether the initial 5-second preloader phase has finished for unauthenticated users
    const [isPreloaded, setIsPreloaded] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsPreloaded(true);
        }, 5000); // 5 seconds preloader duration
        return () => clearTimeout(timer);
    }, []);

    // 1. Authentication check capturing tokens from BOTH search and hash parameters
    const [isAuthenticated] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;

        const searchString = window.location.search;
        const hashString = window.location.hash.replace('#', '?');
        const combinedParams = new URLSearchParams(`${searchString}&${hashString}`);

        const hasAuthToken = !!localStorage.getItem('authToken');
        const hasAccountParam = combinedParams.has('account') || combinedParams.has('acct') || combinedParams.has('acct1');
        
        let foundToken = false;
        for (const [key, value] of combinedParams.entries()) {
            if ((key.includes('token') || key.startsWith('acct')) && value && value.length > 5) {
                localStorage.setItem(key, value);
                foundToken = true;
                if (key.includes('token1') || key === 'token' || key.includes('token')) {
                    localStorage.setItem('authToken', value);
                }
                if (key.startsWith('acct1') || key === 'acct') {
                    localStorage.setItem('active_loginid', value);
                }
            }
        }

        const hasUrlTokens = foundToken || searchString.includes('token') || hashString.includes('token') || searchString.includes('acct');

        return hasAuthToken || hasAccountParam || hasUrlTokens;
    });

    // 2. Initialize API and clean URL parameters once on mount (checking both search and hash)
    useEffect(() => {
        const searchString = window.location.search;
        const hashString = window.location.hash.replace('#', '?');
        const combinedParams = new URLSearchParams(`${searchString}&${hashString}`);

        let tokenFound = false;
        for (const [key, value] of combinedParams.entries()) {
            if ((key.includes('token') || key.startsWith('acct')) && value && value.length > 5) {
                localStorage.setItem(key, value);
                tokenFound = true;
            }
        }

        if (tokenFound || searchString.includes('token') || hashString.includes('token') || searchString.includes('acct')) {
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
        } else {
            setIsApiInitialized(true);
        }

        return () => clearTimeout(timeoutId);
    }, [isAuthenticated]);

    // Twin-button handler for Login
    const handleLogin = () => {
        const originalLoginBtn = document.querySelector('.auth-actions button, .btn-login, [class*="login"]') as HTMLButtonElement;
        
        if (originalLoginBtn) {
            originalLoginBtn.click();
        } else {
            const appId = '1089'; 
            const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
            window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&brand=deriv&l=EN&redirect_uri=${redirectUrl}`;
        }
    };

    // Twin-button handler for Signup
    const handleSignup = () => {
        const originalSignupBtn = document.querySelector('.signup-btn, [class*="signup"], [class*="register"]') as HTMLButtonElement;
        
        if (originalSignupBtn) {
            originalSignupBtn.click();
        } else {
            window.open('https://home.deriv.com/dashboard', '_blank');
        }
    };

    // RENDER GUARDS
    const searchString = typeof window !== 'undefined' ? window.location.search : '';
    const hashString = typeof window !== 'undefined' ? window.location.hash : '';
    const hasTokensInUrl = searchString.includes('token') || searchString.includes('acct') || hashString.includes('token') || hashString.includes('acct');

    // Intercept incoming OAuth return flows to prevent landing page flash
    if (hasTokensInUrl) {
        if (!store || !is_api_initialized) {
            return <AppRootLoader />;
        }
    }

    // If genuinely not authenticated: play 5s preloader first, then render LandingPage
    if (!isAuthenticated) {
        if (!isPreloaded) {
            return (
                <TradingPreloader 
                    appName="TraderScore" 
                    subtitle="TraderScore Trading Workspace" 
                    minLoadingTime={5000} 
                />
            );
        }

        return (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, backgroundColor: '#0b0e14', overflowY: 'auto' }}>
                <LandingPage onLogin={handleLogin} onSignup={handleSignup} />
            </div>
        );
    }

    // If authenticated but still initializing workspace store/API
    if (!store || !is_api_initialized) {
        return <AppRootLoader />;
    }

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
