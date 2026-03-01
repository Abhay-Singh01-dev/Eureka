// ============================================================
// CircuitFlowAnimator — Electric circuit with current flow dots
// Manim-style circuit visualization
// ============================================================

import React, { useRef, useEffect, useCallback, type FC } from "react";
import type { AnimationRendererProps } from "@/types/animation";
import {
  computeTransform,
  computeCameraState,
  computeElementStates,
  worldToScreen,
  drawManimBackground,
  drawElement,
} from "../ManimEngine";

const CircuitFlowAnimator: FC<AnimationRendererProps> = ({
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
    drawManimBackground(ctx, width, height, tf, false);

    const animStates = computeElementStates(
      renderState.elements,
      renderState.instructions,
      renderState.current_time,
    );

    const t = renderState.current_time;

    // Draw circuit wires (lines, rectangles) first
    const wireElements = renderState.elements.filter(
      (e) => e.type === "line" || e.type === "rectangle" || e.type === "arc",
    );
    const otherElements = renderState.elements.filter(
      (e) => e.type !== "line" && e.type !== "rectangle" && e.type !== "arc",
    );

    // Draw wires
    for (const el of wireElements) {
      const anim = animStates.get(el.id);
      if (!anim || anim.opacity <= 0) continue;
      drawElement(ctx, el, anim, tf);
    }

    // Draw current flow dots along paths
    for (const el of renderState.elements) {
      if (el.type !== "path" && !el.props?.current_path) continue;

      const anim = animStates.get(el.id);
      if (!anim || anim.opacity <= 0) continue;

      const path = el.props?.current_path ?? el.props?.points ?? [];
      if (!Array.isArray(path) || path.length < 2) continue;

      const flowSpeed = el.props?.flow_speed ?? 1;
      const dotCount = el.props?.dot_count ?? 5;
      const dotColor = el.stroke?.hex ?? "#FFFF00";
      const dotRadius = (el.props?.radius ?? 0.06) * Math.abs(tf.scaleX);

      // Calculate total path length
      let totalLen = 0;
      const segLens: number[] = [];
      for (let i = 1; i < path.length; i++) {
        const dx = path[i][0] - path[i - 1][0];
        const dy = path[i][1] - path[i - 1][1];
        const len = Math.sqrt(dx * dx + dy * dy);
        segLens.push(len);
        totalLen += len;
      }

      // Place dots along path
      for (let d = 0; d < dotCount; d++) {
        const offset = (d / dotCount + t * flowSpeed * 0.1) % 1;
        const targetDist = offset * totalLen;

        // Find position
        let accum = 0;
        for (let i = 0; i < segLens.length; i++) {
          if (accum + segLens[i] >= targetDist) {
            const frac = (targetDist - accum) / segLens[i];
            const px = path[i][0] + (path[i + 1][0] - path[i][0]) * frac;
            const py = path[i][1] + (path[i + 1][1] - path[i][1]) * frac;
            const [sx, sy] = worldToScreen(px, py, tf);

            ctx.save();
            ctx.globalAlpha = anim.opacity * anim.draw_progress;

            // Glow
            const grd = ctx.createRadialGradient(
              sx,
              sy,
              0,
              sx,
              sy,
              dotRadius * 4,
            );
            grd.addColorStop(0, dotColor + "50");
            grd.addColorStop(1, "transparent");
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(sx, sy, dotRadius * 4, 0, Math.PI * 2);
            ctx.fill();

            // Dot
            ctx.fillStyle = dotColor;
            ctx.beginPath();
            ctx.arc(sx, sy, dotRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
            break;
          }
          accum += segLens[i];
        }
      }
    }

    // Draw other elements (text labels, component symbols, etc.)
    for (const el of otherElements) {
      const anim = animStates.get(el.id);
      if (!anim || anim.opacity <= 0) continue;

      if (el.type === "path") continue; // Already handled

      const [sx, sy] = worldToScreen(
        el.position[0] + anim.offset[0],
        el.position[1] + anim.offset[1],
        tf,
      );

      if (el.type === "text") {
        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.fillStyle = el.stroke?.hex ?? "#ECECEC";
        const fontSize = (el.props?.font_size ?? 13) * (el.scale ?? 1);
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
        const fontSize = (el.props?.font_size ?? 16) * (el.scale ?? 1);
        ctx.font = `italic ${fontSize}px "Times New Roman", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.props?.expression ?? "", sx, sy);
        ctx.restore();
      }

      if (el.type === "circle") {
        const r = (el.props?.radius ?? 0.3) * Math.abs(tf.scaleX);
        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.strokeStyle = el.stroke?.hex ?? "#ECECEC";
        ctx.lineWidth = el.stroke_width ?? 2;
        ctx.beginPath();
        ctx.arc(sx, sy, r * anim.draw_progress, 0, Math.PI * 2);
        ctx.stroke();
        if (el.fill) {
          ctx.fillStyle =
            el.fill.hex +
            Math.round((el.fill.opacity ?? 0.1) * 255)
              .toString(16)
              .padStart(2, "0");
          ctx.fill();
        }
        ctx.restore();
      }

      if (el.type === "dot") {
        const r = (el.props?.radius ?? 0.06) * Math.abs(tf.scaleX);
        ctx.save();
        ctx.globalAlpha = anim.opacity;
        ctx.fillStyle = el.stroke?.hex ?? "#FC6255";
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Resistor / capacitor symbols drawn as rectangles
      if (el.type === "rectangle") {
        drawElement(ctx, el, anim, tf);
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

export default CircuitFlowAnimator;
