// ============================================================
// StudentPreview — Preview node content as a student
// Simulates depth adaptation, tone gating, Socratic behavior,
// beauty gating, and misconception probing on the frontend.
// ============================================================

import React, { useState, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  BookOpen,
  HelpCircle,
  FlaskConical,
  Play,
  Film,
  CheckCircle2,
  ChevronDown,
  X,
} from "lucide-react";
import type {
  ContentBlock,
  BlockType,
  StageContent,
} from "@/types/custom-module";

// ── Block icon/color mapping ──

const BLOCK_VISUAL: Record<
  BlockType,
  {
    icon: React.ReactNode;
    color: string;
    bg: string;
    label: string;
  }
> = {
  entry: {
    icon: <BookOpen className="w-4 h-4" />,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    label: "Introduction",
  },
  explanation: {
    icon: <BookOpen className="w-4 h-4" />,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    label: "Explanation",
  },
  micro_question: {
    icon: <HelpCircle className="w-4 h-4" />,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    label: "Think About This",
  },
  simulation: {
    icon: <FlaskConical className="w-4 h-4" />,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    label: "Interactive Exploration",
  },
  quiz: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    label: "Check Your Understanding",
  },
  video: {
    icon: <Play className="w-4 h-4" />,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-900/20",
    label: "Watch & Learn",
  },
  animation: {
    icon: <Film className="w-4 h-4" />,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    label: "Visual Animation",
  },
};

// ── Depth adaptation logic ──

function adaptContentForDepth(
  blocks: ContentBlock[],
  previewDepth: number,
  maxDepth: number,
  beautyPermission: string,
): ContentBlock[] {
  return blocks
    .filter((block) => {
      // At very low depth, hide quiz blocks (too advanced)
      if (previewDepth <= 1 && block.type === "quiz") return false;
      // At low depth, hide simulation (too complex)
      if (previewDepth <= 1 && block.type === "simulation") return false;
      return true;
    })
    .map((block) => {
      let content = block.content;

      // Simplify vocabulary for low depth
      if (previewDepth <= 2) {
        // Strip LaTeX-heavy content indicators
        content = content.replace(
          /\$\$[^$]+\$\$/g,
          "[mathematical expression]",
        );
        content = content.replace(/\$[^$]+\$/g, "[formula]");
      }

      // Beauty gating
      if (previewDepth <= 2 && beautyPermission !== "Minimal") {
        // For low-depth students viewing content designed with beauty,
        // we note clarity is prioritized
      }

      return { ...block, content };
    });
}

// ── Depth Selector ──

const DEPTH_OPTIONS = [
  { value: 2, label: "Depth 2", description: "Beginning learner" },
  { value: 4, label: "Depth 4", description: "Intermediate student" },
  { value: 6, label: "Depth 6", description: "Advanced learner" },
];

// ── Main Component ──

interface StudentPreviewProps {
  /** Stage-based content (all stages rendered seamlessly) */
  stages: StageContent[];
  nodeTitle: string;
  nodeEmoji?: string;
  maxDepth: number;
  beautyPermission: string;
  socraticIntensity: string;
  onClose: () => void;
}

const StudentPreview: FC<StudentPreviewProps> = ({
  stages,
  nodeTitle,
  nodeEmoji,
  maxDepth,
  beautyPermission,
  socraticIntensity,
  onClose,
}) => {
  const [previewDepth, setPreviewDepth] = useState(Math.min(4, maxDepth));
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  // Flatten all stages into a single seamless block list (no stage labels for students)
  const allBlocks: ContentBlock[] = stages.flatMap((s) => s.blocks);

  const adaptedBlocks = adaptContentForDepth(
    allBlocks,
    previewDepth,
    maxDepth,
    beautyPermission,
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-900/20 dark:to-violet-900/20">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Student Preview
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Viewing as: Depth {previewDepth} Student
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Depth Toggle */}
        <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Preview Depth:
          </span>
          <div className="flex gap-1.5">
            {DEPTH_OPTIONS.filter(
              (d) => d.value <= maxDepth || d.value <= 2,
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPreviewDepth(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  previewDepth === opt.value
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
                }`}
                title={opt.description}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Cognitive indicators */}
          <div className="flex-1" />
          <div className="flex gap-2 text-xs text-gray-400">
            {socraticIntensity !== "Light" && (
              <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                Socratic: {socraticIntensity}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              Beauty: {beautyPermission}
            </span>
          </div>
        </div>

        {/* Content — Student View */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Node Title */}
          <div className="text-center mb-8">
            <span className="text-3xl mb-2 block">{nodeEmoji || "📘"}</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {nodeTitle}
            </h2>
          </div>

          {/* Rendered Blocks */}
          {adaptedBlocks.map((block, index) => {
            const vis = BLOCK_VISUAL[block.type];
            if (!block.content.trim()) return null;

            return (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.3 }}
              >
                {/* Socratic blocks get special treatment */}
                {block.type === "micro_question" ? (
                  <div className="bg-violet-50 dark:bg-violet-900/15 border border-violet-200 dark:border-violet-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <HelpCircle className="w-4 h-4 text-violet-500" />
                      <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                        Think About This
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">
                      {block.content}
                    </p>
                    <button
                      onClick={() =>
                        setExpandedBlock(
                          expandedBlock === block.id ? null : block.id,
                        )
                      }
                      className="mt-3 flex items-center gap-1 text-xs text-violet-500 hover:text-violet-600 transition-colors"
                    >
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${expandedBlock === block.id ? "rotate-180" : ""}`}
                      />
                      {expandedBlock === block.id
                        ? "Hide my thoughts"
                        : "I want to think about this..."}
                    </button>
                    <AnimatePresence>
                      {expandedBlock === block.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 overflow-hidden"
                        >
                          <textarea
                            placeholder="Write your thoughts here..."
                            className="w-full p-3 rounded-lg bg-white dark:bg-gray-800 border border-violet-200 dark:border-violet-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
                            rows={3}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : block.type === "quiz" ? (
                  <div className="bg-rose-50 dark:bg-rose-900/15 border border-rose-200 dark:border-rose-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-rose-500" />
                      <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                        Check Your Understanding
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {block.content}
                    </p>
                  </div>
                ) : block.type === "simulation" ? (
                  <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <FlaskConical className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        Interactive Exploration
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {block.content}
                    </p>
                    <div className="mt-4 h-32 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <span className="text-sm text-amber-500">
                        [Simulation would render here]
                      </span>
                    </div>
                  </div>
                ) : block.type === "video" ? (
                  <div className="bg-pink-50 dark:bg-pink-900/15 border border-pink-200 dark:border-pink-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Play className="w-4 h-4 text-pink-500" />
                      <span className="text-sm font-semibold text-pink-600 dark:text-pink-400">
                        Watch & Learn
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {block.content}
                    </p>
                    <div className="mt-4 h-40 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                      <Play className="w-10 h-10 text-pink-400" />
                    </div>
                  </div>
                ) : (
                  /* Entry + Explanation blocks */
                  <div className="space-y-1">
                    {block.type === "entry" && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className={vis.color}>{vis.icon}</span>
                        <span
                          className={`text-xs font-semibold uppercase tracking-wider ${vis.color}`}
                        >
                          {vis.label}
                        </span>
                      </div>
                    )}
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                      {block.content}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 italic">
              This preview simulates how a Depth {previewDepth} student would
              experience this node. Actual rendering includes full cognitive
              adaptation.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default StudentPreview;
