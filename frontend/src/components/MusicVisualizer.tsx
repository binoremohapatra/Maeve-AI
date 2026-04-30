import { useEffect, useRef } from 'react';
import { useMoodStore } from '../stores/moodStore';

export const MusicVisualizer = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { isPlaying } = useMoodStore();

    useEffect(() => {
        if (!isPlaying || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // "MusicAnalyzer" se data lene ka logic (Assuming global access or Store)
        // Note: Tujhe MusicAnalyzer ko globally accessible banana padega
        const analyzer = (window as any).musicAnalyzer;

        const renderFrame = () => {
            if (!analyzer) return;

            const dataArray = analyzer.getFrequencyData(); // Ye method neeche banayenge

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const barWidth = (canvas.width / dataArray.length) * 2.5;
            let x = 0;

            for (let i = 0; i < dataArray.length; i++) {
                const barHeight = dataArray[i] / 2; // Height adjust

                // Neon Green & Blue Gradient
                const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, '#00ffcc');
                gradient.addColorStop(1, '#0033ff');

                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
            requestAnimationFrame(renderFrame);
        };

        renderFrame();
    }, [isPlaying]);

    if (!isPlaying) return null;

    return (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 w-64 h-24 bg-black/50 rounded-lg border border-cyan-500 backdrop-blur-md p-2">
            <canvas ref={canvasRef} width={240} height={80} />
            <p className="text-center text-xs text-cyan-400 font-mono mt-1">NEURAL LINK ACTIVE</p>
        </div>
    );
};
