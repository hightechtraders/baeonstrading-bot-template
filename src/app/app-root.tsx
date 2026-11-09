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
    
    // ================= ARCHITECTURAL COMBO GATES ================= //
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
    const [isPreloaded, setIsPreloaded] = useState<boolean>(false);

    // Track strictly positive session tokens with hard cache clearing for unauthenticated loads
    const [hasValidSession, setHasValidSession] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        const search = window.location.search;
        const urlParams = new URLSearchParams(search);
        
        let foundValidToken = false;
        for (const [key, value] of urlParams.entries()) {
            if ((key.includes('token') || key.startsWith('acct')) && value && value.length > 5) {
                localStorage.setItem(key, value);
                foundValidToken = true;
                if (key.includes('token1') || key === 'token') {
                    localStorage.setItem('authToken', value);
                }
                if (key.startsWith('acct1') || key === 'acct') {
                    localStorage.setItem('active_loginid', value);
                }
            }
        }

        const authToken = localStorage.getItem('authToken');
        const hasValidAuthToken = !!authToken && authToken !== 'undefined' && authToken !== 'null' && authToken.length > 5;
        const hasAccountParam = urlParams.has('account') || urlParams.has('acct');

        const isAuthorized = hasValidAuthToken || hasAccountParam || foundValidToken;

        // ================= HARD CACHE CLEARING GUARD ================= //
        // If the user is visiting fresh without active OAuth tokens, aggressively purge
        // any lingering cached keys to guarantee a clean landing page launch.
        if (!isAuthorized) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('active_loginid');
            Object.keys(localStorage).forEach(key => {
                if (key.includes('token') || key.startsWith('acct') || key.includes('oauth')) {
                    localStorage.removeItem(key);
                }
            });
        }

        return isAuthorized;
    });
    
    const [is_api_initialized, setIsApiInitialized] = useState(false);

    // Handle the mandatory minimum preloader duration (5 seconds)
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsPreloaded(true);
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    // Validate API and session asynchronously on mount in parallel with the preloader timer
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        let tokenFound = false;

        for (const [key, value] of urlParams.entries()) {
            if ((key.includes('token') || key.startsWith('acct')) && value && value.length > 5) {
                localStorage.setItem(key, value);
                tokenFound = true;
            }
        }

        if (tokenFound || window.location.search.includes('token') || window.location.search.includes('acct')) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const verifyAndInitialize = async () => {
            try {
                if (hasValidSession) {
                    await api_base.init();
                    api_base_initialized.current = true;
                }
            } catch (error) {
                console.error('Session/API initialization failed:', error);
                localStorage.removeItem('authToken');
                localStorage.removeItem('active_loginid');
                setHasValidSession(false);
            } finally {
                setIsApiInitialized(true);
            }
        };

        if (hasValidSession) {
            verifyAndInitialize();
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('active_loginid');
            setIsApiInitialized(true);
        }
    }, [hasValidSession]);

    // Lift the auth loading gate ONLY when both the preloader timer has elapsed AND the API/session checks are complete
    useEffect(() => {
        if (isPreloaded && is_api_initialized) {
            setIsAuthLoading(false);
        }
    }, [isPreloaded, is_api_initialized]);

    // Twin-button handlers
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

    // ================= RENDER GUARDS ================= //

    // 1. Root Default: Play the preloader seamlessly while background validation executes
    if (isAuthLoading) {
        return (
            <TradingPreloader 
                appName="TraderScore" 
                subtitle="TraderScore Trading Workspace" 
                minLoadingTime={5000} 
            />
        );
    }

    // 2. If no valid session exists after preloader clears, lock onto the Landing Page
    if (!hasValidSession) {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, backgroundColor: '#0b0e14', overflowY: 'auto' }}>
                <LandingPage onLogin={handleLogin} onSignup={handleSignup} />
            </div>
        );
    }

    // 3. Fallback loader if store is initializing
    if (!store) {
        return <AppRootLoader />;
    }

    // 4. Fully authenticated workspace content
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
