/**
 * Screen 8 — Interactive Simulation (Reference Frame Switcher)
 *
 * A simplified interactive demo where users switch between reference frames
 * and see how the same motion looks different.
 * Unlock: 2+ interactions (frame switches or play/pause toggles).
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FC,
} from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { playSound } from "../SoundManager";
import type { ScreenProps } from "../types";

type Frame = "ground" | "train" | "space";

const FRAME_INFO: Record<
  Frame,
  { label: string; emoji: string; desc: string }
> = {
  ground: {
    label: "Ground observer",
    emoji: "🧍",
    desc: "You're standing on the platform watching the train go by.",
  },
  train: {
    label: "Train passenger",
    emoji: "🚆",
    desc: "You're sitting inside the smoothly-moving train.",
  },
  space: {
    label: "Astronaut",
    emoji: "🛰️",
    desc: "You're watching Earth from high above — everything moves.",
  },
};

const SimulationScreen: FC<ScreenProps> = ({ onProgressUpdate }) => {
  const [frame, setFrame] = useState<Frame>("ground");
  const [isPlaying, setIsPlaying] = useState(false);
  const [interactions, setInteractions] = useState(0);
  const [ballY, setBallY] = useState(0);
  const [trainX, setTrainX] = useState(0);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);

  const countInteraction = useCallback(() => {
    setInteractions((prev) => {
      const next = prev + 1;
      onProgressUpdate(next);
      return next;
    });
  }, [onProgressUpdate]);

  const switchFrame = (f: Frame) => {
    if (f === frame) return;
    setFrame(f);
    playSound("click");
    countInteraction();
  };

  const togglePlay = () => {
    setIsPlaying((p) => !p);
    playSound("click");
    countInteraction();
  };

  const reset = () => {
    setIsPlaying(false);
    timeRef.current = 0;
    setBallY(0);
    setTrainX(0);
  };

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    let last = performance.now();

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      timeRef.current += dt;
      const t = timeRef.current;

      // Ball: parabolic arc (up-down cycle every 2s)
      const cycle = t % 2;
      const ballHeight = cycle < 1 ? cycle : 2 - cycle; // 0→1→0
      setBallY(ballHeight);

      // Train: moves right
      setTrainX((t * 30) % 280);

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying]);

  // Compute visual positions based on frame
  const getBallStyle = (): React.CSSProperties => {
    if (frame === "train") {
      // In train's frame: ball goes straight up/down, centered
      return {
        left: "50%",
        bottom: `${20 + ballY * 50}%`,
        transform: "translateX(-50%)",
      };
    }
    if (frame === "ground") {
      // From ground: ball follows parabolic arc (moves with train)
      return {
        left: `${10 + (trainX / 280) * 80}%`,
        bottom: `${20 + ballY * 50}%`,
        transform: "translateX(-50%)",
      };
    }
    // Space: everything drifts — ball + train + ground all move
    return {
      left: `${10 + (trainX / 280) * 60 + 10}%`,
      bottom: `${20 + ballY * 40}%`,
      transform: "translateX(-50%)",
    };
  };

  const getTrainStyle = (): React.CSSProperties => {
    if (frame === "train") return { left: "35%", bottom: "18%" };
    if (frame === "ground")
      return { left: `${10 + (trainX / 280) * 80 - 8}%`, bottom: "18%" };
    return { left: `${10 + (trainX / 280) * 60 + 2}%`, bottom: "18%" };
  };

  const getGroundOffset = (): string => {
    if (frame === "space") return `translateX(-${trainX * 0.2}px)`;
    return "none";
  };

  const info = FRAME_INFO[frame];

  return (
    <div className="scrn-content-inner px-6 py-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">🎮</span>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Try It Yourself
        </h3>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Switch between reference frames and observe how the same ball toss looks
        different.{" "}
        {interactions < 2 && (
          <span className="font-medium text-blue-500">
            Interact at least 2 times to continue.
          </span>
        )}
      </p>

      {/* Reference frame buttons */}
      <div className="flex gap-2">
        {(Object.keys(FRAME_INFO) as Frame[]).map((f) => (
          <button
            key={f}
            onClick={() => switchFrame(f)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              frame === f
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {FRAME_INFO[f].emoji} {FRAME_INFO[f].label}
          </button>
        ))}
      </div>

      {/* Simulation viewport */}
      <div className="relative bg-gradient-to-b from-sky-900 to-indigo-950 rounded-xl h-56 overflow-hidden border border-gray-700">
        {/* Stars */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-0.5 h-0.5 bg-white/60 rounded-full"
            style={{
              left: `${(i * 73) % 100}%`,
              top: `${(i * 47) % 60}%`,
            }}
          />
        ))}

        {/* Ground line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-green-900/60 to-transparent"
          style={{ transform: getGroundOffset() }}
        />

        {/* Train (simplified) */}
        <div
          className="absolute w-20 h-8 bg-gray-300 dark:bg-gray-500 rounded-md flex items-center justify-center text-sm transition-none"
          style={getTrainStyle()}
        >
          🚃
        </div>

        {/* Ball */}
        <div
          className="absolute w-4 h-4 bg-yellow-400 rounded-full shadow-lg shadow-yellow-400/40 transition-none"
          style={getBallStyle()}
        />

        {/* Frame label */}
        <div className="absolute top-3 left-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-md backdrop-blur-sm">
          {info.emoji} {info.label}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center">
        {info.desc}
      </p>

      {/* Play controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={togglePlay}
          className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={reset}
          className="p-2.5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default SimulationScreen;
