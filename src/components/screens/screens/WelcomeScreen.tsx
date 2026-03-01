/**
 * Screen 1 — Welcome + Hook
 *
 * Embeds the existing MotionHook (streaming text + TTS).
 * Reports progress = 100 when streaming finishes.
 */

import React, { useEffect, useRef, type FC } from "react";
import { Sparkles } from "lucide-react";
import MotionHook from "@/components/concept-map/MotionHook";
import type { ScreenProps } from "../types";

const WelcomeScreen: FC<ScreenProps> = ({ onProgressUpdate, isActive }) => {
  const reported = useRef(false);

  const handleStreamComplete = () => {
    if (!reported.current) {
      reported.current = true;
      onProgressUpdate(100);
    }
  };

  // Reset when screen becomes active again (e.g. user went back)
  useEffect(() => {
    if (isActive) reported.current = false;
  }, [isActive]);

  return (
    <div className="scrn-content-inner px-6 py-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Eureka
          </div>
          <MotionHook onStreamComplete={handleStreamComplete} />
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
