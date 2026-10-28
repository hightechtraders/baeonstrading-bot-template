export const BrandLogo = ({
    className = ''
}: TBrandLogoProps) => {
    return (
        <div className={`flex items-center overflow-hidden ${className}`}>
            <img
                src="/logog-removebg-preview.png"
                alt="TraderScore.pro Logo"
                style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
            />
        </div>
    );
};
