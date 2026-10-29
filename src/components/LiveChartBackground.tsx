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

        // Pre-generate a robust pool of persistent candles
        let candles: { open: number; high: number; low: number; close: number }[] = [];
        let basePrice = 100.0;
        const totalPool = 120;

        for (let i = 0; i < totalPool; i++) {
            // Increased price variance so wicks and swings are much more dynamic (preventing straight lines)
            const variance = (Math.random() - 0.47) * 14.0;
            const open = basePrice;
            const close = open + variance;
            const high = Math.max(open, close) + Math.random() * 7.0;
            const low = Math.min(open, close) - Math.random() * 7.0;
            candles.push({ open, high, low, close });
            basePrice = close;
        }

        // Tighter vertical bounds so the candles fill up the vertical viewport nicely
        const allPrices = candles.flatMap(c => [c.high, c.low]);
        const fixedMinY = Math.min(...allPrices) - 4;
        const fixedMaxY = Math.max(...allPrices) + 4;
        const range = fixedMaxY - fixedMinY || 1;

        let totalOffset = 0;

        const render = () => {
            if (!canvas || !ctx) return;

            // Butter-smooth continuous horizontal sub-pixel slide
            totalOffset += 0.6;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Slightly wider candle width for a bold, prominent look
            const candleWidth = Math.round(canvas.width / 30);

            const startIndex = Math.floor(totalOffset / candleWidth);
            const localOffset = totalOffset % canvas.width; // Keeps coordinate math robust

            for (let i = 0; i < 45; i++) {
                const poolIndex = (startIndex + i) % candles.length;
                const c = candles[poolIndex];

                const x = Math.round((i * candleWidth) - (totalOffset % canvas.width));

                if (x < -candleWidth * 2 || x > canvas.width + candleWidth * 2) continue;

                const isGreen = c.close >= c.open;
                
                // Dimmed, elegant watermark-style opacities so it sits quietly in the background
                ctx.strokeStyle = isGreen ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.22)';
                ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';
                ctx.lineWidth = 2;

                // Center the chart nicely across the vertical middle of the screen
                const normalizeY = (val: number) => 
                    canvas.height * 0.8 - ((val - fixedMinY) / range) * (canvas.height * 0.6);

                const yHigh = Math.round(normalizeY(c.high));
                const yLow = Math.round(normalizeY(c.low));
                const yOpen = Math.round(normalizeY(c.open));
                const yClose = Math.round(normalizeY(c.close));

                // Draw Wick
                ctx.beginPath();
                ctx.moveTo(x + Math.floor(candleWidth / 2), yHigh);
                ctx.lineTo(x + Math.floor(candleWidth / 2), yLow);
                ctx.stroke();

                // Draw Bold Candle Body (increased minimum height and adjusted padding for the wider columns)
                const bodyY = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(Math.abs(yOpen - yClose), 16);
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
