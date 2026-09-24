import { lazy, Suspense, useEffect } from 'react';
import React from 'react';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import ChunkLoader from '@/components/loader/chunk-loader';
import LocalStorageSyncWrapper from '@/components/localStorage-sync-wrapper';
import RoutePromptDialog from '@/components/route-prompt-dialog';
import { useAccountSwitching } from '@/hooks/useAccountSwitching';
import { useLanguageFromURL } from '@/hooks/useLanguageFromURL';
import { useOAuthCallback } from '@/hooks/useOAuthCallback';
import { StoreProvider } from '@/hooks/useStore';
import { OAuthTokenExchangeService } from '@/services/oauth-token-exchange.service';
import { initializeI18n, localize, TranslationProvider } from '@deriv-com/translations';
import { scannerBridge } from '@/Aiscanner/scannerBridge';
import { CORE_7_STRATEGIES } from '@/Aiscanner/strategies';
import CoreStoreProvider from './CoreStoreProvider';
import './app-root.scss';

const Layout = lazy(() => import('../components/layout'));
const AppRoot = lazy(() => import('./app-root'));

// Map Deriv WebSocket tick symbols to match strategy asset names
const SYMBOL_MAP: Record<string, string> = {
    'R_10': 'Volatility 10',
    'R_25': 'Volatility 25',
    'R_50': 'Volatility 50',
    'R_75': 'Volatility 75',
    'R_100': 'Volatility 100',
    '1HZ100V': 'Volatility 100 (1s)',
    '1HZ25V': 'Volatility 25 (1s)',
};

// Translations CDN configuration
const i18nInstance = initializeI18n({ cdnUrl: '' });

/**
 * Global tick listener component that captures market stream events 
 * and feeds price data to the AI Scanner Web Worker.
 */
const ScannerTickSubscriber = () => {
    useEffect(() => {
        const handleTickEvent = (e: CustomEvent | MessageEvent) => {
            let detail = (e as CustomEvent).detail;

            // Handle direct WebSocket MessageEvent if passed
            if (!detail && (e as MessageEvent).data) {
                try {
                    detail = JSON.parse((e as MessageEvent).data);
                } catch {
                    return;
                }
            }

            if (!detail) return;

            // Normalize tick payload structure
            const tickData = detail.tick || detail;
            const rawSymbol = tickData?.symbol;
            const price = tickData?.quote ?? tickData?.price;

            if (rawSymbol && typeof price === 'number') {
                const assetName = SYMBOL_MAP[rawSymbol] || rawSymbol;
                scannerBridge.pushTick(assetName, price, CORE_7_STRATEGIES);
            }
        };

        // Listen to custom window events or raw WebSocket message broadcasts
        window.addEventListener('deriv:tick' as any, handleTickEvent);
        window.addEventListener('ws:tick' as any, handleTickEvent);

        return () => {
            window.removeEventListener('deriv:tick' as any, handleTickEvent);
            window.removeEventListener('ws:tick' as any, handleTickEvent);
        };
    }, []);

    return null;
};

/**
 * Component wrapper to handle language URL parameter
 */
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
                    fallback={<ChunkLoader message={localize('Please wait while we connect to the server...')} />}
                >
                    <TranslationProvider defaultLang='EN' i18nInstance={i18nInstance}>
                        <LanguageHandler>
                            <StoreProvider>
                                <LocalStorageSyncWrapper>
                                    <RoutePromptDialog />
                                    <CoreStoreProvider>
                                        <ScannerTickSubscriber />
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

function App() {
    // Handle OAuth callback flow (CSRF validation + code extraction)
    const { isProcessing, isValid, params, error, cleanupURL } = useOAuthCallback();

    // Handle account switching via URL parameter
    useAccountSwitching();

    // Process the authorization code when OAuth callback is valid
    React.useEffect(() => {
        if (!isProcessing && isValid && params.code) {
            OAuthTokenExchangeService.exchangeCodeForToken(params.code)
                .then(response => {
                    if (response.access_token) {
                        cleanupURL();
                    } else if (response.error) {
                        console.error('❌ Token exchange failed:', response.error);
                        console.error('Error description:', response.error_description);
                        cleanupURL();
                    }
                })
                .catch(error => {
                    console.error('❌ Token exchange request failed:', error);
                    cleanupURL();
                });
        } else if (!isProcessing && error) {
            console.error('OAuth callback error:', error);
        }
    }, [isProcessing, isValid, params.code, error, cleanupURL]);

    return <RouterProvider router={router} />;
}

export default App;
