/* ──────────────────────────────────────────────────────────────
 *  Eureka — Animation Builder Type Definitions
 *  Covers 9 phases: Blueprint → Scene Design → AI Generation →
 *  Engine → Timeline → Narration → Preview → Publish → Embedding
 *
 *  3B1B / Manim-style: dark backgrounds, smooth morphing,
 *  handwriting-style reveals, LaTeX overlays, clean typography.
 * ────────────────────────────────────────────────────────────── */

// ── Phase 1: Animation Blueprint ─────────────────────────────

export type AnimationSubject =
  | "Physics"
  | "Mathematics"
  | "Chemistry"
  | "Biology"
  | "Custom";

export type AnimationType =
  | "Process"
  | "Transformation"
  | "Comparison"
  | "Phenomenon";

export type SceneStructure =
  | "single"
  | "multi_scene"
  | "step_reveal"
  | "before_after";

export type RevealStrategy =
  | "gradual_constraint_build"
  | "counterexample_resolution"
  | "intuition_formalization"
  | "visual_first_equation_later"
  | "equation_first_geometric"
  | "direct_demonstration"
  | "comparative_contrast";

export type SceneRole =
  | "introduce_tension"
  | "build_structure"
  | "show_counterexample"
  | "reveal_constraint"
  | "formalize_equation"
  | "generalize"
  | "compress_insight"
  | "recap"
  | "highlight_invariant"
  | "translate_representation";

export type RevealPace = "fast" | "moderate" | "slow";

export interface AnimationBlueprint {
  title: string;
  subject: AnimationSubject;
  concept_description: string;
  /** Cognitive depth 1–7 (maps to ToneEngine depth gating) */
  target_depth: number;
  animation_type: AnimationType;
  scene_structure: SceneStructure;
  /** 1 for single, 2–6 for multi */
  scene_count: number;
  /** What confusion / paradox / structural question should this animation resolve? */
  core_tension?: string;
  /** What should feel inevitable at the end? */
  compression_goal?: string;
  /** How the revelation arc unfolds across scenes */
  reveal_strategy?: RevealStrategy;
}

// ── Phase 2: Scene Configuration ─────────────────────────────

export type VisualType =
  | "2d_graph"
  | "vector_field"
  | "grid_transformation"
  | "particle_motion"
  | "wave_propagation"
  | "circuit_flow"
  | "custom_drawing";

export type NarrationType = "ai_narration" | "custom_text" | "silent";

export interface AnimationScene {
  id: string;
  scene_number: number;
  visual_type: VisualType;
  description: string;
  duration_seconds: number;
  highlight_focus?: string;
  narration_type: NarrationType;
  /** Cognitive role of this scene in the animation arc */
  scene_role?: SceneRole;
  /** Controls equation timing, buildup density, narration pauses */
  reveal_pace?: RevealPace;
  /** AI-generated or teacher-authored content */
  generated_content?: GeneratedSceneContent;
  /** Teacher-entered custom narration text */
  custom_narration?: string;
  /** Manim-style visual elements for this scene */
  visual_elements?: ManimElement[];
}

// ── Phase 3: AI-Generated Scene Content ──────────────────────

export interface GeneratedSceneContent {
  animation_instructions: string;
  narration_text?: string;
  key_visual_elements: string[];
  emphasis_points: string[];
  /** Manim element primitives produced by AI */
  visual_elements?: ManimElement[];
  /** Manim-inspired animation sequence instructions */
  manim_sequence?: ManimInstruction[];
  /** Narration segments produced by Phase 6 refinement */
  narration_segments?: NarrationSegment[];
}

// ── Manim-style Visual Primitives ────────────────────────────

export type ManimElementType =
  | "axes"
  | "graph"
  | "arrow"
  | "vector"
  | "dot"
  | "circle"
  | "rectangle"
  | "line"
  | "arc"
  | "polygon"
  | "text"
  | "latex"
  | "number_line"
  | "grid"
  | "particle_system"
  | "wave"
  | "path"
  | "group";

export interface ManimColor {
  hex: string;
  opacity?: number;
}

export interface ManimElement {
  id: string;
  type: ManimElementType;
  /** Position in world coordinates [x, y] or [x, y, z] */
  position: number[];
  /** Scale factor */
  scale?: number;
  /** Rotation in radians */
  rotation?: number;
  /** Stroke/fill colors */
  stroke?: ManimColor;
  fill?: ManimColor;
  stroke_width?: number;
  /** Type-specific properties */
  props: Record<string, any>;
  /** Z-index for layer ordering */
  z_index?: number;
  /** Whether this element participates in 3D scene */
  is_3d?: boolean;
}

// ── Animation Instructions ───────────────────────────────────

export type ManimAnimationType =
  | "create" // Draw/write into existence
  | "fade_in" // Opacity 0→1
  | "fade_out" // Opacity 1→0
  | "transform" // Morph from one state to another
  | "move_to" // Slide to position
  | "scale" // Grow/shrink
  | "rotate" // Rotation animation
  | "draw" // Stroke drawing (handwriting style)
  | "indicate" // Flash/pulse highlight
  | "circumscribe" // Draw circle around
  | "wait" // Pause
  | "camera_move" // Pan/zoom camera
  | "color_change" // Animate color transition
  | "morph" // Shape morphing
  | "trace_path" // Animate along a path
  | "wave_effect" // Ripple/wave distortion
  | "particles" // Particle emission burst
  | "group_anim"; // Sequential/parallel group

export type EasingFunction =
  | "linear"
  | "ease_in"
  | "ease_out"
  | "ease_in_out"
  | "ease_in_cubic"
  | "ease_out_cubic"
  | "ease_in_out_cubic"
  | "ease_in_quint"
  | "ease_out_quint"
  | "ease_in_out_quint"
  | "spring";

export interface ManimInstruction {
  type: ManimAnimationType;
  /** Target element ID(s) */
  targets: string[];
  /** Duration in seconds */
  duration: number;
  /** When to start (seconds from scene start) */
  start_time: number;
  /** Easing function */
  easing: EasingFunction;
  /** Animation-specific parameters */
  params: Record<string, any>;
}

// ── Custom Drawing ───────────────────────────────────────────

export interface CustomPath {
  /** SVG-style path data: M, L, C, Q, Z commands */
  d: string;
  stroke: ManimColor;
  fill?: ManimColor;
  stroke_width: number;
}

export interface CustomDrawingElement extends ManimElement {
  type: "path";
  props: {
    paths: CustomPath[];
    label?: string;
  };
}

// ── Narration Layer ──────────────────────────────────────────

export interface NarrationSegment {
  text: string;
  start_time: number;
  end_time: number;
  /** Position on screen */
  position: "bottom" | "top" | "center" | "subtitle";
  /** Style gated by depth */
  style: "plain" | "standard" | "elegant";
}

// ── Camera System ────────────────────────────────────────────

export interface CameraState {
  /** Center position [x, y] or [x, y, z] */
  center: number[];
  /** Zoom level (1 = default) */
  zoom: number;
  /** Camera rotation (radians, for 3D) */
  rotation?: number[];
}

// ── Complete Scene Runtime State ─────────────────────────────

export interface SceneRenderState {
  scene_id: string;
  current_time: number;
  total_duration: number;
  elements: ManimElement[];
  instructions: ManimInstruction[];
  camera: CameraState;
  narration?: NarrationSegment[];
  is_playing: boolean;
  is_3d: boolean;
}

// ── Animation Document (MongoDB) ─────────────────────────────

export interface AnimationDocument {
  _id?: string;
  blueprint: AnimationBlueprint;
  scenes: AnimationScene[];
  /** Total duration across all scenes (computed) */
  total_duration: number;
  /** Dignity score from filter (0–1) */
  dignity_score?: number;
  status: "draft" | "ready" | "published";
  created_by: string;
  created_at: string;
  updated_at?: string;
}

// ── Shared Renderer Props ────────────────────────────────────

export interface AnimationRendererProps {
  scene: AnimationScene;
  renderState: SceneRenderState;
  width: number;
  height: number;
  dark?: boolean;
  onTimeUpdate?: (time: number) => void;
}

// ── Wizard Step Data ─────────────────────────────────────────

export interface WizardStep1Data {
  title: string;
  subject: AnimationSubject;
  concept_description: string;
  target_depth: number;
  animation_type: AnimationType;
}

export interface WizardStep2Data {
  scene_structure: SceneStructure;
  scene_count: number;
}

// ── Manim Theme Constants ────────────────────────────────────

export const MANIM_COLORS = {
  // 3B1B palette
  BLUE: "#58C4DD",
  TEAL: "#5CD0B3",
  GREEN: "#83C167",
  YELLOW: "#FFFF00",
  GOLD: "#F0AC5F",
  RED: "#FC6255",
  MAROON: "#C55F73",
  PURPLE: "#9A72AC",
  PINK: "#D147BD",
  ORANGE: "#FF862F",
  WHITE: "#ECECEC",
  GRAY: "#888888",
  DARK_GRAY: "#444444",
  // Background
  BG_DARK: "#1C1C2E",
  BG_DARKER: "#141422",
  // Accent
  ACCENT_BLUE: "#3B82F6",
  ACCENT_EMERALD: "#10B981",
} as const;

export const MANIM_BG = "#1C1C2E";
export const MANIM_GRID_COLOR = "rgba(88, 196, 221, 0.08)";
