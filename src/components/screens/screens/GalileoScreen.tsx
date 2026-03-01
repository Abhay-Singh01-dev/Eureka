/**
 * Screen 6 — Key Insight #2: Galileo's Ship
 *
 * Text + illustrated thought experiment (scroll to unlock).
 */

import React, { type FC } from "react";
import type { ScreenProps } from "../types";

const GalileoScreen: FC<ScreenProps> = () => {
  return (
    <div className="scrn-content-inner scrn-scrollable px-6 py-6 space-y-6">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/20 border-2 border-amber-400 dark:border-amber-600 rounded-full px-4 py-1.5">
        <span className="text-lg">💡</span>
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          Key Insight #2
        </span>
      </div>

      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
        Galileo's Ship Experiment
      </h2>

      {/* Ship illustration */}
      <div className="bg-gradient-to-b from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border-2 border-sky-200 dark:border-sky-700 rounded-2xl p-6 text-center">
        <div className="text-5xl mb-3">⛵</div>
        <p className="text-sm text-gray-600 dark:text-gray-400 italic max-w-md mx-auto leading-relaxed">
          "Shut yourself up below decks in a large ship. Have butterflies fly,
          fish swim, and drops fall. You shall not discern any difference
          whether the ship moves or stands still."
        </p>
        <p className="mt-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
          — Galileo Galilei, 1632
        </p>
      </div>

      <div className="text-base leading-relaxed text-gray-700 dark:text-gray-300 space-y-4">
        <p>
          Galileo proposed a revolutionary thought experiment: imagine you're
          below the deck of a smoothly sailing ship. Could you tell, by any
          experiment performed <em>inside</em> the cabin, whether the ship was
          moving or standing still?
        </p>
        <p>
          <strong className="text-gray-900 dark:text-white">
            The answer is no.
          </strong>{" "}
          Butterflies fly the same way. A ball thrown straight up lands in your
          hand. Everything behaves identically — whether the ship moves at
          constant speed or is completely still.
        </p>
        <p>
          This is{" "}
          <span className="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold px-1.5 py-0.5 rounded">
            Galilean Relativity
          </span>
          : the laws of physics are the same in every non-accelerating
          (inertial) reference frame.
        </p>
        <p>
          And suddenly, motion was no longer absolute. It only makes sense
          relative to something else — a dock, the ocean floor, or even the
          stars.
        </p>
        <p className="text-gray-500 dark:text-gray-400 italic">
          Newton would build on this principle. And centuries later, Einstein
          would extend it to light itself — but we'll get there.
        </p>
      </div>
    </div>
  );
};

export default GalileoScreen;
