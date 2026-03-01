import React, { type FC } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { LanguageSelectorProps } from "./types";

const LanguageSelector: FC<LanguageSelectorProps> = ({
  languages,
  activeLanguage,
  isLoading,
  onSelect,
}) => (
  <div
    className="flex items-center gap-2 flex-wrap"
    role="radiogroup"
    aria-label="Narration language"
  >
    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-1 select-none">
      Language:
    </span>

    {languages.map((lang) => {
      const isActive = lang.code === activeLanguage;

      return (
        <motion.button
          key={lang.code}
          role="radio"
          aria-checked={isActive}
          aria-label={lang.name}
          disabled={isLoading}
          onClick={() => onSelect(lang.code)}
          whileTap={{ scale: 0.96 }}
          className={`
            inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm
            font-medium transition-colors duration-200 outline-none
            focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              isActive
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200"
            }
          `}
        >
          {isLoading && isActive ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <span className="text-base leading-none" aria-hidden="true">
              {lang.flag}
            </span>
          )}
          {lang.name}
        </motion.button>
      );
    })}
  </div>
);

export default LanguageSelector;
