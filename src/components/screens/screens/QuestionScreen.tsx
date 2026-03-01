/**
 * Screen 2 — "Are You Moving?" question prompt
 *
 * Three choice cards. Selecting any answer reports progress = 1.
 */

import React, { useState, type FC } from "react";
import { motion } from "framer-motion";
import { playSound } from "../SoundManager";
import type { ScreenProps } from "../types";

const CHOICES = [
  { key: "yes", icon: "✓", label: "Yes, obviously" },
  { key: "no", icon: "✗", label: "No, I'm sitting still" },
  { key: "depends", icon: "💭", label: "It depends..." },
] as const;

const QuestionScreen: FC<ScreenProps> = ({ onProgressUpdate }) => {
  const [selected, setSelected] = useState<string | null>(null);

  const handleChoice = (key: string) => {
    if (selected) return;
    setSelected(key);
    playSound("click");
    onProgressUpdate(1);
  };

  return (
    <div className="scrn-content-inner flex flex-col items-center justify-center px-6 py-10 text-center">
      <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-8 tracking-tight">
        ARE YOU MOVING?
      </h2>

      <div className="flex flex-col gap-3 w-full max-w-md">
        {CHOICES.map((c) => (
          <button
            key={c.key}
            onClick={() => handleChoice(c.key)}
            className={`scrn-choice ${selected === c.key ? "scrn-choice--selected" : ""} ${selected && selected !== c.key ? "opacity-50" : ""}`}
          >
            <span className="text-xl flex-shrink-0 w-8 text-center">
              {c.icon}
            </span>
            <span className="text-base font-medium text-gray-700 dark:text-gray-200">
              {c.label}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 text-base text-gray-500 dark:text-gray-400 italic max-w-sm"
        >
          Interesting choice. Let's explore what "motion" actually means.
        </motion.p>
      )}
    </div>
  );
};

export default QuestionScreen;
