/* ──────────────────────────────────────────────────────────────
 *  ManimEngine — Core rendering engine for Manim-style animations
 *
 *  Handles:
 *   - Canvas 2D rendering pipeline (dark bg, clean shapes)
 *   - SVG/HTML overlay for LaTeX / text labels
 *   - Three.js scene for 3D elements (dynamic import)
 *   - Animation stepping with easing functions
 *   - Scene timeline management
 *   - Camera (pan/zoom) system
 *
 *  No eval() — all expressions evaluated via mathjs.
 *  No arbitrary JS injection.
 * ────────────────────────────────────────────────────────────── */

import * as math from "mathjs";
import type {
  ManimElement,
  ManimInstruction,
  ManimAnimationType,
  EasingFunction,
  CameraState,
  SceneRenderState,
  ManimColor,
  MANIM_COLORS,
} from "@/types/animation";
import { MANIM_BG, MANIM_GRID_COLOR } from "@/types/animation";

// ── Easing Functions ─────────────────────────────────────────

const EASING: Record<EasingFunction, (t: number) => number> = {
  linear: (t) => t,
  ease_in: (t) => t * t,
  ease_out: (t) => 1 - (1 - t) * (1 - t),
  ease_in_out: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  ease_in_cubic: (t) => t * t * t,
  ease_out_cubic: (t) => 1 - Math.pow(1 - t, 3),
  ease_in_out_cubic: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  ease_in_quint: (t) => t * t * t * t * t,
  ease_out_quint: (t) => 1 - Math.pow(1 - t, 5),
  ease_in_out_quint: (t) =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  spring: (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

export function getEasing(
  name: EasingFunction | string,
): (t: number) => number {
  return EASING[name as EasingFunction] ?? EASING.ease_in_out_cubic;
}

// ── Color Utilities ──────────────────────────────────────────

export function colorToCSS(
  c: ManimColor | undefined,
  fallback: string = "#ECECEC",
): string {
  if (!c) return fallback;
  const opacity = c.opacity ?? 1;
  if (opacity >= 1) return c.hex;
  // Convert hex + opacity to rgba
  const r = parseInt(c.hex.slice(1, 3), 16);
  const g = parseInt(c.hex.slice(3, 5), 16);
  const b = parseInt(c.hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function lerpColor(c1: string, c2: string, t: number): string {
  const parse = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });
  const a = parse(c1);
  const b = parse(c2);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

// ── World <-> Screen Coordinate Transforms ───────────────────

export interface WorldTransform {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

export function computeTransform(
  camera: CameraState,
  width: number,
  height: number,
  worldBounds?: { x: [number, number]; y: [number, number] },
): WorldTransform {
  const bounds = worldBounds ?? { x: [-8, 8], y: [-5, 5] };
  const worldW = bounds.x[1] - bounds.x[0];
  const worldH = bounds.y[1] - bounds.y[0];

  const pixPerUnitX = (width / worldW) * camera.zoom;
  const pixPerUnitY = (height / worldH) * camera.zoom;
  const scale = Math.min(pixPerUnitX, pixPerUnitY);

  return {
    offsetX: width / 2 - camera.center[0] * scale,
    offsetY: height / 2 + camera.center[1] * scale, // Y is flipped
    scaleX: scale,
    scaleY: -scale, // Flip Y for math coords
  };
}

export function worldToScreen(
  wx: number,
  wy: number,
  tf: WorldTransform,
): [number, number] {
  return [wx * tf.scaleX + tf.offsetX, wy * tf.scaleY + tf.offsetY];
}

// ── Safe Expression Evaluation ───────────────────────────────

export function safeEval(expr: string, scope: Record<string, number>): number {
  try {
    const val = math.evaluate(expr, { ...scope, pi: Math.PI, e: Math.E });
    return typeof val === "number" ? val : Number(val);
  } catch {
    return 0;
  }
}

// ── Element Creation Progress (for "create" / "draw" animations) ─

export interface ElementAnimState {
  /** 0 = invisible, 1 = fully visible */
  opacity: number;
  /** 0 = not started, 1 = fully drawn (for stroke drawing) */
  draw_progress: number;
  /** Position offset from animation */
  offset: [number, number];
  /** Scale multiplier from animation */
  scale_mult: number;
  /** Rotation offset from animation */
  rotation_offset: number;
  /** Color override */
  color_override?: string;
  /** Whether actively indicating (pulsing) */
  indicating: boolean;
}

const DEFAULT_ANIM_STATE: ElementAnimState = {
  opacity: 0,
  draw_progress: 0,
  offset: [0, 0],
  scale_mult: 1,
  rotation_offset: 0,
  indicating: false,
};

// ── Animation State Computer ─────────────────────────────────

export function computeElementStates(
  elements: ManimElement[],
  instructions: ManimInstruction[],
  currentTime: number,
): Map<string, ElementAnimState> {
  const states = new Map<string, ElementAnimState>();

  // Initialize all elements as invisible
  for (const el of elements) {
    states.set(el.id, { ...DEFAULT_ANIM_STATE });
  }

  // Process instructions in order of start_time
  const sorted = [...instructions].sort((a, b) => a.start_time - b.start_time);

  for (const inst of sorted) {
    const endTime = inst.start_time + inst.duration;
    const easeFn = getEasing(inst.easing);

    // Skip future instructions
    if (currentTime < inst.start_time) continue;

    // Compute progress (0–1)
    const rawProgress =
      inst.duration <= 0
        ? 1
        : Math.min(1, (currentTime - inst.start_time) / inst.duration);
    const progress = easeFn(rawProgress);

    for (const targetId of inst.targets) {
      const state = states.get(targetId);
      if (!state) continue;

      switch (inst.type) {
        case "create":
        case "draw":
          state.opacity = progress;
          state.draw_progress = progress;
          break;

        case "fade_in":
          state.opacity = progress;
          state.draw_progress = 1;
          break;

        case "fade_out":
          state.opacity = 1 - progress;
          break;

        case "move_to": {
          const to = inst.params.position ?? [0, 0];
          const from = inst.params.from ?? [0, 0];
          state.offset = [
            from[0] + (to[0] - from[0]) * progress,
            from[1] + (to[1] - from[1]) * progress,
          ];
          // Ensure visible
          if (state.opacity === 0) state.opacity = 1;
          if (state.draw_progress === 0) state.draw_progress = 1;
          break;
        }

        case "scale": {
          const from = inst.params.from_scale ?? 1;
          const to = inst.params.to_scale ?? inst.params.factor ?? 1.5;
          state.scale_mult = from + (to - from) * progress;
          if (state.opacity === 0) state.opacity = 1;
          if (state.draw_progress === 0) state.draw_progress = 1;
          break;
        }

        case "rotate": {
          const angle = inst.params.angle ?? Math.PI;
          state.rotation_offset = angle * progress;
          if (state.opacity === 0) state.opacity = 1;
          if (state.draw_progress === 0) state.draw_progress = 1;
          break;
        }

        case "indicate":
          state.indicating = rawProgress < 1;
          if (state.opacity === 0) state.opacity = 1;
          if (state.draw_progress === 0) state.draw_progress = 1;
          break;

        case "color_change": {
          const fromColor = inst.params.from_color ?? "#ECECEC";
          const toColor = inst.params.to_color ?? "#58C4DD";
          state.color_override = lerpColor(fromColor, toColor, progress);
          break;
        }

        case "transform":
        case "morph":
          // For morph, opacity ramps up
          state.opacity = Math.min(1, progress * 2);
          state.draw_progress = progress;
          if (state.opacity === 0) state.opacity = 1;
          break;

        case "wait":
          // Just maintain current state
          break;

        case "camera_move":
          // Handled at scene level, not per-element
          break;

        case "trace_path":
          state.draw_progress = progress;
          state.opacity = 1;
          break;

        case "wave_effect":
        case "particles":
        case "circumscribe":
          state.indicating = rawProgress < 1;
          if (state.opacity === 0) state.opacity = 1;
          if (state.draw_progress === 0) state.draw_progress = 1;
          break;

        case "group_anim":
          // Handled by recursion over sub-instructions
          if (state.opacity === 0) state.opacity = 1;
          if (state.draw_progress === 0) state.draw_progress = 1;
          break;
      }
    }
  }

  return states;
}

// ── Camera State Computer ────────────────────────────────────

export function computeCameraState(
  instructions: ManimInstruction[],
  currentTime: number,
  defaultCamera: CameraState,
): CameraState {
  let camera = { ...defaultCamera };

  for (const inst of instructions) {
    if (inst.type !== "camera_move") continue;
    if (currentTime < inst.start_time) continue;

    const progress = Math.min(
      1,
      inst.duration <= 0 ? 1 : (currentTime - inst.start_time) / inst.duration,
    );
    const easeFn = getEasing(inst.easing);
    const t = easeFn(progress);

    const fromCenter = inst.params.from_center ?? camera.center;
    const toCenter = inst.params.to_center ?? camera.center;
    const fromZoom = inst.params.from_zoom ?? camera.zoom;
    const toZoom = inst.params.to_zoom ?? camera.zoom;

    camera = {
      center: [
        fromCenter[0] + (toCenter[0] - fromCenter[0]) * t,
        fromCenter[1] + (toCenter[1] - fromCenter[1]) * t,
      ],
      zoom: fromZoom + (toZoom - fromZoom) * t,
    };
  }

  return camera;
}

// ── Canvas 2D Element Renderer ───────────────────────────────

export function drawElement(
  ctx: CanvasRenderingContext2D,
  element: ManimElement,
  animState: ElementAnimState,
  transform: WorldTransform,
): void {
  if (animState.opacity <= 0) return;

  ctx.save();

  // Apply opacity
  ctx.globalAlpha =
    animState.opacity *
    (animState.indicating ? 0.6 + 0.4 * Math.sin(Date.now() / 100) : 1);

  // Compute screen position
  const pos = element.position;
  const [sx, sy] = worldToScreen(
    pos[0] + animState.offset[0],
    pos[1] + animState.offset[1],
    transform,
  );

  ctx.translate(sx, sy);

  // Apply scale
  const totalScale = (element.scale ?? 1) * animState.scale_mult;
  ctx.scale(totalScale, totalScale);

  // Apply rotation
  const totalRotation = (element.rotation ?? 0) + animState.rotation_offset;
  if (totalRotation) ctx.rotate(totalRotation);

  // Set colors
  const strokeColor =
    animState.color_override ?? colorToCSS(element.stroke, "#ECECEC");
  const fillColor = colorToCSS(element.fill, "transparent");
  const lineWidth = element.stroke_width ?? 2;

  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = fillColor;
  ctx.lineWidth =
    (lineWidth / Math.abs(transform.scaleX)) * (totalScale > 0 ? 1 : -1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Draw based on type
  const props = element.props ?? {};
  const unitPx = Math.abs(transform.scaleX);

  switch (element.type) {
    case "dot": {
      const r = (props.radius ?? 0.08) * unitPx;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor; // Dots are filled with stroke color
      ctx.fill();
      break;
    }

    case "circle": {
      const r = (props.radius ?? 1) * unitPx;
      ctx.beginPath();
      if (animState.draw_progress < 1) {
        ctx.arc(0, 0, r, 0, Math.PI * 2 * animState.draw_progress);
      } else {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
      }
      if (fillColor !== "transparent") ctx.fill();
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      break;
    }

    case "rectangle": {
      const w = (props.width ?? 2) * unitPx;
      const h = (props.height ?? 1) * unitPx;
      if (animState.draw_progress < 1) {
        // Draw rectangle progressively (perimeter)
        const perim = 2 * (w + h);
        const drawn = perim * animState.draw_progress;
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2);
        let left = drawn;
        // Top
        const seg1 = Math.min(left, w);
        ctx.lineTo(-w / 2 + seg1, -h / 2);
        left -= seg1;
        if (left > 0) {
          ctx.lineTo(w / 2, -h / 2 + Math.min(left, h));
          left -= h;
        }
        if (left > 0) {
          ctx.lineTo(w / 2 - Math.min(left, w), h / 2);
          left -= w;
        }
        if (left > 0) {
          ctx.lineTo(-w / 2, h / 2 - Math.min(left, h));
        }
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      } else {
        if (fillColor !== "transparent") {
          ctx.fillRect(-w / 2, -h / 2, w, h);
        }
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
      }
      break;
    }

    case "line": {
      const x2 = (props.end?.[0] ?? 1) * unitPx;
      const y2 = (props.end?.[1] ?? 0) * -unitPx; // Flip Y
      ctx.beginPath();
      ctx.moveTo(0, 0);
      if (animState.draw_progress < 1) {
        ctx.lineTo(x2 * animState.draw_progress, y2 * animState.draw_progress);
      } else {
        ctx.lineTo(x2, y2);
      }
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      break;
    }

    case "arrow":
    case "vector": {
      const tip = props.end ?? props.direction ?? [1, 0];
      const ex = tip[0] * unitPx;
      const ey = tip[1] * -unitPx;
      const len = Math.sqrt(ex * ex + ey * ey);
      const prog = animState.draw_progress;
      const cx = ex * prog;
      const cy = ey * prog;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(cx, cy);
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // Arrow head
      if (prog > 0.8 && len > 5) {
        const headLen = Math.min(12, len * 0.2);
        const angle = Math.atan2(cy, cx);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx - headLen * Math.cos(angle - 0.4),
          cy - headLen * Math.sin(angle - 0.4),
        );
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx - headLen * Math.cos(angle + 0.4),
          cy - headLen * Math.sin(angle + 0.4),
        );
        ctx.stroke();
      }
      break;
    }

    case "arc": {
      const r = (props.radius ?? 1) * unitPx;
      const startAngle = props.start_angle ?? 0;
      const endAngle = props.end_angle ?? Math.PI;
      const drawEnd =
        startAngle + (endAngle - startAngle) * animState.draw_progress;
      ctx.beginPath();
      ctx.arc(0, 0, r, -startAngle, -drawEnd, true); // Negate for screen coords
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      break;
    }

    case "polygon": {
      const points: number[][] = props.points ?? [[0, 0]];
      if (points.length < 2) break;
      const totalPoints = Math.ceil(points.length * animState.draw_progress);
      ctx.beginPath();
      ctx.moveTo(points[0][0] * unitPx, points[0][1] * -unitPx);
      for (let i = 1; i < totalPoints; i++) {
        ctx.lineTo(points[i][0] * unitPx, points[i][1] * -unitPx);
      }
      if (animState.draw_progress >= 1 && fillColor !== "transparent") {
        ctx.closePath();
        ctx.fill();
      }
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      break;
    }

    case "axes": {
      const xRange = props.x_range ?? [-5, 5, 1];
      const yRange = props.y_range ?? [-5, 5, 1];
      const axisColor = strokeColor;

      ctx.lineWidth = 2;
      ctx.strokeStyle = axisColor;

      // X axis
      const xMin = xRange[0] * unitPx;
      const xMax = xRange[1] * unitPx * animState.draw_progress;
      ctx.beginPath();
      ctx.moveTo(xMin * animState.draw_progress, 0);
      ctx.lineTo(xMax, 0);
      ctx.stroke();

      // Y axis
      const yMin = yRange[0] * -unitPx;
      const yMax = yRange[1] * -unitPx * animState.draw_progress;
      ctx.beginPath();
      ctx.moveTo(0, yMin * animState.draw_progress);
      ctx.lineTo(0, yMax);
      ctx.stroke();

      // Tick marks (only when mostly drawn)
      if (animState.draw_progress > 0.6) {
        const tickAlpha = Math.min(1, (animState.draw_progress - 0.6) / 0.4);
        ctx.globalAlpha *= tickAlpha;
        ctx.lineWidth = 1;
        const xStep = xRange[2] ?? 1;
        const yStep = yRange[2] ?? 1;

        // X ticks
        for (let x = xRange[0]; x <= xRange[1]; x += xStep) {
          if (x === 0) continue;
          const px = x * unitPx;
          ctx.beginPath();
          ctx.moveTo(px, -4);
          ctx.lineTo(px, 4);
          ctx.stroke();
        }
        // Y ticks
        for (let y = yRange[0]; y <= yRange[1]; y += yStep) {
          if (y === 0) continue;
          const py = y * -unitPx;
          ctx.beginPath();
          ctx.moveTo(-4, py);
          ctx.lineTo(4, py);
          ctx.stroke();
        }
      }
      break;
    }

    case "graph": {
      const expr = props.expression;
      const xRange = props.x_range ?? [-5, 5];
      const samples = props.samples ?? 200;
      const graphColor = strokeColor;

      if (!expr) break;

      ctx.strokeStyle = graphColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      const totalSamples = Math.ceil(samples * animState.draw_progress);
      const dx = (xRange[1] - xRange[0]) / samples;
      let firstPoint = true;

      for (let i = 0; i <= totalSamples; i++) {
        const x = xRange[0] + i * dx;
        const y = safeEval(expr, { x, t: 0 });
        const px = x * unitPx;
        const py = y * -unitPx;

        if (isNaN(y) || !isFinite(y)) {
          firstPoint = true;
          continue;
        }

        if (firstPoint) {
          ctx.moveTo(px, py);
          firstPoint = false;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      break;
    }

    case "number_line": {
      const range = props.range ?? [-5, 5, 1];
      const length = (range[1] - range[0]) * unitPx;

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-length / 2, 0);
      ctx.lineTo(-length / 2 + length * animState.draw_progress, 0);
      ctx.stroke();

      // Ticks
      if (animState.draw_progress > 0.5) {
        const tickAlpha = (animState.draw_progress - 0.5) * 2;
        ctx.globalAlpha *= tickAlpha;
        const step = range[2] ?? 1;
        for (let v = range[0]; v <= range[1]; v += step) {
          const px = ((v - range[0]) / (range[1] - range[0]) - 0.5) * length;
          ctx.beginPath();
          ctx.moveTo(px, -5);
          ctx.lineTo(px, 5);
          ctx.stroke();
        }
      }
      break;
    }

    case "grid": {
      const gridRange = props.range ?? [-5, 5];
      const gridStep = props.step ?? 1;
      const gridColor = props.color ?? MANIM_GRID_COLOR;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha *= 0.3 * animState.opacity;

      for (let v = gridRange[0]; v <= gridRange[1]; v += gridStep) {
        const px = v * unitPx;
        const min = gridRange[0] * -unitPx;
        const max = gridRange[1] * -unitPx;
        // Vertical
        ctx.beginPath();
        ctx.moveTo(px, min);
        ctx.lineTo(px, max);
        ctx.stroke();
        // Horizontal
        ctx.beginPath();
        ctx.moveTo(gridRange[0] * unitPx, -v * unitPx + 0);
        ctx.lineTo(gridRange[1] * unitPx, -v * unitPx + 0);
        ctx.stroke();
      }
      break;
    }

    case "path": {
      // Custom SVG-like paths
      const paths: Array<{
        d: string;
        stroke: ManimColor;
        fill?: ManimColor;
        stroke_width: number;
      }> = props.paths ?? [];
      for (const p of paths) {
        ctx.strokeStyle = colorToCSS(p.stroke);
        ctx.fillStyle = p.fill ? colorToCSS(p.fill) : "transparent";
        ctx.lineWidth = p.stroke_width ?? 2;
        // Simple path parsing — support M, L, C, Q, Z
        const path2d = new Path2D(p.d);
        if (p.fill) ctx.fill(path2d);
        ctx.stroke(path2d);
      }
      break;
    }

    case "text":
    case "latex":
      // Text/LaTeX rendered via SVG overlay (not canvas)
      // This is a placeholder — actual rendering in the overlay component
      break;

    case "particle_system":
    case "wave":
    case "group":
      // Complex types handled by specific renderer components
      break;
  }

  ctx.restore();
}

// ── Subtle Background Grid ───────────────────────────────────

export function drawManimBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: WorldTransform,
  showGrid: boolean = true,
): void {
  // Dark background
  ctx.fillStyle = MANIM_BG;
  ctx.fillRect(0, 0, width, height);

  if (!showGrid) return;

  // Subtle grid
  ctx.strokeStyle = MANIM_GRID_COLOR;
  ctx.lineWidth = 0.5;
  const unitPx = Math.abs(transform.scaleX);

  if (unitPx < 5) return; // Skip grid if too zoomed out

  const step = unitPx;
  const startX = transform.offsetX % step;
  const startY = transform.offsetY % step;

  ctx.beginPath();
  for (let x = startX; x < width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = startY; y < height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

// ── Full Frame Renderer ──────────────────────────────────────

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: SceneRenderState,
  width: number,
  height: number,
  showGrid: boolean = true,
): void {
  const camera = state.camera;
  const transform = computeTransform(camera, width, height);

  // 1. Background
  drawManimBackground(ctx, width, height, transform, showGrid);

  // 2. Compute animation states for all elements
  const animStates = computeElementStates(
    state.elements,
    state.instructions,
    state.current_time,
  );

  // 3. Sort elements by z_index
  const sorted = [...state.elements].sort(
    (a, b) => (a.z_index ?? 0) - (b.z_index ?? 0),
  );

  // 4. Draw each element
  for (const element of sorted) {
    const animState = animStates.get(element.id) ?? DEFAULT_ANIM_STATE;
    drawElement(ctx, element, animState, transform);
  }
}

// ── Scene Transition Helpers ─────────────────────────────────

export function computeSceneTransition(
  currentScene: number,
  nextScene: number,
  progress: number,
): { opacity: number; offset: number } {
  // Crossfade transition
  if (currentScene < nextScene) {
    // Forward: slide left + fade
    return {
      opacity: 1 - progress,
      offset: -progress * 100,
    };
  } else {
    // Backward: slide right + fade
    return {
      opacity: 1 - progress,
      offset: progress * 100,
    };
  }
}

// All functions are exported inline via `export function`.
