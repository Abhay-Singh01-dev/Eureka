// ============================================================
// Motion & Forces — Node Metadata Configuration
// Central source of truth for the concept map.
// Future modules add their own file; ConceptMapView is generic.
// ============================================================

export interface ConceptNode {
  id: number;
  title: string;
  /** Short sentence shown as fallback description */
  description: string;
  /** Bullet points shown under "You'll discover:" in the tooltip */
  discoverPoints: string[];
  estimatedTime: string;
  /** Contextual note shown below the time (e.g. prerequisites, encouragement) */
  contextNote: string;
  /** Optional follow-up line (e.g. "Related to: X, Y" or "Builds on: Z") */
  relatedContent?: string;
  relatedNodeIds: number[];
  position: {
    x: number;
    y: number;
  };
}

export const motionForcesNodes: ConceptNode[] = [
  {
    id: 1,
    title: "What is Motion?",
    description:
      "Understand how objects change position over time and why reference frames matter.",
    discoverPoints: [
      'Why nothing is truly "still"',
      "How motion depends on your viewpoint",
      'What Einstein meant by "relative motion"',
    ],
    estimatedTime: "~5 min",
    contextNote: "Great starting point! No prerequisites needed.",
    relatedContent: undefined,
    relatedNodeIds: [],
    position: { x: 50, y: 10 },
  },
  {
    id: 2,
    title: "What is a Force?",
    description: "Explore forces as interactions that cause changes in motion.",
    discoverPoints: [
      "Why pushing and pulling are the same thing",
      "How forces can act without touching",
      "What makes things start, stop, or change direction",
    ],
    estimatedTime: "~6 min",
    contextNote: "Perfect second step after exploring motion!",
    relatedContent: "Related to: What is Motion?, Types of Forces",
    relatedNodeIds: [1, 4],
    position: { x: 75, y: 40 },
  },
  {
    id: 3,
    title: "Speed & Velocity",
    description:
      "Differentiate scalar and vector motion and understand direction.",
    discoverPoints: [
      "Why 60 mph North ≠ 60 mph South",
      "The hidden power of direction",
      "How vectors change everything in physics",
    ],
    estimatedTime: "~7 min",
    contextNote: "Builds on: What is Motion?",
    relatedContent:
      "Connects to: Understanding Acceleration, Newton's Three Laws",
    relatedNodeIds: [1, 5, 6],
    position: { x: 25, y: 30 },
  },
  {
    id: 4,
    title: "Types of Forces",
    description: "Learn about gravity, friction, tension, and normal force.",
    discoverPoints: [
      "Why objects fall differently on Earth vs. Moon",
      "How friction can be helpful AND harmful",
      "What tension really means in a rope",
      'Why normal force isn\'t "normal" at all',
    ],
    estimatedTime: "~9 min",
    contextNote: "Builds on: What is a Force?",
    relatedContent: "Unlocks deeper understanding of: Newton's Three Laws",
    relatedNodeIds: [2, 6],
    position: { x: 25, y: 60 },
  },
  {
    id: 5,
    title: "Understanding Acceleration",
    description:
      "Understand how velocity changes and why acceleration drives motion.",
    discoverPoints: [
      "Why speeding up and slowing down are THE SAME thing",
      "How acceleration happens even at constant speed",
      "Real-world examples you experience daily",
    ],
    estimatedTime: "~7 min",
    contextNote: "Builds on: Speed & Velocity",
    relatedContent: "Essential for: Newton's Three Laws, Putting It Together",
    relatedNodeIds: [3, 6, 7],
    position: { x: 50, y: 45 },
  },
  {
    id: 6,
    title: "Newton's Three Laws",
    description: "Discover the three laws that govern motion and forces.",
    discoverPoints: [
      "Why rockets work in space (no air needed!)",
      "The secret behind every action-reaction pair",
      "How a tiny force can move planets over time",
    ],
    estimatedTime: "~12 min",
    contextNote:
      "Most powerful when you understand: Speed & Velocity, Types of Forces, Understanding Acceleration",
    relatedContent: "Opens the door to: Putting It Together",
    relatedNodeIds: [3, 4, 5, 7],
    position: { x: 50, y: 70 },
  },
  {
    id: 7,
    title: "Putting It Together",
    description:
      "Apply motion and force principles to structured problem solving.",
    discoverPoints: [
      "How motion, forces, and acceleration are one story",
      "Why everything you learned connects beautifully",
      'The "aha moment" that makes physics click',
    ],
    estimatedTime: "~10 min",
    contextNote: "This is where it all makes sense!",
    relatedContent:
      "Brings together: All previous concepts\nPrepares you for: Physics in the Real World",
    relatedNodeIds: [1, 2, 3, 4, 5, 6, 8],
    position: { x: 50, y: 85 },
  },
  {
    id: 8,
    title: "Physics in the Real World",
    description:
      "See how motion and forces explain rockets, vehicles, and satellites.",
    discoverPoints: [
      "How cars, planes, and rockets use these principles",
      "Why athletes and engineers think about forces",
      "Real problems you can now solve like a physicist",
    ],
    estimatedTime: "~15 min",
    contextNote: "The grand finale—apply everything you've learned!",
    relatedContent: "Builds on: Everything in this module",
    relatedNodeIds: [7],
    position: { x: 50, y: 100 },
  },
];
