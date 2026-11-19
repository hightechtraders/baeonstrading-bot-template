import { useDevice } from '@deriv-com/ui';

type TBrandLogoProps = {
    width?: number;
    height?: number;
    fill?: string;
    className?: string;
};

export const BrandLogo = ({
    className = ''
}: TBrandLogoProps) => {
    const { isDesktop } = useDevice();

    return (
        <div className={`flex items-center overflow-visible ${className}`}>
            <img
                src="/logog-removebg-preview.png"
                alt="TraderScore.pro Logo"
                style={
                    isDesktop
                        ? { height: '36px', width: 'auto', objectFit: 'contain', transform: 'scale(2.2)', transformOrigin: 'left center' }
                        : { height: '26px', width: 'auto', objectFit: 'contain', transform: 'scale(1.15)', transformOrigin: 'left center' }
                }
            />
        </div>
    );
};
