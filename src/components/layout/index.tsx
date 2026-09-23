import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import { Outlet } from 'react-router-dom';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { useDevice } from '@deriv-com/ui';
import { crypto_currencies_display_order, fiat_currencies_display_order } from '../shared';
import Footer from './footer';
import AppHeader from './header';
import Body from './main-body';
import { FloatingAI } from '../../Aiscanner/FloatingAI';
import RiskDisclaimer from '../risk-disclaimer/risk-disclaimer';
import './layout.scss';

const Layout = observer(() => {
    const { isDesktop } = useDevice();
    const store = useStore();
    const is_quick_strategy_active = store?.quick_strategy?.is_open;
    const isCallbackPage = window.location.pathname === '/callback';

    // Risk Disclaimer Modal State
    const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);

    // Track scanner visibility by observing screen text
    const [isScannerVisible, setIsScannerVisible] = useState(false);

    useEffect(() => {
        const checkForScannerText = () => {
            // Check if any element on the page contains "AI Multi-Asset Scanner"
            const bodyText = document.body.innerText || document.body.textContent || '';
            const isVisible = bodyText.includes('AI Multi-Asset Scanner');
            setIsScannerVisible(isVisible);
        };

        // Check initially
        checkForScannerText();

        // Listen for DOM changes when modal opens or closes
        const observerInstance = new MutationObserver(() => {
            checkForScannerText();
        });

        observerInstance.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });

        return () => observerInstance.disconnect();
    }, []);

    const checkClientAccount = JSON.parse(localStorage.getItem('clientAccounts') ?? '{}');
    const getQueryParams = new URLSearchParams(window.location.search);
    const currency = getQueryParams.get('account') ?? '';
    const accountsList = JSON.parse(localStorage.getItem('accountsList') ?? '{}');
    const isClientAccountsPopulated = Object.keys(accountsList).length > 0;
    const ifClientAccountHasCurrency =
        Object.values(checkClientAccount).some((account: any) => account.currency === currency) ||
        currency === 'demo' ||
        currency === '';
    const [clientHasCurrency, setClientHasCurrency] = useState(ifClientAccountHasCurrency);
    const [isAuthenticating, setIsAuthenticating] = useState(true);

    useEffect(() => {
        (window as any).setClientHasCurrency = setClientHasCurrency;
        (window as any).openRiskDisclaimer = () => setIsRiskModalOpen(true);

        return () => {
            delete (window as any).setClientHasCurrency;
            delete (window as any).openRiskDisclaimer;
        };
    }, []);

    const validCurrencies = [...fiat_currencies_display_order, ...crypto_currencies_display_order];
    const query_currency = (getQueryParams.get('account') ?? '')?.toUpperCase();
    const isCurrencyValid = validCurrencies.includes(query_currency);
    const api_accounts: any[][] = [];
    let subscription: { unsubscribe: () => void };

    const validateApiAccounts = ({ data }: any) => {
        if (data.msg_type === 'authorize') {
            const account_list = data?.authorize?.account_list || [];
            const account_list_filter = account_list.filter((acc: any) => acc.is_disabled === 0);
            api_accounts.push(account_list_filter || []);
            const allCurrencies = new Set(Object.values(checkClientAccount).map((acc: any) => acc.currency));

            const accounts = api_accounts.flat();
            let detected_currency = '';
            const hasMissingCurrency = accounts.some(data => {
                if (!allCurrencies.has(data.currency)) {
                    sessionStorage.setItem('query_param_currency', data.currency);
                    return true;
                }
                detected_currency = data.currency;
                return false;
            });

            let hasMissingToken = false;
            let missingTokenCurrency = '';

            for (const acc of account_list_filter) {
                if (acc.loginid && !accountsList[acc.loginid]) {
                    hasMissingToken = true;
                    missingTokenCurrency = acc.currency || '';
                    if (missingTokenCurrency) {
                        sessionStorage.setItem('query_param_currency', missingTokenCurrency);
                    }
                    break;
                }
            }

            if (hasMissingCurrency || hasMissingToken) {
                setClientHasCurrency(false);
            } else {
                const account_list_ =
                    account_list_filter?.find((acc: { currency: string }) => acc.currency === currency) ||
                    account_list_filter?.[0];

                let session_storage_currency =
                    sessionStorage.getItem('query_param_currency') || account_list_?.currency || 'USD';

                session_storage_currency = `account=${session_storage_currency}`;
                setClientHasCurrency(true);
                if (!new URLSearchParams(window.location.search).has('account')) {
                    window.history.pushState({}, '', `${window.location.pathname}?${session_storage_currency}`);
                }

                setClientHasCurrency(true);
            }

            if (subscription) {
                subscription?.unsubscribe();
            }
        }
    };

    useEffect(() => {
        if (isCurrencyValid && api_base.api) {
            const is_valid_currency = currency && validCurrencies.includes(currency.toUpperCase());
            if (!is_valid_currency) return;
            subscription = api_base.api.onMessage().subscribe(validateApiAccounts);
        }
    }, []);

    useEffect(() => {
        setIsAuthenticating(true);
        if (currency) {
            sessionStorage.setItem('query_param_currency', currency);
        }
        setIsAuthenticating(false);
    }, [isClientAccountsPopulated, isCallbackPage, clientHasCurrency, currency]);

    const [isInitialAuthCheckComplete, setIsInitialAuthCheckComplete] = useState(false);

    useEffect(() => {
        if (!isAuthenticating && !isInitialAuthCheckComplete) {
            const timer = setTimeout(() => {
                setIsInitialAuthCheckComplete(true);
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [isAuthenticating, isInitialAuthCheckComplete]);

    return (
        <div
            className={clsx('layout', {
                responsive: isDesktop,
                'quick-strategy-active': is_quick_strategy_active && !isDesktop,
            })}
        >
            {!isCallbackPage && <AppHeader isAuthenticating={isAuthenticating || !isInitialAuthCheckComplete} />}
            <Body>
                <Outlet />
            </Body>
            {!isCallbackPage && isDesktop && <Footer />}
            <FloatingAI />

            {/* Render Risk Disclaimer Trigger Button ONLY when scanner modal text is NOT present */}
            {!isScannerVisible && (
                <button
                    type="button"
                    className="risk-disclaimer-trigger"
                    onClick={() => setIsRiskModalOpen(true)}
                >
                    ⚠️ Risk Disclaimer
                </button>
            )}

            {/* Risk Disclaimer Modal */}
            <RiskDisclaimer
                isOpen={isRiskModalOpen}
                onClose={() => setIsRiskModalOpen(false)}
            />
        </div>
    );
});

export default Layout;
