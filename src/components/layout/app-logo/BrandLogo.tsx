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
        <div className={`flex items-center overflow-hidden ${className}`}>
            <img
                src="/logog-removebg-preview.png"
                alt="TraderScore.pro Logo"
                className="h-2 w-auto object-contain max-h-2"
            />
        </div>
    );
};
