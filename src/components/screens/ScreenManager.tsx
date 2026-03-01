/**
 * ScreenManager — orchestrates 12-screen progressive disclosure
 *
 * Responsibilities:
 *  - Track current screen, completed screens, progress per screen
 *  - Handle forward/back transitions with animation
 *  - Monitor unlock conditions and pass progress to ContinueButton
 *  - Persist progress in localStorage
 *  - Handle scroll-based progress for scrollable screens
 *  - Sound effects on transitions
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  type FC,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Volume2, VolumeX } from "lucide-react";
import { MOTION_SCREENS } from "./config";
import ProgressBubbles from "./ProgressBubbles";
import ContinueButton from "./ContinueButton";
import { playSound, soundManager } from "./SoundManager";

// Screens
import WelcomeScreen from "./screens/WelcomeScreen";
import VideoScreen from "./screens/VideoScreen";
import PostVideoSocratic from "./screens/PostVideoSocratic";
import InsightScreen from "./screens/InsightScreen";
import QuickCheckScreen from "./screens/QuickCheckScreen";
import GalileoScreen from "./screens/GalileoScreen";
import SocraticScreen from "./screens/SocraticScreen";
import SimulationScreen from "./screens/SimulationScreen";
import ExamplesScreen from "./screens/ExamplesScreen";
import SummaryScreen from "./screens/SummaryScreen";
import ReflectionScreen from "./screens/ReflectionScreen";
import CompletionScreen from "./screens/CompletionScreen";

import "./ScreenStyles.css";

// ── Persistence key ──
const LS_KEY = "eureka_motion_screen_state";

interface PersistedState {
  currentScreen: number;
  completedScreens: number[];
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.currentScreen && Array.isArray(parsed.completedScreens)) {
        // Clamp to new screen count (migrating from 11 → 12 screens)
        const total = MOTION_SCREENS.length;
        return {
          currentScreen: Math.min(parsed.currentScreen, total),
          completedScreens: parsed.completedScreens.filter(
            (n: number) => n <= total,
          ),
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { currentScreen: 1, completedScreens: [] };
}

function saveState(s: PersistedState) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

// ── Props ──
interface ScreenManagerProps {
  onBack: () => void;
  onMarkComplete: (nodeId: number) => void;
}

// ── Motion variants for slide transitions ──
const variants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -40 : 40,
    opacity: 0,
  }),
};

const TOTAL = MOTION_SCREENS.length; // 12

// ── Component ──
const ScreenManager: FC<ScreenManagerProps> = ({ onBack, onMarkComplete }) => {
  const initial = loadState();
  const [currentScreen, setCurrentScreen] = useState(initial.currentScreen);
  const [completedScreens, setCompletedScreens] = useState<number[]>(
    initial.completedScreens,
  );
  const [progress, setProgress] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMuted, setIsMuted] = useState(soundManager.isSoundsMuted());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist on change
  useEffect(() => {
    saveState({ currentScreen, completedScreens });
  }, [currentScreen, completedScreens]);

  // Reset progress when screen changes
  useEffect(() => {
    const cfg = MOTION_SCREENS[currentScreen - 1];
    // If the screen was already completed or always-unlocked, start at 100
    if (
      completedScreens.includes(currentScreen) ||
      cfg.unlockCondition.type === "always"
    ) {
      setProgress(100);
    } else {
      setProgress(0);
    }
    // Reset scroll position
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [currentScreen, completedScreens]);

  // ── Progress updates from child screens ──
  const handleProgressUpdate = useCallback((val: number) => {
    setProgress((prev) => Math.max(prev, val));
  }, []);

  // ── Scroll tracking for scrollable screens ──
  const handleContentScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) return;
    const pct = (scrollTop / scrollable) * 100;
    setProgress((prev) => Math.max(prev, pct));
  }, []);

  // ── Navigation ──
  const goForward = useCallback(() => {
    if (isTransitioning || currentScreen >= TOTAL) return;
    setIsTransitioning(true);
    setDirection(1);

    // Mark current as completed
    setCompletedScreens((prev) =>
      prev.includes(currentScreen) ? prev : [...prev, currentScreen],
    );

    playSound("screenEnter");

    setTimeout(() => {
      setCurrentScreen((prev) => prev + 1);
      setIsTransitioning(false);
    }, 300);
  }, [isTransitioning, currentScreen]);

  const goBack = useCallback(() => {
    if (isTransitioning || currentScreen <= 1) return;
    setIsTransitioning(true);
    setDirection(-1);

    setTimeout(() => {
      setCurrentScreen((prev) => prev - 1);
      setIsTransitioning(false);
    }, 300);
  }, [isTransitioning, currentScreen]);

  // ── Keyboard ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && currentScreen > 1) {
        goBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, currentScreen]);

  // ── Sound toggle ──
  const toggleSound = () => {
    const nowMuted = soundManager.toggleMute();
    setIsMuted(nowMuted);
    if (!nowMuted) playSound("click");
  };

  // ── Determine if current screen is scroll-tracked ──
  const cfg = MOTION_SCREENS[currentScreen - 1];
  const isScrollTracked = cfg.unlockCondition.type === "scroll_complete";
  const isFinal = currentScreen === TOTAL;

  // ── Render screen content ──
  const renderScreen = () => {
    const props = { onProgressUpdate: handleProgressUpdate, isActive: true };

    switch (currentScreen) {
      case 1:
        return <WelcomeScreen {...props} />;
      case 2:
        return <VideoScreen {...props} />;
      case 3:
        return <PostVideoSocratic {...props} />;
      case 4:
        return <InsightScreen {...props} />;
      case 5:
        return <QuickCheckScreen {...props} />;
      case 6:
        return <GalileoScreen {...props} />;
      case 7:
        return <SocraticScreen {...props} />;
      case 8:
        return <SimulationScreen {...props} />;
      case 9:
        return <ExamplesScreen {...props} />;
      case 10:
        return <SummaryScreen {...props} />;
      case 11:
        return <ReflectionScreen {...props} />;
      case 12:
        return (
          <CompletionScreen
            {...props}
            onBackToMap={onBack}
            onMarkComplete={() => onMarkComplete(1)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="scrn-container">
      {/* ── Back button (only after screen 1) ── */}
      {currentScreen > 1 && (
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goBack}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <button
            onClick={toggleSound}
            className="scrn-sound-toggle"
            aria-label={isMuted ? "Unmute sounds" : "Mute sounds"}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}

      {/* ── Content area ── */}
      <div
        ref={scrollRef}
        className="scrn-content-area"
        onScroll={isScrollTracked ? handleContentScroll : undefined}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentScreen}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="scrn-content-wrapper"
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Footer: bubbles + continue ── */}
      {currentScreen < TOTAL && (
        <div className="scrn-footer">
          <ProgressBubbles
            totalScreens={TOTAL}
            currentScreen={currentScreen}
            completedScreens={completedScreens}
          />
          <ContinueButton
            unlockCondition={cfg.unlockCondition}
            onContinue={goForward}
            screenNumber={currentScreen}
            progress={progress}
            isFinal={currentScreen === TOTAL - 1}
          />
        </div>
      )}
    </div>
  );
};

export default ScreenManager;
