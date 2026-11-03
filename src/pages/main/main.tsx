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
    LabelPairedLaptopCaptionRegularIcon,
} from '@deriv/quill-icons/LabelPaired';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import RunPanel from '../../components/run-panel';
import ChartModal from '../chart/chart-modal';
import Dashboard from '../dashboard';
import RunStrategy from '../dashboard/run-strategy';
import './main.scss';

const ChartWrapper = lazy(() => import('../chart/chart-wrapper'));

// ==========================================
// SUB-COMPONENT: PROFESSIONAL SVG GAUGE CIRCLE
// ==========================================
function ProfessionalDigitGauge({ digit, percentage, isSelected, trendMode }) {
  const circleRadius = 18;
  const lineThickness = 3.5;
  const pathCircumference = 2 * Math.PI * circleRadius; // ~113.1
  
  const operationalScale = 15;
  const scaledValue = Math.min(percentage, operationalScale);
  const strokeOffsetProgress = pathCircumference - (scaledValue / operationalScale) * pathCircumference;
  
  let themeConfig = {
    labelColor: '#9ca3af',
    valueColor: 'var(--text-prominent)',
    trackColor: 'rgba(255, 255, 255, 0.08)',
    activeColor: '#6b7280',
    background: 'transparent',
    glow: 'none'
  };

  if (trendMode === 'selected' || isSelected) {
    themeConfig = {
      labelColor: '#818cf8',
      valueColor: '#ffffff',
      trackColor: '#1e1b4b',
      activeColor: '#6366f1',
      background: 'rgba(99, 102, 241, 0.15)',
      glow: '0 0 12px rgba(99, 102, 241, 0.4)'
    };
  } else if (trendMode === 'high') {
    themeConfig = {
      labelColor: '#14b8a6',
      valueColor: '#2dd4bf',
      trackColor: 'rgba(20, 184, 166, 0.15)',
      activeColor: '#14b8a6',
      background: 'rgba(20, 184, 166, 0.1)',
      glow: '0 0 10px rgba(20, 184, 166, 0.25)'
    };
  } else if (trendMode === 'low') {
    themeConfig = {
      labelColor: '#f43f5e',
      valueColor: '#fb7185',
      trackColor: 'rgba(244, 63, 94, 0.15)',
      activeColor: '#f43f5e',
      background: 'rgba(244, 63, 94, 0.1)',
      glow: '0 0 10px rgba(244, 63, 94, 0.25)'
    };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px', userSelect: 'none' }}>
      <span style={{ fontSize: '12px', fontWeight: 900, marginBottom: '4px', letterSpacing: '0.5px', color: themeConfig.labelColor }}>
        {digit}
      </span>
      
      <div 
        style={{ 
          position: 'relative', 
          width: '52px', 
          height: '52px', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          background: themeConfig.background,
          boxShadow: themeConfig.glow,
          transition: 'all 0.3s ease'
        }}
      >
        <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 44 44">
          <circle 
            cx="22" 
            cy="22" 
            r={circleRadius} 
            fill="none"
            stroke={themeConfig.trackColor}
            strokeWidth={lineThickness} 
          />
          <circle
            cx="22"
            cy="22"
            r={circleRadius}
            fill="none"
            stroke={themeConfig.activeColor}
            strokeWidth={lineThickness}
            strokeDasharray={pathCircumference}
            strokeDashoffset={strokeOffsetProgress}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '-0.5px', color: themeConfig.valueColor }}>
            {percentage}%
          </span>
        </div>
      </div>
    </div>
  );
}

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
    const hash = ['dashboard', 'bot_builder', 'free_bots', 'manual_trader', 'copy_trading', 'chart', 'tutorial'];
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

    // Manual Trader State Set strictly to Volatility 10 (R_10)
    const [selectedSymbol] = useState('Volatility 10 Index');
    const symbolCode = 'R_10';
    const [contractType, setContractType] = useState('Over/Under');
    const [targetDigit, setTargetDigit] = useState<number>(8);
    const [manualStake, setManualStake] = useState<string>('500.00');

    // Moving Cursor simulation state for active red upward arrow cursor underneath
    const [cursorPosition, setCursorPosition] = useState<number>(6);
    useEffect(() => {
        const interval = setInterval(() => {
            setCursorPosition(prev => (prev + 1) % 10);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    const [digitStats] = useState([
        { digit: 0, percent: 9.5, trend: 'neutral' },
        { digit: 1, percent: 9.4, trend: 'neutral' },
        { digit: 2, percent: 10.4, trend: 'neutral' },
        { digit: 3, percent: 10.0, trend: 'neutral' },
        { digit: 4, percent: 10.4, trend: 'neutral' },
        { digit: 5, percent: 8.7,  trend: 'low' },
        { digit: 6, percent: 11.3, trend: 'high' },
        { digit: 7, percent: 11.6, trend: 'high' },
        { digit: 8, percent: 9.3,  trend: 'selected' },
        { digit: 9, percent: 9.4,  trend: 'neutral' }
    ]);

    // Copy Trading Hub State & Mock Datasets
    const [copy_sub_tab, setCopySubTab] = useState<'discover' | 'portfolio' | 'history'>('discover');
    const [multiplier, setMultiplier] = useState<number>(1.0);
    const [maxStake, setMaxStake] = useState<string>('50');
    const [stopLoss, setStopLoss] = useState<string>('20');
    const [riskFilter, setRiskFilter] = useState<'ALL' | 'Low' | 'Medium' | 'High'>('ALL');

    const [master_traders] = useState([
        {
            id: 'master_1',
            name: 'Barons AI Momentum Master',
            creator: 'Barons Tech Lab',
            winRate: '78.5%',
            roi30d: '+34.2%',
            maxDrawdown: '-4.1%',
            asset: 'Volatility 10 Index',
            risk: 'Medium',
            copiersCount: 142,
        },
        {
            id: 'master_2',
            name: 'Synthetic Scalper Pro V2',
            creator: 'AlphaQuant',
            winRate: '82.1%',
            roi30d: '+48.9%',
            maxDrawdown: '-6.8%',
            asset: 'Volatility 10 Index',
            risk: 'High',
            copiersCount: 289,
        },
        {
            id: 'master_3',
            name: 'Low-Risk Digit Defender',
            creator: 'SafeGrid Algos',
            winRate: '91.4%',
            roi30d: '+18.5%',
            maxDrawdown: '-1.5%',
            asset: 'Volatility 10 Index',
            risk: 'Low',
            copiersCount: 94,
        },
    ]);

    const [active_portfolios, setActivePortfolios] = useState([
        {
            id: 'active_1',
            name: 'Barons AI Momentum Master',
            allocation: '$10.00 / trade',
            pnl: '+14.50 USD',
            status: 'Active',
        }
    ]);

    const [trade_history] = useState([
        { id: 'tx_1', time: '12:04:12', master: 'Barons AI Momentum Master', type: 'CALL', stake: '$10.00', pnl: '+$4.50', status: 'Won' },
        { id: 'tx_2', time: '11:58:30', master: 'Barons AI Momentum Master', type: 'PUT', stake: '$10.00', pnl: '-$10.00', status: 'Lost' },
        { id: 'tx_3', time: '11:42:05', master: 'Synthetic Scalper Pro V2', type: 'DIGITOVER', stake: '$15.00', pnl: '+$20.00', status: 'Won' },
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

                            {/* MANUAL TRADER TAB - PROPERLY FIT IN SCREEN */}
                            <div
                                label={
                                    <>
                                        <LabelPairedLaptopCaptionRegularIcon
                                            height='24px'
                                            width='24px'
                                            fill='var(--text-general)'
                                        />
                                        <Localize i18n_default_text='Manual Trader' />
                                    </>
                                }
                                id='id-manual-trader'
                            >
                                <div className='manual-trader-wrapper' style={{ maxWidth: '1100px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '8px', margin: '0 auto', padding: '0.4rem 0.8rem', boxSizing: 'border-box', overflowY: 'auto' }}>
                                    
                                    {/* Market Mode Banner */}
                                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-prominent)', background: 'var(--general-section-1)', padding: '4px 12px', borderRadius: '16px', border: '1.5px solid rgba(0, 168, 107, 0.3)', fontWeight: 600 }}>
                                            Market Mode: <strong style={{ color: '#00a86b' }}>{selectedSymbol}</strong>
                                        </span>
                                    </div>

                                    {/* 10-Digit Dynamic SVG Gauge Grid with bottom space reserved for red arrow cursor */}
                                    <div className='digit-stats-grid' style={{ background: 'var(--general-section-1)', border: '1.5px solid rgba(0, 168, 107, 0.35)', borderRadius: '1rem', padding: '8px 10px 16px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', flexShrink: 0 }}>
                                        <div className='digit-stats-grid__inner'>
                                            {digitStats.map((item) => {
                                                const isSelected = targetDigit === item.digit;
                                                const isCursorHere = cursorPosition === item.digit;
                                                let cardModifier = '';
                                                if (isSelected) cardModifier = 'digit-card--selected';
                                                else if (item.trend === 'high') cardModifier = 'digit-card--high';
                                                else if (item.trend === 'low') cardModifier = 'digit-card--low';

                                                return (
                                                    <div 
                                                        key={item.digit} 
                                                        onClick={() => {
                                                            setTargetDigit(item.digit);
                                                            setCursorPosition(item.digit);
                                                        }}
                                                        className={`digit-gauge-card ${cardModifier}`}
                                                        style={{ position: 'relative', paddingBottom: '20px' }}
                                                    >
                                                        <ProfessionalDigitGauge
                                                            digit={item.digit}
                                                            percentage={item.percent}
                                                            isSelected={isSelected}
                                                            trendMode={isSelected ? 'selected' : item.trend}
                                                        />

                                                        {/* Red Upward Arrow Cursor Design cleanly positioned underneath */}
                                                        {isCursorHere && (
                                                            <div style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'bounceCursor 0.8s infinite alternate', pointerEvents: 'none' }}>
                                                                <span style={{ color: '#ef4444', fontSize: '14px', fontWeight: 900, lineHeight: 1, filter: 'drop-shadow(0 2px 3px rgba(239, 68, 68, 0.4))' }}>▲</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Compact Interactive Controls & Strategy Setup Card */}
                                    <div style={{ background: 'var(--general-section-1)', border: '1.5px solid rgba(0, 168, 107, 0.35)', borderRadius: '1rem', padding: '10px 14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', flexShrink: 0 }}>
                                        
                                        {/* Strategy Selection & Targets Row */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                                            <div>
                                                <label style={{ fontSize: '0.68rem', color: 'var(--text-general)', display: 'block', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>Trade Logic Blueprint</label>
                                                <select 
                                                    value={contractType} 
                                                    onChange={(e) => setContractType(e.target.value)}
                                                    style={{ width: '100%', background: 'var(--general-main-1)', border: '1.5px solid rgba(0, 168, 107, 0.35)', color: 'var(--text-prominent)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, outline: 'none', cursor: 'pointer' }}
                                                >
                                                    <option value='Over/Under'>Over / Under</option>
                                                    <option value='Matches/Differs'>Matches / Differs</option>
                                                    <option value='Even/Odd'>Even / Odd</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.68rem', color: 'var(--text-general)', display: 'block', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>Prediction Target</label>
                                                <div style={{ width: '100%', background: 'var(--general-main-1)', border: '1.5px solid rgba(99, 102, 241, 0.5)', color: '#818cf8', padding: '6px 10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 900, textAlign: 'center' }}>
                                                    Digit: {targetDigit}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Contract Duration & Stake Allocation Row */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '10px', marginBottom: '8px', alignItems: 'center' }}>
                                            <div>
                                                <label style={{ fontSize: '0.68rem', color: 'var(--text-general)', display: 'block', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>Contract Duration</label>
                                                <div style={{ width: '100%', background: 'var(--general-main-1)', border: '1.5px solid rgba(0, 168, 107, 0.25)', color: 'var(--text-prominent)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}>
                                                    1 Tick Execution
                                                </div>
                                            </div>

                                            <div style={{ background: 'var(--general-main-1)', border: '1.5px solid rgba(0, 168, 107, 0.35)', borderRadius: '8px', padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                                    <span style={{ fontSize: '0.62rem', color: 'var(--text-general)', textTransform: 'uppercase', fontWeight: 800 }}>Risk Capital Allocation</span>
                                                    <input 
                                                        type='text' 
                                                        value={manualStake}
                                                        onChange={(e) => setManualStake(e.target.value)}
                                                        style={{ background: 'transparent', color: 'var(--text-prominent)', fontWeight: 900, fontSize: '0.95rem', border: 'none', outline: 'none', width: '100%', marginTop: '1px' }}
                                                    />
                                                </div>
                                                <span style={{ fontSize: '0.68rem', fontWeight: 900, color: 'var(--text-prominent)', background: 'var(--general-section-1)', padding: '3px 8px', borderRadius: '6px', border: '1.5px solid rgba(0, 168, 107, 0.3)' }}>USD STAKE</span>
                                            </div>
                                        </div>

                                        {/* Dual Block Execution Payout Action Area - Locked to R_10 */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <button 
                                                onClick={() => {
                                                    ScannerBridge.executeDirectTrade(
                                                        { strategyName: `Manual Over ${targetDigit}`, symbol: symbolCode },
                                                        { symbol: symbolCode, contractType: 'DIGITOVER', barrier: String(targetDigit), stake: Number(manualStake) || 1, duration: 1, durationUnit: 't' }
                                                    );
                                                }}
                                                style={{ background: '#059669', border: 'none', padding: '8px', borderRadius: '10px', color: '#fff', fontWeight: 900, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(5, 150, 105, 0.35)', transition: 'all 0.2s ease' }}
                                            >
                                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.9 }}>Purchase Over</span>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 900, marginTop: '1px' }}>OVER {targetDigit}</span>
                                                <span style={{ marginTop: '2px', fontSize: '0.62rem', fontWeight: 700, background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                                                    Payout: +3,514.41 USD
                                                </span>
                                            </button>

                                            <button 
                                                onClick={() => {
                                                    ScannerBridge.executeDirectTrade(
                                                        { strategyName: `Manual Under ${targetDigit}`, symbol: symbolCode },
                                                        { symbol: symbolCode, contractType: 'DIGITUNDER', barrier: String(targetDigit), stake: Number(manualStake) || 1, duration: 1, durationUnit: 't' }
                                                    );
                                                }}
                                                style={{ background: '#e11d48', border: 'none', padding: '8px', borderRadius: '10px', color: '#fff', fontWeight: 900, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(225, 29, 72, 0.35)', transition: 'all 0.2s ease' }}
                                            >
                                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.9 }}>Purchase Under</span>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 900, marginTop: '1px' }}>UNDER {targetDigit}</span>
                                                <span style={{ marginTop: '2px', fontSize: '0.62rem', fontWeight: 700, background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                                                    Payout: +593.82 USD
                                                </span>
                                            </button>
                                        </div>

                                    </div>
                                </div>
                            </div>

                            {/* Copy Trading Tab Complete Production Hub */}
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
                                <div className='free-bots-container' style={{ padding: '24px' }}>
                                    {/* Header & Sub-Nav Bar */}
                                    <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid rgba(0, 168, 107, 0.2)', paddingBottom: '1.2rem' }}>
                                        <div>
                                            <h3 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.4rem', color: 'var(--text-prominent)', letterSpacing: '0.5px' }}>
                                                Copy Trading Hub
                                            </h3>
                                            <p style={{ color: 'var(--text-prominent)', fontSize: '1.05rem', fontWeight: 500, opacity: 0.9 }}>
                                                Mirror verified master traders and automate multi-asset execution in real-time.
                                            </p>
                                        </div>

                                        {/* Professional Sub-Navigation Tabs */}
                                        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0, 168, 107, 0.08)', padding: '6px', borderRadius: '12px', border: '1px solid rgba(0, 168, 107, 0.2)' }}>
                                            <button 
                                                onClick={() => setCopySubTab('discover')}
                                                style={{ padding: '10px 18px', background: copy_sub_tab === 'discover' ? '#00a86b' : 'transparent', border: 'none', color: copy_sub_tab === 'discover' ? '#fff' : 'var(--text-prominent)', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s ease' }}
                                            >
                                                Discover Masters
                                            </button>
                                            <button 
                                                onClick={() => setCopySubTab('portfolio')}
                                                style={{ padding: '10px 18px', background: copy_sub_tab === 'portfolio' ? '#00a86b' : 'transparent', border: 'none', color: copy_sub_tab === 'portfolio' ? '#fff' : 'var(--text-prominent)', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s ease' }}
                                            >
                                                Active Portfolios ({active_portfolios.length})
                                            </button>
                                            <button 
                                                onClick={() => setCopySubTab('history')}
                                                style={{ padding: '10px 18px', background: copy_sub_tab === 'history' ? '#00a86b' : 'transparent', border: 'none', color: copy_sub_tab === 'history' ? '#fff' : 'var(--text-prominent)', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s ease' }}
                                            >
                                                Trade Audit Log
                                            </button>
                                        </div>
                                    </div>

                                    {/* DISCOVER TAB VIEW */}
                                    {copy_sub_tab === 'discover' && (
                                        <>
                                            {/* Advanced Risk Management & Capital Allocation Panel */}
                                            <div style={{ background: 'var(--general-section-1)', border: '1.5px solid rgba(0, 168, 107, 0.3)', borderRadius: '1.4rem', padding: '20px 24px', marginBottom: '2.4rem', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                                                <div style={{ flex: '1.2', minWidth: '220px' }}>
                                                    <label style={{ display: 'block', fontSize: '0.95rem', color: 'var(--text-prominent)', fontWeight: 700, marginBottom: '8px' }}>Global Stake Multiplier: <strong style={{ color: '#00a86b' }}>{multiplier}x</strong></label>
                                                    <input 
                                                        type='range' min='0.1' max='5.0' step='0.1' value={multiplier} 
                                                        onChange={(e) => setMultiplier(Number(e.target.value))}
                                                        style={{ width: '100%', accentColor: '#00a86b', cursor: 'pointer' }} 
                                                    />
                                                </div>
                                                <div style={{ flex: '1', minWidth: '180px' }}>
                                                    <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-prominent)', fontWeight: 700, marginBottom: '6px' }}>Max Stake Cap ($)</label>
                                                    <input 
                                                        type='number' value={maxStake} onChange={(e) => setMaxStake(e.target.value)}
                                                        style={{ width: '100%', padding: '10px 14px', background: 'var(--general-main-1)', border: '1.5px solid rgba(0, 168, 107, 0.35)', color: 'var(--text-prominent)', borderRadius: '8px', fontSize: '1rem', fontWeight: 600 }}
                                                    />
                                                </div>
                                                <div style={{ flex: '1', minWidth: '180px' }}>
                                                    <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-prominent)', fontWeight: 700, marginBottom: '6px' }}>Daily Stop-Loss ($)</label>
                                                    <input 
                                                        type='number' value={stopLoss} onChange={(e) => setStopLoss(e.target.value)}
                                                        style={{ width: '100%', padding: '10px 14px', background: 'var(--general-main-1)', border: '1.5px solid rgba(0, 168, 107, 0.35)', color: 'var(--text-prominent)', borderRadius: '8px', fontSize: '1rem', fontWeight: 600 }}
                                                    />
                                                </div>
                                                <div style={{ flex: '1', minWidth: '160px' }}>
                                                    <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-prominent)', fontWeight: 700, marginBottom: '6px' }}>Risk Filter</label>
                                                    <select 
                                                        value={riskFilter} 
                                                        onChange={(e) => setRiskFilter(e.target.value as any)}
                                                        style={{ width: '100%', padding: '10px 12px', background: 'var(--general-main-1)', border: '1.5px solid rgba(0, 168, 107, 0.35)', color: 'var(--text-prominent)', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }}
                                                    >
                                                        <option value='ALL'>All Risk Profiles</option>
                                                        <option value='Low'>Low Risk Only</option>
                                                        <option value='Medium'>Medium Risk Only</option>
                                                        <option value='High'>High Risk Only</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Master Traders Production Cards Grid */}
                                            <div className='free-bots-grid'>
                                                {master_traders
                                                    .filter(trader => riskFilter === 'ALL' || trader.risk === riskFilter)
                                                    .map((trader, index) => (
                                                        <div className='free-bots-card' key={trader.id} style={{ background: 'var(--general-section-1)', border: '1.5px solid rgba(0, 168, 107, 0.4)', borderRadius: '1.4rem', padding: '20px' }}>
                                                            <div className='free-bots-header'>
                                                                <span className='strategy-tag' style={{ fontSize: '0.85rem', fontWeight: 800 }}>MASTER #{index + 1}</span>
                                                                <span className='confidence-badge' style={{ background: trader.risk === 'Low' ? 'rgba(76, 175, 80, 0.18)' : trader.risk === 'Medium' ? 'rgba(33, 150, 243, 0.18)' : 'rgba(255, 152, 0, 0.18)', color: trader.risk === 'Low' ? '#4caf50' : trader.risk === 'Medium' ? '#2196f3' : '#ff9800', fontSize: '0.85rem', fontWeight: 700, padding: '4px 10px', borderRadius: '6px' }}>
                                                                    {trader.risk} Risk
                                                                </span>
                                                            </div>

                                                            <div className='free-bots-body'>
                                                                <h4 className='strategy-title' style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-prominent)' }}>{trader.name}</h4>
                                                                <p className='strategy-description' style={{ fontSize: '0.95rem', color: 'var(--text-prominent)', opacity: 0.9, fontWeight: 500 }}>
                                                                    Created by <strong style={{ color: '#00a86b' }}>{trader.creator}</strong> • {trader.copiersCount} active copiers
                                                                </p>
                                                                
                                                                {/* High-Contrast Production Stat Boxes */}
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
                                                                    <div style={{ background: 'rgba(0, 168, 107, 0.08)', border: '1px solid rgba(0, 168, 107, 0.25)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                                                                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-general)', fontWeight: 600, textTransform: 'uppercase' }}>Win Rate</span>
                                                                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-prominent)' }}>{trader.winRate}</span>
                                                                    </div>
                                                                    <div style={{ background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                                                                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-general)', fontWeight: 600, textTransform: 'uppercase' }}>30D ROI</span>
                                                                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#4caf50' }}>{trader.roi30d}</span>
                                                                    </div>
                                                                </div>

                                                                <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-less-prominent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span>Primary Asset:</span>
                                                                    <strong style={{ color: 'var(--text-prominent)' }}>{trader.asset}</strong>
                                                                </div>
                                                            </div>

                                                            <button 
                                                                onClick={() => {
                                                                    setActivePortfolios(prev => [...prev, {
                                                                        id: `active_${Date.now()}`,
                                                                        name: trader.name,
                                                                        allocation: `$${(0.35 * multiplier).toFixed(2)} / trade`,
                                                                        pnl: '+0.00 USD',
                                                                        status: 'Active',
                                                                    }]);
                                                                    setCopySubTab('portfolio');
                                                                }} 
                                                                className='free-bots-btn'
                                                                style={{ marginTop: '1.2rem', background: '#00a86b', color: '#fff', border: 'none', fontWeight: 800, padding: '12px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                                            >
                                                                Copy Strategy Now
                                                            </button>
                                                        </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {/* ACTIVE PORTFOLIOS TAB VIEW */}
                                    {copy_sub_tab === 'portfolio' && (
                                        <div>
                                            {active_portfolios.length === 0 ? (
                                                <div className='free-bots-closed-state' style={{ padding: '60px', textAlign: 'center', background: 'var(--general-section-1)', borderRadius: '1.4rem', border: '1.5px dashed rgba(0, 168, 107, 0.3)' }}>
                                                    <p style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>You are not currently copying any master traders.</p>
                                                    <button onClick={() => setCopySubTab('discover')} className='free-bots-btn rescan-btn' style={{ background: '#00a86b', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 700 }}>
                                                        Discover Strategies
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                    {active_portfolios.map(item => (
                                                        <div key={item.id} style={{ background: 'var(--general-section-1)', border: '1.5px solid rgba(0, 168, 107, 0.4)', borderRadius: '1.4rem', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                                                            <div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                                                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4caf50', display: 'inline-block', boxShadow: '0 0 8px #4caf50' }} />
                                                                    <h4 style={{ color: 'var(--text-prominent)', fontSize: '1.2rem', fontWeight: 800 }}>{item.name}</h4>
                                                                </div>
                                                                <p style={{ color: 'var(--text-prominent)', fontSize: '0.95rem', fontWeight: 500, opacity: 0.9 }}>
                                                                    Allocation: <strong>{item.allocation}</strong> • Multiplier: <strong>{multiplier}x</strong> • Max Stake: <strong>${maxStake}</strong>
                                                                </p>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                                                <div style={{ textAlign: 'right', background: 'rgba(76, 175, 80, 0.08)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                                                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-general)', fontWeight: 700, textTransform: 'uppercase' }}>Live P&L</span>
                                                                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#4caf50' }}>{item.pnl}</span>
                                                                </div>
                                                                <button 
                                                                    onClick={() => {
                                                                        setActivePortfolios(prev => prev.filter(p => p.id !== item.id));
                                                                    }}
                                                                    style={{ padding: '10px 18px', background: 'rgba(244, 67, 54, 0.15)', border: '1px solid rgba(244, 67, 54, 0.4)', color: '#f44336', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, transition: 'all 0.2s ease' }}
                                                                >
                                                                    Unlink Master
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* TRADE AUDIT LOG TAB VIEW */}
                                    {copy_sub_tab === 'history' && (
                                        <div style={{ background: 'var(--general-section-1)', border: '1.5px solid rgba(0, 168, 107, 0.35)', borderRadius: '1.4rem', padding: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                                            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-prominent)', marginBottom: '16px' }}>Executed Mirror Trades Audit Log</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {trade_history.map(tx => (
                                                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--general-main-1)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                        <div>
                                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-general)', fontWeight: 700 }}>{tx.time}</span>
                                                                <span style={{ fontSize: '0.85rem', fontWeight: 700, background: 'rgba(0,168,107,0.15)', color: '#00a86b', padding: '2px 8px', borderRadius: '4px' }}>{tx.type}</span>
                                                            </div>
                                                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-prominent)' }}>{tx.master}</span>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-general)', fontWeight: 600 }}>Stake: {tx.stake}</span>
                                                            <span style={{ fontSize: '1rem', fontWeight: 800, color: tx.status === 'Won' ? '#4caf50' : '#f44336' }}>{tx.pnl} ({tx.status})</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div
                                label={
                                    <>
                                        <LabelPairedChartLineCaptionRegularIcon
                                            height='24px'
                                            width='24px'
                                            fill='var(--text-general)'
                                        />
                                        <Localize i18n_default_text='Charts' />
                                    </>
                                }
                                id={
                                    is_chart_modal_visible || is_trading_view_modal_visible
                                        ? 'id-charts--disabled'
                                        : 'id-charts'
                                }
                            >
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading chart...')} />}
                                >
                                    <ChartWrapper show_digits_stats={false} />
                                </Suspense>
                            </div>
                        </Tabs>
                        {!isDesktop && right_tab_shadow && <span className='tabs-shadow tabs-shadow--right' />}
                    </div>
                </div>
            </div>
            <DesktopWrapper>
                <div className='main__run-strategy-wrapper'>
                    <RunStrategy />
                    <RunPanel />
                </div>
                <ChartModal />
                <TradingViewModal />
            </DesktopWrapper>
            <MobileWrapper>{!is_open && <RunPanel />}</MobileWrapper>
            <Dialog
                cancel_button_text={cancel_button_text || localize('Cancel')}
                className='dc-dialog__wrapper--fixed'
                confirm_button_text={ok_button_text || localize('Ok')}
                has_close_icon
                is_mobile_full_width={false}
                is_visible={is_dialog_open}
                onCancel={onCancelButtonClick}
                onClose={onCloseDialog}
                onConfirm={onOkButtonClick || onCloseDialog}
                portal_element_id='modal_root'
                title={title}
                login={handleLoginGeneration}
                dismissable={dismissable}
                is_closed_on_cancel={is_closed_on_cancel}
            >
                {message}
            </Dialog>

            {(() => {
                const modalProps = getTradeTypeModalProps();
                return (
                    <TradeTypeConfirmationModal
                        is_visible={modalProps.is_visible}
                        trade_type_display_name={modalProps.trade_type_display_name}
                        current_trade_type={modalProps.current_trade_type}
                        current_trade_type_display_name={modalProps.current_trade_type_display_name}
                        onConfirm={modalProps.onConfirm}
                        onCancel={modalProps.onCancel}
                    />
                );
            })()}
        </React.Fragment>
    );
});

AppWrapper.displayName = 'AppWrapper';

export default AppWrapper;
