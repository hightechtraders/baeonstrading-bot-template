// ==========================================
// FILE: src/components/LiveChartBackground.scss / .tsx
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

        // Initialize smooth background candles
        for (let i = 0; i < 90; i++) {
            const variance = (Math.random() - 0.48) * 2.0;
            const open = basePrice;
            const close = open + variance;
            const high = Math.max(open, close) + Math.random() * 1.0;
            const low = Math.min(open, close) - Math.random() * 1.0;
            candles.push({ open, high, low, close });
            basePrice = close;
        }

        // Continuously morph the latest active candle smoothly instead of popping new ones
        let lastUpdateTime = performance.now();
        const updateInterval = 600; // ms per structural tick

        let offset = 0;
        const render = (currentTime: number) => {
            if (!canvas || !ctx) return;

            // 1. Smooth continuous sub-pixel panning speed (no stutter)
            offset += 0.4; 

            // 2. Continuous structural candle progression
            if (currentTime - lastUpdateTime > updateInterval) {
                lastUpdateTime = currentTime;
                const last = candles[candles.length - 1];
                const open = last ? last.close : 100.0;
                const close = open + (Math.random() - 0.48) * 2.5;
                const high = Math.max(open, close) + Math.random() * 0.8;
                const low = Math.min(open, close) - Math.random() * 0.8;

                candles.push({ open, high, low, close });
                if (candles.length > 120) candles.shift();
            }

            // Sub-pixel live breathing effect on the current forming candle
            if (candles.length > 0) {
                const currentCandle = candles[candles.length - 1];
                currentCandle.close += (Math.random() - 0.5) * 0.15;
                currentCandle.high = Math.max(currentCandle.high, currentCandle.close);
                currentCandle.low = Math.min(currentCandle.low, currentCandle.close);
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const candleWidth = Math.max(canvas.width / 95, 10);
            
            // Reset offset loop seamlessly when it crosses one candle width
            if (offset >= candleWidth) {
                offset -= candleWidth;
                // Shift array smoothly matching the seamless loop reset
                // (Handled implicitly by continuous index mapping)
            }

            const prices = candles.flatMap(c => [c.high, c.low]);
            const minY = Math.min(...prices);
            const maxY = Math.max(...prices);
            const range = maxY - minY || 1;

            candles.forEach((c, index) => {
                // Pin candles to smooth continuous horizontal offset coordinates
                const x = (index * candleWidth) - offset;
                
                // Skip rendering off-screen candles for maximum performance
                if (x < -candleWidth || x > canvas.width + candleWidth) return;

                const isGreen = c.close >= c.open;
                
                ctx.strokeStyle = isGreen ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)';
                ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
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

    return (
        <canvas 
            ref={canvasRef} 
            className="live-chart-background"
        />
    );
};
