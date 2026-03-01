// ============================================================
// Custom Module — TypeScript Types
// ============================================================

// ── Phase A: Wizard Data ──

export type SubjectArea =
  | "Physics"
  | "Mathematics"
  | "Chemistry"
  | "Biology"
  | "Custom";

export type DifficultyLevel =
  | "Foundational"
  | "Intermediate"
  | "Advanced"
  | "Cross-disciplinary";

export type TeachingStyle =
  | "Concept-first"
  | "Example-first"
  | "Simulation-first"
  | "Problem-first";

export type SocraticIntensity = "Light" | "Moderate" | "Deep";

export type BeautyPermission = "Minimal" | "Balanced" | "Depth-gated Cinematic";

export type TargetAgeGroup =
  | "Middle School"
  | "High School"
  | "University"
  | "Adult Learner";

export interface ConceptScope {
  module_title: string;
  subject: SubjectArea;
  difficulty_level: DifficultyLevel;
  assumed_prerequisites: string[];
  estimated_duration_minutes: number;
  regional_context?: string;
  target_age_group?: TargetAgeGroup;
}

export interface LearningObjectives {
  conceptual_understanding: string[];
  mathematical_skills?: string[];
  real_world_applications?: string[];
  common_misconceptions?: string[];
}

export interface CognitiveDesign {
  teaching_style: TeachingStyle;
  socratic_intensity: SocraticIntensity;
  allowed_depth_range: {
    min: number; // 1-7
    max: number; // 1-7
  };
  beauty_permission: BeautyPermission;
}

// ── Phase B: Node Graph ──

export interface GeneratedNode {
  id: string;
  title: string;
  description: string;
  depth_level: number;
  addresses_misconception?: string[];
  prerequisites: string[]; // node IDs
  emoji?: string;
  estimated_time?: string;
  discover_points?: string[];
}

export interface NodeEdge {
  from: string;
  to: string;
}

export interface NodeGraph {
  nodes: GeneratedNode[];
  edges: NodeEdge[];
}

// ── Full Custom Module ──

export interface CustomModule {
  id: string;
  blueprint: ConceptScope;
  objectives: LearningObjectives;
  cognitive_design: CognitiveDesign;
  node_graph: NodeGraph;
  /** Per-node content keyed by node ID */
  node_contents?: Record<string, NodeContent>;
  /** Whether the module has been published (all safeguards passed) */
  published?: boolean;
  created_by: string;
  created_at: number;
}

// ── Wizard State ──

export type WizardStep = 1 | 2 | 3;

export interface WizardState {
  currentStep: WizardStep;
  conceptScope: Partial<ConceptScope>;
  learningObjectives: Partial<LearningObjectives>;
  cognitiveDesign: Partial<CognitiveDesign>;
}

// ── Phase C: Node Content Builder ──

export type EntryStyle =
  | "short_explanation"
  | "question_first"
  | "simulation_first"
  | "real_world_example"
  | "video_first";

export type BlockType =
  | "entry"
  | "explanation"
  | "micro_question"
  | "simulation"
  | "animation"
  | "quiz"
  | "video";

/**
 * Experience type determines the overall structure of a node's content.
 * - focused_concept: Single stage, deep dive into one idea
 * - multi_stage: 2–10 sequential stages, each with its own entry style
 * - simulation_led: Single stage, simulation-first flow
 * - dialogue_based: Single stage, Socratic dialogue flow
 */
export type ExperienceType =
  | "focused_concept"
  | "multi_stage"
  | "simulation_led"
  | "dialogue_based";

export interface ContentBlock {
  id: string;
  type: BlockType;
  content: string;
  /** Whether this block can be deleted (entry block cannot) */
  locked?: boolean;
}

export interface NodeScaffold {
  entry_block: {
    type: EntryStyle;
    content: string;
  };
  explanation_block?: string;
  micro_questions?: string[];
  misconception_probe?: string;
  simulation_suggestion?: string;
  quiz_prompt?: string;
  depth_hint: number;
  dignity_score?: number;
  dignity_warning?: string;
}

/** Content for a single stage within a node */
export interface StageContent {
  stage_number: number;
  entry_style: EntryStyle;
  blocks: ContentBlock[];
}

/**
 * Node content — multi-stage aware.
 * For focused_concept / simulation_led / dialogue_based: stages has 1 entry.
 * For multi_stage: stages has 2–10 entries.
 *
 * Backward compat: if `stages` is missing but `blocks` exists,
 * treat as focused_concept with 1 stage.
 */
export interface NodeContent {
  experience_type: ExperienceType;
  stages: StageContent[];
  last_modified: number;
  /** @deprecated — kept for backward compat migration only */
  entry_style?: EntryStyle;
  /** @deprecated — kept for backward compat migration only */
  blocks?: ContentBlock[];
}

/** Migrate old flat NodeContent to stage-based structure */
export function migrateNodeContent(raw: any): NodeContent {
  if (raw.stages && Array.isArray(raw.stages)) {
    return raw as NodeContent;
  }
  // Legacy flat format → single stage
  return {
    experience_type: "focused_concept",
    stages: [
      {
        stage_number: 1,
        entry_style: raw.entry_style || "short_explanation",
        blocks: raw.blocks || [],
      },
    ],
    last_modified: raw.last_modified || Date.now(),
  };
}

export interface PublishValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
