import React, { type FC } from "react";
import { motion } from "framer-motion";
import type { Chapter } from "@/types";

interface ConceptSpaceHeaderProps {
  chapter: Chapter | null;
}

const ConceptSpaceHeader: FC<ConceptSpaceHeaderProps> = ({ chapter }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700"
    >
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{chapter?.icon || "🌍"}</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {chapter?.name || "Gravity & Orbits"}
          </h1>
        </div>
      </div>
    </motion.div>
  );
};

export default ConceptSpaceHeader;
