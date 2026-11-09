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

// Helper function to safely scrape OAuth parameters from search or hash fragments
const getOAuthSessionStatus = () => {
    if (typeof window === 'undefined') return { isValid: false, hasUrlTokens: false };

    const searchString = window.location.search;
    const hashString = window.location.hash.replace('#', '?');
    const combinedParams = new URLSearchParams(`${searchString}&${hashString}`);

    let foundValidToken = false;
    for (const [key, value] of combinedParams.entries()) {
        if ((key.includes('token') || key.startsWith('acct')) && value && value.length > 5) {
            sessionStorage.setItem(key, value);
            foundValidToken = true;
            if (key.includes('token1'] || key === 'token' || key.includes('token')) {
                sessionStorage.setItem('authToken', value);
            }
            if (key.startsWith('acct1') || key === 'acct') {
                sessionStorage.setItem('active_loginid', value);
            }
        }
    }

    const authToken = sessionStorage.getItem('authToken');
    const hasValidAuthToken = !!authToken && authToken !== 'undefined' && authToken !== 'null' && authToken.length > 5;
    const hasAccountParam = combinedParams.has('account') || combinedParams.has('acct');

    return {
        isValid: hasValidAuthToken || hasAccountParam || foundValidToken,
        hasUrlTokens: foundValidToken || searchString.includes('token') || hashString.includes('token') || searchString.includes('acct')
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
    
    // ================= ARCHITECTURAL COMBO GATES ================= //
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
    const [isPreloaded, setIsPreloaded] = useState<boolean>(false);

    // Track strictly positive session tokens using sessionStorage
    const [hasValidSession, setHasValidSession] = useState<boolean>(() => {
        const session = getOAuthSessionStatus();
        if (!session.isValid) {
            sessionStorage.removeItem('authToken');
            sessionStorage.removeItem('active_loginid');
            localStorage.removeItem('authToken');
            localStorage.removeItem('active_loginid');
        }
        return session.isValid;
    });
    
    const [is_api_initialized, setIsApiInitialized] = useState(false);

    // Handle the mandatory minimum preloader duration (5 seconds)
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsPreloaded(true);
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    // Validate API and session asynchronously on mount
    useEffect(() => {
        const session = getOAuthSessionStatus();

        const verifyAndInitialize = async () => {
            try {
                if (session.isValid) {
                    // Clean URL parameters immediately after capturing so they don't loop
                    if (session.hasUrlTokens) {
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }

                    await api_base.init();
                    api_base_initialized.current = true;
                }
            } catch (error) {
                console.error('Session/API initialization failed:', error);
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('active_loginid');
                setHasValidSession(false);
            } finally {
                setIsApiInitialized(true);
            }
        };

        if (session.isValid) {
            verifyAndInitialize();
        } else {
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
