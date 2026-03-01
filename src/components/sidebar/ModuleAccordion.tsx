import React, { type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { Chapter, SubjectKey } from "@/types";

const subjectIcons: Record<SubjectKey, string> = {
  physics: "📕",
  mathematics: "📘",
  chemistry: "📗",
  biology: "📙",
};

const subjectColors: Record<SubjectKey, string> = {
  physics: "text-red-600 bg-red-50",
  mathematics: "text-blue-600 bg-blue-50",
  chemistry: "text-teal-600 bg-teal-50",
  biology: "text-green-600 bg-green-50",
};

interface ModuleAccordionProps {
  subject: SubjectKey;
  chapters: Chapter[];
  isExpanded: boolean;
  onToggle: () => void;
  onChapterClick: (chapter: Chapter) => void;
  activeChapter: Chapter | null;
}

const ModuleAccordion: FC<ModuleAccordionProps> = ({
  subject,
  chapters,
  isExpanded,
  onToggle,
  onChapterClick,
  activeChapter,
}) => {
  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 ${
          isExpanded
            ? `${subjectColors[subject]} dark:bg-opacity-20`
            : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{subjectIcons[subject]}</span>
          <span className="font-medium text-gray-800 dark:text-gray-200 capitalize">
            {subject}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pl-4 pr-2 py-2 space-y-1">
              {chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => onChapterClick(chapter)}
                  className={`w-full flex items-center justify-between pl-3 pr-2 py-1.5 rounded-md text-left transition-all duration-150 group ${
                    activeChapter?.id === chapter.id
                      ? "bg-gray-100 dark:bg-gray-700/50"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm">{chapter.icon}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {chapter.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModuleAccordion;
