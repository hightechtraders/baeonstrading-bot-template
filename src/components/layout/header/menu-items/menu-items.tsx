import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';

export const MenuItems = observer(() => {
    useEffect(() => {
        const forceActiveTab = () => {
            const tabs = document.querySelectorAll('.dc-tabs__item, .cq-tabs__item, [role="tab"], .derivs-secondary-tabs > div, .derivs-secondary-tabs a');
            tabs.forEach(tab => {
                const el = tab as HTMLElement;
                const isActive = el.classList.contains('dc-tabs__item--active') || 
                                 el.classList.contains('is-active') || 
                                 el.getAttribute('aria-selected') === 'true' ||
                                 el.classList.contains('active');
                
                if (isActive) {
                    el.style.setProperty('color', '#ff444f', 'important');
                    el.style.setProperty('font-weight', '700', 'important');
                    if (!el.querySelector('.custom-active-line')) {
                        const line = document.createElement('div');
                        line.className = 'custom-active-line';
                        line.style.cssText = 'position:absolute; bottom:0; left:0; right:0; height:3px; background-color:#ff444f; border-radius:3px 3px 0 0; z-index:5;';
                        if (getComputedStyle(el).position === 'static') {
                            el.style.position = 'relative';
                        }
                        el.appendChild(line);
                    }
                } else {
                    const line = el.querySelector('.custom-active-line');
                    if (line) line.remove();
                }
            });
        };

        forceActiveTab();
        const observer = new MutationObserver(forceActiveTab);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
        return () => observer.disconnect();
    }, []);

    return null;
});

export const TradershubLink = observer(() => null);

type MenuItemsType = typeof MenuItems & {
    TradershubLink: typeof TradershubLink;
};
(MenuItems as MenuItemsType).TradershubLink = TradershubLink;

export default MenuItems as MenuItemsType;
