type TBrandLogoProps = {
    width?: number;
    height?: number;
    fill?: string;
    className?: string;
};

export const BrandLogo = ({
    width = 120,
    height = 32,
    className = ''
}: TBrandLogoProps) => {
    return (
        <img
            src="/logog-removebg-preview.png"
            alt="TraderScore.pro Logo"
            width={width}
            height={height}
            className={className}
            style={{ objectFit: 'contain' }}
        />
    );
};
