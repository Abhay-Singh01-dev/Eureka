import type { ConceptNodeData, NodeConnection, Progress } from "@/types";

export const motionAndForcesNodes: ConceptNodeData[] = [
  {
    id: 1,
    emoji: "🌱",
    title: "What is Motion?",
    type: "foundation",
    state: "unlocked",
    prerequisites: [],
    unlocks: [2, 3],
    estimatedTime: "5 min",
    position: { x: 50, y: 0 },
    content: {
      welcomeMessage:
        "Welcome to What is Motion! Let's explore the fundamental concept of objects changing position over time.",
      videoTitle: "Understanding Motion",
      videoDuration: "3:00",
      reflectionQuestion: "In your own words, what does motion mean to you?",
    },
  },
  {
    id: 2,
    emoji: "🔵",
    title: "What is a Force?",
    type: "foundation",
    state: "unlocked",
    prerequisites: [1],
    unlocks: [4],
    estimatedTime: "6 min",
    position: { x: 20, y: 180 },
    content: {
      welcomeMessage:
        "Welcome to What is a Force! Let's explore how forces cause changes in motion and why they're everywhere around us.",
      videoTitle: "Forces Explained",
      videoDuration: "3:30",
      reflectionQuestion:
        "Can you think of a force that acts on objects without touching them?",
    },
  },
  {
    id: 3,
    emoji: "🔗",
    title: "Speed & Velocity",
    type: "connection",
    state: "unlocked",
    prerequisites: [1],
    unlocks: [4],
    estimatedTime: "7 min",
    position: { x: 80, y: 180 },
    content: {
      welcomeMessage:
        "Welcome to Speed & Velocity! Let's explore the difference between how fast something moves and where it's going.",
      videoTitle: "Speed vs Velocity",
      videoDuration: "4:00",
      reflectionQuestion:
        "If two cars are moving at 60 km/h, but one is going North and the other East, do they have the same velocity?",
    },
  },
  {
    id: 4,
    emoji: "⚡",
    title: "Types of Forces",
    type: "power",
    state: "unlocked",
    prerequisites: [2, 3],
    unlocks: [5, 6],
    estimatedTime: "9 min",
    position: { x: 50, y: 360 },
    content: {
      welcomeMessage:
        "Types of Forces unlocks the full picture. Gravity, friction, tension, normal force—let's meet them all!",
      videoTitle: "Types of Forces",
      videoDuration: "5:00",
      reflectionQuestion: "How does friction help you walk without slipping?",
    },
  },
  {
    id: 5,
    emoji: "⚡",
    title: "Understanding Acceleration",
    type: "power",
    state: "unlocked",
    prerequisites: [4],
    unlocks: [7],
    estimatedTime: "7 min",
    position: { x: 20, y: 540 },
    content: {
      welcomeMessage:
        "Acceleration is all about how velocity changes. Let's explore this powerful concept—including why slowing down is still acceleration!",
      videoTitle: "Understanding Acceleration",
      videoDuration: "4:30",
      reflectionQuestion:
        "Can an object be moving at constant speed but still accelerating?",
    },
  },
  {
    id: 6,
    emoji: "⚡",
    title: "Newton's Three Laws",
    type: "power",
    state: "unlocked",
    prerequisites: [4],
    unlocks: [7],
    estimatedTime: "12 min",
    position: { x: 80, y: 540 },
    content: {
      welcomeMessage:
        "Newton's three laws explain WHY things move the way they do. These are foundational to all of physics!",
      videoTitle: "Newton's Three Laws",
      videoDuration: "6:00",
      reflectionQuestion:
        "Think of an everyday example of Newton's third law in action.",
    },
  },
  {
    id: 7,
    emoji: "🌟",
    title: "Putting It Together",
    type: "synthesis",
    state: "unlocked",
    prerequisites: [5, 6],
    unlocks: [8],
    estimatedTime: "10 min",
    position: { x: 50, y: 720 },
    content: {
      welcomeMessage:
        "Now let's bring everything together and see how all these concepts work in beautiful harmony!",
      videoTitle: "Synthesizing Motion & Forces",
      videoDuration: "5:30",
      reflectionQuestion:
        "How do all these concepts work together when you throw a ball?",
    },
  },
  {
    id: 8,
    emoji: "🚀",
    title: "Physics in the Real World",
    type: "challenge",
    state: "unlocked",
    prerequisites: [7],
    unlocks: [],
    estimatedTime: "15 min",
    position: { x: 50, y: 900 },
    content: {
      welcomeMessage:
        "Time to apply everything you've learned to real-world scenarios and challenges. You're thinking like a physicist!",
      videoTitle: "Physics in Action",
      videoDuration: "7:00",
      reflectionQuestion:
        "Design a simple experiment to demonstrate one concept you've learned.",
    },
  },
];

export const nodeConnections: NodeConnection[] = [
  { from: 1, to: 2 },
  { from: 1, to: 3 },
  { from: 2, to: 4 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
  { from: 4, to: 6 },
  { from: 5, to: 7 },
  { from: 6, to: 7 },
  { from: 7, to: 8 },
];

export const initialProgress: Progress = {
  completedNodes: [],
  currentNode: 1,
  totalNodes: 8,
  progressPercentage: 0,
};
