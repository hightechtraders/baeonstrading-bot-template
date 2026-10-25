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

    // 1. Synchronously compute authentication status and persist tokens immediately on mount
    const [isAuthenticated] = useState<boolean>(() => {
        const search = window.location.search;
        const hasUrlAuth = search.includes('token') || search.includes('acct');

        const urlParams = new URLSearchParams(search);
        let foundValidAuth = false;

        for (const [key, value] of urlParams.entries()) {
            if (key.includes('token') || key.startsWith('acct')) {
                localStorage.setItem(key, value);
                sessionStorage.setItem('active_session_active', 'true');
                foundValidAuth = true;
                if (key.includes('token1') || key === 'token') {
                    localStorage.setItem('authToken', value);
                }
                if (key.startsWith('acct1') || key === 'acct') {
                    localStorage.setItem('active_loginid', value);
                }
            }
        }

        const isSessionActive = sessionStorage.getItem('active_session_active') === 'true';
        const hasLocalToken = !!(localStorage.getItem('authToken') || localStorage.getItem('token'));
        
        return !!(hasUrlAuth || foundValidAuth || isSessionActive || hasLocalToken);
    });

    // 2. Initialize API and clean URL parameters once on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        let tokenFound = false;

        for (const [key, value] of urlParams.entries()) {
            if (key.includes('token') || key.startsWith('acct')) {
                tokenFound = true;
            }
        }

        if (tokenFound) {
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

    // Direct Login handler using the official OAuth sign-in gateway
    const handleLogin = () => {
        const appId = '1089'; 
        const redirectUrl = encodeURIComponent(window.location.origin + '/');
        window.location.href = `https://oauth.deriv.com/oauth2/oauth.html?app_id=${appId}&l=EN&brand=deriv`;
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
    const isSessionActive = isAuthenticated || sessionStorage.getItem('active_session_active') === 'true';

    // If genuinely not authenticated and no active session, show the Landing Page
    if (!isAuthenticated && !isSessionActive) {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, backgroundColor: '#0b0e14', overflowY: 'auto' }}>
                <LandingPage onLogin={handleLogin} onSignup={handleSignup} />
            </div>
        );
    }

    // If authenticated or session is active, show preloader until API is fully initialized
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
