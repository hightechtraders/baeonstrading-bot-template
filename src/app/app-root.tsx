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

    // Synchronously check and persist authentication on mount
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        const urlParams = new URLSearchParams(window.location.search);
        let hasTokenInUrl = false;

        for (const [key, value] of urlParams.entries()) {
            if (key.includes('token') || key.startsWith('acct')) {
                localStorage.setItem(key, value);
                hasTokenInUrl = true;
                if (key.includes('token1') || key === 'token') {
                    localStorage.setItem('authToken', value);
                }
                if (key.startsWith('acct1') || key === 'acct') {
                    localStorage.setItem('active_loginid', value);
                }
            }
        }

        const clientAccounts = localStorage.getItem('client.accounts');
        const activeLoginId = localStorage.getItem('active_loginid');
        const authToken = localStorage.getItem('authToken');
        
        return !!(clientAccounts || activeLoginId || authToken || hasTokenInUrl);
    });

    // Dynamic storage listener
    useEffect(() => {
        const checkAuth = () => {
            const clientAccounts = localStorage.getItem('client.accounts');
            const activeLoginId = localStorage.getItem('active_loginid');
            const authToken = localStorage.getItem('authToken');
            const hasTokenInUrl = window.location.search.includes('token') || window.location.search.includes('acct');
            
            setIsAuthenticated(!!(clientAccounts || activeLoginId || authToken || hasTokenInUrl));
        };

        window.addEventListener('storage', checkAuth);
        return () => window.removeEventListener('storage', checkAuth);
    }, []);

    // Initialize API & Clean URL immediately
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

        // Fast fallback timeout to prevent hanging
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

    // Twin-button handler for Login (100% untouched)
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

    // Twin-button handler for Signup (100% untouched)
    const handleSignup = () => {
        const originalSignupBtn = document.querySelector('.signup-btn, [class*="signup"], [class*="register"]') as HTMLButtonElement;
        
        if (originalSignupBtn) {
            originalSignupBtn.click();
        } else {
            window.open('https://home.deriv.com/dashboard', '_blank');
        }
    };

    // 1. If NOT authenticated, show Landing Page immediately (No preloader delay on fresh visits)
    if (!isAuthenticated) {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, backgroundColor: '#0b0e14', overflowY: 'auto' }}>
                <LandingPage onLogin={handleLogin} onSignup={handleSignup} />
            </div>
        );
    }

    // 2. If authenticated, but API or store is still loading, show the single unified preloader
    if (!is_api_initialized || !store) {
        return <AppRootLoader />;
    }

    // 3. Fully loaded workspace
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
