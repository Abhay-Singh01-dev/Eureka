// ============================================================
// WavePropagationAnimator — Travelling / standing wave renderer
// Manim-style wave visualization with interference patterns
// ============================================================

import React, { useRef, useEffect, useCallback, type FC } from "react";
import type { AnimationRendererProps } from "@/types/animation";
import {
  computeTransform,
  computeCameraState,
  computeElementStates,
  worldToScreen,
  drawManimBackground,
  safeEval,
} from "../ManimEngine";

const WavePropagationAnimator: FC<AnimationRendererProps> = ({
  scene,
  renderState,
  width,
  height,
  onTimeUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const camera = computeCameraState(
      renderState.instructions,
      renderState.current_time,
      renderState.camera,
    );
    const tf = computeTransform(camera, width, height);
    drawManimBackground(ctx, width, height, tf, true);

    const animStates = computeElementStates(
      renderState.elements,
      renderState.instructions,
      renderState.current_time,
    );

    const t = renderState.current_time;

    for (const el of renderState.elements) {
      const anim = animStates.get(el.id);
      if (!anim || anim.opacity <= 0) continue;

      if (el.type === "wave") {
        const amplitude = el.props?.amplitude ?? 1;
        const wavelength = el.props?.wavelength ?? 2;
        const frequency = el.props?.frequency ?? 1;
        const xRange = el.props?.x_range ?? [-6, 6];
        const phase = el.props?.phase ?? 0;
        const damping = el.props?.damping ?? 0;
        const waveType = el.props?.wave_type ?? "travelling"; // travelling | standing
        const samples = el.props?.samples ?? 300;

        const k = (2 * Math.PI) / wavelength;
        const omega = 2 * Math.PI * frequency;
        const waveProgress = anim.draw_progress;

        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.strokeStyle = el.stroke?.hex ?? "#58C4DD";
        ctx.lineWidth = el.stroke_width ?? 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        const drawSamples = Math.ceil(samples * waveProgress);
        let firstPoint = true;

        for (let i = 0; i <= drawSamples; i++) {
          const x = xRange[0] + (i / samples) * (xRange[1] - xRange[0]);
          let y: number;

          if (waveType === "standing") {
            y = amplitude * Math.sin(k * x + phase) * Math.cos(omega * t);
          } else {
            y = amplitude * Math.sin(k * x - omega * t + phase);
          }

          // Apply damping
          if (damping > 0) {
            y *= Math.exp(-damping * Math.abs(x));
          }

          const [sx, sy] = worldToScreen(
            x + el.position[0],
            y + el.position[1],
            tf,
          );

          if (firstPoint) {
            ctx.moveTo(sx, sy);
            firstPoint = false;
          } else {
            ctx.lineTo(sx, sy);
          }
        }
        ctx.stroke();

        // Draw envelope for standing waves
        if (waveType === "standing" && waveProgress > 0.5) {
          ctx.globalAlpha = anim.opacity * 0.2;
          ctx.setLineDash([4, 4]);

          // Upper envelope
          ctx.beginPath();
          firstPoint = true;
          for (let i = 0; i <= samples; i++) {
            const x = xRange[0] + (i / samples) * (xRange[1] - xRange[0]);
            const y = amplitude * Math.abs(Math.sin(k * x + phase));
            const [sx, sy] = worldToScreen(
              x + el.position[0],
              y + el.position[1],
              tf,
            );
            if (firstPoint) {
              ctx.moveTo(sx, sy);
              firstPoint = false;
            } else ctx.lineTo(sx, sy);
          }
          ctx.stroke();

          // Lower envelope
          ctx.beginPath();
          firstPoint = true;
          for (let i = 0; i <= samples; i++) {
            const x = xRange[0] + (i / samples) * (xRange[1] - xRange[0]);
            const y = -amplitude * Math.abs(Math.sin(k * x + phase));
            const [sx, sy] = worldToScreen(
              x + el.position[0],
              y + el.position[1],
              tf,
            );
            if (firstPoint) {
              ctx.moveTo(sx, sy);
              firstPoint = false;
            } else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.restore();
      }

      // Axes
      if (el.type === "axes") {
        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.strokeStyle = el.stroke?.hex ?? "#ECECEC";
        ctx.lineWidth = 1.5;
        const xr = el.props?.x_range ?? [-6, 6];
        const yr = el.props?.y_range ?? [-3, 3];

        const [lx, ly] = worldToScreen(xr[0], 0, tf);
        const [rx, ry] = worldToScreen(xr[1], 0, tf);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(rx, ry);
        ctx.stroke();

        const [ox, oy] = worldToScreen(0, yr[0], tf);
        const [, ty] = worldToScreen(0, yr[1], tf);
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox, ty);
        ctx.stroke();

        ctx.restore();
      }

      // Text
      if (el.type === "text") {
        const [sx, sy] = worldToScreen(
          el.position[0] + anim.offset[0],
          el.position[1] + anim.offset[1],
          tf,
        );
        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.fillStyle = el.stroke?.hex ?? "#ECECEC";
        const fontSize = (el.props?.font_size ?? 14) * (el.scale ?? 1);
        ctx.font = `${fontSize}px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.props?.content ?? "", sx, sy);
        ctx.restore();
      }

      // LaTeX
      if (el.type === "latex") {
        const [sx, sy] = worldToScreen(
          el.position[0] + anim.offset[0],
          el.position[1] + anim.offset[1],
          tf,
        );
        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.fillStyle = el.stroke?.hex ?? "#58C4DD";
        const fontSize = (el.props?.font_size ?? 18) * (el.scale ?? 1);
        ctx.font = `italic ${fontSize}px "Times New Roman", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.props?.expression ?? "", sx, sy);
        ctx.restore();
      }

      // Dots (nodes, antinodes)
      if (el.type === "dot") {
        const [sx, sy] = worldToScreen(
          el.position[0] + anim.offset[0],
          el.position[1] + anim.offset[1],
          tf,
        );
        const r = (el.props?.radius ?? 0.08) * Math.abs(tf.scaleX);
        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.fillStyle = el.stroke?.hex ?? "#FFFF00";
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [renderState, width, height]);

  // Animation loop
  useEffect(() => {
    if (!renderState.is_playing) {
      draw();
      return;
    }

    startTimeRef.current = performance.now() - renderState.current_time * 1000;

    const loop = () => {
      if (!startTimeRef.current) return;
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      const capped = Math.min(elapsed, renderState.total_duration);
      onTimeUpdate?.(capped);
      draw();
      if (capped < renderState.total_duration) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderState.is_playing, renderState.total_duration, draw, onTimeUpdate]);

  useEffect(() => {
    if (!renderState.is_playing) draw();
  }, [renderState.current_time, draw, renderState.is_playing]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height }}
      className="rounded-lg"
    />
  );
};

export default WavePropagationAnimator;
