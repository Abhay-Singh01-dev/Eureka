// ============================================================
// GraphRenderer — 2D plot renderer using Recharts
// ============================================================

import React, { useMemo, type FC } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from "recharts";
import * as math from "mathjs";
import type { RendererProps, GraphRendererConfig } from "@/types/simulation";

const GraphRenderer: FC<RendererProps> = ({
  config,
  state,
  model,
  width,
  height,
  dark = false,
}) => {
  const cfg = config as GraphRendererConfig;

  // Generate data for the chart
  const data = useMemo(() => {
    if (model.time_dependent && state.history.length > 0) {
      // Use history data for time-dependent sims
      return state.history
        .map((h) => {
          const point: Record<string, number> = {};
          point[cfg.x_axis.variable] = h[cfg.x_axis.variable] ?? h.t ?? 0;
          for (const yAxis of cfg.y_axes) {
            const val = h[yAxis.variable] ?? 0;
            point[yAxis.variable] = Number.isFinite(val) ? val : 0;
          }
          return point;
        })
        .filter((p) =>
          cfg.y_axes.some((yAxis) => Number.isFinite(p[yAxis.variable])),
        );
    }

    // For parametric sims, sweep the x variable
    const xVar = cfg.x_axis.variable;
    const xMin =
      state.variables[`${xVar}_min`] ??
      (model.initial_state[`${xVar}_min`] as number) ??
      0;
    const xMax =
      state.variables[`${xVar}_max`] ??
      (model.initial_state[`${xVar}_max`] as number) ??
      10;

    const points: Record<string, number>[] = [];
    const n = cfg.sample_count || 200;

    for (let i = 0; i <= n; i++) {
      const xVal = xMin + (i / n) * (xMax - xMin);
      const scope: Record<string, number> = {
        ...state.variables,
        [xVar]: xVal,
        pi: Math.PI,
        e: Math.E,
      };

      const point: Record<string, number> = { [xVar]: xVal };

      for (const eq of model.equations) {
        try {
          const val = math.evaluate(eq.expression, scope);
          point[eq.output_variable] =
            typeof val === "number" ? val : Number(val);
          scope[eq.output_variable] = point[eq.output_variable];
        } catch {
          point[eq.output_variable] = 0;
        }
      }

      // Only keep y-axis variables
      for (const yAxis of cfg.y_axes) {
        if (!(yAxis.variable in point)) {
          point[yAxis.variable] = 0;
        }
      }

      points.push(point);
    }

    return points;
  }, [cfg, state, model]);

  const gridColor = dark ? "#374151" : "#e5e7eb";
  const textColor = dark ? "#9ca3af" : "#6b7280";
  const bgColor = dark ? "#111827" : "#ffffff";

  return (
    <div className="w-full h-full" style={{ background: bgColor }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          {cfg.show_grid && (
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          )}
          <XAxis
            dataKey={cfg.x_axis.variable}
            tick={{ fill: textColor, fontSize: 11 }}
            label={{
              value: `${cfg.x_axis.label} (${cfg.x_axis.unit})`,
              position: "insideBottom",
              offset: -10,
              fill: textColor,
              fontSize: 12,
            }}
            stroke={gridColor}
          />
          <YAxis tick={{ fill: textColor, fontSize: 11 }} stroke={gridColor} />
          <Tooltip
            contentStyle={{
              background: dark ? "#1f2937" : "#ffffff",
              border: `1px solid ${gridColor}`,
              borderRadius: 8,
              fontSize: 12,
              color: dark ? "#e5e7eb" : "#111827",
            }}
          />
          {cfg.show_legend && (
            <Legend wrapperStyle={{ fontSize: 12, color: textColor }} />
          )}
          {cfg.y_axes.map((yAxis) => (
            <Line
              key={yAxis.variable}
              type="monotone"
              dataKey={yAxis.variable}
              name={`${yAxis.label} (${yAxis.unit})`}
              stroke={yAxis.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GraphRenderer;
