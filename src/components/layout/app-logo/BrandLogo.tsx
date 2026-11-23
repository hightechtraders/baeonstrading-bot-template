import { useDevice } from '@deriv-com/ui';

type TBrandLogoProps = {
    width?: number;
    height?: number;
    fill?: string;
    className?: string;
    showPulse?: boolean;
};

export const BrandLogo = ({
    width,
    height,
    fill = '#00a86b',
    className = '',
    showPulse = false,
}: TBrandLogoProps) => {
    const { isDesktop } = useDevice();

    const resolvedHeight = height ?? (isDesktop ? 36 : 28);
    const resolvedWidth = width ?? resolvedHeight;

    return (
        <span
            className={`relative inline-flex shrink-0 items-center justify-center rounded-xl border border-[#00a86b]/40 bg-[#00a86b]/15 shadow-[0_0_14px_rgba(0,168,107,0.22)] ${className}`}
            style={{ width: resolvedWidth, height: resolvedHeight, color: fill }}
        >
            {showPulse && (
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-xl border border-[#00a86b]/60 animate-ping"
                    style={{ animationDuration: '2s' }}
                />
            )}

            <svg
                viewBox="0 0 24 24"
                width="62%"
                height="62%"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="TraderScore.pro Logo"
            >
                <path
                    d="M12 2L2 7L12 12L22 7L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M2 17L12 22L22 17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M2 12L12 17L22 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </span>
    );
};
