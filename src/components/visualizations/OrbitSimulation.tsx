import React, { useRef, useEffect, useState, type FC } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

const OrbitSimulation: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [velocity, setVelocity] = useState<number[]>([50]);
  const [moonAngle, setMoonAngle] = useState<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const earthRadius = 30;
    const orbitRadius = 100;

    let angle = moonAngle;
    const moonRadius = 12;

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw stars
      ctx.fillStyle = "white";
      for (let i = 0; i < 50; i++) {
        const x = (i * 97) % canvas.width;
        const y = (i * 53) % canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 0.5 + Math.random() * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw orbit path
      ctx.beginPath();
      ctx.arc(centerX, centerY, orbitRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Earth
      const earthGradient = ctx.createRadialGradient(
        centerX - 10,
        centerY - 10,
        0,
        centerX,
        centerY,
        earthRadius,
      );
      earthGradient.addColorStop(0, "#60a5fa");
      earthGradient.addColorStop(0.5, "#3b82f6");
      earthGradient.addColorStop(1, "#1e40af");

      ctx.beginPath();
      ctx.arc(centerX, centerY, earthRadius, 0, Math.PI * 2);
      ctx.fillStyle = earthGradient;
      ctx.fill();

      // Draw Earth glow
      ctx.beginPath();
      ctx.arc(centerX, centerY, earthRadius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(96, 165, 250, 0.3)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.lineWidth = 1;

      // Calculate moon position
      const velocityFactor = velocity[0] / 100;
      const actualOrbitRadius = orbitRadius * (0.5 + velocityFactor * 0.5);
      const moonX = centerX + Math.cos(angle) * actualOrbitRadius;
      const moonY = centerY + Math.sin(angle) * actualOrbitRadius;

      // Draw velocity vector
      const vectorLength = velocityFactor * 40;
      const tangentX = -Math.sin(angle);
      const tangentY = Math.cos(angle);

      ctx.beginPath();
      ctx.moveTo(moonX, moonY);
      ctx.lineTo(
        moonX + tangentX * vectorLength,
        moonY + tangentY * vectorLength,
      );
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Arrow head
      const arrowSize = 6;
      const arrowAngle = Math.atan2(tangentY, tangentX);
      ctx.beginPath();
      ctx.moveTo(
        moonX + tangentX * vectorLength,
        moonY + tangentY * vectorLength,
      );
      ctx.lineTo(
        moonX +
          tangentX * vectorLength -
          arrowSize * Math.cos(arrowAngle - Math.PI / 6),
        moonY +
          tangentY * vectorLength -
          arrowSize * Math.sin(arrowAngle - Math.PI / 6),
      );
      ctx.lineTo(
        moonX +
          tangentX * vectorLength -
          arrowSize * Math.cos(arrowAngle + Math.PI / 6),
        moonY +
          tangentY * vectorLength -
          arrowSize * Math.sin(arrowAngle + Math.PI / 6),
      );
      ctx.closePath();
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
      ctx.lineWidth = 1;

      // Draw Moon
      const moonGradient = ctx.createRadialGradient(
        moonX - 3,
        moonY - 3,
        0,
        moonX,
        moonY,
        moonRadius,
      );
      moonGradient.addColorStop(0, "#e5e7eb");
      moonGradient.addColorStop(1, "#9ca3af");

      ctx.beginPath();
      ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
      ctx.fillStyle = moonGradient;
      ctx.fill();

      // Update angle if playing
      if (isPlaying) {
        const speed = 0.02 * velocityFactor;
        angle += speed;
        setMoonAngle(angle);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, velocity, moonAngle]);

  const handleReset = () => {
    setMoonAngle(0);
    setVelocity([50]);
  };

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden">
      <canvas ref={canvasRef} width={320} height={240} className="w-full" />

      <div className="p-4 space-y-4 bg-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Velocity</span>
          <span className="text-sm font-medium text-amber-400">
            {velocity[0]}%
          </span>
        </div>

        <Slider
          value={velocity}
          onValueChange={setVelocity}
          min={10}
          max={100}
          step={5}
          className="[&_[role=slider]]:bg-amber-500"
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex-1 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 mr-1" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" /> Play
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrbitSimulation;
