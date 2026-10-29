// ==========================================
// FILE: src/pages/main/main.tsx
// ==========================================
import React, { lazy, Suspense, useEffect, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useLocation, useNavigate } from 'react-router-dom';
import ChunkLoader from '@/components/loader/chunk-loader';
import { generateOAuthURL } from '@/components/shared';
import DesktopWrapper from '@/components/shared_ui/desktop-wrapper';
import Dialog from '@/components/shared_ui/dialog';
import MobileWrapper from '@/components/shared_ui/mobile-wrapper';
import Tabs from '@/components/shared_ui/tabs/tabs';
import TradeTypeConfirmationModal from '@/components/trade-type-confirmation-modal';
import TradingViewModal from '@/components/trading-view-chart/trading-view-modal';
import { DBOT_TABS, TAB_IDS } from '@/constants/bot-contents';
import { api_base, updateWorkspaceName } from '@/external/bot-skeleton';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { isDbotRTL } from '@/external/bot-skeleton/utils/workspace';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { ScannerBridge } from '../../Aiscanner/scannerBridge';
import {
    disableUrlParameterApplication,
    enableUrlParameterApplication,
    setupTradeTypeChangeListener,
} from '@/utils/blockly-url-param-handler';
import {
    checkAndShowTradeTypeModal,
    getModalState,
    handleTradeTypeCancel,
    handleTradeTypeConfirm,
    resetUrlParamProcessing,
    setModalStateChangeCallback,
} from '@/utils/trade-type-modal-handler';
import {
    LabelPairedChartLineCaptionRegularIcon,
    LabelPairedObjectsColumnCaptionRegularIcon,
    LabelPairedPuzzlePieceTwoCaptionBoldIcon,
    LabelPairedBookmarkCaptionRegularIcon,
    LabelPairedUsersCaptionRegularIcon,
} from '@deriv/quill-icons/LabelPaired';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import RunPanel from '../../components/run-panel';
import ChartModal from '../chart/chart-modal';
import Dashboard from '../dashboard';
import RunStrategy from '../dashboard/run-strategy';
import './main.scss';

const ChartWrapper = lazy(() => import('../chart/chart-wrapper'));

const AppWrapper = observer(() => {
    const { connectionStatus } = useApiBase();
    const { dashboard, load_modal, run_panel, quick_strategy, summary_card, blockly_store } = useStore();
    const { is_loading } = blockly_store;
    const {
        active_tab,
        active_tour,
        is_chart_modal_visible,
        is_trading_view_modal_visible,
        setActiveTab,
        setWebSocketState,
        setActiveTour,
        setTourDialogVisibility,
    } = dashboard;
    const { dashboard_strategies } = load_modal;
    const {
        is_dialog_open,
        is_drawer_open,
        dialog_options,
        onCancelButtonClick,
        onCloseDialog,
        onOkButtonClick,
        stopBot,
    } = run_panel;
    const { is_open } = quick_strategy;
    const { cancel_button_text, ok_button_text, title, message, dismissable, is_closed_on_cancel } = dialog_options as {
        [key: string]: string;
    };
    const { clear } = summary_card;
    const { DASHBOARD, BOT_BUILDER } = DBOT_TABS;
    const init_render = React.useRef(true);
    const hash = ['dashboard', 'bot_builder', 'free_bots', 'copy_trading', 'chart', 'tutorial'];
    const { isDesktop } = useDevice();
    const location = useLocation();
    const navigate = useNavigate();
    const [left_tab_shadow, setLeftTabShadow] = useState<boolean>(false);
    const [right_tab_shadow, setRightTabShadow] = useState<boolean>(false);

    // Free bots card visibility state & 7 integrated working strategies
    const [is_card_visible, setIsCardVisible] = useState<boolean>(true);
    const [working_strategies] = useState([
        {
            id: 'strat_1',
            strategyName: 'EMA Crossover Breakpoint',
            description: 'Identifies trend momentum shifts by tracking fast and slow exponential moving average intersections.',
            marketName: 'Volatility 50 (1s) Index',
            symbol: '1HZ50V',
            contractType: 'PUT',
            direction: 'DOWN',
            confidence: '84%',
            status: 'HIGH',
        },
        {
            id: 'strat_2',
            strategyName: 'Bollinger Band Squeeze',
            description: 'Capitalizes on low-volatility consolidation periods anticipating strong breakout directional moves.',
            marketName: 'Volatility 100 (1s) Index',
            symbol: '1HZ100V',
            contractType: 'CALL',
            direction: 'UP',
            confidence: '79%',
            status: 'HIGH',
        },
        {
            id: 'strat_3',
            strategyName: 'Only Ups / Only Downs Momentum',
            description: 'Rides continuous multi-tick unidirectional trends with automated safety filters.',
            marketName: 'Volatility 100 Index',
            symbol: '1HZ100V',
            contractType: 'CALL',
            direction: 'UP',
            confidence: '91%',
            status: 'HIGH',
        },
        {
            id: 'strat_4',
            strategyName: 'Over 2, Recovery Over 7',
            description: 'Digit-based probabilistic trading targeting high-probability boundary exits with recovery scaling.',
            marketName: 'Volatility 75 Index',
            symbol: '1HZ75V',
            contractType: 'DIGITOVER',
            barrier: '2',
            direction: 'DIGIT',
            confidence: '88%',
            status: 'HIGH',
        },
        {
            id: 'strat_5',
            strategyName: 'Even Botter Strategy',
            description: 'Analyzes statistical parity of last digits to execute high-frequency even/odd contracts.',
            marketName: 'Volatility 10 Index',
            symbol: 'R_10',
            contractType: 'EVEN',
            direction: 'EVEN',
            confidence: '82%',
            status: 'MED',
        },
        {
            id: 'strat_6',
            strategyName: 'Over 1, Recovery Under 7',
            description: 'Digit prediction strategy designed to capture frequent tick fluctuations safely.',
            marketName: 'Volatility 25 Index',
            symbol: 'R_25',
            contractType: 'DIGITOVER',
            barrier: '1',
            direction: 'DIGIT',
            confidence: '85%',
            status: 'HIGH',
        },
        {
            id: 'strat_7',
            strategyName: 'Rise and Fall Copier',
            description: 'Mirrors high-frequency price action swings across synthetic volatility streams.',
            marketName: 'Volatility 50 Index',
            symbol: 'R_50',
            contractType: 'CALL',
            direction: 'CALL/PUT',
            confidence: '90%',
            status: 'HIGH',
        }
    ]);

    // Copy Trading Hub State & Datasets
    const [copy_sub_tab, setCopySubTab] = useState<'discover' | 'portfolio' | 'history'>('discover');
    const [selected_master, setSelectedMaster] = useState<any | null>(null);
    const [multiplier, setMultiplier] = useState<number>(1.0);
    const [maxStake, setMaxStake] = useState<string>('50');
    const [stopLoss, setStopLoss] = useState<string>('20');

    const [master_traders] = useState([
        {
            id: 'master_1',
            name: 'Baeons AI Momentum Master',
            creator: 'Baeons Tech Labs',
            winRate: '78.5%',
            roi30d: '+34.2%',
            maxDrawdown: '-4.1%',
            asset: 'Volatility 10 Index (R_10)',
            risk: 'Medium',
            copiersCount: 142,
            totalVolume: '$124,500',
            description: 'Leverages advanced neural network indicators to catch high-probability momentum bursts on synthetic volatility indices with built-in martingale recovery filters.',
            history: [
                { id: 't1', time: '10:42:15', asset: 'Volatility 10 Index', type: 'CALL', stake: '$10.00', pnl: '+$9.50' },
                { id: 't2', time: '10:38:02', asset: 'Volatility 10 Index', type: 'PUT', stake: '$10.00', pnl: '-$10.00' },
                { id: 't3', time: '10:30:11', asset: 'Volatility 10 Index', type: 'CALL', stake: '$20.00', pnl: '+$19.00' },
            ]
        },
        {
            id: 'master_2',
            name: 'Synthetic Scalper Pro V2',
            creator: 'AlphaQuant',
            winRate: '82.1%',
            roi30d: '+48.9%',
            maxDrawdown: '-6.8%',
            asset: 'Volatility 75 Index',
            risk: 'High',
            copiersCount: 289,
            totalVolume: '$389,100',
            description: 'High-frequency breakout scalper engineered for high-volatility environments. Executes fast contracts during consolidated band breakouts.',
            history: [
                { id: 't4', time: '10:40:00', asset: 'Volatility 75 Index', type: 'PUT', stake: '$15.00', pnl: '+$14.25' },
                { id: 't5', time: '10:25:44', asset: 'Volatility 75 Index', type: 'CALL', stake: '$15.00', pnl: '+$14.25' },
            ]
        },
        {
            id: 'master_3',
            name: 'Low-Risk Digit Defender',
            creator: 'SafeGrid Algos',
            winRate: '91.4%',
            roi30d: '+18.5%',
            maxDrawdown: '-1.5%',
            asset: 'Volatility 25 Index',
            risk: 'Low',
            copiersCount: 94,
            totalVolume: '$62,400',
            description: 'Conservative statistical digit barrier strategy designed for steady compounding with extremely low drawdown metrics.',
            history: [
                { id: 't6', time: '10:15:30', asset: 'Volatility 25 Index', type: 'DIGITOVER 2', stake: '$5.00', pnl: '+$4.20' },
            ]
        },
    ]);

    const [active_portfolios, setActivePortfolios] = useState([
        {
            id: 'active_1',
            name: 'Baeons AI Momentum Master',
            allocation: '$10.00 / trade',
            pnl: '+14.50 USD',
            status: 'Active',
        }
    ]);

    // Trade type modal state
    const [tradeTypeModalState, setTradeTypeModalState] = useState(getModalState());

    const getTradeTypeModalProps = () => {
        const { tradeTypeData } = tradeTypeModalState;

        return {
            is_visible: tradeTypeModalState.isVisible,
            trade_type_display_name: tradeTypeData?.displayName || '',
            current_trade_type: tradeTypeData?.currentTradeType
                ? `${tradeTypeData.currentTradeType.tradeTypeCategory}/${tradeTypeData.currentTradeType.tradeType}`
                : 'N/A',
            current_trade_type_display_name: tradeTypeData?.currentTradeTypeDisplayName || 'N/A',
            onConfirm: handleTradeTypeConfirm,
            onCancel: handleTradeTypeCancel,
        };
    };

    let tab_value: number | string = active_tab;
    const GetHashedValue = (tab: number) => {
        tab_value = location.hash?.split('#')[1];
        if (!tab_value) return tab;
        return Number(hash.indexOf(String(tab_value)));
    };
    const active_hash_tab = GetHashedValue(active_tab);

    React.useEffect(() => {
        setModalStateChangeCallback(new_state => {
            setTradeTypeModalState(new_state);
        });
    }, [is_loading]);

    React.useEffect(() => {
        resetUrlParamProcessing();
    }, [location.search]);

    React.useEffect(() => {
        const el_dashboard = document.getElementById('id-dbot-dashboard');
        const el_bot_builder = document.getElementById('id-bot-builder');

        const observer_dashboard = new window.IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setLeftTabShadow(false);
                    return;
                }
                setLeftTabShadow(true);
            },
            { root: null, threshold: 0.5 }
        );

        const observer_bot_builder = new window.IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setRightTabShadow(false);
                    return;
                }
                setRightTabShadow(true);
            },
            { root: null, threshold: 0.5 }
        );
        if (el_dashboard) observer_dashboard.observe(el_dashboard);
        if (el_bot_builder) observer_bot_builder.observe(el_bot_builder);
    }, []);

    React.useEffect(() => {
        if (connectionStatus !== CONNECTION_STATUS.OPENED) {
            const is_bot_running = document.getElementById('db-animation__stop-button') !== null;
            if (is_bot_running) {
                clear();
                stopBot();
                api_base.setIsRunning(false);
                setWebSocketState(false);
            }
        }
    }, [clear, connectionStatus, setWebSocketState, stopBot]);

    const updateTabShadowsHeight = () => {
        const botBuilderEl = document.getElementById('id-bot-builder');
        const leftShadow = document.querySelector('.tabs-shadow--left') as HTMLElement;
        const rightShadow = document.querySelector('.tabs-shadow--right') as HTMLElement;

        if (botBuilderEl && leftShadow && rightShadow) {
            const height = botBuilderEl.offsetHeight;
            leftShadow.style.height = `${height}px`;
            rightShadow.style.height = `${height}px`;
        }
    };

    React.useEffect(() => {
        let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;

        if (active_tab === BOT_BUILDER) {
            requestAnimationFrame(() => {
                disableUrlParameterApplication();
                setupTradeTypeChangeListener();

                const handleTradeTypeModal = () => {
                    checkAndShowTradeTypeModal(
                        () => {
                            enableUrlParameterApplication();
                        },
                        () => {}
                    );
                };

                if (!blockly_store.is_loading) {
                    setTimeout(() => {
                        handleTradeTypeModal();
                    }, 500);
                } else {
                    let pollAttempts = 0;
                    const maxPollAttempts = 10;

                    const checkBlocklyLoaded = () => {
                        if (!blockly_store.is_loading) {
                            handleTradeTypeModal();
                            return;
                        }

                        if (pollAttempts < maxPollAttempts) {
                            pollAttempts++;
                            pollTimeoutId = setTimeout(checkBlocklyLoaded, 500);
                        } else {
                            console.warn('Blockly loading timeout after 5 seconds');
                        }
                    };

                    checkBlocklyLoaded();
                }
            });
        }

        return () => {
            if (pollTimeoutId) {
                clearTimeout(pollTimeoutId);
                pollTimeoutId = null;
            }
        };
    }, [active_tab, is_loading]);

    React.useEffect(() => {
        updateTabShadowsHeight();

        if (is_open) {
            setTourDialogVisibility(false);
        }
        if (init_render.current) {
            setActiveTab(Number(active_hash_tab));
            if (!isDesktop) handleTabChange(Number(active_hash_tab));
            init_render.current = false;
        } else {
            const currentSearch = window.location.search;
            navigate(`${currentSearch}#${hash[active_tab] || hash[0]}`);
        }
        if (active_tour !== '') {
            setActiveTour('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active_tab]);

    React.useEffect(() => {
        const trashcan_init_id = setTimeout(() => {
            if (active_tab === BOT_BUILDER && Blockly?.derivWorkspace?.trashcan) {
                const trashcanY = window.innerHeight - 250;
                let trashcanX;
                if (is_drawer_open) {
                    trashcanX = isDbotRTL() ? 380 : window.innerWidth - 460;
                } else {
                    trashcanX = isDbotRTL() ? 20 : window.innerWidth - 100;
                }
                Blockly?.derivWorkspace?.trashcan?.setTrashcanPosition(trashcanX, trashcanY);
            }
        }, 100);

        return () => {
            clearTimeout(trashcan_init_id);
        };
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active_tab, is_drawer_open]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (dashboard_strategies.length > 0) {
            timer = setTimeout(() => {
                updateWorkspaceName();
            });
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [dashboard_strategies, active_tab]);

    const handleTabChange = React.useCallback(
        (tab_index: number) => {
            setActiveTab(tab_index);

            const el_id = TAB_IDS[tab_index];
            if (el_id) {
                const el_tab = document.getElementById(el_id);
                setTimeout(() => {
                    el_tab?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }, 10);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [active_tab]
    );

    const handleLoginGeneration = async () => {
        const oauthUrl = await generateOAuthURL();
        if (oauthUrl) {
            window.location.replace(oauthUrl);
        } else {
            console.error('Failed to generate OAuth URL');
        }
    };

    return (
        <React.Fragment>
            <div className='main'>
                <div
                    className={classNames('main__container', {
                        'main__container--active': active_tour && active_tab === DASHBOARD && !isDesktop,
                    })}
                >
                    <div>
                        {!isDesktop && left_tab_shadow && <span className='tabs-shadow tabs-shadow--left' />}
                        <Tabs active_index={active_tab} className='main__tabs' onTabItemClick={handleTabChange} top>
                            <div
                                label={
                                    <>
                                        <LabelPairedObjectsColumnCaptionRegularIcon
                                            height='24px'
                                            width='24px'
                                            fill='var(--text-general)'
                                        />
                                        <Localize i18n_default_text='Dashboard' />
                                    </>
                                }
                                id='id-dbot-dashboard'
                            >
                                <Dashboard handleTabChange={handleTabChange} />
                            </div>
                            <div
                                label={
                                    <>
                                        <LabelPairedPuzzlePieceTwoCaptionBoldIcon
                                            height='24px'
                                            width='24px'
                                            fill='var(--text-general)'
                                        />
                                        <Localize i18n_default_text='Bot Builder' />
                                    </>
                                }
                                id='id-bot-builder'
                            />
                            <div
                                label={
                                    <>
                                        <LabelPairedBookmarkCaptionRegularIcon
                                            height='24px'
                                            width='24px'
                                            fill='var(--text-general)'
                                        />
                                        <Localize i18n_default_text='Free Bots' />
                                    </>
                                }
                                id='id-tutorials'
                            >
                                <div className='free-bots-container'>
                                    {is_card_visible ? (
                                        <div className='free-bots-grid'>
                                            {working_strategies.map((bot, index) => (
                                                <div className='free-bots-card' key={bot.id}>
                                                    <div className='free-bots-header'>
                                                        <span className='strategy-tag'>STRATEGY #{index + 1}</span>
                                                        <span className='confidence-badge'>CONFIDENCE {bot.confidence}</span>
                                                    </div>

                                                    <div className='free-bots-body'>
                                                        <h4 className='strategy-title'>{bot.strategyName}</h4>
                                                        <p className='strategy-description'>{bot.description}</p>
                                                        <div className='strategy-details'>
                                                            <span className='market-name'>{bot.marketName}</span>
                                                            <span className='dot-separator'>•</span>
                                                            <span className={`direction-badge ${bot.direction === 'UP' ? 'up' : 'down'}`}>
                                                                {bot.direction}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <button 
                                                        onClick={() => {
                                                            ScannerBridge.executeDirectTrade(bot, {
                                                                symbol: bot.symbol,
                                                                contractType: bot.contractType,
                                                                barrier: bot.barrier,
                                                                stake: 0.35,
                                                                duration: 5,
                                                                durationUnit: 't'
                                                            });
                                                        }}
                                                        className='free-bots-btn'
                                                    >
                                                        Run Free Bot
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className='free-bots-closed-state'>
                                            <p>Strategy cards hidden.</p>
                                            <button 
                                                onClick={() => setIsCardVisible(true)}
                                                className='free-bots-btn rescan-btn'
                                            >
                                                Show Free Bots
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Copy Trading Tab Complete Hub */}
                            <div
                                label={
                                    <>
                                        <LabelPairedUsersCaptionRegularIcon
                                            height='24px'
                                            width='24px'
                                            fill='var(--text-general)'
                                        />
                                        <Localize i18n_default_text='Copy Trading' />
                                    </>
                                }
                                id='id-copy-trading'
                            >
                                <div className='free-bots-container' style={{ padding: '2rem', boxSizing: 'border-box' }}>
                                    
                                    {/* CONDITIONAL VIEW: MASTER STRATEGY DETAIL PAGE WITH VISIBLE BACK BUTTON */}
                                    {selected_master ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', maxWidth: '1000px', margin: '0 auto', textAlign: 'left', paddingBottom: '4rem' }}>
                                            
                                            {/* Top Navigation Bar with Back Button */}
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <button 
                                                    onClick={() => setSelectedMaster(null)}
                                                    style={{ 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        gap: '8px', 
                                                        background: 'var(--general-section-1)', 
                                                        border: '1.5px solid
