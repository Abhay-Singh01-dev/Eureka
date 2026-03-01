/**
 * Screen 7 — Socratic Dialogue
 *
 * A guided chain of questions that lead to deeper understanding.
 * Unlock: user selects an answer.
 */

import React, { useState, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { playSound } from "../SoundManager";
import type { ScreenProps } from "../types";

interface DialogStep {
  question: string;
  choices: string[];
  follow: string;
}

const STEPS: DialogStep[] = [
  {
    question:
      "If you're on a moving train and throw a ball up, it lands in your hand. Why?",
    choices: [
      "The ball already had the train's velocity",
      "Gravity pulls it straight down",
      "The air inside the train pushed it",
    ],
    follow:
      "Exactly — the ball doesn't 'forget' it was moving with the train. It inherits that horizontal velocity. Gravity only acts vertically, so the ball's forward motion continues unchanged.",
  },
  {
    question:
      "Now imagine you're floating in deep space, far from any stars. Could you tell if you're moving?",
    choices: [
      "Yes, I could feel the speed",
      "No, there's no way to tell",
      "Only if I had a speedometer",
    ],
    follow:
      "There is no experiment you can perform in an inertial frame that reveals your absolute velocity. Without a reference point, 'moving' and 'still' are meaningless. This is the heart of relativity.",
  },
  {
    question: "So if motion is always relative… does 'absolute rest' exist?",
    choices: [
      "Yes, the center of the universe is at rest",
      "No, there is no universal frame of rest",
      "Only Earth's surface counts as rest",
    ],
    follow:
      "Correct — there is no preferred frame of reference. The Earth moves around the Sun, the Sun around the galaxy, the galaxy through the cosmos. Every 'rest' is just a choice of frame.",
  },
];

const SocraticScreen: FC<ScreenProps> = ({ onProgressUpdate }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [showFollow, setShowFollow] = useState(false);
  const [completed, setCompleted] = useState(false);

  const step = STEPS[stepIndex];

  const handleChoose = (idx: number) => {
    if (selectedChoice !== null) return;
    setSelectedChoice(idx);
    playSound("click");
    setShowFollow(true);

    // Last step → report complete
    if (stepIndex === STEPS.length - 1) {
      setCompleted(true);
      onProgressUpdate(1);
    }
  };

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((p) => p + 1);
      setSelectedChoice(null);
      setShowFollow(false);
    }
  };

  return (
    <div className="scrn-content-inner px-6 py-6 space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-indigo-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Let's think together
        </h3>
        <span className="text-xs text-gray-400 ml-auto">
          {stepIndex + 1} / {STEPS.length}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {/* Question */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4">
            <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed">
              {step.question}
            </p>
          </div>

          {/* Choices */}
          <div className="flex flex-col gap-2.5">
            {step.choices.map((c, i) => (
              <button
                key={i}
                onClick={() => handleChoose(i)}
                className={`scrn-choice ${selectedChoice === i ? "scrn-choice--selected" : ""} ${selectedChoice !== null && selectedChoice !== i ? "opacity-40" : ""}`}
              >
                <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center justify-center flex-shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-200 text-left">
                  {c}
                </span>
              </button>
            ))}
          </div>

          {/* Follow-up response */}
          {showFollow && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4 flex items-start gap-3"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {step.follow}
              </p>
            </motion.div>
          )}

          {/* Next step button (intra-screen, not the Continue button) */}
          {showFollow && stepIndex < STEPS.length - 1 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleNext}
              className="mx-auto block text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Next question →
            </motion.button>
          )}

          {completed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm text-green-600 dark:text-green-400 font-medium"
            >
              Great thinking! You've explored the core of relative motion.
            </motion.p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SocraticScreen;
