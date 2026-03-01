// ============================================================
// GraphAnimator — 2D Graph Manim-style renderer
// Draws animated axes, functions, points, labels on Canvas 2D
// ============================================================

import React, { useRef, useEffect, useCallback, type FC } from "react";
import type { AnimationRendererProps, ManimElement } from "@/types/animation";
import {
  renderFrame,
  computeElementStates,
  computeCameraState,
  computeTransform,
  worldToScreen,
  safeEval,
} from "../ManimEngine";

const GraphAnimator: FC<AnimationRendererProps> = ({
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

    // High DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    renderFrame(ctx, renderState, width, height, true);

    // Overlay: LaTeX / text elements via basic canvas text fallback
    const camera = computeCameraState(
      renderState.instructions,
      renderState.current_time,
      renderState.camera,
    );
    const tf = computeTransform(camera, width, height);
    const animStates = computeElementStates(
      renderState.elements,
      renderState.instructions,
      renderState.current_time,
    );

    for (const el of renderState.elements) {
      const anim = animStates.get(el.id);
      if (!anim || anim.opacity <= 0) continue;

      if (el.type === "text") {
        const [sx, sy] = worldToScreen(
          el.position[0] + anim.offset[0],
          el.position[1] + anim.offset[1],
          tf,
        );
        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.fillStyle = el.stroke ? (el.stroke.hex ?? "#ECECEC") : "#ECECEC";
        const fontSize =
          (el.props?.font_size ?? 16) * (el.scale ?? 1) * anim.scale_mult;
        ctx.font = `${fontSize}px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.props?.content ?? "", sx, sy);
        ctx.restore();
      }

      if (el.type === "latex") {
        // Render LaTeX as plain text fallback (KaTeX overlay handled by parent)
        const [sx, sy] = worldToScreen(
          el.position[0] + anim.offset[0],
          el.position[1] + anim.offset[1],
          tf,
        );
        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.fillStyle = el.stroke ? (el.stroke.hex ?? "#58C4DD") : "#58C4DD";
        const fontSize =
          (el.props?.font_size ?? 18) * (el.scale ?? 1) * anim.scale_mult;
        ctx.font = `italic ${fontSize}px "Times New Roman", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.props?.expression ?? el.props?.content ?? "", sx, sy);
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
      const now = performance.now();
      const elapsed = (now - startTimeRef.current) / 1000;
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

  // Redraw on state change (when paused)
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

export default GraphAnimator;
