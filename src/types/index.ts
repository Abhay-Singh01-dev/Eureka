// ============================================================
// Eureka – Shared TypeScript Types
// ============================================================

// ---- Chat / Messaging ----

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  equations?: string[];
  hasVisualization?: boolean;
  visualizationType?: "video" | "simulation" | null;
}

// ---- Concept Map ----

export type NodeState = "completed" | "unlocked" | "locked";

export type NodeType =
  | "foundation"
  | "connection"
  | "power"
  | "synthesis"
  | "challenge";

export interface NodeContent {
  welcomeMessage: string;
  videoTitle: string;
  videoDuration: string;
  reflectionQuestion: string;
}

export interface ConceptNodeData {
  id: number;
  emoji: string;
  title: string;
  type: NodeType;
  state: NodeState;
  prerequisites: number[];
  unlocks: number[];
  estimatedTime: string;
  position: { x: number; y: number };
  content: NodeContent;
}

export interface NodeConnection {
  from: number;
  to: number;
}

export interface Progress {
  completedNodes: number | number[];
  currentNode?: number;
  totalNodes: number;
  progressPercentage: number;
}

// ---- Sidebar / Modules ----

export interface Chapter {
  id: string;
  name: string;
  icon: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_date: Date;
}

export type SubjectKey = "physics" | "mathematics" | "chemistry" | "biology";

export type ModulesData = Record<SubjectKey, Chapter[]>;

// ---- Theme ----

export type Theme = "light" | "dark" | "system";

// ---- Chemistry Builder ----

export interface ChemElement {
  symbol: string;
  name: string;
  number: number;
  type: "metal" | "nonmetal" | "metalloid" | "noble";
}

export interface ChemCompound {
  formula: string;
  name: string;
}

export interface ReactionSymbol {
  symbol: string;
  name: string;
}

// ---- Equation Builder ----

export interface EquationTemplate {
  label: string;
  latex: string;
}

export interface EquationTab {
  id: string;
  label: string;
}

// ---- Complexity ----

export type ComplexityLevel = "simple" | "balanced" | "advanced";

export interface ComplexityOption {
  id: ComplexityLevel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

// ---- Pages Config ----

export interface PagesConfig {
  mainPage: string;
  Pages: Record<string, React.ComponentType>;
  Layout?: React.ComponentType<{
    currentPageName: string;
    children: React.ReactNode;
  }>;
}
