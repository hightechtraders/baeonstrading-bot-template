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

// Immediate synchronous check and URL token capture
const checkAndCaptureSession = () => {
    if (typeof window === 'undefined') return false;

    const searchString = window.location.search;
    const hashString = window.location.hash.replace('#', '?');
    const combinedParams = new URLSearchParams(`${searchString}&${hashString}`);

    let foundToken = false;

    for (const [key, value] of combinedParams.entries()) {
        if ((key.includes('token') || key.startsWith('acct')) && value && value.length > 5) {
            sessionStorage.setItem(key, value);
            foundToken = true;
            if (key.includes('token1') || key === 'token' || key.includes('token')) {
                sessionStorage.setItem('authToken', value);
            }
            if (key.startsWith('acct1') || key === 'acct') {
                sessionStorage.setItem('active_loginid', value);
            }
        }
    }

    const authToken = sessionStorage.getItem('authToken');
    const hasAuthToken = !!authToken && authToken !== 'undefined' && authToken !== 'null' && authToken.length > 5;
    const hasAccountParam = combinedParams.has('account') || combinedParams.has('acct') || combinedParams.has('acct1');

    return hasAuthToken || hasAccountParam || foundToken;
};

const AppRoot = () => {
    let store;
    try {
        store = useStore();
    } catch (e) {
        store = null;
    }

    const api_base_initialized = useRef(false);

    // Capture session state instantly right on first evaluation
    const hasActiveSession = checkAndCaptureSession();

    const [isPreloaded, setIsPreloaded] = useState<boolean>(hasActiveSession);
    const [isApiInitialized, setIsApiInitialized] = useState<boolean>(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(hasActiveSession);

    // Clean URL query parameters safely *after* tokens are secured in session storage
    useEffect(() => {
        const searchString = window.location.search;
        const hashString = window.location.hash;
        if (hasActiveSession && (searchString.includes('token') || hashString.includes('token') || searchString.includes('acct'))) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [hasActiveSession]);

    // Preloader timer for unauthenticated users landing page experience
    useEffect(() => {
        if (isAuthenticated) {
            setIsPreloaded(true);
            return;
        }
        const timer = setTimeout(() => {
            setIsPreloaded(true);
        }, 5000);
        return () => clearTimeout(timer);
    }, [isAuthenticated]);

    // Initialize API background connection safely
    useEffect(() => {
        const initializeApp = async () => {
            try {
                if (hasActiveSession) {
                    if (!api_base_initialized.current) {
                        await api_base.init();
                        api_base_initialized.current = true;
                    }
                    setIsAuthenticated(true);
                }
            } catch (error) {
                console.error('API Initialization warning (ignoring minor socket jitter):', error);
                
                // DIFFERENCE: Instead of wiping session on ANY error, verify if token exists.
                // If a valid token exists in sessionStorage, keep the user logged in!
                const currentToken = sessionStorage.getItem('authToken');
                if (currentToken && currentToken.length > 5) {
                    console.log('Valid auth token found in session storage. Preserving session.');
                    setIsAuthenticated(true);
                } else {
                    sessionStorage.removeItem('authToken');
                    sessionStorage.removeItem('active_loginid');
                    setIsAuthenticated(false);
                }
            } finally {
                setIsApiInitialized(true);
            }
        };

        initializeApp();
    }, [hasActiveSession]);

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

    const handleSignup = () => {
        const originalSignupBtn = document.querySelector('.signup-btn, [class*="signup"], [class*="register"]') as HTMLButtonElement;
        if (originalSignupBtn) {
            originalSignupBtn.click();
        } else {
            window.open('https://home.deriv.com/dashboard', '_blank');
        }
    };

    // Render Guards
    if (!isPreloaded || !isApiInitialized) {
        return (
            <TradingPreloader 
                appName="TraderScore" 
                subtitle="TraderScore Trading Workspace" 
                minLoadingTime={1200} 
            />
        );
    }

    if (!isAuthenticated) {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, backgroundColor: '#0b0e14', overflowY: 'auto' }}>
                <LandingPage onLogin={handleLogin} onSignup={handleSignup} />
            </div>
        );
    }

    if (!store) {
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
