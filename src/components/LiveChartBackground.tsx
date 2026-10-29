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

        // Pre-generate a robust pool of persistent candles to scroll through seamlessly
        let candles: { open: number; high: number; low: number; close: number }[] = [];
        let basePrice = 100.0;
        const totalPool = 120;

        for (let i = 0; i < totalPool; i++) {
            const variance = (Math.random() - 0.48) * 3.0;
            const open = basePrice;
            const close = open + variance;
            const high = Math.max(open, close) + Math.random() * 1.5;
            const low = Math.min(open, close) - Math.random() * 1.5;
            candles.push({ open, high, low, close });
            basePrice = close;
        }

        // Fixed price range ceiling/floor to completely prevent vertical stretching/jitter
        const allPrices = candles.flatMap(c => [c.high, c.low]);
        const fixedMinY = Math.min(...allPrices) - 10;
        const fixedMaxY = Math.max(...allPrices) + 10;
        const range = fixedMaxY - fixedMinY || 1;

        let totalOffset = 0;

        const render = () => {
            if (!canvas || !ctx) return;

            // Smooth continuous sub-pixel movement (no discrete snaps)
            totalOffset += 0.6;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const candleWidth = Math.round(canvas.width / 40);

            // When offset passes one full candle width, seamlessly wrap the pool index forward
            const startIndex = Math.floor(totalOffset / candleWidth);
            const localOffset = totalOffset % candleWidth;

            for (let i = 0; i < 50; i++) {
                const poolIndex = (startIndex + i) % candles.length;
                const c = candles[poolIndex];

                // Continuous floating-point X coordinate mapped cleanly
                const x = (i * candleWidth) - localOffset;

                if (x < -candleWidth * 2 || x > canvas.width + candleWidth * 2) continue;

                const isGreen = c.close >= c.open;
                
                ctx.strokeStyle = isGreen ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)';
                ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                ctx.lineWidth = 2;

                const normalizeY = (val: number) => 
                    canvas.height - ((val - fixedMinY) / range) * (canvas.height * 0.5) - (canvas.height * 0.25);

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
                const bodyHeight = Math.max(Math.abs(yOpen - yClose), 4);
                ctx.fillRect(x + 4, bodyY, candleWidth - 8, bodyHeight);
                ctx.strokeRect(x + 4, bodyY, candleWidth - 8, bodyHeight);
            }

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
