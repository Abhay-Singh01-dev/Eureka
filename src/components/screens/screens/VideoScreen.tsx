/**
 * Screen 3 — Video Player
 *
 * Wraps VideoPlayerWithAudio and tracks watch percentage.
 * Unlocks continue at 40 % watched.
 */

import React, { useCallback, useRef, type FC } from "react";
import { VideoPlayerWithAudio } from "@/components/VideoPlayer";
import type { ScreenProps } from "../types";

const VideoScreen: FC<ScreenProps> = ({ onProgressUpdate }) => {
  const lastPct = useRef(0);

  const handleProgress = useCallback(
    (pct: number) => {
      // Only report increases — avoids jitter when user seeks backward
      if (pct > lastPct.current) {
        lastPct.current = pct;
        onProgressUpdate(pct);
      }
    },
    [onProgressUpdate],
  );

  return (
    <div className="scrn-content-inner px-5 py-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🎬</span>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Visual Introduction
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">(3:00)</span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
        Watch this short animation to see how motion works across different
        perspectives.
      </p>

      <div className="rounded-2xl overflow-hidden shadow-lg">
        <VideoPlayerWithAudio
          slug="what-is-motion"
          topic="motion"
          onComplete={() => onProgressUpdate(100)}
          onSkip={() => onProgressUpdate(100)}
          onProgressUpdate={handleProgress}
        />
      </div>

      <div className="mt-4 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Pay attention to:
        </p>
        <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
          {[
            "How the same object appears different from different viewpoints",
            "The cosmic zoom (Earth → Solar System → Galaxy)",
            "Galileo's ship experiment",
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-blue-500 font-bold mt-0.5">{"→"}</span>
              <span className="leading-snug">{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default VideoScreen;
