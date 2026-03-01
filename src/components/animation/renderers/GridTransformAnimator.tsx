// ============================================================
// GridTransformAnimator — Matrix transformation on a 2D grid
// Shows linear transformations Manim-style
// ============================================================

import React, { useRef, useEffect, useCallback, type FC } from "react";
import type { AnimationRendererProps } from "@/types/animation";
import {
  computeTransform,
  computeCameraState,
  computeElementStates,
  worldToScreen,
  drawManimBackground,
} from "../ManimEngine";

const GridTransformAnimator: FC<AnimationRendererProps> = ({
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
    drawManimBackground(ctx, width, height, tf, false); // No default grid — we draw our own

    const animStates = computeElementStates(
      renderState.elements,
      renderState.instructions,
      renderState.current_time,
    );

    // Find grid elements for transformation matrix
    const gridEls = renderState.elements.filter((e) => e.type === "grid");
    const otherEls = renderState.elements.filter((e) => e.type !== "grid");

    // Draw transformed grids
    for (const el of gridEls) {
      const anim = animStates.get(el.id);
      if (!anim || anim.opacity <= 0) continue;

      const range = el.props?.range ?? [-5, 5];
      const step = el.props?.step ?? 1;
      // Matrix from props (2x2 transformation)
      const matrix = el.props?.matrix ?? [1, 0, 0, 1]; // [a, b, c, d] => [[a,b],[c,d]]
      const progress = anim.draw_progress;

      ctx.save();
      ctx.globalAlpha = anim.opacity;

      // Interpolate matrix from identity to target
      const a = 1 + (matrix[0] - 1) * progress;
      const b = matrix[1] * progress;
      const c = matrix[2] * progress;
      const d = 1 + (matrix[3] - 1) * progress;

      // Draw grid lines
      for (let v = range[0]; v <= range[1]; v += step) {
        // Vertical line: (v, range[0]) to (v, range[1])
        const isAxis = v === 0;
        ctx.strokeStyle = isAxis ? "#58C4DD" : (el.stroke?.hex ?? "#333366");
        ctx.lineWidth = isAxis ? 2 : 0.8;
        ctx.globalAlpha = anim.opacity * (isAxis ? 1 : 0.4);
        ctx.beginPath();

        const segments = 30;
        for (let s = 0; s <= segments; s++) {
          const t = range[0] + (s / segments) * (range[1] - range[0]);
          // Apply matrix
          const wx = a * v + b * t;
          const wy = c * v + d * t;
          const [sx, sy] = worldToScreen(wx, wy, tf);
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        // Horizontal line: (range[0], v) to (range[1], v)
        ctx.strokeStyle = isAxis ? "#FC6255" : (el.stroke?.hex ?? "#333366");
        ctx.lineWidth = isAxis ? 2 : 0.8;
        ctx.globalAlpha = anim.opacity * (isAxis ? 1 : 0.4);
        ctx.beginPath();

        for (let s = 0; s <= segments; s++) {
          const t = range[0] + (s / segments) * (range[1] - range[0]);
          const wx = a * t + b * v;
          const wy = c * t + d * v;
          const [sx, sy] = worldToScreen(wx, wy, tf);
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      ctx.restore();
    }

    // Draw other elements (vectors, dots, text, etc.)
    for (const el of otherEls) {
      const anim = animStates.get(el.id);
      if (!anim || anim.opacity <= 0) continue;

      const pos = el.position;
      const [sx, sy] = worldToScreen(
        pos[0] + anim.offset[0],
        pos[1] + anim.offset[1],
        tf,
      );

      ctx.save();
      ctx.globalAlpha = anim.opacity;

      if (el.type === "vector" || el.type === "arrow") {
        const dir = el.props?.direction ?? el.props?.end ?? [1, 0];
        const endX = pos[0] + dir[0];
        const endY = pos[1] + dir[1];
        const [ex, ey] = worldToScreen(
          endX + anim.offset[0],
          endY + anim.offset[1],
          tf,
        );

        ctx.strokeStyle = el.stroke?.hex ?? "#83C167";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        const dx = (ex - sx) * anim.draw_progress;
        const dy = (ey - sy) * anim.draw_progress;
        ctx.lineTo(sx + dx, sy + dy);
        ctx.stroke();

        // Arrowhead
        if (anim.draw_progress > 0.5) {
          const angle = Math.atan2(dy, dx);
          const headLen = 10;
          ctx.fillStyle = el.stroke?.hex ?? "#83C167";
          ctx.beginPath();
          ctx.moveTo(sx + dx, sy + dy);
          ctx.lineTo(
            sx + dx - headLen * Math.cos(angle - 0.4),
            sy + dy - headLen * Math.sin(angle - 0.4),
          );
          ctx.lineTo(
            sx + dx - headLen * Math.cos(angle + 0.4),
            sy + dy - headLen * Math.sin(angle + 0.4),
          );
          ctx.closePath();
          ctx.fill();
        }
      }

      if (el.type === "dot") {
        const r = (el.props?.radius ?? 0.1) * Math.abs(tf.scaleX);
        ctx.fillStyle = el.stroke?.hex ?? "#FFFF00";
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (el.type === "text") {
        ctx.fillStyle = el.stroke?.hex ?? "#ECECEC";
        const fontSize = (el.props?.font_size ?? 14) * (el.scale ?? 1);
        ctx.font = `${fontSize}px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.props?.content ?? "", sx, sy);
      }

      if (el.type === "latex") {
        ctx.fillStyle = el.stroke?.hex ?? "#58C4DD";
        const fontSize = (el.props?.font_size ?? 18) * (el.scale ?? 1);
        ctx.font = `italic ${fontSize}px "Times New Roman", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.props?.expression ?? "", sx, sy);
      }

      ctx.restore();
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

export default GridTransformAnimator;
