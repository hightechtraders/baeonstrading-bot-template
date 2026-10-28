import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { addComma, getCurrencyDisplayCode, getDecimalPlaces } from '@/components/shared';
import Text from '@/components/shared_ui/text';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { isDemoAccount } from '@/utils/account-helpers';
import { Localize } from '@deriv-com/translations';
import { TAccountSwitcher } from './common/types';
import AccountInfoWrapper from './account-info-wrapper';
import './account-switcher.scss';

const AccountSwitcher = observer(({ activeAccount }: TAccountSwitcher) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { accountList, activeLoginid } = useApiBase();
    const { client, run_panel } = useStore() ?? {};

    const is_bot_running = run_panel?.is_running || api_base.is_running;
    const isSingleAccount = !accountList || accountList.length <= 1;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const toggleDropdown = useCallback(() => {
        if (is_bot_running || isSingleAccount) return;
        setIsOpen(prev => !prev);
    }, [is_bot_running, isSingleAccount]);

    const handleAccountSelect = useCallback(
        (loginid: string) => {
            localStorage.setItem('active_loginid', loginid);
            client?.checkAndRegenerateWebSocket();
            setIsOpen(false);
        },
        [client]
    );

    const formattedAccounts = useMemo(() => {
        if (!accountList) return [];
        return accountList
            .map(account => ({
                loginid: account.loginid,
                currency: account.currency,
                balance: addComma(Number(account.balance ?? 0).toFixed(getDecimalPlaces(account.currency))),
                isVirtual: isDemoAccount(account.loginid),
                isActive: account.loginid === activeLoginid,
            }))
            .sort((a, b) => (a.isActive ? -1 : b.isActive ? 1 : 0));
    }, [accountList, activeLoginid]);

    if (!activeAccount) return null;

    const { currency, isVirtual, balance } = activeAccount;
    const showChevron = !isSingleAccount && !is_bot_running;

    return (
        <div className='acc-info__wrapper' ref={wrapperRef}>
            <AccountInfoWrapper>
                <div
                    data-testid='dt_acc_info'
                    id='dt_core_account-info_acc-info'
                    role={showChevron ? 'button' : undefined}
                    tabIndex={showChevron ? 0 : -1}
                    aria-expanded={showChevron ? isOpen : undefined}
                    aria-haspopup={showChevron ? 'listbox' : undefined}
                    className={classNames('acc-info', {
                        'acc-info--is-virtual': isVirtual,
                        'acc-info--interactive': showChevron,
                    })}
                    onClick={toggleDropdown}
                    onKeyDown={e => {
                        if (showChevron && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            toggleDropdown();
                        }
                    }}
                >
                    <span className='acc-info__id' aria-hidden='true'></span>
                    
                    {/* Main Horizontal Flex Row */}
                    <div className='acc-info__content' style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', flexDirection: 'row' }}>
                        
                        {/* Currency Flag / Badge */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            backgroundColor: isVirtual ? '#e0f2fe' : '#d1fae5',
                            color: isVirtual ? '#0369a1' : '#047857',
                            borderRadius: '50%',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            flexShrink: 0
                        }}>
                            $
                        </div>

                        {/* Text Stack: Account Type on top, Balance on bottom */}
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2', textAlign: 'left' }}>
                            <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: 500 }}>
                                {isVirtual ? 'Demo account' : 'Real account'}
                            </span>
                            {(typeof balance !== 'undefined' || !currency) && (
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1f2937', whiteSpace: 'nowrap' }}>
                                    {!currency ? 'No currency' : `${balance} ${getCurrencyDisplayCode(currency)}`}
                                </span>
                            )}
                        </div>

                        {/* Dropdown Chevron Arrow on the right */}
                        {showChevron && (
                            <span
                                className={classNames('acc-info__select-arrow', {
                                    'acc-info__select-arrow--invert': isOpen,
                                })}
                                style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}
                            >
                                <svg width='10' height='10' viewBox='0 0 12 12' fill='none'>
                                    <path
                                        d='M2 4L6 8L10 4'
                                        stroke='currentColor'
                                        strokeWidth='1.5'
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    />
                                </svg>
                            </span>
                        )}
                    </div>
                </div>
            </AccountInfoWrapper>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className='acc-dropdown' role='listbox'>
                    {formattedAccounts.map(account => (
                        <div
                            key={account.loginid}
                            role='option'
                            aria-selected={account.isActive}
                            tabIndex={0}
                            className={classNames('acc-dropdown__account', {
                                'acc-dropdown__account--selected': account.isActive,
                                'acc-dropdown__account--virtual': account.isVirtual,
                            })}
                            onClick={() => !account.isActive && handleAccountSelect(account.loginid)}
                            onKeyDown={e => {
                                if (!account.isActive && (e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    handleAccountSelect(account.loginid);
                                }
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px' }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '20px',
                                height: '20px',
                                backgroundColor: account.isVirtual ? '#e0f2fe' : '#d1fae5',
                                color: account.isVirtual ? '#0369a1' : '#047857',
                                borderRadius: '50%',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                flexShrink: 0
                            }}>
                                $
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '9px', color: '#6b7280' }}>
                                    {account.isVirtual ? 'Demo account' : 'Real account'}
                                </span>
                                <Text size='xs' weight='bold' className='acc-dropdown__balance'>
                                    {account.currency ? (
                                        `${account.balance} ${getCurrencyDisplayCode(account.currency)}`
                                    ) : (
                                        <Localize i18n_default_text='No currency assigned' />
                                    )}
                                </Text>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

export default AccountSwitcher;
