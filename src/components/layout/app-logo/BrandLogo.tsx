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
            src="/baronslogos.jpg"
            alt="TraderScore.pro Logo"
            width={width}
            height={height}
            className={className}
            style={{ objectFit: 'contain' }}
        />
    );
};
