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
        <div className={`flex items-center overflow-visible brand-logo ${className}`}>
            <img
                src="/logog-removebg-preview.png"
                alt="TraderScore.pro Logo"
                className="brand-logo__img"
            />
        </div>
    );
};
