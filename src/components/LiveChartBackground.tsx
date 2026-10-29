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

        // Initialize a comfortable number of wide candles (e.g., 45 total across screen)
        const totalCandles = 45;
        for (let i = 0; i < totalCandles; i++) {
            const variance = (Math.random() - 0.48) * 3.5;
            const open = basePrice;
            const close = open + variance;
            const high = Math.max(open, close) + Math.random() * 1.8;
            const low = Math.min(open, close) - Math.random() * 1.8;
            candles.push({ open, high, low, close });
            basePrice = close;
        }

        let lastStructuralTime = performance.now();
        const structuralInterval = 900; // ms between shifting new structural candles
        let offset = 0;

        const render = (currentTime: number) => {
            if (!canvas || !ctx) return;

            // 1. Smooth, clear horizontal scrolling speed
            offset += 0.8;

            // 2. Add structural candles smoothly over time
            if (currentTime - lastStructuralTime > structuralInterval) {
                lastStructuralTime = currentTime;
                const last = candles[candles.length - 1];
                const open = last ? last.close : 100.0;
                const close = open + (Math.random() - 0.48) * 4.0;
                const high = Math.max(open, close) + Math.random() * 2.0;
                const low = Math.min(open, close) - Math.random() * 2.0;

                candles.push({ open, high, low, close });
                if (candles.length > 60) candles.shift();
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Calculate a wide, substantial candle width so they look like real chart candles
            const candleWidth = Math.round(canvas.width / 38);

            // Seamless loop reset when offset completes one full candle width
            if (offset >= candleWidth) {
                offset -= candleWidth;
            }

            const prices = candles.flatMap(c => [c.high, c.low]);
            const minY = Math.min(...prices);
            const maxY = Math.max(...prices);
            const range = maxY - minY || 1;

            candles.forEach((c, index) => {
                const x = Math.round((index * candleWidth) - offset);

                // Skip off-screen rendering
                if (x < -candleWidth * 2 || x > canvas.width + candleWidth * 2) return;

                const isGreen = c.close >= c.open;
                
                // Crisp institutional colors with clean opacity
                ctx.strokeStyle = isGreen ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)';
                ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                ctx.lineWidth = 2;

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

                // Draw Body (with generous spacing so they never touch or look thin)
                const bodyY = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(Math.abs(yOpen - yClose), 4);
                ctx.fillRect(x + 4, bodyY, candleWidth - 8, bodyHeight);
                ctx.strokeRect(x + 4, bodyY, candleWidth - 8, bodyHeight);
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
