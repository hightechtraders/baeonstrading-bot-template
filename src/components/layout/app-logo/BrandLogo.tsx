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
        <div className="flex items-center overflow-visible h-10">
            <img
                src="/logog-removebg-preview.png"
                alt="TraderScore.pro Logo"
                className={`h-10 w-auto object-contain ${className}`}
            />
        </div>
    );
};
