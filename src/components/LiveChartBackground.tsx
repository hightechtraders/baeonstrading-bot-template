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

        // Force explicit full-screen sizing on mount and resize
        const updateSize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        updateSize();
        window.addEventListener('resize', updateSize);

        let candles: { open: number; high: number; low: number; close: number }[] = [];
        let basePrice = 100.0;

        // Initialize smooth background ambient candles
        for (let i = 0; i < 75; i++) {
            const variance = (Math.random() - 0.49) * 2.5;
            const open = basePrice;
            const close = open + variance;
            const high = Math.max(open, close) + Math.random() * 1.5;
            const low = Math.min(open, close) - Math.random() * 1.5;
            candles.push({ open, high, low, close });
            basePrice = close;
        }

        const pushSimulatedTick = () => {
            const last = candles[candles.length - 1];
            const open = last ? last.close : 100.0;
            const close = open + (Math.random() - 0.49) * 3.0;
            const high = Math.max(open, close) + Math.random() * 1.5;
            const low = Math.min(open, close) - Math.random() * 1.5;

            candles.push({ open, high, low, close });
            if (candles.length > 95) candles.shift();
        };

        // Smooth simulation tick interval
        simulationInterval = setInterval(pushSimulatedTick, 800);

        let offset = 0;
        const render = () => {
            if (!canvas || !ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const candleWidth = Math.max(canvas.width / 80, 10);
            offset += 0.18; // Smooth horizontal drift speed

            const prices = candles.flatMap(c => [c.high, c.low]);
            const minY = Math.min(...prices);
            const maxY = Math.max(...prices);
            const range = maxY - minY || 1;

            candles.forEach((c, index) => {
                const x = index * candleWidth - (offset % candleWidth);
                const isGreen = c.close >= c.open;
                
                // Professional institutional styling with visible contrast
                ctx.strokeStyle = isGreen ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
                ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)';
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
            window.removeEventListener('resize', updateSize);
            cancelAnimationFrame(animationFrameId);
            if (simulationInterval) clearInterval(simulationInterval);
        };
    }, []);

    return (
        <canvas 
            ref={canvasRef} 
            className="live-chart-background"
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 1 }}
        />
    );
};
