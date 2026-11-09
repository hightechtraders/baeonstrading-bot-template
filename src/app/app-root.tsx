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

// ================= 1. STRICT AUTHENTICATION GATE ================= //
const getAuthenticationStatus = () => {
    if (typeof window === 'undefined') return { isAuthenticated: false, hasTokensInUrl: false };

    const searchString = window.location.search;
    const hashString = window.location.hash.replace('#', '?');
    const combinedParams = new URLSearchParams(`${searchString}&${hashString}`);

    let foundValidToken = false;
    for (const [key, value] of combinedParams.entries()) {
        if ((key.includes('token') || key.startsWith('acct')) && value && value.length > 5) {
            sessionStorage.setItem(key, value);
            foundValidToken = true;
            if (key.includes('token1') || key === 'token' || key.includes('token')) {
                sessionStorage.setItem('authToken', value);
            }
            if (key.startsWith('acct1') || key === 'acct') {
                sessionStorage.setItem('active_loginid', value);
            }
        }
    }

    // (a) Persistent token check
    const authToken = sessionStorage.getItem('authToken');
    const hasAuthToken = !!authToken && authToken !== 'undefined' && authToken !== 'null' && authToken.length > 5;

    // (b) Active account query parameter check (e.g., account=USD or acct)
    const hasAccountParam = combinedParams.has('account') || combinedParams.has('acct') || combinedParams.has('acct1');

    // (c) Incoming OAuth handshake detection via search/hash
    const hasUrlTokens = foundValidToken || searchString.includes('token') || hashString.includes('token') || searchString.includes('acct');

    // (d) Final Rule: Resolves to true only if genuine auth tokens or active parameters are present
    const isAuthenticated = hasAuthToken || hasAccountParam || foundValidToken;

    return {
        isAuthenticated,
        hasUrlTokens
    };
};

const AppRoot = () => {
    let store;
    try {
        store = useStore();
    } catch (e) {
        store = null;
    }

    const api_base_initialized = useRef(false);

    // ================= 2. THE 5-SECOND PRELOADER LOGIC ================= //
    const [isPreloaded, setIsPreloaded] = useState<boolean>(false);
    const [isApiInitialized, setIsApiInitialized] = useState<boolean>(false);

    // Persistent evaluation based on actual credentials & active URL parameters
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        const status = getAuthenticationStatus();
        if (!status.isAuthenticated) {
            sessionStorage.removeItem('authToken');
            sessionStorage.removeItem('active_loginid');
        }
        return status.isAuthenticated;
    });

    // Run the 5-second preloader timer
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsPreloaded(true);
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    // ================= 3. CLEAN OAUTH INTERCEPTION & WORKSPACE ENTRY ================= //
    useEffect(() => {
        const status = getAuthenticationStatus();

        const initializeApp = async () => {
            try {
                if (status.isAuthenticated) {
                    // Preventing flashes & cleaning the URL: 
                    // Strip sensitive tokens out of the browser bar for cleanliness & security once captured
                    if (status.hasUrlTokens) {
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }

                    await api_base.init();
                    api_base_initialized.current = true;
                }
            } catch (error) {
                console.error('API Initialization error:', error);
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('active_loginid');
                setIsAuthenticated(false);
            } finally {
                setIsApiInitialized(true);
            }
        };

        initializeApp();
    }, []);

    // Twin-button handlers for login/signup actions on the Landing Page
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

    const handleSignup = () => {
        const originalSignupBtn = document.querySelector('.signup-btn, [class*="signup"], [class*="register"]') as HTMLButtonElement;
        
        if (originalSignupBtn) {
            originalSignupBtn.click();
        } else {
            window.open('https://home.deriv.com/dashboard', '_blank');
        }
    };

    // ================= RENDER GUARDS & ENFORCEMENT ================= //

    // Rule 2: If preloader hasn't finished OR API/Auth checks are still running, display Trading Preloader (Prevents flashing)
    if (!isPreloaded || !isApiInitialized) {
        return (
            <TradingPreloader 
                appName="TraderScore" 
                subtitle="TraderScore Trading Workspace" 
                minLoadingTime={5000} 
            />
        );
    }

    // Rule 1 & 2: Once the 5s timer completes, if not authenticated, land on the Landing Page
    if (!isAuthenticated) {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, backgroundColor: '#0b0e14', overflowY: 'auto' }}>
                <LandingPage onLogin={handleLogin} onSignup={handleSignup} />
            </div>
        );
    }

    // Rule 3: Fallback loader if store is initializing post-auth
    if (!store) {
        return <AppRootLoader />;
    }

    // Fully authenticated workspace entry point
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
