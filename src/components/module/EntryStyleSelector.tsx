// ============================================================
// EntryStyleSelector — Step 1 of Node Content Builder
// Pedagogical entry style selection before content scaffolding
// ============================================================

import React, { type FC } from "react";
import { motion } from "framer-motion";
import { BookOpen, HelpCircle, FlaskConical, Globe, Play } from "lucide-react";
import type { EntryStyle } from "@/types/custom-module";

interface EntryStyleOption {
  value: EntryStyle;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

const ENTRY_STYLES: EntryStyleOption[] = [
  {
    value: "short_explanation",
    label: "Short Explanation",
    description:
      "Concept clarity first — a concise, focused explanation to build understanding immediately.",
    icon: <BookOpen className="w-5 h-5" />,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-300 dark:border-blue-600",
  },
  {
    value: "question_first",
    label: "Question First",
    description:
      "Socratic engagement — start with a thought-provoking question that challenges assumptions.",
    icon: <HelpCircle className="w-5 h-5" />,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-900/20",
    borderColor: "border-violet-300 dark:border-violet-600",
  },
  {
    value: "simulation_first",
    label: "Simulation First",
    description:
      "Interactive discovery — let students explore a simulation before the explanation.",
    icon: <FlaskConical className="w-5 h-5" />,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    borderColor: "border-emerald-300 dark:border-emerald-600",
  },
  {
    value: "real_world_example",
    label: "Real-World Example",
    description:
      "Applied grounding — anchor the concept in a vivid, relatable real-world scenario.",
    icon: <Globe className="w-5 h-5" />,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-300 dark:border-amber-600",
  },
  {
    value: "video_first",
    label: "Video First",
    description:
      "Visual narrative entry — begin with a visual story or animation that reveals the concept.",
    icon: <Play className="w-5 h-5" />,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-50 dark:bg-rose-900/20",
    borderColor: "border-rose-300 dark:border-rose-600",
  },
];

interface EntryStyleSelectorProps {
  nodeTitle: string;
  selected: EntryStyle | null;
  onSelect: (style: EntryStyle) => void;
  onContinue: () => void;
  /** Optional stage label shown for multi-stage nodes */
  stageLabel?: string;
}

const EntryStyleSelector: FC<EntryStyleSelectorProps> = ({
  nodeTitle,
  selected,
  onSelect,
  onContinue,
  stageLabel,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {stageLabel
            ? `${stageLabel} — How should it begin?`
            : "How should this node begin?"}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Choose the pedagogical entry style for{" "}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {nodeTitle}
          </span>
          {stageLabel && (
            <span className="text-violet-500 dark:text-violet-400 ml-1">
              ({stageLabel})
            </span>
          )}
        </p>
      </div>

      {/* Options Grid */}
      <div className="space-y-3">
        {ENTRY_STYLES.map((style, index) => {
          const isSelected = selected === style.value;
          return (
            <motion.button
              key={style.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.25 }}
              onClick={() => onSelect(style.value)}
              className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                isSelected
                  ? `${style.borderColor} ${style.bgColor} shadow-sm`
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              {/* Radio Circle */}
              <div className="flex-shrink-0 mt-0.5">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? `${style.borderColor} ${style.bgColor}`
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`w-2.5 h-2.5 rounded-full ${style.color.replace("text-", "bg-").split(" ")[0]}`}
                    />
                  )}
                </div>
              </div>

              {/* Icon */}
              <div
                className={`flex-shrink-0 p-2 rounded-lg ${
                  isSelected ? style.bgColor : "bg-gray-100 dark:bg-gray-700/50"
                }`}
              >
                <span
                  className={
                    isSelected
                      ? style.color
                      : "text-gray-500 dark:text-gray-400"
                  }
                >
                  {style.icon}
                </span>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium text-sm ${
                    isSelected
                      ? style.color
                      : "text-gray-800 dark:text-gray-200"
                  }`}
                >
                  {style.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                  {style.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Continue Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: selected ? 1 : 0.4 }}
        onClick={onContinue}
        disabled={!selected}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-lg"
      >
        Generate Content Scaffold
      </motion.button>
    </div>
  );
};

export default EntryStyleSelector;
