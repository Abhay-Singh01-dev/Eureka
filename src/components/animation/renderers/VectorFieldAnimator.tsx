// ============================================================
// VectorFieldAnimator — Arrow grids with animated flow
// Displays force / velocity fields Manim-style
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
  colorToCSS,
} from "../ManimEngine";
import { MANIM_BG } from "@/types/animation";

const VectorFieldAnimator: FC<AnimationRendererProps> = ({
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

    // Draw each element
    for (const el of renderState.elements) {
      const anim = animStates.get(el.id);
      if (!anim || anim.opacity <= 0) continue;

      if (el.type === "vector" || el.type === "arrow") {
        const dir = el.props?.direction ?? el.props?.end ?? [1, 0];
        const [sx, sy] = worldToScreen(
          el.position[0] + anim.offset[0],
          el.position[1] + anim.offset[1],
          tf,
        );

        const mag = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]);
        const angle = Math.atan2(-dir[1], dir[0]); // Negate Y for screen
        const arrowLen = mag * Math.abs(tf.scaleX) * anim.draw_progress;

        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.translate(sx, sy);
        ctx.rotate(angle);

        // Shaft
        ctx.strokeStyle = el.stroke?.hex ?? "#58C4DD";
        ctx.lineWidth = el.stroke_width ?? 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(arrowLen, 0);
        ctx.stroke();

        // Head
        if (anim.draw_progress > 0.3) {
          const headSize = Math.min(8, arrowLen * 0.25);
          ctx.fillStyle = el.stroke?.hex ?? "#58C4DD";
          ctx.beginPath();
          ctx.moveTo(arrowLen, 0);
          ctx.lineTo(arrowLen - headSize, -headSize * 0.5);
          ctx.lineTo(arrowLen - headSize, headSize * 0.5);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }

      // Grid background for vector fields
      if (el.type === "grid") {
        ctx.save();
        ctx.globalAlpha = anim.opacity * 0.15;
        const unitPx = Math.abs(tf.scaleX);
        const range = el.props?.range ?? [-5, 5];
        const step = el.props?.step ?? 1;
        ctx.strokeStyle = el.stroke?.hex ?? "#333366";
        ctx.lineWidth = 0.5;

        for (let v = range[0]; v <= range[1]; v += step) {
          const [x1, y1] = worldToScreen(v, range[0], tf);
          const [x2, y2] = worldToScreen(v, range[1], tf);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          const [hx1, hy1] = worldToScreen(range[0], v, tf);
          const [hx2, hy2] = worldToScreen(range[1], v, tf);
          ctx.beginPath();
          ctx.moveTo(hx1, hy1);
          ctx.lineTo(hx2, hy2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Text labels
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

      // Dots / points
      if (el.type === "dot") {
        const [sx, sy] = worldToScreen(
          el.position[0] + anim.offset[0],
          el.position[1] + anim.offset[1],
          tf,
        );
        const r = (el.props?.radius ?? 0.08) * Math.abs(tf.scaleX);
        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.fillStyle = el.stroke?.hex ?? "#FC6255";
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

export default VectorFieldAnimator;
