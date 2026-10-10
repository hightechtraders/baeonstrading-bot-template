import React, { useState } from 'react';
import { TradingPreloader } from '@/components/trading-preloader/TradingPreloader';

export default function ChunkLoader({ message }: { message?: string }) {
    const [isFinished, setIsFinished] = useState(false);

    if (isFinished) return null;

    return (
        <TradingPreloader 
            appName="TraderScore" 
            subtitle="TraderScore Trading Workspace" 
            minLoadingTime={6000} 
            onComplete={() => {
                // Add a small 600ms delay to let the fade-out fully complete 
                // before removing the component from the DOM entirely
                setTimeout(() => {
                    setIsFinished(true);
                }, 600);
            }}
        />
    );
}
