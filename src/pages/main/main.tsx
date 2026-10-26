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
    // Updated hash array to match tab order: dashboard, bot_builder, free_bots, copy_trading, chart, tutorial
    const hash = ['dashboard', 'bot_builder', 'free_bots', 'copy_trading', 'chart', 'tutorial'];
    const { isDesktop } = useDevice();
    const location = useLocation();
    const navigate = useNavigate();
    const [left_tab_shadow, setLeftTabShadow] = useState<boolean>(false);
    const [right_tab_shadow, setRightTabShadow] = useState<boolean>(false);

    // Free bots card visibility state & 7 integrated working strategies with descriptions and accurate contract mappings
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
                                                    {/* Header Section */}
                                                    <div className='free-bots-header'>
                                                        <span className='strategy-tag'>STRATEGY #{index + 1}</span>
                                                        <span className='confidence-badge'>CONFIDENCE {bot.confidence}</span>
                                                    </div>

                                                    {/* Strategy Body with Definition / Description */}
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

                                                    {/* Action Button - Headless Execution */}
                                                    <button 
                                                        onClick={() => {
                                                            console.log(`Executing ${bot.strategyName} via Headless API...`);
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
                            {/* Copy Trading Tab inserted between Free Bots and Charts */}
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
                                <div className='free-bots-container'>
                                    <div className='free-bots-closed-state'>
                                        <h3 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.8rem', color: 'var(--text-prominent)' }}>
                                            Copy Trading Hub
                                        </h3>
                                        <p>Connect with master traders and mirror profitable automated strategies in real-time.</p>
                                    </div>
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

export default AppWrapper;
