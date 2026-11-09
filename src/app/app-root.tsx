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
    // Safely attempt to grab store, handle potential undefined initial state safely
    let store;
    try {
        store = useStore();
    } catch (e) {
        store = null;
    }

    const api_base_initialized = useRef(false);
    
    // ================= ARCHITECTURAL AUTH GATES ================= //
    // 1. Strict auth loading gate: Default to true to prevent premature rendering race conditions
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

    // Synchronously evaluate session and tokens on initial mount initializer function
    const [hasSession, setHasSession] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        const search = window.location.search;
        const urlParams = new URLSearchParams(search);
        
        let foundToken = false;
        for (const [key, value] of urlParams.entries()) {
            if (key.includes('token') || key.startsWith('acct')) {
                localStorage.setItem(key, value);
                foundToken = true;
                if (key.includes('token1') || key === 'token') {
                    localStorage.setItem('authToken', value);
                }
                if (key.startsWith('acct1') || key === 'acct') {
                    localStorage.setItem('active_loginid', value);
                }
            }
        }

        const hasAuthToken = !!localStorage.getItem('authToken');
        const hasAccountParam = urlParams.has('account') || urlParams.has('acct');
        const hasUrlTokens = search.includes('token') || search.includes('acct') || foundToken;

        return hasAuthToken || hasAccountParam || hasUrlTokens;
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
            if (key.includes('token') || key.startsWith('acct')) {
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
                setIsAuthLoading(false); // Release gate on fallback timeout
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
                    setHasSession(false);
                } finally {
                    setIsApiInitialized(true);
                    setIsAuthLoading(false); // Release auth loading gate only after API initialization finishes
                    clearTimeout(timeoutId);
                }
            }
        };

        if (hasSession) {
            initializeApi();
        } else {
            setIsApiInitialized(true);
            setIsAuthLoading(false); // Release gate immediately if unauthenticated
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

    // 1. Strict Auth Loading Gate: Block all workspace mounting until session and API initialization are fully settled
    if (isAuthLoading) {
        return <AppRootLoader />;
    }

    // 2. If incoming OAuth return tokens exist in URL, show loader immediately to prevent flash
    const hasTokensInUrl = window.location.search.includes('token') || window.location.search.includes('acct');
    if (hasTokensInUrl || (!is_api_initialized && hasSession)) {
        return <AppRootLoader />;
    }

    // 3. If genuinely not authenticated, strictly enforce the landing page view
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

    // 4. If authenticated but store/API is still booting up, show loader
    if (!store || !is_api_initialized) {
        return <AppRootLoader />;
    }

    // 5. Safe to render workspace app content for authenticated users
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
