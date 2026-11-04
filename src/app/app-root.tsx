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

    // Track whether the initial 5-second preloader phase has finished for unauthenticated users
    const [isPreloaded, setIsPreloaded] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsPreloaded(true);
        }, 5000); // 5 seconds preloader duration
        return () => clearTimeout(timer);
    }, []);

    // Clear session storage when the tab closes so reopening requires a fresh landing page entry
    useEffect(() => {
        const handleTabClose = () => {
            sessionStorage.clear();
        };
        window.addEventListener('beforeunload', handleTabClose);
        return () => window.removeEventListener('beforeunload', handleTabClose);
    }, []);

    // ==========================================
    // AUTHENTICATION STATE & OAUTH CAPTURE
    // ==========================================
    const [isAuthenticated] = useState<boolean>(() => {
        const search = window.location.search;
        const urlParams = new URLSearchParams(search);
        let tokenFound = false;

        // Capture incoming tokens if returning from Deriv redirect
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
        const hasAccountParam = urlParams.has('account');
        const hasSessionToken = !!sessionStorage.getItem('authToken');
        const isSessionActive = sessionStorage.getItem('isLoggedInSession') === 'true';

        // Evaluate true if they just returned with tokens OR have an active session established
        const isAuthed = hasUrlTokens || tokenFound || hasAccountParam || hasSessionToken || isSessionActive;

        if (isAuthed) {
            sessionStorage.setItem('isLoggedInSession', 'true');
        }

        return isAuthed;
    });

    // ==========================================
    // API INITIALIZATION & URL CLEANUP
    // ==========================================
    useEffect(() => {
        const initializeApi = async () => {
            if (!api_base_initialized.current) {
                try {
                    await api_base.init();
                    api_base_initialized.current = true;
                } catch (error) {
                    console.error('API initialization failed:', error);
                } finally {
                    setIsApiInitialized(true);
                }
            }
        };

        if (isAuthenticated) {
            initializeApi();

            // Allow the workspace 2 seconds to stabilize before wiping tokens from the URL bar
            const stripTimer = setTimeout(() => {
                const search = window.location.search;
                if (search.includes('token') || search.includes('acct')) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }, 2000);

            return () => clearTimeout(stripTimer);
        } else {
            setIsApiInitialized(true);
        }
    }, [isAuthenticated]);

    // Login Handler for Deriv OAuth
    const handleLogin = () => {
        const originalLoginBtn = document.querySelector('.auth-actions button, .btn-login, [class*="login"]') as HTMLButtonElement;
        
        if (originalLoginBtn) {
            originalLoginBtn.click();
        } else {
            const appId = '1089'; 
            const redirectUrl = encodeURIComponent(window.location.origin + '/');
            window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&brand=deriv&l=EN&redirect_uri=${redirectUrl}`;
        }
    };

    // Signup Handler
    const handleSignup = () => {
        const originalSignupBtn = document.querySelector('.signup-btn, [class*="signup"], [class*="register"]') as HTMLButtonElement;
        
        if (originalSignupBtn) {
            originalSignupBtn.click();
        } else {
            window.open('https://home.deriv.com/dashboard', '_blank');
        }
    };

    // ==========================================
    // RENDER GUARDS
    // ==========================================
    const hasTokensInUrl = window.location.search.includes('token') || window.location.search.includes('acct');

    if (hasTokensInUrl) {
        if (!store || !is_api_initialized) {
            return <AppRootLoader />;
        }
    }

    // Fresh open: if not authenticated, show landing page
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

    // Authenticated session view
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
