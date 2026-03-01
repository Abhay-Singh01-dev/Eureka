// ============================================================
// VectorFieldRenderer — SVG arrow grid for force/velocity fields
// ============================================================

import React, { useMemo, type FC } from "react";
import * as math from "mathjs";
import type { RendererProps, VectorFieldConfig } from "@/types/simulation";

/* ── Color helpers ───────────────────────────────────────── */

function magnitudeToColor(mag: number, maxMag: number, dark: boolean): string {
  const t = Math.min(mag / (maxMag || 1), 1);
  // Blue → Cyan → Green → Yellow → Red
  if (t < 0.25) {
    const s = t / 0.25;
    return `rgb(${Math.round(59 + 6 * s)}, ${Math.round(130 + 70 * s)}, ${Math.round(246 - 46 * s)})`;
  }
  if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return `rgb(${Math.round(65 + 89 * s)}, ${Math.round(200 - 30 * s)}, ${Math.round(200 - 160 * s)})`;
  }
  if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return `rgb(${Math.round(154 + 80 * s)}, ${Math.round(170 - 40 * s)}, ${Math.round(40 - 20 * s)})`;
  }
  const s = (t - 0.75) / 0.25;
  return `rgb(${Math.round(234 + 5 * s)}, ${Math.round(130 - 80 * s)}, ${Math.round(20 - 10 * s)})`;
}

/* ── Arrow component ─────────────────────────────────────── */

interface ArrowProps {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  maxLen: number;
}

const Arrow: FC<ArrowProps> = ({ x, y, dx, dy, color, maxLen }) => {
  const angle = Math.atan2(dy, dx);
  const headSize = Math.min(maxLen * 0.3, 4);

  return (
    <g>
      <line
        x1={x}
        y1={y}
        x2={x + dx}
        y2={y + dy}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Arrowhead */}
      <polygon
        points={`
          ${x + dx},${y + dy}
          ${x + dx - headSize * Math.cos(angle - 0.5)},${y + dy - headSize * Math.sin(angle - 0.5)}
          ${x + dx - headSize * Math.cos(angle + 0.5)},${y + dy - headSize * Math.sin(angle + 0.5)}
        `}
        fill={color}
      />
    </g>
  );
};

/* ── Main component ──────────────────────────────────────── */

const VectorFieldRenderer: FC<RendererProps> = ({
  config,
  state,
  width,
  height,
  dark = false,
}) => {
  const cfg = config as VectorFieldConfig;

  const scope: Record<string, number> = useMemo(
    () => ({
      ...state.variables,
      t: state.time,
      pi: Math.PI,
      e: Math.E,
    }),
    [state.variables, state.time],
  );

  // Compute field vectors on grid
  const fieldData = useMemo(() => {
    const { resolution, bounds, normalize } = cfg;
    const [xMin, xMax] = bounds.x;
    const [yMin, yMax] = bounds.y;

    const padding = 30;
    const drawW = width - padding * 2;
    const drawH = height - padding * 2;
    const cellW = drawW / resolution;
    const cellH = drawH / resolution;
    const maxArrowLen = Math.min(cellW, cellH) * 0.4;

    const arrows: {
      sx: number;
      sy: number;
      dx: number;
      dy: number;
      mag: number;
    }[] = [];

    let maxMag = 0;

    for (let i = 0; i <= resolution; i++) {
      for (let j = 0; j <= resolution; j++) {
        const worldX = xMin + (i / resolution) * (xMax - xMin);
        const worldY = yMin + (j / resolution) * (yMax - yMin);

        // Screen position (center of cell)
        const sx = padding + (i / resolution) * drawW;
        const sy = padding + ((resolution - j) / resolution) * drawH;

        // Evaluate field
        const evalScope = { ...scope, x: worldX, y: worldY };
        let fx = 0;
        let fy = 0;
        try {
          fx = Number(math.evaluate(cfg.field.fx, evalScope));
          fy = Number(math.evaluate(cfg.field.fy, evalScope));
        } catch {
          continue;
        }

        if (!isFinite(fx) || !isFinite(fy)) continue;

        const mag = Math.sqrt(fx * fx + fy * fy);
        if (mag > maxMag) maxMag = mag;

        arrows.push({ sx, sy, dx: fx, dy: -fy, mag }); // -fy for SVG coords
      }
    }

    // Normalize arrow lengths
    const scaled = arrows.map((a) => {
      const mag = a.mag;
      if (mag === 0) return { ...a, dx: 0, dy: 0 };

      let len: number;
      if (normalize) {
        len = maxArrowLen;
      } else {
        len = (mag / (maxMag || 1)) * maxArrowLen;
      }

      const angle = Math.atan2(a.dy, a.dx);
      return {
        ...a,
        dx: len * Math.cos(angle),
        dy: len * Math.sin(angle),
        maxArrowLen,
      };
    });

    return { arrows: scaled, maxMag, maxArrowLen };
  }, [cfg, scope, width, height]);

  return (
    <svg
      width={width}
      height={height}
      className="block"
      style={{
        background: dark ? "#0f172a" : "#ffffff",
      }}
    >
      {/* Grid */}
      {cfg.show_grid && (
        <g>
          {/* Horizontal grid lines */}
          {Array.from({ length: cfg.resolution + 1 }).map((_, i) => {
            const y = 30 + (i / cfg.resolution) * (height - 60);
            return (
              <line
                key={`h${i}`}
                x1={30}
                y1={y}
                x2={width - 30}
                y2={y}
                stroke={dark ? "#1e293b" : "#f3f4f6"}
                strokeWidth={0.5}
              />
            );
          })}
          {/* Vertical grid lines */}
          {Array.from({ length: cfg.resolution + 1 }).map((_, i) => {
            const x = 30 + (i / cfg.resolution) * (width - 60);
            return (
              <line
                key={`v${i}`}
                x1={x}
                y1={30}
                x2={x}
                y2={height - 30}
                stroke={dark ? "#1e293b" : "#f3f4f6"}
                strokeWidth={0.5}
              />
            );
          })}
        </g>
      )}

      {/* Axes */}
      <g>
        {/* X axis labels */}
        <text
          x={width / 2}
          y={height - 6}
          textAnchor="middle"
          fill={dark ? "#6b7280" : "#9ca3af"}
          fontSize="10"
        >
          x [{cfg.bounds.x[0]}, {cfg.bounds.x[1]}]
        </text>
        {/* Y axis labels */}
        <text
          x={6}
          y={height / 2}
          textAnchor="middle"
          fill={dark ? "#6b7280" : "#9ca3af"}
          fontSize="10"
          transform={`rotate(-90, 10, ${height / 2})`}
        >
          y [{cfg.bounds.y[0]}, {cfg.bounds.y[1]}]
        </text>
      </g>

      {/* Arrows */}
      {fieldData.arrows.map((a, i) => (
        <Arrow
          key={i}
          x={a.sx}
          y={a.sy}
          dx={a.dx}
          dy={a.dy}
          color={
            cfg.color_mode === "magnitude"
              ? magnitudeToColor(a.mag, fieldData.maxMag, dark)
              : cfg.uniform_color || (dark ? "#34d399" : "#059669")
          }
          maxLen={fieldData.maxArrowLen}
        />
      ))}

      {/* Magnitude legend (for magnitude color mode) */}
      {cfg.color_mode === "magnitude" && (
        <g>
          <defs>
            <linearGradient id="mag-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={magnitudeToColor(0, 1, dark)} />
              <stop offset="25%" stopColor={magnitudeToColor(0.25, 1, dark)} />
              <stop offset="50%" stopColor={magnitudeToColor(0.5, 1, dark)} />
              <stop offset="75%" stopColor={magnitudeToColor(0.75, 1, dark)} />
              <stop offset="100%" stopColor={magnitudeToColor(1, 1, dark)} />
            </linearGradient>
          </defs>
          <rect
            x={width - 140}
            y={8}
            width={100}
            height={8}
            rx={4}
            fill="url(#mag-grad)"
          />
          <text
            x={width - 140}
            y={26}
            fill={dark ? "#6b7280" : "#9ca3af"}
            fontSize="8"
          >
            0
          </text>
          <text
            x={width - 40}
            y={26}
            textAnchor="end"
            fill={dark ? "#6b7280" : "#9ca3af"}
            fontSize="8"
          >
            {fieldData.maxMag.toFixed(2)}
          </text>
        </g>
      )}
    </svg>
  );
};

export default VectorFieldRenderer;
