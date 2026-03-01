import React, { useState, type FC } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipForward,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface VideoPlayerProps {
  title?: string;
  duration?: string;
  thumbnail?: string | null;
  onSkip?: () => void;
}

const VideoPlayer: FC<VideoPlayerProps> = ({
  title = "Visual Introduction",
  duration = "3:00",
  thumbnail = null,
  onSkip,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [progress, setProgress] = useState<number[]>([0]);
  const [showControls, setShowControls] = useState<boolean>(true);

  // Mock video content with animated gradient
  const VideoContent: FC = () => (
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 overflow-hidden">
      {/* Animated particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-white/20"
          initial={{
            x: Math.random() * 100 + "%",
            y: Math.random() * 100 + "%",
            scale: Math.random() * 0.5 + 0.5,
          }}
          animate={
            isPlaying
              ? {
                  x: [null, Math.random() * 100 + "%"],
                  y: [null, Math.random() * 100 + "%"],
                }
              : {}
          }
          transition={{
            duration: 10 + Math.random() * 10,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}

      {/* Central animation placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="text-center"
          animate={isPlaying ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="text-6xl mb-4">🌍</div>
          <p className="text-white/70 text-sm">Gravity Animation</p>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-black group"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(isPlaying ? false : true)}
    >
      {/* Video area */}
      <div className="relative aspect-video">
        <VideoContent />

        {/* Play/Pause overlay */}
        {!isPlaying && (
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={() => setIsPlaying(true)}
            className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors"
          >
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
              <Play className="w-8 h-8 text-gray-900 ml-1" />
            </div>
          </motion.button>
        )}

        {/* Controls overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showControls || !isPlaying ? 1 : 0 }}
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4"
        >
          {/* Progress bar */}
          <div className="mb-3">
            <Slider
              value={progress}
              onValueChange={setProgress}
              min={0}
              max={100}
              step={1}
              className="[&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:bg-white"
            />
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              <span className="text-xs text-white/70 ml-2">
                {Math.floor((progress[0] * 1.8) / 60)}:
                {String(Math.floor(progress[0] * 1.8) % 60).padStart(2, "0")} /{" "}
                {duration}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="text-xs text-white/70 hover:text-white flex items-center gap-1 transition-colors"
                >
                  Skip <SkipForward className="w-3 h-3" />
                </button>
              )}
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Title bar */}
      <div className="p-3 bg-gray-50 border-t border-gray-100">
        <p className="text-sm font-medium text-gray-700">{title}</p>
      </div>
    </div>
  );
};

export default VideoPlayer;
