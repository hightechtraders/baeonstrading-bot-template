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

    // Force permanent dark mode & full brightness explicitly on mobile devices only
    useEffect(() => {
        const brightnessStyle = document.createElement('style');
        brightnessStyle.id = 'mobile-brightness-override';

        const handleThemeByDevice = () => {
            const isMobile = window.innerWidth <= 768; // Standard mobile threshold
            if (isMobile) {
                document.body.classList.add('theme--dark');
                document.body.classList.remove('theme--light');

                // Apply full brightness / prevent fading strictly on mobile
                brightnessStyle.innerHTML = `
                    @media screen and (max-width: 768px) {
                        html, body, #root {
                            filter: brightness(1) !important;
                            backdrop-filter: none !important;
                        }
                        button:disabled, input:disabled, [class*="disabled"] {
                            opacity: 0.95 !important;
                            filter: brightness(1) !important;
                        }
                    }
                `;
                if (!document.head.contains(brightnessStyle)) {
                    document.head.appendChild(brightnessStyle);
                }
            } else {
                document.body.classList.add('theme--light');
                document.body.classList.remove('theme--dark');

                // Remove brightness override on desktop/laptop
                if (document.head.contains(brightnessStyle)) {
                    brightnessStyle.remove();
                }
            }
        };

        // Run on mount
        handleThemeByDevice();

        // Handle if user resizes window between mobile and desktop views
        window.addEventListener('resize', handleThemeByDevice);
        return () => {
            window.removeEventListener('resize', handleThemeByDevice);
            if (document.head.contains(brightnessStyle)) {
                brightnessStyle.remove();
            }
        };
    }, []);

    // Automatically capture and store tokens when Deriv redirects back
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        for (const [key, value] of urlParams.entries()) {
            if (key.includes('token') || key.startsWith('acct')) {
                localStorage.setItem('authToken', value);
            }
        }

        if (!isProcessing && isValid && params.code) {
            OAuthTokenExchangeService.exchangeCodeForToken(params.code)
                .then(response => {
                    if (response.access_token) {
                        localStorage.setItem('authToken', response.access_token);
                        cleanupURL();
                        window.location.href = '/'; // Refresh clean state
                    } else if (response.error) {
                        cleanupURL();
                    }
                })
                .catch(() => cleanupURL());
        } else if (!isProcessing && error) {
            console.error('OAuth callback error:', error);
        }
    }, [isProcessing, isValid, params.code, error, cleanupURL]);

    // Router handles everything cleanly now
    return <RouterProvider router={router} />;
}
