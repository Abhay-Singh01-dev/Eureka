// ============================================================
// CustomDrawingAnimator — Freeform shapes, paths, SVG
// Manim-style custom drawing renderer
// ============================================================

import React, { useRef, useEffect, useCallback, type FC } from "react";
import type { AnimationRendererProps } from "@/types/animation";
import {
  renderFrame,
  computeElementStates,
  computeCameraState,
  computeTransform,
  worldToScreen,
} from "../ManimEngine";

const CustomDrawingAnimator: FC<AnimationRendererProps> = ({
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

    // Use the core engine for most rendering
    renderFrame(ctx, renderState, width, height, true);

    // Additional overlay: text / latex elements drawn via canvas text
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

      const [sx, sy] = worldToScreen(
        el.position[0] + anim.offset[0],
        el.position[1] + anim.offset[1],
        tf,
      );

      if (el.type === "text") {
        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.fillStyle = el.stroke?.hex ?? "#ECECEC";
        const fontSize =
          (el.props?.font_size ?? 14) * (el.scale ?? 1) * anim.scale_mult;
        ctx.font = `${fontSize}px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.props?.content ?? "", sx, sy);
        ctx.restore();
      }

      if (el.type === "latex") {
        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.fillStyle = el.stroke?.hex ?? "#58C4DD";
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

export default CustomDrawingAnimator;
