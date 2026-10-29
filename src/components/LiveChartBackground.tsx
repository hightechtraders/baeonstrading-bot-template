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
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let subscription: { unsubscribe: () => void } | null = null;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        let candles: { open: number; high: number; low: number; close: number }[] = [];
        let basePrice = 1000;

        // Initialize smooth background ambient candles
        for (let i = 0; i < 60; i++) {
            const variance = (Math.random() - 0.5) * 4;
            const open = basePrice;
            const close = open + variance;
            const high = Math.max(open, close) + Math.random() * 2;
            const low = Math.min(open, close) - Math.random() * 2;
            candles.push({ open, high, low, close });
            basePrice = close;
        }

        // Plug live tick feed specifically to R_10
        const initLiveFeed = async () => {
            try {
                if (api_base.api) {
                    await api_base.api.subscribe({ ticks: 'R_10' });
                    subscription = api_base.api.onMessage().subscribe(({ data }: any) => {
                        if (data.msg_type === 'tick') {
                            const quote = data.tick.quote;
                            const last = candles[candles.length - 1];
                            const open = last ? last.close : quote;
                            const close = quote;
                            const high = Math.max(open, close) + 0.2;
                            const low = Math.min(open, close) - 0.2;

                            candles.push({ open, high, low, close });
                            if (candles.length > 80) candles.shift();
                        }
                    });
                }
            } catch (e) {
                // Graceful fallback if WebSocket is not initialized yet
            }
        };

        initLiveFeed();

        let offset = 0;
        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const candleWidth = canvas.width / 70;
            offset += 0.15; // Slow ambient pan effect

            candles.forEach((c, index) => {
                const x = index * candleWidth - (offset % candleWidth);
                const isGreen = c.close >= c.open;
                
                ctx.strokeStyle = isGreen ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
                ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)';
                ctx.lineWidth = 1;

                const minY = Math.min(...candles.map(item => item.low));
                const maxY = Math.max(...candles.map(item => item.high));
                const range = maxY - minY || 1;
                
                const normalizeY = (val: number) => 
                    canvas.height - ((val - minY) / range) * (canvas.height * 0.6) - (canvas.height * 0.2);

                const yHigh = normalizeY(c.high);
                const yLow = normalizeY(c.low);
                const yOpen = normalizeY(c.open);
                const yClose = normalizeY(c.close);

                ctx.beginPath();
                ctx.moveTo(x + candleWidth / 2, yHigh);
                ctx.lineTo(x + candleWidth / 2, yLow);
                ctx.stroke();

                const bodyY = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(Math.abs(yOpen - yClose), 2);
                ctx.fillRect(x + 2, bodyY, candleWidth - 4, bodyHeight);
                ctx.strokeRect(x + 2, bodyY, candleWidth - 4, bodyHeight);
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    return <canvas ref={canvasRef} className="live-chart-background" />;
};
