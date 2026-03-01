/* ──────────────────────────────────────────────────────────────
 *  Eureka — Simulation Builder Type Definitions
 *  Covers all 7 phases: Blueprint → Engine → Renderer →
 *  Cognitive Overlay → Student Preview → Publish → Embedding
 * ────────────────────────────────────────────────────────────── */

// ── Phase 1: Blueprint Wizard ────────────────────────────────

export type SimulationCategory =
  | "mechanics"
  | "waves"
  | "thermodynamics"
  | "electromagnetism"
  | "optics"
  | "circuits"
  | "fluid_dynamics"
  | "quantum"
  | "chemistry"
  | "biology"
  | "mathematics"
  | "economics"
  | "custom";

export type RendererType =
  | "graph"
  | "animated_object"
  | "numerical_display"
  | "vector_field"
  | "circuit_diagram"
  | "grid_transform";

export type DifficultyLevel =
  | "introductory"
  | "intermediate"
  | "advanced"
  | "research";

export interface SimulationVariable {
  name: string;
  symbol: string;
  unit: string;
  min: number;
  max: number;
  default_value: number;
  step: number;
  /** true = student can adjust this with a slider */
  is_input: boolean;
  /** optional display color for charts/renderers */
  color?: string;
}

export interface SimulationBlueprint {
  title: string;
  subject: string;
  topic: string;
  description: string;
  category: SimulationCategory;
  renderer_type: RendererType;
  difficulty: DifficultyLevel;
  variables: SimulationVariable[];
  target_audience: string;
  learning_goal: string;
  /** Optional free-text constraints the teacher wants enforced */
  constraints?: string;
}

// ── Phase 2: Engine Generation (AI-produced) ─────────────────

export interface SimulationEquation {
  /** Human-readable label, e.g. "Vertical position" */
  label: string;
  /** mathjs-safe expression, e.g. "v0*sin(theta)*t - 0.5*g*t^2" */
  expression: string;
  /** Which output variable this computes */
  output_variable: string;
  /** LaTeX for display: "y = v_0 \\sin\\theta \\cdot t - \\tfrac12 g t^2" */
  latex?: string;
}

export interface SimulationModel {
  equations: SimulationEquation[];
  /** Initial values for all state variables */
  initial_state: Record<string, number>;
  /** For time-dependent sims: dt in seconds */
  time_step: number;
  /** Whether sim evolves with time or is purely parametric */
  time_dependent: boolean;
  /** Max simulation time in seconds (for time-dependent) */
  max_time?: number;
  /** Update rules for time-stepping (mathjs expressions) */
  update_rules?: {
    variable: string;
    expression: string;
  }[];
}

// ── Phase 3: Renderer Configuration ─────────────────────────

export interface GraphRendererConfig {
  type: "graph";
  x_axis: { variable: string; label: string; unit: string };
  y_axes: {
    variable: string;
    label: string;
    unit: string;
    color: string;
  }[];
  /** Number of sample points for parametric plots */
  sample_count: number;
  show_grid: boolean;
  show_legend: boolean;
}

export interface AnimatedObjectConfig {
  type: "animated_object";
  /** 2d or 3d rendering */
  dimension: "2d" | "3d";
  objects: {
    id: string;
    shape: "circle" | "rect" | "arrow" | "spring" | "pendulum" | "custom_path";
    /** mathjs expressions for position, e.g. { x: "v0*cos(theta)*t", y: "..." } */
    position: { x: string; y: string; z?: string };
    size: number;
    color: string;
    trail?: boolean;
  }[];
  /** World bounds in simulation units */
  bounds: {
    x: [number, number];
    y: [number, number];
    z?: [number, number];
  };
  /** Whether to show coordinate axes */
  show_axes: boolean;
  /** Background color */
  background: string;
}

export interface NumericalDisplayConfig {
  type: "numerical_display";
  displays: {
    variable: string;
    label: string;
    unit: string;
    /** Number of decimal places */
    precision: number;
    /** Optional color thresholds */
    thresholds?: {
      value: number;
      color: string;
    }[];
    /** Show as gauge, counter, or plain number */
    display_style: "gauge" | "counter" | "number";
  }[];
  layout: "grid" | "row" | "column";
}

export interface VectorFieldConfig {
  type: "vector_field";
  /** mathjs expressions for field components */
  field: {
    fx: string;
    fy: string;
  };
  /** Grid resolution (arrows per row/col) */
  resolution: number;
  bounds: {
    x: [number, number];
    y: [number, number];
  };
  /** Color mode: magnitude-based or uniform */
  color_mode: "magnitude" | "uniform";
  uniform_color?: string;
  /** Whether to normalize arrow lengths */
  normalize: boolean;
  show_grid: boolean;
}

export interface CircuitComponent {
  id: string;
  type:
    | "resistor"
    | "capacitor"
    | "inductor"
    | "battery"
    | "switch"
    | "wire"
    | "bulb"
    | "ammeter"
    | "voltmeter"
    | "ground";
  /** Label, e.g. "R1", "C2" */
  label: string;
  /** Value with unit, e.g. "10 kΩ" */
  value: string;
  /** Grid position for layout */
  position: { row: number; col: number };
  /** Orientation */
  rotation: 0 | 90 | 180 | 270;
  /** Connected node IDs */
  connections: string[];
}

export interface CircuitDiagramConfig {
  type: "circuit_diagram";
  components: CircuitComponent[];
  /** Grid size for layout */
  grid: { rows: number; cols: number };
  /** Computed values to display (voltage, current, power per component) */
  computed_values: {
    component_id: string;
    voltage?: string;
    current?: string;
    power?: string;
  }[];
  /** Whether to show current flow animation */
  animate_current: boolean;
}

export interface GridTransformConfig {
  type: "grid_transform";
  /** mathjs expression for the transformation matrix, e.g. "[[cos(theta), -sin(theta)], [sin(theta), cos(theta)]]" */
  matrix_expression: string;
  /** Grid bounds */
  bounds: { x: [number, number]; y: [number, number] };
  /** Grid line count */
  grid_lines: number;
  /** Show basis vectors */
  show_basis_vectors: boolean;
  /** Show eigenvectors if real */
  show_eigenvectors: boolean;
  /** Additional points to track through the transform */
  tracked_points?: { x: number; y: number; label: string }[];
  /** Color for original grid vs transformed grid */
  original_color: string;
  transformed_color: string;
}

export type RendererConfig =
  | GraphRendererConfig
  | AnimatedObjectConfig
  | NumericalDisplayConfig
  | VectorFieldConfig
  | CircuitDiagramConfig
  | GridTransformConfig;

// ── Phase 4: Cognitive Overlay (AI-produced) ─────────────────

export interface SimulationGuidance {
  /** Prompt shown before sim starts: "What do you think will happen if…?" */
  hypothesis_prompt: string;
  /** Prompts shown at key moments during simulation */
  observation_prompts: {
    trigger: "time" | "variable_threshold" | "manual";
    /** For time triggers: seconds; for variable: { variable, operator, value } */
    condition?: {
      variable?: string;
      operator?: ">" | "<" | ">=" | "<=" | "==";
      value?: number;
      time?: number;
    };
    prompt: string;
  }[];
  /** Summary insight after exploration */
  insight_summary: string;
  /** Common misconceptions to detect/flag */
  misconception_alerts: {
    misconception: string;
    correction: string;
    /** Variable conditions that suggest this misconception is triggered */
    trigger_hint?: string;
  }[];
  /** Challenge explorations: "Try setting X to 0. What happens?" */
  exploration_challenges: {
    challenge: string;
    hint?: string;
    expected_behavior: string;
  }[];
}

// ── Phase 5 / 6: Full Document ──────────────────────────────

export type SimulationStatus = "draft" | "generating" | "ready" | "published";

export interface SimulationDocument {
  _id: string;
  user_id: string;
  blueprint: SimulationBlueprint;
  model: SimulationModel | null;
  renderer_config: RendererConfig | null;
  guidance: SimulationGuidance | null;
  status: SimulationStatus;
  /** Optional module ID if embedded via SimulationBlock */
  embedded_in_module?: string;
  /** Optional node ID within the module */
  embedded_in_node?: string;
  created_at: string;
  updated_at: string;
}

// ── Phase 7: Embedding ──────────────────────────────────────

/** Stored inside a ContentBlock with type "simulation" */
export interface SimulationBlockData {
  simulation_id: string;
  /** Inline snapshot so the block works even before the sim is fully loaded */
  title: string;
  renderer_type: RendererType;
  /** Whether to show cognitive overlay in the embedded view */
  show_guidance: boolean;
}

// ── Runtime Types (frontend only) ────────────────────────────

export interface SimulationState {
  /** Current values of all variables */
  variables: Record<string, number>;
  /** Current simulation time (for time-dependent sims) */
  time: number;
  /** Is the simulation running? */
  running: boolean;
  /** Playback speed multiplier */
  speed: number;
  /** Data history for graphs */
  history: Record<string, number>[];
  /** Maximum history length */
  max_history: number;
}

/** Props shared by all renderer components */
export interface RendererProps {
  config: RendererConfig;
  state: SimulationState;
  model: SimulationModel;
  /** Callback when user adjusts a variable slider */
  onVariableChange: (variable: string, value: number) => void;
  /** Width/height of the renderer viewport */
  width: number;
  height: number;
  /** Dark mode */
  dark?: boolean;
}

// ── Wizard step data ────────────────────────────────────────

export interface WizardStep1Data {
  title: string;
  subject: string;
  topic: string;
  description: string;
  category: SimulationCategory;
}

export interface WizardStep2Data {
  renderer_type: RendererType;
  difficulty: DifficultyLevel;
  target_audience: string;
  learning_goal: string;
  constraints: string;
}

export interface WizardStep3Data {
  variables: SimulationVariable[];
}
