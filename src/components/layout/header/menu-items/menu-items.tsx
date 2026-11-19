import { observer } from 'mobx-react-lite';

export const MenuItems = observer(() => null);

export const TradershubLink = observer(() => null);

type MenuItemsType = typeof MenuItems & {
    TradershubLink: typeof TradershubLink;
};
(MenuItems as MenuItemsType).TradershubLink = TradershubLink;

export default MenuItems as MenuItemsType;
