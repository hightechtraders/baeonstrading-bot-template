import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { useDevice } from '@deriv-com/ui';
import './mobile-menu.scss';

type TMobileMenuProps = {
    onLogout?: () => void;
};

const MobileMenu = observer(({ onLogout: _onLogout }: TMobileMenuProps) => {
    const { isDesktop } = useDevice();
    const { ui } = useStore() ?? {};

    const [isDark, setIsDark] = useState<boolean>(() => {
        if (typeof ui?.is_dark_mode_on === 'boolean') return ui.is_dark_mode_on;
        if (typeof document !== 'undefined') {
            return document.body.classList.contains('theme--dark');
        }
        return true;
    });

    useEffect(() => {
        if (typeof ui?.is_dark_mode_on === 'boolean') {
            setIsDark(ui.is_dark_mode_on);
        }
    }, [ui?.is_dark_mode_on]);

    const handleToggleTheme = () => {
        const nextDark = !isDark;
        setIsDark(nextDark);

        if (typeof ui?.setDarkMode === 'function') {
            ui.setDarkMode(nextDark);
        }

        if (typeof document !== 'undefined') {
            document.body.classList.toggle('theme--dark', nextDark);
            document.body.classList.toggle('theme--light', !nextDark);
        }

        try {
            localStorage.setItem('theme', nextDark ? 'dark' : 'light');
        } catch {
            // Ignore storage errors in restricted contexts
        }
    };

    // Remove this line if you also want the theme toggle visible on desktop beside the logo
    if (isDesktop) return null;

    return (
        <div className='mobile-menu'>
            <button
                type='button'
                className='mobile-menu__toggle'
                onClick={handleToggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    padding: 0,
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 168, 107, 0.35)',
                    background: isDark ? 'rgba(0, 168, 107, 0.14)' : 'rgba(15, 23, 42, 0.06)',
                    color: isDark ? '#00ff99' : '#00a86b',
                    cursor: 'pointer',
                }}
            >
                {isDark ? (
                    /* Sun icon when in Dark Mode (click for Light Mode) */
                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                        <circle cx='12' cy='12' r='4' />
                        <path d='M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41' />
                    </svg>
                ) : (
                    /* Moon icon when in Light Mode (click for Dark Mode) */
                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                        <path d='M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' />
                    </svg>
                )}
            </button>
        </div>
    );
});

export default MobileMenu;
