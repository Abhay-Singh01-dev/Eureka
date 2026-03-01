/**
 * Screen 10 — Summary: Three Key Insights
 *
 * Recap of the core ideas (scroll to unlock).
 */

import React, { type FC } from "react";
import type { ScreenProps } from "../types";

const INSIGHTS = [
  {
    num: 1,
    title: "Motion is relative",
    desc: "There is no absolute motion — only motion relative to a chosen reference frame. Different observers can disagree on speed or path, and both are correct.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    num: 2,
    title: "No privileged frame of rest",
    desc: "Galileo showed that the laws of physics are identical in all non-accelerating frames. You cannot detect your own constant velocity through any experiment.",
    color: "from-emerald-500 to-teal-600",
  },
  {
    num: 3,
    title: "Choosing the right frame simplifies everything",
    desc: "Complex problems become elegant when viewed from the right reference frame. This principle powers GPS, space navigation, and much of modern physics.",
    color: "from-purple-500 to-violet-600",
  },
];

const SummaryScreen: FC<ScreenProps> = () => {
  return (
    <div className="scrn-content-inner scrn-scrollable px-6 py-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
        What You've Learned
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md mx-auto">
        Three foundational ideas about motion that took humanity centuries to
        discover.
      </p>

      <div className="space-y-4">
        {INSIGHTS.map((ins) => (
          <div
            key={ins.num}
            className="bg-white dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden"
          >
            <div className="flex items-stretch">
              <div
                className={`w-14 flex-shrink-0 bg-gradient-to-b ${ins.color} flex items-center justify-center`}
              >
                <span className="text-xl font-bold text-white">{ins.num}</span>
              </div>
              <div className="p-4 flex-1">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  {ins.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {ins.desc}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-gray-400 dark:text-gray-500 italic pt-2">
        These ideas set the stage for Newton's mechanics and, eventually,
        Einstein's special relativity.
      </p>
    </div>
  );
};

export default SummaryScreen;
