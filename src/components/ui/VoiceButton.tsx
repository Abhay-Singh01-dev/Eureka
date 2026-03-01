import React, { useState, type FC } from "react";
import { Mic, MicOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface VoiceButtonProps {
  onTranscript?: (text: string) => void;
  size?: "default" | "large";
  disabled?: boolean;
}

const VoiceButton: FC<VoiceButtonProps> = ({
  onTranscript,
  size = "default",
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleVoiceInput = () => {
    if (isRecording) {
      setIsRecording(false);
      // Mock transcription
      setTimeout(() => {
        onTranscript?.("Why doesn't the moon fall to Earth?");
      }, 500);
      return;
    }

    setIsRecording(true);
    setError(null);

    // Simulate recording for 3 seconds
    setTimeout(() => {
      setIsRecording(false);
      onTranscript?.("Why doesn't the moon fall to Earth?");
    }, 3000);
  };

  const sizeClasses: Record<string, string> = {
    default: "w-10 h-10",
    large: "w-14 h-14",
  };

  return (
    <div className="relative">
      <motion.button
        onClick={handleVoiceInput}
        disabled={disabled && !isRecording}
        whileTap={{ scale: 0.95 }}
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center transition-all duration-200 ${
          isRecording
            ? "bg-red-500 text-white"
            : disabled
              ? "bg-gray-100 text-gray-400 cursor-not-allowed opacity-40"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
        aria-label={isRecording ? "Stop recording" : "Start voice input"}
      >
        <AnimatePresence mode="wait">
          {isRecording ? (
            <motion.div
              key="recording"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <MicOff className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Mic className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Recording indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute -top-1 -right-1 w-3 h-3"
          >
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="absolute top-full mt-2 text-xs text-red-500 whitespace-nowrap">
          {error}
        </p>
      )}
    </div>
  );
};

export default VoiceButton;
