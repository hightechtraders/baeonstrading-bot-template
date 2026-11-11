// ==========================================
// FILE: src/app/App.tsx
// ==========================================
import { lazy, Suspense, useEffect } from 'react';
import React from 'react';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import LocalStorageSyncWrapper from '@/components/localStorage-sync-wrapper';
import RoutePromptDialog from '@/components/route-prompt-dialog';
import { useAccountSwitching } from '@/hooks/useAccountSwitching';
import { useLanguageFromURL } from '@/hooks/useLanguageFromURL';
import { useOAuthCallback } from '@/hooks/useOAuthCallback';
import { StoreProvider } from '@/hooks/useStore';
import { OAuthTokenExchangeService } from '@/services/oauth-token-exchange.service';
import { initializeI18n, TranslationProvider } from '@deriv-com/translations';
import { useScannerFeed } from '@/Aiscanner/useScannerFeed';
import { TradingPreloader } from '@/components/trading-preloader/TradingPreloader';
import CoreStoreProvider from './CoreStoreProvider';
import './app-root.scss';

const Layout = lazy(() => import('../components/layout'));
const AppRoot = lazy(() => import('./app-root'));

const i18nInstance = initializeI18n({ cdnUrl: '' });

const LanguageHandler = ({ children }: { children: React.ReactNode }) => {
    useLanguageFromURL();
    return <>{children}</>;
};

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route
            path='/'
            element={
                <Suspense
                    fallback={
                        <TradingPreloader 
                            appName="TraderScore" 
                            subtitle="TraderScore Trading Workspace" 
                            minLoadingTime={1000} 
                        />
                    }
                >
                    <TranslationProvider defaultLang='EN' i18nInstance={i18nInstance}>
                        <LanguageHandler>
                            <StoreProvider>
                                <LocalStorageSyncWrapper>
                                    <RoutePromptDialog />
                                    <CoreStoreProvider>
                                        <Layout />
                                    </CoreStoreProvider>
                                </LocalStorageSyncWrapper>
                            </StoreProvider>
                        </LanguageHandler>
                    </TranslationProvider>
                </Suspense>
            }
        >
            <Route index element={<AppRoot />} />
        </Route>
    )
);

export default function App() {
    useScannerFeed();

    const { isProcessing, isValid, params, error, cleanupURL } = useOAuthCallback();
    useAccountSwitching();

    // Force permanent dark mode on mobile devices, light mode on laptops
    useEffect(() => {
        const handleThemeByDevice = () => {
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                document.body.classList.add('theme--dark');
                document.body.classList.remove('theme--light');
            } else {
                document.body.classList.add('theme--light');
                document.body.classList.remove('theme--dark');
            }
        };

        handleThemeByDevice();
        window.addEventListener('resize', handleThemeByDevice);
        return () => window.removeEventListener('resize', handleThemeByDevice);
    }, []);

    // Clean token sync without overriding active account switcher logic
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

        if (tokenFound) {
            cleanupURL();
        }

        if (!isProcessing && isValid && params.code) {
            OAuthTokenExchangeService.exchangeCodeForToken(params.code)
                .then(response => {
                    if (response.access_token) {
                        localStorage.setItem('authToken', response.access_token);
                        cleanupURL();
                        window.location.href = '/';
                    } else if (response.error) {
                        cleanupURL();
                    }
                })
                .catch(() => cleanupURL());
        } else if (!isProcessing && error) {
            console.error('OAuth callback error:', error);
        }
    }, [isProcessing, isValid, params.code, error, cleanupURL]);

    return <RouterProvider router={router} />;
}
