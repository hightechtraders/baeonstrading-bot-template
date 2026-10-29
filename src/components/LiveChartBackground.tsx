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
        let simulationInterval: NodeJS.Timeout | null = null;

        const resize = () => {
            canvas.width = window.innerWidth || document.documentElement.clientWidth;
            canvas.height = window.innerHeight || document.documentElement.clientHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        let candles: { open: number; high: number; low: number; close: number }[] = [];
        let basePrice = 100.0;

        // Initialize smooth background ambient candles
        for (let i = 0; i < 70; i++) {
            const variance = (Math.random() - 0.49) * 2.2;
            const open = basePrice;
            const close = open + variance;
            const high = Math.max(open, close) + Math.random() * 1.2;
            const low = Math.min(open, close) - Math.random() * 1.2;
            candles.push({ open, high, low, close });
            basePrice = close;
        }

        const pushSimulatedTick = () => {
            const last = candles[candles.length - 1];
            const open = last ? last.close : 100.0;
            // Introduce subtle trending movement with realistic market noise
            const close = open + (Math.random() - 0.49) * 2.5;
            const high = Math.max(open, close) + Math.random() * 1.2;
            const low = Math.min(open, close) - Math.random() * 1.2;

            candles.push({ open, high, low, close });
            if (candles.length > 90) candles.shift();
        };

        // Smooth simulation tick interval (updates every 900ms)
        simulationInterval = setInterval(() => {
            pushSimulatedTick();
        }, 900);

        let offset = 0;
        const render = () => {
            if (!canvas || !ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const candleWidth = Math.max(canvas.width / 75, 12);
            offset += 0.15; // Smooth horizontal drift speed

            const prices = candles.flatMap(c => [c.high, c.low]);
            const minY = Math.min(...prices);
            const maxY = Math.max(...prices);
            const range = maxY - minY || 1;

            candles.forEach((c, index) => {
                const x = index * candleWidth - (offset % candleWidth);
                const isGreen = c.close >= c.open;
                
                // Professional institutional dark-theme coloring with balanced opacity
                ctx.strokeStyle = isGreen ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
                ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
                ctx.lineWidth = 1.5;

                const normalizeY = (val: number) => 
                    canvas.height - ((val - minY) / range) * (canvas.height * 0.5) - (canvas.height * 0.25);

                const yHigh = normalizeY(c.high);
                const yLow = normalizeY(c.low);
                const yOpen = normalizeY(c.open);
                const yClose = normalizeY(c.close);

                // Draw Candle Wick
                ctx.beginPath();
                ctx.moveTo(x + candleWidth / 2, yHigh);
                ctx.lineTo(x + candleWidth / 2, yLow);
                ctx.stroke();

                // Draw Candle Body
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
        };
    }, []);

    return <canvas ref={canvasRef} className="live-chart-background" />;
};
