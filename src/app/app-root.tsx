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
    
    // ================= ARCHITECTURAL AUTH GATES ================= //
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

    // Synchronously evaluate session and clear half-baked/interrupted tokens
    const [hasSession, setHasSession] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        const search = window.location.search;
        const urlParams = new URLSearchParams(search);
        
        let foundValidToken = false;
        for (const [key, value] of urlParams.entries()) {
            // Only capture valid tokens/accounts, ignore empty or stray fragments
            if ((key.includes('token') || key.startsWith('acct')) && value && value.length > 3) {
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
        const hasUrlTokens = search.includes('token') || search.includes('acct') || foundValidToken;

        const finalSessionState = hasValidAuthToken || hasAccountParam || hasUrlTokens;

        // If no valid session exists, actively wipe stale/half-written fragments to prevent false positives on reload
        if (!finalSessionState) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('active_loginid');
        }

        return finalSessionState;
    });
    
    const [is_api_initialized, setIsApiInitialized] = useState(false);
    const [isPreloaded, setIsPreloaded] = useState(false);

    // Unauthenticated preloader timer
    useEffect(() => {
        if (!hasSession) {
            const timer = setTimeout(() => {
                setIsPreloaded(true);
            }, 5000);
            return () => clearTimeout(timer);
        } else {
            setIsPreloaded(true);
        }
    }, [hasSession]);

    // Initialize API, clean URL search tokens, and manage the strict auth loading gate
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        let tokenFound = false;

        for (const [key, value] of urlParams.entries()) {
            if ((key.includes('token') || key.startsWith('acct')) && value && value.length > 3) {
                localStorage.setItem(key, value);
                tokenFound = true;
            }
        }

        if (tokenFound || window.location.search.includes('token') || window.location.search.includes('acct')) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const timeoutId = setTimeout(() => {
            if (!api_base_initialized.current) {
                setIsApiInitialized(true);
                setIsAuthLoading(false);
            }
        }, 2000);

        const initializeApi = async () => {
            if (!api_base_initialized.current) {
                try {
                    await api_base.init();
                    api_base_initialized.current = true;
                } catch (error) {
                    console.error('API initialization failed:', error);
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('active_loginid');
                    setHasSession(false);
                } finally {
                    setIsApiInitialized(true);
                    setIsAuthLoading(false);
                    clearTimeout(timeoutId);
                }
            }
        };

        if (hasSession) {
            initializeApi();
        } else {
            setIsApiInitialized(true);
            setIsAuthLoading(false);
        }

        return () => clearTimeout(timeoutId);
    }, [hasSession]);

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

    if (isAuthLoading) {
        return <AppRootLoader />;
    }

    const hasTokensInUrl = window.location.search.includes('token') || window.location.search.includes('acct');
    if (hasTokensInUrl || (!is_api_initialized && hasSession)) {
        return <AppRootLoader />;
    }

    if (!hasSession) {
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
