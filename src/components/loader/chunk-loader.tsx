import React from 'react';
import { TradingPreloader } from '@/components/trading-preloader/TradingPreloader';

export default function ChunkLoader({ message }: { message?: string }) {
    return (
        <TradingPreloader 
            appName="TraderScore" 
            subtitle="TraderScore Trading Workspace" 
            minLoadingTime={2000} 
        />
    );
}
