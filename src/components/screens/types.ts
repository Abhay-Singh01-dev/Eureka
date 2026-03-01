// ============================================================
// Eureka – Screen System Types
// ============================================================

export type UnlockType =
  | "streaming_complete"
  | "video_progress"
  | "scroll_complete"
  | "interaction_count"
  | "answer_selected"
  | "always";

export interface UnlockCondition {
  type: UnlockType;
  threshold?: number;
}

export interface ScreenConfig {
  id: number;
  type: string;
  unlockCondition: UnlockCondition;
  estimatedDuration: number;
}

export interface ScreenProps {
  /** Reports progress 0-100 (or 0/1 for boolean conditions) */
  onProgressUpdate: (progress: number) => void;
  /** Whether this screen is currently visible / active */
  isActive: boolean;
}

export interface ScreenState {
  currentScreen: number;
  totalScreens: number;
  completedScreens: number[];
  continueUnlocked: boolean;
  isTransitioning: boolean;
}
