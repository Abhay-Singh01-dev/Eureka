// ============================================================
// GridTransformRenderer — Canvas matrix transformation viz
// ============================================================

import React, { useRef, useEffect, useMemo, type FC } from "react";
import * as math from "mathjs";
import type { RendererProps, GridTransformConfig } from "@/types/simulation";

const GridTransformRenderer: FC<RendererProps> = ({
  config,
  state,
  width,
  height,
  dark = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cfg = config as GridTransformConfig;

  const scope: Record<string, number> = useMemo(
    () => ({
      ...state.variables,
      t: state.time,
      pi: Math.PI,
      e: Math.E,
    }),
    [state.variables, state.time],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    const [xMin, xMax] = cfg.bounds.x;
    const [yMin, yMax] = cfg.bounds.y;
    const padding = 40;
    const drawW = width - padding * 2;
    const drawH = height - padding * 2;

    // World → screen
    const toSx = (wx: number) =>
      padding + ((wx - xMin) / (xMax - xMin)) * drawW;
    const toSy = (wy: number) =>
      padding + ((yMax - wy) / (yMax - yMin)) * drawH;

    // Background
    ctx.fillStyle = dark ? "#0f172a" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Parse transformation matrix
    let matrix: number[][] = [
      [1, 0],
      [0, 1],
    ];
    try {
      const result = math.evaluate(cfg.matrix_expression, scope);
      // mathjs returns a Matrix or nested array
      if (result && typeof result.toArray === "function") {
        matrix = result.toArray() as number[][];
      } else if (Array.isArray(result)) {
        matrix = result as number[][];
      }
    } catch {
      // Identity fallback
    }

    const [a, b] = [matrix[0][0], matrix[0][1]];
    const [c, d] = [matrix[1][0], matrix[1][1]];

    const transform = (x: number, y: number): [number, number] => [
      a * x + b * y,
      c * x + d * y,
    ];

    // ── Draw original grid ──

    ctx.strokeStyle = cfg.original_color + "40";
    ctx.lineWidth = 0.8;

    const step = (xMax - xMin) / cfg.grid_lines;

    // Vertical lines
    for (let x = xMin; x <= xMax; x += step) {
      ctx.beginPath();
      ctx.moveTo(toSx(x), toSy(yMin));
      ctx.lineTo(toSx(x), toSy(yMax));
      ctx.stroke();
    }
    // Horizontal lines
    for (let y = yMin; y <= yMax; y += step) {
      ctx.beginPath();
      ctx.moveTo(toSx(xMin), toSy(y));
      ctx.lineTo(toSx(xMax), toSy(y));
      ctx.stroke();
    }

    // ── Draw transformed grid ──

    ctx.strokeStyle = cfg.transformed_color + "80";
    ctx.lineWidth = 1.2;

    // Vertical lines (transformed)
    for (let x = xMin; x <= xMax; x += step) {
      ctx.beginPath();
      const segments = 40;
      for (let i = 0; i <= segments; i++) {
        const y = yMin + (i / segments) * (yMax - yMin);
        const [tx, ty] = transform(x, y);
        const sx = toSx(tx);
        const sy = toSy(ty);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Horizontal lines (transformed)
    for (let y = yMin; y <= yMax; y += step) {
      ctx.beginPath();
      const segments = 40;
      for (let i = 0; i <= segments; i++) {
        const x = xMin + (i / segments) * (xMax - xMin);
        const [tx, ty] = transform(x, y);
        const sx = toSx(tx);
        const sy = toSy(ty);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // ── Axes ──

    ctx.strokeStyle = dark ? "#4b5563" : "#9ca3af";
    ctx.lineWidth = 1;

    // X axis
    if (yMin <= 0 && yMax >= 0) {
      ctx.beginPath();
      ctx.moveTo(toSx(xMin), toSy(0));
      ctx.lineTo(toSx(xMax), toSy(0));
      ctx.stroke();
    }
    // Y axis
    if (xMin <= 0 && xMax >= 0) {
      ctx.beginPath();
      ctx.moveTo(toSx(0), toSy(yMin));
      ctx.lineTo(toSx(0), toSy(yMax));
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = dark ? "#6b7280" : "#9ca3af";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    for (let x = Math.ceil(xMin); x <= xMax; x++) {
      if (x === 0) continue;
      ctx.fillText(String(x), toSx(x), toSy(0) + 14);
    }
    ctx.textAlign = "right";
    for (let y = Math.ceil(yMin); y <= yMax; y++) {
      if (y === 0) continue;
      ctx.fillText(String(y), toSx(0) - 6, toSy(y) + 3);
    }

    // ── Basis vectors ──

    if (cfg.show_basis_vectors) {
      // Original e1 = (1, 0), e2 = (0, 1)
      const drawArrow = (
        fx: number,
        fy: number,
        tx: number,
        ty: number,
        color: string,
        label: string,
        dashed?: boolean,
      ) => {
        const sx1 = toSx(fx);
        const sy1 = toSy(fy);
        const sx2 = toSx(tx);
        const sy2 = toSy(ty);

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2.5;
        if (dashed) ctx.setLineDash([4, 4]);
        else ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(sy2 - sy1, sx2 - sx1);
        const hs = 8;
        ctx.beginPath();
        ctx.moveTo(sx2, sy2);
        ctx.lineTo(
          sx2 - hs * Math.cos(angle - 0.4),
          sy2 - hs * Math.sin(angle - 0.4),
        );
        ctx.lineTo(
          sx2 - hs * Math.cos(angle + 0.4),
          sy2 - hs * Math.sin(angle + 0.4),
        );
        ctx.closePath();
        ctx.fill();

        // Label
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, sx2 + 12, sy2 - 8);
        ctx.setLineDash([]);
      };

      // Original basis (dashed)
      drawArrow(0, 0, 1, 0, cfg.original_color, "ê₁", true);
      drawArrow(0, 0, 0, 1, cfg.original_color, "ê₂", true);

      // Transformed basis
      const [te1x, te1y] = transform(1, 0);
      const [te2x, te2y] = transform(0, 1);
      drawArrow(0, 0, te1x, te1y, cfg.transformed_color, "Tê₁");
      drawArrow(0, 0, te2x, te2y, cfg.transformed_color, "Tê₂");
    }

    // ── Eigenvectors ──

    if (cfg.show_eigenvectors) {
      try {
        const det = a * d - b * c;
        const trace = a + d;
        const disc = trace * trace - 4 * det;

        if (disc >= 0) {
          const lambda1 = (trace + Math.sqrt(disc)) / 2;
          const lambda2 = (trace - Math.sqrt(disc)) / 2;

          const drawEigen = (
            lambda: number,
            color: string,
            labelText: string,
          ) => {
            let vx: number, vy: number;
            if (Math.abs(b) > 1e-10) {
              vx = b;
              vy = lambda - a;
            } else if (Math.abs(c) > 1e-10) {
              vx = lambda - d;
              vy = c;
            } else {
              // Diagonal matrix
              vx = 1;
              vy = 0;
            }

            const mag = Math.sqrt(vx * vx + vy * vy);
            if (mag < 1e-10) return;

            vx /= mag;
            vy /= mag;

            const extent = Math.max(xMax - xMin, yMax - yMin) * 0.5;

            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.moveTo(toSx(-vx * extent), toSy(-vy * extent));
            ctx.lineTo(toSx(vx * extent), toSy(vy * extent));
            ctx.stroke();
            ctx.setLineDash([]);

            // Label
            ctx.fillStyle = color;
            ctx.font = "bold 10px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(
              `${labelText} (λ=${lambda.toFixed(2)})`,
              toSx(vx * extent * 0.6) + 4,
              toSy(vy * extent * 0.6) - 6,
            );
          };

          drawEigen(lambda1, "#f59e0b", "v₁");
          if (Math.abs(lambda1 - lambda2) > 1e-10) {
            drawEigen(lambda2, "#a855f7", "v₂");
          }
        }
      } catch {
        // Skip eigenvector drawing on error
      }
    }

    // ── Tracked points ──

    if (cfg.tracked_points) {
      for (const pt of cfg.tracked_points) {
        const [tx, ty] = transform(pt.x, pt.y);

        // Original point
        ctx.fillStyle = cfg.original_color;
        ctx.beginPath();
        ctx.arc(toSx(pt.x), toSy(pt.y), 4, 0, Math.PI * 2);
        ctx.fill();

        // Transformed point
        ctx.fillStyle = cfg.transformed_color;
        ctx.beginPath();
        ctx.arc(toSx(tx), toSy(ty), 4, 0, Math.PI * 2);
        ctx.fill();

        // Connecting line
        ctx.strokeStyle = dark ? "#475569" : "#cbd5e1";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(toSx(pt.x), toSy(pt.y));
        ctx.lineTo(toSx(tx), toSy(ty));
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = dark ? "#e5e7eb" : "#374151";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(
          `${pt.label} (${pt.x},${pt.y})→(${tx.toFixed(1)},${ty.toFixed(1)})`,
          toSx(tx) + 8,
          toSy(ty) - 4,
        );
      }
    }

    // ── Matrix display ──

    ctx.fillStyle = dark ? "#e5e7eb" : "#1f2937";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`T = [${a.toFixed(2)}, ${b.toFixed(2)}]`, 8, 18);
    ctx.fillText(`    [${c.toFixed(2)}, ${d.toFixed(2)}]`, 8, 32);

    const detVal = a * d - b * c;
    ctx.fillStyle = dark ? "#6b7280" : "#9ca3af";
    ctx.font = "10px monospace";
    ctx.fillText(`det = ${detVal.toFixed(3)}`, 8, 46);
  }, [cfg, scope, width, height, dark, state]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
};

export default GridTransformRenderer;
