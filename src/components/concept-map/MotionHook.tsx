/**
 * MotionHook.tsx
 *
 * Phase 1 "The Hook" — segmented streaming with embedded interactive question.
 *
 * Flow:
 *   1. Streams intro text word-by-word at ~140 WPM
 *   2. Pauses at "are you moving?" and shows 3 answer buttons
 *   3. On selection → buttons fade out → adaptive response appears → resumes streaming
 *   4. Cosmic reveal unfolds → fires onStreamComplete
 *
 * TTS is split into pre-question + post-answer audio for sync.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import "./MotionHook.css";

/* ── Segmented script ─────────────────────────────────────────────────────── */

interface Segment {
  id: string;
  type: "text" | "interactive";
  content: string;
}

const WELCOME_SEGMENTS: Segment[] = [
  {
    id: "intro_1",
    type: "text",
    content: "Welcome! Before we begin, I have a strange question for you:",
  },
  {
    id: "question",
    type: "interactive",
    content: "Right now, as you read this… are you moving?",
  },
  {
    id: "post_answer_bridge",
    type: "text",
    content: "Let's zoom out for a moment.",
  },
  {
    id: "cosmic_1",
    type: "text",
    content: "You are moving at 1,670 kilometers per hour right now.",
  },
  {
    id: "cosmic_2",
    type: "text",
    content:
      "And at the same time, moving at 107,000 kilometers per hour in another direction.",
  },
  {
    id: "cosmic_3",
    type: "text",
    content:
      "And even more astonishing — moving at 720,000 kilometers per hour through our galaxy.",
  },
  {
    id: "confusion",
    type: "text",
    content:
      "Confused? Good. That confusion is the beginning of understanding.",
  },
];

/* ── Answer options & responses ───────────────────────────────────────────── */

const MOTION_OPTIONS = [
  { id: "yes", label: "Yes, obviously" },
  { id: "no", label: "No, I'm sitting still" },
  { id: "depends", label: "It depends…" },
] as const;

const RESPONSE_MAP: Record<string, string> = {
  yes: "Interesting. So you suspect something larger is happening. Let's see how large.",
  no: "That feels true. You're not walking or running. But what if your room itself is moving?",
  depends:
    "That's a very physicist-like answer. It depends on what you're measuring against.",
};

/* ── Full text for TTS ────────────────────────────────────────────────────── */

const PRE_QUESTION_TEXT = WELCOME_SEGMENTS.filter(
  (s) => s.id === "intro_1" || s.id === "question",
)
  .map((s) => s.content)
  .join("\n\n");

const POST_ANSWER_TEXT = WELCOME_SEGMENTS.filter(
  (s) => s.type === "text" && s.id !== "intro_1",
)
  .map((s) => s.content)
  .join("\n\n");

/* ── Character-by-character streaming helper ──────────────────────────────── */

/**
 * Streams text character-by-character with natural pacing:
 *  - Base rate ~30ms per char (~33 chars/sec, pleasant reading speed)
 *  - Slight pause after punctuation (. , ! ? ; :) for natural rhythm
 *  - Tiny random jitter so it doesn't feel mechanical
 */
function getCharDelay(char: string): number {
  const base = 30; // ms per character
  const jitter = Math.random() * 10 - 5; // ±5ms

  if (".!?".includes(char)) return base + 180 + jitter; // sentence pause
  if (",;:".includes(char)) return base + 80 + jitter; // clause pause
  if (char === "\n") return base + 60; // line break pause
  if (char === " ") return base + 5 + jitter; // tiny space pause
  return base + jitter;
}

/* ── Component ────────────────────────────────────────────────────────────── */

interface MotionHookProps {
  onStreamComplete?: () => void;
}

const MotionHook: FC<MotionHookProps> = ({ onStreamComplete }) => {
  /* ── State ── */
  const [preText, setPreText] = useState(""); // text above the option
  const [postText, setPostText] = useState(""); // text below the option
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [allDone, setAllDone] = useState(false);

  /* ── Audio state ── */
  const [isMuted, setIsMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* ── Refs ── */
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const onCompleteRef = useRef(onStreamComplete);
  useEffect(() => {
    onCompleteRef.current = onStreamComplete;
  }, [onStreamComplete]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ── Core: stream characters one-by-one with natural pacing ─────────── */
  const streamTokens = useCallback(
    (
      text: string,
      setter: React.Dispatch<React.SetStateAction<string>>,
    ): Promise<void> => {
      return new Promise((resolve) => {
        const chars = Array.from(text);
        let idx = 0;

        const scheduleNext = () => {
          if (!mountedRef.current) {
            resolve();
            return;
          }
          if (idx >= chars.length) {
            intervalRef.current = null;
            resolve();
            return;
          }

          const char = chars[idx];
          setter((prev) => prev + char);
          idx += 1;

          const delay = getCharDelay(char);
          intervalRef.current = setTimeout(
            scheduleNext,
            delay,
          ) as unknown as ReturnType<typeof setInterval>;
        };

        scheduleNext();
      });
    },
    [],
  );

  /* ── Drive segment-by-segment streaming ─────────────────────────────── */
  const streamFrom = useCallback(
    async (
      startIdx: number,
      setter: React.Dispatch<React.SetStateAction<string>>,
    ) => {
      for (let i = startIdx; i < WELCOME_SEGMENTS.length; i++) {
        if (!mountedRef.current) return;
        const seg = WELCOME_SEGMENTS[i];

        if (seg.type === "interactive") {
          // Stream the question text
          if (i > 0) setter((prev) => prev + "\n\n");
          await streamTokens(seg.content, setter);
          if (!mountedRef.current) return;

          // Pause for user interaction
          setSegmentIndex(i);
          setIsPaused(true);
          // Small pause before showing options
          await new Promise((r) => setTimeout(r, 400));
          if (mountedRef.current) setShowOptions(true);
          return; // stop — user must pick an answer to resume
        }

        // Normal text segment
        if (i > 0) setter((prev) => prev + "\n\n");
        await streamTokens(seg.content, setter);
        if (!mountedRef.current) return;
        setSegmentIndex(i + 1);
      }

      // All segments done
      if (mountedRef.current) {
        setAllDone(true);
        onCompleteRef.current?.();
      }
    },
    [streamTokens],
  );

  /* ── Kick off on mount ──────────────────────────────────────────────── */
  useEffect(() => {
    streamFrom(0, setPreText);
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Answer selection handler ───────────────────────────────────────── */
  const handleAnswer = useCallback(
    (answerId: string) => {
      if (selectedAnswer) return; // already picked
      setSelectedAnswer(answerId);

      // Options stay visible — render filters to show only selected one

      // Show adaptive response after a beat — goes into postText (below option)
      setTimeout(() => {
        if (!mountedRef.current) return;
        setShowResponse(true);

        // Append response text below the option
        const response = RESPONSE_MAP[answerId];
        setPostText(response);

        // Resume streaming after 800ms pause — continues into postText
        setTimeout(() => {
          if (!mountedRef.current) return;
          setIsPaused(false);
          const interactiveIdx = WELCOME_SEGMENTS.findIndex(
            (s) => s.type === "interactive",
          );
          streamFrom(interactiveIdx + 1, setPostText);
        }, 800);
      }, 300);
    },
    [selectedAnswer, streamFrom],
  );

  /* ── Skip handler ───────────────────────────────────────────────────── */
  const handleSkip = useCallback(() => {
    // Stop any active streaming
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }

    const interactiveIdx = WELCOME_SEGMENTS.findIndex(
      (s) => s.type === "interactive",
    );

    // Pre-text: segments up to and including the interactive question
    const preParts = WELCOME_SEGMENTS.slice(0, interactiveIdx + 1).map(
      (s) => s.content,
    );
    setPreText(preParts.join("\n\n"));

    // Post-text: response + remaining segments after the question
    const answer = selectedAnswer || "depends";
    if (!selectedAnswer) setSelectedAnswer("depends");
    const postParts = [
      RESPONSE_MAP[answer],
      ...WELCOME_SEGMENTS.slice(interactiveIdx + 1).map((s) => s.content),
    ];
    setPostText(postParts.join("\n\n"));

    setShowOptions(true);
    setShowResponse(true);
    setIsPaused(false);
    setAllDone(true);
    onCompleteRef.current?.();

    // Stop audio
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
  }, [selectedAnswer]);

  /* ── TTS: Pre-question audio on mount ───────────────────────────────── */
  useEffect(() => {
    fetch("/api/tts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: PRE_QUESTION_TEXT }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("TTS fetch failed");
        return res.json();
      })
      .then((data: { audioUrl: string }) => {
        if (!mountedRef.current) return;
        const a = new Audio(data.audioUrl);
        a.muted = false;
        a.play().catch(() => {});
        audioRef.current = a;
        setAudioReady(true);
      })
      .catch(() => {
        /* TTS unavailable — silent fallback */
      });
  }, []);

  /* ── TTS: Post-answer audio when answer selected ────────────────────── */
  useEffect(() => {
    if (!selectedAnswer) return;

    const postText = RESPONSE_MAP[selectedAnswer] + "\n\n" + POST_ANSWER_TEXT;

    fetch("/api/tts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: postText }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("TTS fetch failed");
        return res.json();
      })
      .then((data: { audioUrl: string }) => {
        if (!mountedRef.current) return;
        // Stop pre-question audio first
        const prev = audioRef.current;
        if (prev) {
          prev.pause();
          prev.currentTime = 0;
        }
        const a = new Audio(data.audioUrl);
        a.muted = isMuted;
        a.play().catch(() => {});
        audioRef.current = a;
      })
      .catch(() => {
        /* TTS unavailable — silent fallback */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnswer]);

  /* ── Cleanup audio on unmount ───────────────────────────────────────── */
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.currentTime = 0;
      }
    };
  }, []);

  /* ── Mute toggle ────────────────────────────────────────────────────── */
  const handleMuteToggle = () => {
    const next = !isMuted;
    setIsMuted(next);
    const a = audioRef.current;
    if (a) a.muted = next;
  };

  /* ── Computed state ─────────────────────────────────────────────────── */
  const isStreaming = !allDone && !isPaused;

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Message bubble ── */}
      <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl rounded-tl-md px-5 py-4 shadow-sm relative overflow-hidden">
        {/* Drifting gradient — visible only while streaming */}
        {isStreaming && <div className="mhook-bg" aria-hidden="true" />}

        {/* ── Pre-answer text (above the option) ── */}
        <p
          className="relative text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line"
          aria-live="polite"
          aria-atomic="false"
        >
          {preText}
          {isStreaming && !selectedAnswer && (
            <span className="mhook-cursor" aria-hidden="true">
              ▋
            </span>
          )}
        </p>

        {/* ── Inline answer options (pinned between pre and post text) ── */}
        <AnimatePresence>
          {showOptions && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="mhook-options"
            >
              {MOTION_OPTIONS.map((opt, i) => {
                const isSelected = selectedAnswer === opt.id;
                const isOther = selectedAnswer && !isSelected;
                // After selection: hide non-selected options
                if (isOther) return null;
                return (
                  <motion.button
                    key={opt.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.2 }}
                    onClick={() => !selectedAnswer && handleAnswer(opt.id)}
                    className={`mhook-option ${isSelected ? "mhook-option-selected" : ""}`}
                    disabled={!!selectedAnswer}
                  >
                    {isSelected && <span className="mr-1.5">{"✓"}</span>}
                    {opt.label}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Post-answer text (below the option, streams here) ── */}
        {postText && (
          <p
            className="relative text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line mt-3"
            aria-live="polite"
            aria-atomic="false"
          >
            {postText}
            {isStreaming && selectedAnswer && (
              <span className="mhook-cursor" aria-hidden="true">
                ▋
              </span>
            )}
          </p>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center gap-3 mt-2">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Just now
        </span>

        {audioReady && (
          <button
            onClick={handleMuteToggle}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label={isMuted ? "Unmute narration" : "Mute narration"}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {!allDone && (
          <button
            onClick={handleSkip}
            className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
            aria-label="Skip the streaming introduction"
          >
            Skip Intro
          </button>
        )}
      </div>
    </>
  );
};

export default MotionHook;
