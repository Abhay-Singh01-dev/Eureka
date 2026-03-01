// ============================================================
// ParticleMotionAnimator — Moving particles with trails
// Manim-style particle systems: dots, trails, collisions
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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  trail: Array<[number, number]>;
}

const ParticleMotionAnimator: FC<AnimationRendererProps> = ({
  scene,
  renderState,
  width,
  height,
  onTimeUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const initRef = useRef(false);

  // Initialize particles from elements
  const initParticles = useCallback(() => {
    const particles: Particle[] = [];
    for (const el of renderState.elements) {
      if (el.type === "particle_system" || el.type === "dot") {
        const count = el.props?.particle_count ?? 1;
        const baseColor = el.stroke?.hex ?? "#58C4DD";
        const baseRadius = el.props?.radius ?? 0.08;

        for (let i = 0; i < count; i++) {
          particles.push({
            x:
              el.position[0] +
              (Math.random() - 0.5) * (el.props?.spread ?? 0.5),
            y:
              el.position[1] +
              (Math.random() - 0.5) * (el.props?.spread ?? 0.5),
            vx:
              (el.props?.velocity?.[0] ?? 0) +
              (Math.random() - 0.5) * (el.props?.velocity_spread ?? 0.2),
            vy:
              (el.props?.velocity?.[1] ?? 0) +
              (Math.random() - 0.5) * (el.props?.velocity_spread ?? 0.2),
            color: baseColor,
            radius: baseRadius * (0.5 + Math.random() * 0.5),
            trail: [],
          });
        }
      }
    }
    particlesRef.current = particles;
    initRef.current = true;
  }, [renderState.elements]);

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

    // Calculate overall progress for particle system
    let maxProgress = 0;
    for (const el of renderState.elements) {
      const anim = animStates.get(el.id);
      if (anim) maxProgress = Math.max(maxProgress, anim.draw_progress);
    }

    // Initialize particles if needed
    if (!initRef.current || particlesRef.current.length === 0) {
      initParticles();
    }

    // Update particles based on time
    const dt = 0.016; // ~60fps timestep
    const gravity =
      renderState.elements.find((e) => e.props?.gravity !== undefined)?.props
        ?.gravity ?? 0;
    const bounds = { x: [-7, 7], y: [-5, 5] };

    for (const p of particlesRef.current) {
      if (maxProgress <= 0) continue;

      // Apply velocity
      p.x += p.vx * dt * maxProgress;
      p.y += p.vy * dt * maxProgress;
      p.vy += gravity * dt * maxProgress;

      // Bounce off bounds
      if (p.x < bounds.x[0] || p.x > bounds.x[1]) {
        p.vx *= -0.8;
        p.x = Math.max(bounds.x[0], Math.min(bounds.x[1], p.x));
      }
      if (p.y < bounds.y[0] || p.y > bounds.y[1]) {
        p.vy *= -0.8;
        p.y = Math.max(bounds.y[0], Math.min(bounds.y[1], p.y));
      }

      // Trail
      p.trail.push([p.x, p.y]);
      if (p.trail.length > 40) p.trail.shift();
    }

    // Draw trails
    for (const p of particlesRef.current) {
      if (p.trail.length < 2) continue;
      ctx.save();
      for (let i = 1; i < p.trail.length; i++) {
        const alpha = (i / p.trail.length) * 0.4 * maxProgress;
        const [sx, sy] = worldToScreen(p.trail[i][0], p.trail[i][1], tf);
        const [sx0, sy0] = worldToScreen(
          p.trail[i - 1][0],
          p.trail[i - 1][1],
          tf,
        );
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx0, sy0);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw particles
    for (const p of particlesRef.current) {
      const [sx, sy] = worldToScreen(p.x, p.y, tf);
      const r = p.radius * Math.abs(tf.scaleX);

      ctx.save();
      ctx.globalAlpha = maxProgress;

      // Glow
      const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3);
      grd.addColorStop(0, p.color + "40");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 3, 0, Math.PI * 2);
      ctx.fill();

      // Solid dot
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Draw non-particle elements (text, axes, etc.)
    for (const el of renderState.elements) {
      const anim = animStates.get(el.id);
      if (!anim || anim.opacity <= 0) continue;
      if (el.type === "particle_system" || el.type === "dot") continue;

      const [sx, sy] = worldToScreen(
        el.position[0] + anim.offset[0],
        el.position[1] + anim.offset[1],
        tf,
      );

      if (el.type === "text") {
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

      if (el.type === "axes") {
        // Simple axes
        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.strokeStyle = el.stroke?.hex ?? "#ECECEC";
        ctx.lineWidth = 1.5;
        const unitPx = Math.abs(tf.scaleX);
        const xr = el.props?.x_range ?? [-5, 5];
        const yr = el.props?.y_range ?? [-5, 5];
        const [ox, oy] = worldToScreen(0, 0, tf);
        const [lx] = worldToScreen(xr[0], 0, tf);
        const [rx] = worldToScreen(xr[1], 0, tf);
        const [, ty] = worldToScreen(0, yr[1], tf);
        const [, by] = worldToScreen(0, yr[0], tf);
        ctx.beginPath();
        ctx.moveTo(lx, oy);
        ctx.lineTo(rx, oy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ox, by);
        ctx.lineTo(ox, ty);
        ctx.stroke();
        ctx.restore();
      }
    }
  }, [renderState, width, height, initParticles]);

  // Reset particles when scene changes
  useEffect(() => {
    initRef.current = false;
  }, [renderState.elements]);

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

export default ParticleMotionAnimator;
