// ========================================
// MENU ITEMS PLACEHOLDER FOR WHITE-LABELING
// ========================================

import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';

export const MenuItems = observer(() => {
    // Automatically highlights the active tab with brand color & underline
    useEffect(() => {
        const updateActiveTab = () => {
            const tabs = document.querySelectorAll('.dc-tabs__item, .cq-tabs__item, [role="tab"], .derivs-secondary-tabs > div, .derivs-secondary-tabs a');
            tabs.forEach(tab => {
                const isActive = tab.classList.contains('dc-tabs__item--active') || 
                                 tab.classList.contains('is-active') || 
                                 tab.getAttribute('aria-selected') === 'true' ||
                                 tab.classList.contains('active');
                
                if (isActive) {
                    (tab as HTMLElement).style.setProperty('color', '#ff444f', 'important');
                    (tab as HTMLElement).style.setProperty('font-weight', '700', 'important');
                    if (!tab.querySelector('.active-indicator')) {
                        const indicator = document.createElement('div');
                        indicator.className = 'active-indicator';
                        indicator.style.cssText = 'position:absolute; bottom:-1px; left:0; right:0; height:3px; background-color:#ff444f; border-radius:3px 3px 0 0;';
                        if (getComputedStyle(tab).position === 'static') {
                            (tab as HTMLElement).style.position = 'relative';
                        }
                        tab.appendChild(indicator);
                    }
                } else {
                    const indicator = tab.querySelector('.active-indicator');
                    if (indicator) indicator.remove();
                }
            });
        };

        updateActiveTab();
        const observer = new MutationObserver(updateActiveTab);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });

        return () => observer.disconnect();
    }, []);

    return null;
});

export const TradershubLink = observer(() => {
    return null;
});

type MenuItemsType = typeof MenuItems & {
    TradershubLink: typeof TradershubLink;
};

(MenuItems as MenuItemsType).TradershubLink = TradershubLink;

export default MenuItems as MenuItemsType;
