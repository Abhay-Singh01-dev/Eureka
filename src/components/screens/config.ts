import type { ScreenConfig } from "./types";

// ============================================================
// 12-screen progressive disclosure configuration
// (Screen 1 includes embedded interactive question;
//  Screen 3 is the post-video Socratic dialogue)
// ============================================================

export const MOTION_SCREENS: ScreenConfig[] = [
  {
    id: 1,
    type: "welcome",
    unlockCondition: { type: "streaming_complete" },
    estimatedDuration: 35,
  },
  {
    id: 2,
    type: "video",
    unlockCondition: { type: "video_progress", threshold: 40 },
    estimatedDuration: 180,
  },
  {
    id: 3,
    type: "post_video_socratic",
    unlockCondition: { type: "answer_selected" },
    estimatedDuration: 120,
  },
  {
    id: 4,
    type: "text_diagram",
    unlockCondition: { type: "scroll_complete", threshold: 60 },
    estimatedDuration: 30,
  },
  {
    id: 5,
    type: "quick_check",
    unlockCondition: { type: "answer_selected" },
    estimatedDuration: 20,
  },
  {
    id: 6,
    type: "text_diagram",
    unlockCondition: { type: "scroll_complete", threshold: 60 },
    estimatedDuration: 40,
  },
  {
    id: 7,
    type: "socratic_dialogue",
    unlockCondition: { type: "answer_selected" },
    estimatedDuration: 60,
  },
  {
    id: 8,
    type: "simulation",
    unlockCondition: { type: "interaction_count", threshold: 2 },
    estimatedDuration: 45,
  },
  {
    id: 9,
    type: "text_examples",
    unlockCondition: { type: "scroll_complete", threshold: 60 },
    estimatedDuration: 50,
  },
  {
    id: 10,
    type: "summary",
    unlockCondition: { type: "scroll_complete", threshold: 60 },
    estimatedDuration: 30,
  },
  {
    id: 11,
    type: "reflection",
    unlockCondition: { type: "always" },
    estimatedDuration: 0,
  },
  {
    id: 12,
    type: "completion",
    unlockCondition: { type: "always" },
    estimatedDuration: 0,
  },
];
