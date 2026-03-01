// ============================================================
// NumericalDisplay — Gauge / Counter / Number readouts
// ============================================================

import React, { useMemo, type FC } from "react";
import * as math from "mathjs";
import type { RendererProps, NumericalDisplayConfig } from "@/types/simulation";

/* ── Gauge SVG ───────────────────────────────────────────── */

interface GaugeProps {
  value: number;
  min: number;
  max: number;
  label: string;
  unit: string;
  precision: number;
  color: string;
  dark: boolean;
}

const Gauge: FC<GaugeProps> = ({
  value,
  min,
  max,
  label,
  unit,
  precision,
  color,
  dark,
}) => {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -135 + pct * 270; // sweep from -135° to 135°
  const r = 40;
  const cx = 50;
  const cy = 55;

  // Arc path (background)
  const arcPath = (startAngle: number, endAngle: number) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Needle
  const toRad = (d: number) => (d * Math.PI) / 180;
  const needleLen = r - 6;
  const nx = cx + needleLen * Math.cos(toRad(angle));
  const ny = cy + needleLen * Math.sin(toRad(angle));

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 80" className="w-full max-w-[180px]">
        {/* Background arc */}
        <path
          d={arcPath(-135, 135)}
          fill="none"
          stroke={dark ? "#374151" : "#e5e7eb"}
          strokeWidth={6}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={arcPath(-135, angle)}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
        />
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={dark ? "#e5e7eb" : "#1f2937"}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3} fill={color} />
        {/* Value text */}
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          fill={dark ? "#f3f4f6" : "#111827"}
          fontSize="10"
          fontWeight="bold"
          fontFamily="monospace"
        >
          {value.toFixed(precision)} {unit}
        </text>
      </svg>
      <span
        className={`text-xs mt-1 font-medium ${dark ? "text-gray-400" : "text-gray-600"}`}
      >
        {label}
      </span>
    </div>
  );
};

/* ── Counter Display ─────────────────────────────────────── */

interface CounterProps {
  value: number;
  label: string;
  unit: string;
  precision: number;
  color: string;
  dark: boolean;
}

const Counter: FC<CounterProps> = ({
  value,
  label,
  unit,
  precision,
  color,
  dark,
}) => {
  const digits = value.toFixed(precision).split("");

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`text-xs font-medium ${dark ? "text-gray-400" : "text-gray-600"}`}
      >
        {label}
      </span>
      <div className="flex gap-0.5">
        {digits.map((d, i) => (
          <span
            key={i}
            className={`inline-flex items-center justify-center w-6 h-9 rounded text-lg font-mono font-bold ${
              d === "." || d === "-"
                ? "bg-transparent"
                : dark
                  ? "bg-slate-700"
                  : "bg-gray-100"
            }`}
            style={{ color }}
          >
            {d}
          </span>
        ))}
        <span
          className={`ml-1 self-end text-xs pb-1 ${dark ? "text-gray-500" : "text-gray-400"}`}
        >
          {unit}
        </span>
      </div>
    </div>
  );
};

/* ── Plain Number ────────────────────────────────────────── */

interface PlainNumberProps {
  value: number;
  label: string;
  unit: string;
  precision: number;
  color: string;
  dark: boolean;
}

const PlainNumber: FC<PlainNumberProps> = ({
  value,
  label,
  unit,
  precision,
  color,
  dark,
}) => (
  <div
    className={`flex flex-col items-center px-4 py-3 rounded-lg border ${
      dark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-gray-50"
    }`}
  >
    <span
      className={`text-xs font-medium mb-1 ${dark ? "text-gray-400" : "text-gray-600"}`}
    >
      {label}
    </span>
    <span className="text-2xl font-mono font-bold" style={{ color }}>
      {value.toFixed(precision)}
    </span>
    <span className={`text-xs ${dark ? "text-gray-500" : "text-gray-400"}`}>
      {unit}
    </span>
  </div>
);

/* ── Main Component ──────────────────────────────────────── */

const NumericalDisplay: FC<RendererProps> = ({
  config,
  state,
  model,
  dark = false,
}) => {
  const cfg = config as NumericalDisplayConfig;

  const scope: Record<string, number> = useMemo(
    () => ({
      ...state.variables,
      t: state.time,
      pi: Math.PI,
      e: Math.E,
    }),
    [state.variables, state.time],
  );

  const layoutClass =
    cfg.layout === "row"
      ? "flex flex-row flex-wrap gap-4 items-end justify-center"
      : cfg.layout === "column"
        ? "flex flex-col gap-4 items-center"
        : "grid grid-cols-2 sm:grid-cols-3 gap-4";

  // Resolve value and color for each display item
  const resolved = useMemo(() => {
    return cfg.displays.map((d) => {
      let value = 0;
      try {
        // Try evaluating from equations first
        const eq = model.equations.find(
          (eq) => eq.output_variable === d.variable,
        );
        if (eq) {
          value = Number(math.evaluate(eq.expression, scope));
        } else {
          value = scope[d.variable] ?? 0;
        }
      } catch {
        value = scope[d.variable] ?? 0;
      }

      // Determine color based on thresholds
      let color = dark ? "#10b981" : "#059669";
      if (d.thresholds && d.thresholds.length > 0) {
        // Sort thresholds descending so we pick the highest matching
        const sorted = [...d.thresholds].sort((a, b) => b.value - a.value);
        for (const thr of sorted) {
          if (value >= thr.value) {
            color = thr.color;
            break;
          }
        }
      }

      // Get min/max for gauge — derive from initial state or a sensible default
      const initialVal = model.initial_state?.[d.variable] ?? 0;
      const absMax = Math.max(Math.abs(value), Math.abs(initialVal), 1);
      const min = 0;
      // Set gauge max to the nearest "nice" ceiling above current and initial values
      const max =
        Math.ceil(
          (absMax * 1.5) / Math.pow(10, Math.floor(Math.log10(absMax))),
        ) * Math.pow(10, Math.floor(Math.log10(absMax))) || 100;

      return { ...d, value, color, min, max };
    });
  }, [cfg.displays, model.equations, scope, state.variables, dark]);

  return (
    <div className={`w-full h-full flex items-center justify-center p-6`}>
      <div className={layoutClass}>
        {resolved.map((d, i) => {
          switch (d.display_style) {
            case "gauge":
              return (
                <Gauge
                  key={i}
                  value={d.value}
                  min={d.min}
                  max={d.max}
                  label={d.label}
                  unit={d.unit}
                  precision={d.precision}
                  color={d.color}
                  dark={dark}
                />
              );
            case "counter":
              return (
                <Counter
                  key={i}
                  value={d.value}
                  label={d.label}
                  unit={d.unit}
                  precision={d.precision}
                  color={d.color}
                  dark={dark}
                />
              );
            case "number":
            default:
              return (
                <PlainNumber
                  key={i}
                  value={d.value}
                  label={d.label}
                  unit={d.unit}
                  precision={d.precision}
                  color={d.color}
                  dark={dark}
                />
              );
          }
        })}
      </div>
    </div>
  );
};

export default NumericalDisplay;
