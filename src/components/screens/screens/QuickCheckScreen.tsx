/**
 * Screen 5 — Quick Check: Ball in a Car
 *
 * Classic physics quiz. Selecting any answer reports progress = 1.
 */

import React, { useState, type FC } from "react";
import { motion } from "framer-motion";
import { playSound } from "../SoundManager";
import type { ScreenProps } from "../types";

interface Option {
  key: string;
  letter: string;
  text: string;
  feedback: string;
  correct: boolean;
}

const OPTIONS: Option[] = [
  {
    key: "A",
    letter: "A",
    text: "Behind you (the car moved forward while the ball was in the air)",
    feedback:
      "Not quite. The ball was already moving at 100 km/h with the car before you tossed it. That motion doesn't vanish.",
    correct: false,
  },
  {
    key: "B",
    letter: "B",
    text: "In your hand (the ball kept moving forward with you)",
    feedback:
      "Exactly! The ball inherited the car's forward motion. Tossing it upward doesn't change its horizontal velocity.",
    correct: true,
  },
  {
    key: "C",
    letter: "C",
    text: "In front of you (the ball was thrown upward AND forward)",
    feedback:
      "Close, but remember: you only threw it UP, not forward. It already had the forward motion from the car.",
    correct: false,
  },
];

const QuickCheckScreen: FC<ScreenProps> = ({ onProgressUpdate }) => {
  const [selected, setSelected] = useState<string | null>(null);

  const handleAnswer = (key: string) => {
    if (selected) return;
    setSelected(key);
    playSound("click");
    onProgressUpdate(1);
  };

  const selectedOpt = OPTIONS.find((o) => o.key === selected);

  return (
    <div className="scrn-content-inner flex flex-col items-center px-6 py-8">
      <span className="text-4xl mb-3">🤔</span>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Quick Check
      </h3>

      <p className="text-base text-gray-700 dark:text-gray-300 text-center max-w-lg mb-6 leading-relaxed">
        You're in a car moving at 100&nbsp;km/h. You toss a ball straight up.
        Where does it land?
      </p>

      <div className="flex flex-col gap-3 w-full max-w-lg">
        {OPTIONS.map((o) => {
          const isThis = selected === o.key;
          let extraClass = "";
          if (isThis && o.correct) extraClass = "scrn-quiz--correct";
          else if (isThis && !o.correct) extraClass = "scrn-quiz--incorrect";
          else if (selected && !isThis) extraClass = "opacity-50";

          return (
            <button
              key={o.key}
              onClick={() => handleAnswer(o.key)}
              className={`scrn-quiz-option ${extraClass}`}
            >
              <span
                className={`scrn-quiz-letter ${isThis ? "scrn-quiz-letter--selected" : ""}`}
              >
                {o.letter}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-200 text-left leading-snug">
                {o.text}
              </span>
            </button>
          );
        })}
      </div>

      {selectedOpt && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-5 max-w-lg p-4 rounded-xl flex items-start gap-3 ${
            selectedOpt.correct
              ? "bg-green-50 dark:bg-green-900/20 border-2 border-green-400"
              : "bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400"
          }`}
        >
          <span className="text-xl flex-shrink-0">
            {selectedOpt.correct ? "✓" : "ℹ️"}
          </span>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {selectedOpt.feedback}
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default QuickCheckScreen;
