/**
 * Screen 12 — Completion + Navigation
 *
 * Celebrates the user's progress and offers navigation.
 */

import React, { useEffect, useRef, type FC } from "react";
import { motion } from "framer-motion";
import { playSound } from "../SoundManager";
import type { ScreenProps } from "../types";

interface CompletionScreenProps extends ScreenProps {
  onBackToMap: () => void;
  onMarkComplete: () => void;
}

const CompletionScreen: FC<CompletionScreenProps> = ({
  onBackToMap,
  onMarkComplete,
}) => {
  const played = useRef(false);

  useEffect(() => {
    if (!played.current) {
      played.current = true;
      playSound("completion");
    }
  }, []);

  return (
    <div className="scrn-content-inner flex flex-col items-center justify-center px-6 py-10 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mb-5 shadow-lg shadow-green-500/30"
      >
        <span className="text-3xl text-white">{"✓"}</span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-bold text-gray-900 dark:text-white mb-2"
      >
        Concept Explored!
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-8 leading-relaxed"
      >
        You've explored what motion really means — from Galileo's ship to cosmic
        reference frames. This understanding is the foundation for everything
        that comes next.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <button
          onClick={() => {
            onMarkComplete();
            onBackToMap();
          }}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-md"
        >
          ← Back to Map
        </button>
        <button
          onClick={onBackToMap}
          className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-medium rounded-xl transition-colors"
        >
          Explore Related Ideas
        </button>
      </motion.div>
    </div>
  );
};

export default CompletionScreen;
