/**
 * Screen 9 — Text + Real-World Examples
 *
 * Three tangible applications of relative motion (scroll to unlock).
 */

import React, { type FC } from "react";
import type { ScreenProps } from "../types";

const EXAMPLES = [
  {
    icon: "📡",
    title: "GPS Satellites",
    text: "GPS satellites orbit at ~14,000 km/h relative to Earth. Their atomic clocks tick at a slightly different rate than clocks on the ground — a consequence of both special and general relativity. Without correction for this, your GPS position would drift by ~10 km per day.",
  },
  {
    icon: "🌍",
    title: "Planetary Motion",
    text: "Medieval astronomers struggled with complex planetary orbits because they used Earth as the reference frame. Switching to a Sun-centered (heliocentric) frame made orbits beautifully simple — almost circular. The mathematics didn't change, only the perspective.",
  },
  {
    icon: "⚽",
    title: "Sports Physics",
    text: "A soccer ball curving in mid-air is a study in relative motion. The spin creates different air speeds on each side. From the ball's reference frame, air rushes past unevenly. From the ground, the ball swerves. Same physics, different vantage points.",
  },
];

const ExamplesScreen: FC<ScreenProps> = () => {
  return (
    <div className="scrn-content-inner scrn-scrollable px-6 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-xl">🌎</span>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          Motion in the Real World
        </h3>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        The concept of relative motion isn't just theoretical — it shapes
        technology, science, and everyday life.
      </p>

      <div className="space-y-4">
        {EXAMPLES.map((ex, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{ex.icon}</span>
              <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                {ex.title}
              </h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {ex.text}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          <strong>Pattern:</strong> In each example, the physics is the same —
          but choosing the right reference frame transforms complexity into
          clarity. That's the power of understanding relative motion.
        </p>
      </div>
    </div>
  );
};

export default ExamplesScreen;
