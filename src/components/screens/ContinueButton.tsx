import React, { useState, useEffect, type FC } from "react";
import { playSound } from "./SoundManager";
import type { UnlockCondition } from "./types";

interface ContinueButtonProps {
  unlockCondition: UnlockCondition;
  onContinue: () => void;
  screenNumber: number;
  progress: number;
  /** Whether this is the very last screen (show "Finish" instead) */
  isFinal?: boolean;
}

const ContinueButton: FC<ContinueButtonProps> = ({
  unlockCondition,
  onContinue,
  screenNumber,
  progress,
  isFinal = false,
}) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [buttonState, setButtonState] = useState<
    "locked" | "unlocked" | "clicked"
  >("locked");

  // ── Reset state when screen changes ─────────────────────
  useEffect(() => {
    setIsUnlocked(false);
    setButtonState("locked");
  }, [screenNumber]);

  // ── Check unlock condition ──────────────────────────────
  useEffect(() => {
    if (isUnlocked) return;

    let shouldUnlock = false;

    switch (unlockCondition.type) {
      case "always":
        shouldUnlock = true;
        break;
      case "streaming_complete":
        shouldUnlock = progress >= 100;
        break;
      case "video_progress":
        shouldUnlock = progress >= (unlockCondition.threshold ?? 40);
        break;
      case "scroll_complete":
        shouldUnlock = progress >= (unlockCondition.threshold ?? 60);
        break;
      case "interaction_count":
        shouldUnlock = progress >= (unlockCondition.threshold ?? 2);
        break;
      case "answer_selected":
        shouldUnlock = progress >= 1;
        break;
    }

    if (shouldUnlock) {
      setIsUnlocked(true);
      setButtonState("unlocked");
      playSound("unlock");
    }
  }, [progress, unlockCondition, isUnlocked]);

  // ── Click handler ───────────────────────────────────────
  const handleClick = () => {
    if (!isUnlocked || buttonState === "clicked") return;
    setButtonState("clicked");
    playSound("click");
    setTimeout(() => onContinue(), 280);
  };

  // ── Button label ────────────────────────────────────────
  const getLabel = (): string => {
    if (buttonState === "clicked")
      return isFinal ? "Finishing..." : "Continue \u2713";

    if (!isUnlocked) {
      switch (unlockCondition.type) {
        case "video_progress": {
          const rem = Math.ceil((unlockCondition.threshold ?? 40) - progress);
          return `Continue (watch ${Math.max(rem, 0)}% more)`;
        }
        case "scroll_complete":
          return "Continue (scroll to read more)";
        case "interaction_count": {
          const left = Math.max((unlockCondition.threshold ?? 2) - progress, 0);
          return `Continue (try ${left} more ${left === 1 ? "time" : "times"})`;
        }
        case "answer_selected":
          return "Continue (select an answer)";
        case "streaming_complete":
          return "Continue (listening...)";
        default:
          return "Continue";
      }
    }

    return isFinal ? "Finish →" : "Continue →";
  };

  return (
    <button
      className={`scrn-continue scrn-continue--${buttonState}`}
      onClick={handleClick}
      disabled={!isUnlocked}
      aria-label={`Continue to screen ${screenNumber + 1}`}
    >
      <span>{getLabel()}</span>
    </button>
  );
};

export default ContinueButton;
