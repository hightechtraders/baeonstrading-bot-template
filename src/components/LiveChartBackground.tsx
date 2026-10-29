// ==========================================
// FILE: src/components/LiveChartBackground.tsx
// ==========================================
import { useEffect, useRef } from 'react';
import './LiveChartBackground.scss';

export const LiveChartBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const updateSize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        updateSize();
        window.addEventListener('resize', updateSize);

        let candles: { open: number; high: number; low: number; close: number }[] = [];
        let basePrice = 100.0;

        // Initialize enough candles to fill wide viewports comfortably
        for (let i = 0; i < 100; i++) {
            const variance = (Math.random() - 0.49) * 2.0;
            const open = basePrice;
            const close = open + variance;
            const high = Math.max(open, close) + Math.random() * 0.9;
            const low = Math.min(open, close) - Math.random() * 0.9;
            candles.push({ open, high, low, close });
            basePrice = close;
        }

        let lastStructuralTime = performance.now();
        const structuralInterval = 700; // ms between adding new structural candles
        let offset = 0;

        const render = (currentTime: number) => {
            if (!canvas || !ctx) return;

            // 1. Perfectly smooth sub-pixel continuous horizontal drift
            offset += 0.5;

            // 2. Add structural candles seamlessly over time
            if (currentTime - lastStructuralTime > structuralInterval) {
                lastStructuralTime = currentTime;
                const last = candles[candles.length - 1];
                const open = last ? last.close : 100.0;
                const close = open + (Math.random() - 0.49) * 2.2;
                const high = Math.max(open, close) + Math.random() * 0.8;
                const low = Math.min(open, close) - Math.random() * 0.8;

                candles.push({ open, high, low, close });
                if (candles.length > 130) candles.shift();
            }

            // 3. Gentle micro-fluctuation on the current live candle
            if (candles.length > 0) {
                const current = candles[candles.length - 1];
                current.close += (Math.random() - 0.5) * 0.12;
                current.high = Math.max(current.high, current.close);
                current.low = Math.min(current.low, current.close);
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Force candle width to an even, clean number to eliminate sub-pixel grid shimmering
            const candleWidth = Math.round(Math.max(canvas.width / 90, 12));

            // Seamless loop reset when offset completes one full candle width
            if (offset >= candleWidth) {
                offset -= candleWidth;
            }

            const prices = candles.flatMap(c => [c.high, c.low]);
            const minY = Math.min(...prices);
            const maxY = Math.max(...prices);
            const range = maxY - minY || 1;

            candles.forEach((c, index) => {
                // Round the final X coordinate to the nearest integer to completely eliminate jitter
                const x = Math.round((index * candleWidth) - offset);

                // Skip off-screen rendering for pristine performance
                if (x < -candleWidth * 2 || x > canvas.width + candleWidth * 2) return;

                const isGreen = c.close >= c.open;
                
                ctx.strokeStyle = isGreen ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)';
                ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
                ctx.lineWidth = 1.5;

                const normalizeY = (val: number) => 
                    canvas.height - ((val - minY) / range) * (canvas.height * 0.5) - (canvas.height * 0.25);

                const yHigh = Math.round(normalizeY(c.high));
                const yLow = Math.round(normalizeY(c.low));
                const yOpen = Math.round(normalizeY(c.open));
                const yClose = Math.round(normalizeY(c.close));

                // Draw Wick
                ctx.beginPath();
                ctx.moveTo(x + Math.floor(candleWidth / 2), yHigh);
                ctx.lineTo(x + Math.floor(candleWidth / 2), yLow);
                ctx.stroke();

                // Draw Body
                const bodyY = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(Math.abs(yOpen - yClose), 2);
                ctx.fillRect(x + 2, bodyY, candleWidth - 4, bodyHeight);
                ctx.strokeRect(x + 2, bodyY, candleWidth - 4, bodyHeight);
            });

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
            window.removeEventListener('resize', updateSize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={canvasRef} className="live-chart-background" />;
};
