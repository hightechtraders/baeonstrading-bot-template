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
import { ScannerLogic } from '@/Aiscanner/scannerLogic';
import { FloatingAI } from '@/Aiscanner/FloatingAI';
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
    '1HZ50V': 'Volatility 50 (1s)',
    '1HZ75V': 'Volatility 75 (1s)',
};

const TARGET_MARKETS = ['1HZ50V', '1HZ75V', '1HZ10V', '1HZ100V', 'R_25', 'R_75', 'R_10'];

// Translations CDN configuration
const i18nInstance = initializeI18n({ cdnUrl: '' });

// Persistent singleton instance of your core scanner logic
const globalScanner = new ScannerLogic();

/**
 * Safe tick subscriber that taps into the existing Deriv application socket 
 * without breaking redirects, auth, or navigation flow.
 */
const ScannerTickSubscriber = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let pollTimer: NodeJS.Timeout;
        let hasSubscribed = false;

        const connectAndSubscribe = () => {
            const appStore = (window as any).derivBotAppStore;
            const ws = appStore?.client?.ws || (window as any).ws || (window as any).derivSocket;

            if (ws && ws.readyState === WebSocket.OPEN) {
                if (!hasSubscribed) {
                    console.log("[AI Sniper]: Attached to active Deriv socket. Requesting ticks...");
                    TARGET_MARKETS.forEach((symbol) => {
                        ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
                    });
                    hasSubscribed = true;
                }
            }
        };

        // Poll every second until the application store and socket are open and ready
        pollTimer = setInterval(connectAndSubscribe, 1000);

        // Listen for custom tick events or messages
        const handleCustomTick = (e: CustomEvent) => {
            const detail = e.detail;
            if (detail?.symbol && typeof detail?.price === 'number') {
                const assetName = SYMBOL_MAP[detail.symbol] || detail.symbol;
                scannerBridge.pushTick(assetName, detail.price, CORE_7_STRATEGIES);
                const updatedStrategies = globalScanner.processLiveTick(detail.symbol, detail.price);
                window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                    detail: { strategies: updatedStrategies }
                }));
            }
        };

        window.addEventListener('deriv_live_tick' as any, handleCustomTick as EventListener);

        return () => {
            clearInterval(pollTimer);
            window.removeEventListener('deriv_live_tick' as any, handleCustomTick as EventListener);
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
                                        {/* Floating AI Scanner Button & Modal */}
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
