import { lazy, Suspense, useState, useEffect } from 'react';
import React from 'react';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import LocalStorageSyncWrapper from '@/components/localStorage-sync-wrapper';
import RoutePromptDialog from '@/components/route-prompt-dialog';
import { useAccountSwitching } from '@/hooks/useAccountSwitching';
import { useLanguageFromURL } from '@/hooks/useLanguageFromURL';
import { useOAuthCallback } from '@/hooks/useOAuthCallback';
import { StoreProvider } from '@/hooks/useStore';
import { OAuthTokenExchangeService } from '@/services/oauth-token-exchange.service';
import { initializeI18n, localize, TranslationProvider } from '@deriv-com/translations';
import { FloatingAI } from '@/Aiscanner/FloatingAI';
import { useScannerFeed } from '@/Aiscanner/useScannerFeed';
import { TradingPreloader } from '@/components/trading-preloader/TradingPreloader';
import { LandingPage } from '@/components/LandingPage'; // Import your new landing page
import CoreStoreProvider from './CoreStoreProvider';
import './app-root.scss';

const Layout = lazy(() => import('../components/layout'));
const AppRoot = lazy(() => import('./app-root'));

// Translations CDN configuration
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
                            minLoadingTime={10000} 
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
                                        {/* Floating AI Scanner Component */}
                                        <FloatingAI />
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

    // Check if token exists in localStorage or URL query parameters
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        return !!localStorage.getItem('authToken') || window.location.search.includes('token');
    });

    React.useEffect(() => {
        if (!isProcessing && isValid && params.code) {
            OAuthTokenExchangeService.exchangeCodeForToken(params.code)
                .then(response => {
                    if (response.access_token) {
                        localStorage.setItem('authToken', response.access_token);
                        setIsAuthenticated(true);
                        cleanupURL();
                    } else if (response.error) {
                        cleanupURL();
                    }
                })
                .catch(() => cleanupURL());
        } else if (!isProcessing && error) {
            console.error('OAuth callback error:', error);
        }
    }, [isProcessing, isValid, params.code, error, cleanupURL]);

    const handleLoginRedirect = () => {
        // Replace with your actual Deriv App ID
        const appId = 'YOUR_APP_ID'; 
        const redirectUrl = encodeURIComponent(window.location.origin);
        window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&brand=deriv&l=EN`;
    };

    // If user is not authenticated, show your professional landing page first!
    if (!isAuthenticated) {
        return <LandingPage onLogin={handleLoginRedirect} />;
    }

    return <RouterProvider router={router} />;
}
