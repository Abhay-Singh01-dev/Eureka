import React, { type FC, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Volume2, Sparkles } from "lucide-react";
import { format } from "date-fns";

interface MessageBubbleProps {
  message: string;
  isUser: boolean;
  timestamp?: Date;
  children?: ReactNode;
}

const MessageBubble: FC<MessageBubbleProps> = ({
  message,
  isUser,
  timestamp,
  children,
}) => {
  const formattedTime = timestamp
    ? format(new Date(timestamp), "h:mm a")
    : format(new Date(), "h:mm a");

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-end mb-6"
      >
        <div className="max-w-[70%] bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl rounded-br-md px-4 py-3">
          <p className="text-gray-800 dark:text-gray-200 text-[15px] leading-relaxed">
            {message}
          </p>
          {children}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 mr-1">
          You • {formattedTime}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col items-start mb-6"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Eureka
        </span>
      </div>

      <div className="max-w-[85%] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-2xl rounded-tl-md px-5 py-4 shadow-sm">
        <p className="text-gray-800 dark:text-gray-200 text-[15px] leading-relaxed whitespace-pre-wrap">
          {message}
        </p>

        {/* Inline visualization slot */}
        {children && <div className="mt-4">{children}</div>}
      </div>

      <div className="flex items-center gap-3 mt-1.5 ml-1">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {formattedTime}
        </span>
        <button
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          aria-label="Read aloud"
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

export default MessageBubble;
