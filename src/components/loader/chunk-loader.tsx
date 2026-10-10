import React from 'react';
import { TradingPreloader } from '@/components/trading-preloader/TradingPreloader';

export default function ChunkLoader({ message, onLoaded }: { message?: string; onLoaded?: () => void }) {
    return (
        <TradingPreloader 
            appName="TraderScore" 
            subtitle="TraderScore Neural Trading Workspace" 
            minLoadingTime={6000} 
            onComplete={onLoaded}
        />
    );
}
