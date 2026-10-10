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
            onComplete={() => setIsFinished(true)}
        />
    );
}
