/**
 * Screen 4 — Key Insight #1: Motion is Relative
 *
 * Text + CSS diagram showing three reference frames.
 * Unlock: scroll to 60%.
 */

import React, { type FC } from "react";
import type { ScreenProps } from "../types";

const InsightScreen: FC<ScreenProps> = () => {
  // Scroll tracking is handled by ScreenManager's onScroll on the
  // scrollable wrapper — this component just provides content.

  return (
    <div className="scrn-content-inner scrn-scrollable px-6 py-6 space-y-6">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/20 border-2 border-amber-400 dark:border-amber-600 rounded-full px-4 py-1.5">
        <span className="text-lg">💡</span>
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          Key Insight #1
        </span>
      </div>

      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
        Motion is Relative
      </h2>

      {/* Visual diagram — three perspectives */}
      <div className="bg-white dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-2xl p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            {
              label: "On the ground",
              emoji: "🧍",
              desc: "The ball flies in an arc",
            },
            {
              label: "On the train",
              emoji: "🚆",
              desc: "The ball goes straight up and down",
            },
            {
              label: "From space",
              emoji: "🛰️",
              desc: "Both the ball AND ground move",
            },
          ].map((frame, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <span className="text-3xl">{frame.emoji}</span>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                {frame.label}
              </span>
              {/* Animated ball placeholder */}
              <div className="relative w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
                {frame.desc}
              </p>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-3 italic">
          Same ball, three different perspectives
        </p>
      </div>

      {/* Explanation text */}
      <div className="text-base leading-relaxed text-gray-700 dark:text-gray-300 space-y-4">
        <p>
          The ball is the{" "}
          <strong className="text-gray-900 dark:text-white">SAME object</strong>
          . But from different reference frames, it appears to move differently.
        </p>
        <p>
          This is what we mean by{" "}
          <span className="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold px-1.5 py-0.5 rounded">
            "motion is relative"
          </span>
          .
        </p>
        <p>
          There is no "correct" perspective.{" "}
          <em className="text-gray-500 dark:text-gray-400">
            Each viewpoint is equally valid.
          </em>
        </p>
        <p>
          When you say "I'm sitting still," you're implicitly choosing the
          Earth's surface as your reference frame. But someone floating in space
          would see you hurtling through the cosmos.
        </p>
      </div>
    </div>
  );
};

export default InsightScreen;
