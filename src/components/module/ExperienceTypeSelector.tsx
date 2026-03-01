// ============================================================
// ExperienceTypeSelector — Step 0 of Node Content Builder
// Choose the overall learning experience structure for a node
// ============================================================

import React, { type FC } from "react";
import { motion } from "framer-motion";
import {
  Focus,
  Layers,
  FlaskConical,
  MessageCircle,
  Minus,
  Plus,
} from "lucide-react";
import type { ExperienceType } from "@/types/custom-module";

interface ExperienceOption {
  value: ExperienceType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  stageHint: string;
}

const EXPERIENCE_OPTIONS: ExperienceOption[] = [
  {
    value: "focused_concept",
    label: "Focused Concept",
    description:
      "A single, deep-dive learning experience. Ideal for concepts that need concentrated attention without splitting into stages.",
    icon: <Focus className="w-5 h-5" />,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-300 dark:border-blue-600",
    stageHint: "1 stage",
  },
  {
    value: "multi_stage",
    label: "Multi-Stage Journey",
    description:
      "Break this concept into 2–10 progressive stages. Each stage has its own entry style and scaffold. Great for complex topics.",
    icon: <Layers className="w-5 h-5" />,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-900/20",
    borderColor: "border-violet-300 dark:border-violet-600",
    stageHint: "2–10 stages",
  },
  {
    value: "simulation_led",
    label: "Simulation-Led",
    description:
      "Build discovery around an interactive simulation. Students explore first, then understand. Entry style defaults to simulation-first.",
    icon: <FlaskConical className="w-5 h-5" />,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    borderColor: "border-emerald-300 dark:border-emerald-600",
    stageHint: "1 stage",
  },
  {
    value: "dialogue_based",
    label: "Dialogue-Based",
    description:
      "A Socratic conversation that guides the student through questions and reflections. Entry style defaults to question-first.",
    icon: <MessageCircle className="w-5 h-5" />,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-300 dark:border-amber-600",
    stageHint: "1 stage",
  },
];

interface ExperienceTypeSelectorProps {
  nodeTitle: string;
  selected: ExperienceType | null;
  onSelect: (type: ExperienceType) => void;
  /** Stage count — only used when selected is "multi_stage" */
  stageCount: number;
  onStageCountChange: (count: number) => void;
  onContinue: () => void;
}

const ExperienceTypeSelector: FC<ExperienceTypeSelectorProps> = ({
  nodeTitle,
  selected,
  onSelect,
  stageCount,
  onStageCountChange,
  onContinue,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          What kind of learning experience?
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Choose the structure for{" "}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {nodeTitle}
          </span>
        </p>
      </div>

      {/* Options Grid */}
      <div className="space-y-3">
        {EXPERIENCE_OPTIONS.map((opt, index) => {
          const isSelected = selected === opt.value;
          return (
            <motion.button
              key={opt.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.25 }}
              onClick={() => onSelect(opt.value)}
              className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                isSelected
                  ? `${opt.borderColor} ${opt.bgColor} shadow-sm`
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              {/* Radio Circle */}
              <div className="flex-shrink-0 mt-0.5">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? `${opt.borderColor} ${opt.bgColor}`
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`w-2.5 h-2.5 rounded-full ${opt.color.replace("text-", "bg-").split(" ")[0]}`}
                    />
                  )}
                </div>
              </div>

              {/* Icon */}
              <div
                className={`flex-shrink-0 p-2 rounded-lg ${
                  isSelected ? opt.bgColor : "bg-gray-100 dark:bg-gray-700/50"
                }`}
              >
                <span
                  className={
                    isSelected
                      ? opt.color
                      : "text-gray-500 dark:text-gray-400"
                  }
                >
                  {opt.icon}
                </span>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={`font-medium text-sm ${
                      isSelected
                        ? opt.color
                        : "text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {opt.label}
                  </p>
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                    {opt.stageHint}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                  {opt.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Stage Count Selector (only for multi_stage) */}
      {selected === "multi_stage" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center justify-center gap-4 py-3 px-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700"
        >
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
            Number of stages:
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onStageCountChange(Math.max(2, stageCount - 1))}
              disabled={stageCount <= 2}
              className="p-1 rounded-lg bg-violet-100 dark:bg-violet-800/50 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-700/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-bold text-violet-700 dark:text-violet-300 text-lg">
              {stageCount}
            </span>
            <button
              onClick={() => onStageCountChange(Math.min(10, stageCount + 1))}
              disabled={stageCount >= 10}
              className="p-1 rounded-lg bg-violet-100 dark:bg-violet-800/50 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-700/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Continue Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: selected ? 1 : 0.4 }}
        onClick={onContinue}
        disabled={!selected}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-lg"
      >
        Continue to Entry Style
      </motion.button>
    </div>
  );
};

export default ExperienceTypeSelector;
