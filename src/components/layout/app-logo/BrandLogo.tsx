type TBrandLogoProps = {
    width?: number;
    height?: number;
    fill?: string;
    className?: string;
};

export const BrandLogo = ({
    className = ''
}: TBrandLogoProps) => {
    return (
        <div className={`flex items-center overflow-visible ${className}`}>
            <img
                src="/logog-removebg-preview.png"
                alt="TraderScore.pro Logo"
                style={{ height: '36px', width: 'auto', objectFit: 'contain', transform: 'scale(2.2)', transformOrigin: 'left center' }}
            />
        </div>
    );
};
