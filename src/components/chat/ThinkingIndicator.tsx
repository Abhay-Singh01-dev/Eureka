import React, { type FC } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const ThinkingIndicator: FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-start mb-6"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-medium text-gray-700">Eureka</span>
      </div>

      <div className="ml-2 flex items-center gap-1.5 px-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm">
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: 0 }}
          className="w-2 h-2 rounded-full bg-blue-500"
        />
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
          className="w-2 h-2 rounded-full bg-blue-500"
        />
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }}
          className="w-2 h-2 rounded-full bg-blue-500"
        />
        <span className="ml-2 text-sm text-gray-500">thinking...</span>
      </div>
    </motion.div>
  );
};

export default ThinkingIndicator;
