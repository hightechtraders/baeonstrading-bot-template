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

// Translations CDN configuration
const i18nInstance = initializeI18n({ cdnUrl: '' });

// Persistent singleton instance of your core scanner logic
const globalScanner = new ScannerLogic();

/**
 * Global tick listener component that intercepts the native WebSocket stream
 * and feeds real-time prices to both the scanner bridge and logic engine.
 */
const ScannerTickSubscriber = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Save original WebSocket constructor
        const OrigWebSocket = window.WebSocket;

        // Override WebSocket globally to catch all incoming Deriv frames
        (window as any).WebSocket = function(url: string, protocols?: string | string[]) {
            const ws = new OrigWebSocket(url, protocols);
            
            ws.addEventListener('message', (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Check if the frame is a Deriv tick response
                    if (data.msg_type === 'tick' && data.tick) {
                        const rawSymbol = data.tick.symbol;
                        const price = Number(data.tick.quote);

                        if (rawSymbol && !isNaN(price)) {
                            const assetName = SYMBOL_MAP[rawSymbol] || rawSymbol;
                            
                            // 1. Push tick into your UI bridge
                            scannerBridge.pushTick(assetName, price, CORE_7_STRATEGIES);

                            // 2. Feed tick into ScannerLogic to drive buffers, confidence scores, and signal locks
                            const updatedStrategies = globalScanner.processLiveTick(rawSymbol, price);

                            // 3. Broadcast fresh strategy updates to FloatingAI
                            window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                                detail: { strategies: updatedStrategies }
                            }));
                        }
                    }
                } catch (err) {
                    // Ignore non-JSON frames
                }
            });
            
            return ws;
        };

        // Copy static properties over
        Object.assign((window as any).WebSocket, OrigWebSocket);

        console.log("[AI Sniper]: Global WebSocket tick interceptor active.");
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
