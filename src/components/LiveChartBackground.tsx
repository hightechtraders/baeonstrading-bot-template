// ==========================================
// FILE: src/components/LiveChartBackground.tsx
// ==========================================
import { useEffect, useRef } from 'react';
import { api_base } from '@/external/bot-skeleton';
import './LiveChartBackground.scss';

export const LiveChartBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            console.error('LiveChartBackground: Canvas ref is null');
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('LiveChartBackground: 2D context not available');
            return;
        }

        let animationFrameId: number;
        let subscription: { unsubscribe: () => void } | null = null;
        let simulationInterval: NodeJS.Timeout | null = null;
        let isReceivingLiveTicks = false;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        let candles: { open: number; high: number; low: number; close: number }[] = [];
        let basePrice = 100.0; // Scaled base price for stable rendering

        // Initialize smooth background ambient candles
        for (let i = 0; i < 60; i++) {
            const variance = (Math.random() - 0.5) * 2;
            const open = basePrice;
            const close = open + variance;
            const high = Math.max(open, close) + Math.random();
            const low = Math.min(open, close) - Math.random();
            candles.push({ open, high, low, close });
            basePrice = close;
        }

        const pushTick = (price: number) => {
            const last = candles[candles.length - 1];
            const open = last ? last.close : price;
            const close = price;
            const high = Math.max(open, close) + 0.5;
            const low = Math.min(open, close) - 0.5;

            candles.push({ open, high, low, close });
            if (candles.length > 80) candles.shift();
        };

        // 1. Simulation fallback ticker
        simulationInterval = setInterval(() => {
            if (!isReceivingLiveTicks) {
                const lastClose = candles[candles.length - 1]?.close || 100.0;
                const nextPrice = lastClose + (Math.random() - 0.48) * 1.5;
                pushTick(nextPrice);
            }
        }, 1000);

        // 2. Live R_10 feed subscription
        const initLiveFeed = async () => {
            try {
                if (api_base.api) {
                    await api_base.api.subscribe({ ticks: 'R_10' });
                    subscription = api_base.api.onMessage().subscribe(({ data }: any) => {
                        if (data.msg_type === 'tick') {
                            isReceivingLiveTicks = true;
                            if (simulationInterval) clearInterval(simulationInterval);
                            pushTick(Number(data.tick.quote));
                        }
                    });
                }
            } catch (e) {
                console.warn('LiveChartBackground: WebSocket feed fallback active');
            }
        };

        initLiveFeed();

        let offset = 0;
        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const candleWidth = canvas.width / 70;
            offset += 0.12;

            const prices = candles.flatMap(c => [c.high, c.low]);
            const minY = Math.min(...prices);
            const maxY = Math.max(...prices);
            const range = maxY - minY || 1;

            candles.forEach((c, index) => {
                const x = index * candleWidth - (offset % candleWidth);
                const isGreen = c.close >= c.open;
                
                // Slightly increased opacity so it is clearly visible
                ctx.strokeStyle = isGreen ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
                ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
                ctx.lineWidth = 1.5;

                const normalizeY = (val: number) => 
                    canvas.height - ((val - minY) / range) * (canvas.height * 0.5) - (canvas.height * 0.25);

                const yHigh = normalizeY(c.high);
                const yLow = normalizeY(c.low);
                const yOpen = normalizeY(c.open);
                const yClose = normalizeY(c.close);

                // Draw Wick
                ctx.beginPath();
                ctx.moveTo(x + candleWidth / 2, yHigh);
                ctx.lineTo(x + candleWidth / 2, yLow);
                ctx.stroke();

                // Draw Body
                const bodyY = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(Math.abs(yOpen - yClose), 3);
                ctx.fillRect(x + 2, bodyY, candleWidth - 4, bodyHeight);
                ctx.strokeRect(x + 2, bodyY, candleWidth - 4, bodyHeight);
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
            if (simulationInterval) clearInterval(simulationInterval);
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    return <canvas ref={canvasRef} className="live-chart-background" />;
};
