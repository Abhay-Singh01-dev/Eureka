// ============================================================
// CircuitDiagramRenderer — SVG circuit schematic with live values
// ============================================================

import React, { useMemo, type FC } from "react";
import * as math from "mathjs";
import type {
  RendererProps,
  CircuitDiagramConfig,
  CircuitComponent,
} from "@/types/simulation";

/* ── Component SVG shapes ────────────────────────────────── */

interface ComponentViewProps {
  comp: CircuitComponent;
  x: number;
  y: number;
  cellW: number;
  cellH: number;
  dark: boolean;
  voltageText?: string;
  currentText?: string;
  animatePhase: number;
}

const COMPONENT_STROKE = {
  light: "#374151",
  dark: "#d1d5db",
};

const ComponentView: FC<ComponentViewProps> = ({
  comp,
  x,
  y,
  cellW,
  cellH,
  dark,
  voltageText,
  currentText,
  animatePhase,
}) => {
  const stroke = dark ? COMPONENT_STROKE.dark : COMPONENT_STROKE.light;
  const fill = dark ? "#1e293b" : "#ffffff";
  const halfW = cellW / 2;
  const halfH = cellH / 2;
  const cx = x + halfW;
  const cy = y + halfH;

  // Rotation transform
  const rot = comp.rotation || 0;
  const transform = `rotate(${rot}, ${cx}, ${cy})`;

  const labelY = cy + halfH * 0.7;
  const labelFill = dark ? "#9ca3af" : "#6b7280";

  const renderShape = () => {
    switch (comp.type) {
      case "resistor":
        // Zigzag pattern
        return (
          <g transform={transform}>
            <line
              x1={x + 4}
              y1={cy}
              x2={cx - 18}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
            <polyline
              points={`
                ${cx - 18},${cy}
                ${cx - 14},${cy - 6}
                ${cx - 10},${cy + 6}
                ${cx - 6},${cy - 6}
                ${cx - 2},${cy + 6}
                ${cx + 2},${cy - 6}
                ${cx + 6},${cy + 6}
                ${cx + 10},${cy - 6}
                ${cx + 14},${cy + 6}
                ${cx + 18},${cy}
              `}
              fill="none"
              stroke={stroke}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            <line
              x1={cx + 18}
              y1={cy}
              x2={x + cellW - 4}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
          </g>
        );

      case "capacitor":
        return (
          <g transform={transform}>
            <line
              x1={x + 4}
              y1={cy}
              x2={cx - 4}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
            <line
              x1={cx - 4}
              y1={cy - 10}
              x2={cx - 4}
              y2={cy + 10}
              stroke={stroke}
              strokeWidth={2}
            />
            <line
              x1={cx + 4}
              y1={cy - 10}
              x2={cx + 4}
              y2={cy + 10}
              stroke={stroke}
              strokeWidth={2}
            />
            <line
              x1={cx + 4}
              y1={cy}
              x2={x + cellW - 4}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
          </g>
        );

      case "inductor":
        return (
          <g transform={transform}>
            <line
              x1={x + 4}
              y1={cy}
              x2={cx - 16}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
            {/* Coil arcs */}
            {[0, 1, 2, 3].map((i) => (
              <path
                key={i}
                d={`M ${cx - 16 + i * 8},${cy} A 4 4 0 0 1 ${cx - 8 + i * 8},${cy}`}
                fill="none"
                stroke={stroke}
                strokeWidth={1.5}
              />
            ))}
            <line
              x1={cx + 16}
              y1={cy}
              x2={x + cellW - 4}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
          </g>
        );

      case "battery":
        return (
          <g transform={transform}>
            <line
              x1={x + 4}
              y1={cy}
              x2={cx - 6}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
            {/* Thin line (positive) */}
            <line
              x1={cx - 6}
              y1={cy - 12}
              x2={cx - 6}
              y2={cy + 12}
              stroke={stroke}
              strokeWidth={1.5}
            />
            {/* Thick line (negative) */}
            <line
              x1={cx + 2}
              y1={cy - 7}
              x2={cx + 2}
              y2={cy + 7}
              stroke={stroke}
              strokeWidth={3}
            />
            <line
              x1={cx + 2}
              y1={cy}
              x2={x + cellW - 4}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
            {/* +/- labels */}
            <text
              x={cx - 10}
              y={cy - 14}
              fill={labelFill}
              fontSize="8"
              textAnchor="middle"
            >
              +
            </text>
            <text
              x={cx + 6}
              y={cy - 10}
              fill={labelFill}
              fontSize="8"
              textAnchor="middle"
            >
              −
            </text>
          </g>
        );

      case "switch":
        return (
          <g transform={transform}>
            <line
              x1={x + 4}
              y1={cy}
              x2={cx - 10}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
            <circle cx={cx - 10} cy={cy} r={2} fill={stroke} />
            <line
              x1={cx - 10}
              y1={cy}
              x2={cx + 10}
              y2={cy - 10}
              stroke={stroke}
              strokeWidth={1.5}
            />
            <circle cx={cx + 10} cy={cy} r={2} fill={stroke} />
            <line
              x1={cx + 10}
              y1={cy}
              x2={x + cellW - 4}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
          </g>
        );

      case "bulb":
        return (
          <g transform={transform}>
            <line
              x1={x + 4}
              y1={cy}
              x2={cx - 10}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
            <circle
              cx={cx}
              cy={cy}
              r={10}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.5}
            />
            <line
              x1={cx - 5}
              y1={cy - 5}
              x2={cx + 5}
              y2={cy + 5}
              stroke={stroke}
              strokeWidth={1}
            />
            <line
              x1={cx + 5}
              y1={cy - 5}
              x2={cx - 5}
              y2={cy + 5}
              stroke={stroke}
              strokeWidth={1}
            />
            <line
              x1={cx + 10}
              y1={cy}
              x2={x + cellW - 4}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
          </g>
        );

      case "ammeter":
      case "voltmeter":
        return (
          <g transform={transform}>
            <line
              x1={x + 4}
              y1={cy}
              x2={cx - 12}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
            <circle
              cx={cx}
              cy={cy}
              r={12}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.5}
            />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              fill={stroke}
              fontSize="10"
              fontWeight="bold"
            >
              {comp.type === "ammeter" ? "A" : "V"}
            </text>
            <line
              x1={cx + 12}
              y1={cy}
              x2={x + cellW - 4}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
          </g>
        );

      case "ground":
        return (
          <g transform={transform}>
            <line
              x1={cx}
              y1={y + 4}
              x2={cx}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
            <line
              x1={cx - 10}
              y1={cy}
              x2={cx + 10}
              y2={cy}
              stroke={stroke}
              strokeWidth={2}
            />
            <line
              x1={cx - 6}
              y1={cy + 4}
              x2={cx + 6}
              y2={cy + 4}
              stroke={stroke}
              strokeWidth={1.5}
            />
            <line
              x1={cx - 3}
              y1={cy + 8}
              x2={cx + 3}
              y2={cy + 8}
              stroke={stroke}
              strokeWidth={1}
            />
          </g>
        );

      case "wire":
      default:
        return (
          <g transform={transform}>
            <line
              x1={x + 4}
              y1={cy}
              x2={x + cellW - 4}
              y2={cy}
              stroke={stroke}
              strokeWidth={1.5}
            />
          </g>
        );
    }
  };

  return (
    <g>
      {renderShape()}

      {/* Label */}
      <text
        x={cx}
        y={labelY + 4}
        textAnchor="middle"
        fill={labelFill}
        fontSize="9"
        fontWeight="500"
      >
        {comp.label}
        {comp.value ? ` (${comp.value})` : ""}
      </text>

      {/* Live computed values */}
      {(voltageText || currentText) && (
        <g>
          {voltageText && (
            <text
              x={cx}
              y={labelY + 14}
              textAnchor="middle"
              fill="#3b82f6"
              fontSize="8"
            >
              {voltageText}
            </text>
          )}
          {currentText && (
            <text
              x={cx}
              y={labelY + (voltageText ? 22 : 14)}
              textAnchor="middle"
              fill="#ef4444"
              fontSize="8"
            >
              {currentText}
            </text>
          )}
        </g>
      )}

      {/* Current flow animation dots */}
      {animatePhase >= 0 && currentText && (
        <circle
          cx={cx - 18 + (animatePhase % 36)}
          cy={cy}
          r={2}
          fill="#facc15"
          opacity={0.8}
        />
      )}
    </g>
  );
};

/* ── Main component ──────────────────────────────────────── */

const CircuitDiagramRenderer: FC<RendererProps> = ({
  config,
  state,
  model,
  width,
  height,
  dark = false,
}) => {
  const cfg = config as CircuitDiagramConfig;

  const scope: Record<string, number> = useMemo(
    () => ({
      ...state.variables,
      t: state.time,
      pi: Math.PI,
      e: Math.E,
    }),
    [state.variables, state.time],
  );

  const cellW = (width - 40) / cfg.grid.cols;
  const cellH = (height - 60) / cfg.grid.rows;

  // Evaluate computed values
  const computedMap = useMemo(() => {
    const map = new Map<
      string,
      { voltage?: string; current?: string; power?: string }
    >();

    for (const cv of cfg.computed_values) {
      let voltage: string | undefined;
      let current: string | undefined;

      try {
        if (cv.voltage) {
          const val = Number(math.evaluate(cv.voltage, scope));
          voltage = `${val.toFixed(2)} V`;
        }
      } catch {
        /* skip */
      }

      try {
        if (cv.current) {
          const val = Number(math.evaluate(cv.current, scope));
          current = `${(val * 1000).toFixed(1)} mA`;
        }
      } catch {
        /* skip */
      }

      map.set(cv.component_id, { voltage, current });
    }
    return map;
  }, [cfg.computed_values, scope]);

  // Animation phase (0–36 cycling)
  const animPhase = cfg.animate_current ? Math.floor(state.time * 20) % 36 : -1;

  return (
    <svg
      width={width}
      height={height}
      className="block"
      style={{ background: dark ? "#0f172a" : "#ffffff" }}
    >
      {/* Title */}
      <text
        x={width / 2}
        y={18}
        textAnchor="middle"
        fill={dark ? "#e5e7eb" : "#374151"}
        fontSize="12"
        fontWeight="600"
      >
        Circuit Diagram
      </text>

      {/* Grid background */}
      {Array.from({ length: cfg.grid.rows + 1 }).map((_, i) => (
        <line
          key={`hr${i}`}
          x1={20}
          y1={30 + i * cellH}
          x2={width - 20}
          y2={30 + i * cellH}
          stroke={dark ? "#1e293b" : "#f9fafb"}
          strokeWidth={0.5}
          strokeDasharray="4 4"
        />
      ))}
      {Array.from({ length: cfg.grid.cols + 1 }).map((_, i) => (
        <line
          key={`vr${i}`}
          x1={20 + i * cellW}
          y1={30}
          x2={20 + i * cellW}
          y2={height - 30}
          stroke={dark ? "#1e293b" : "#f9fafb"}
          strokeWidth={0.5}
          strokeDasharray="4 4"
        />
      ))}

      {/* Components */}
      {cfg.components.map((comp) => {
        const px = 20 + comp.position.col * cellW;
        const py = 30 + comp.position.row * cellH;
        const cv = computedMap.get(comp.id);

        return (
          <ComponentView
            key={comp.id}
            comp={comp}
            x={px}
            y={py}
            cellW={cellW}
            cellH={cellH}
            dark={dark}
            voltageText={cv?.voltage}
            currentText={cv?.current}
            animatePhase={animPhase}
          />
        );
      })}
    </svg>
  );
};

export default CircuitDiagramRenderer;
