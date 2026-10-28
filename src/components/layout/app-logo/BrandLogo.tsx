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
        <div className="flex items-center overflow-visible">
            <img
                src="/logog-removebg-preview.png"
                alt="TraderScore.pro Logo"
                width={width}
                height={height}
                className={`${className} scale-150 origin-left`}
                style={{ objectFit: 'contain' }}
            />
        </div>
    );
};
