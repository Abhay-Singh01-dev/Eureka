/**
 * Screen 11 — Reflection (optional, always unlocked)
 *
 * A calm, optional prompt where users write what they learned about motion.
 * Features:
 *  - Floating 💭 icon, info tooltip about why reflection helps
 *  - Character counter, "Eureka is listening" indicator at 50+ chars
 *  - GPT-5.2-chat personalised response (with local keyword fallback)
 *  - Save to MongoDB via /api/analytics/reflection
 *  - Cmd/Ctrl+Enter to submit, Escape skips
 *  - Full dark mode, mobile responsive, accessible
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, Sparkles, Send } from "lucide-react";
import { playSound } from "../SoundManager";
import type { ScreenProps } from "../types";
import "./ReflectionScreen.css";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const MAX_CHARS = 500;
const LISTENING_THRESHOLD = 50;

/* ═══════════════════════════════════════════════════════════════════════════
   LOCAL FALLBACK — keyword-based response
   ═══════════════════════════════════════════════════════════════════════════ */

function localFallbackResponse(text: string): string {
  const lower = text.toLowerCase();

  if (text.length < 15) {
    return "Every thought counts! Even a short reflection helps your brain remember. 🌟";
  }

  const showsConfusion =
    lower.includes("confus") ||
    lower.includes("not sure") ||
    lower.includes("still don't") ||
    lower.includes("hard");
  if (showsConfusion) {
    return "I can see you're still working through this—that's completely normal! Motion is one of physics' most counterintuitive concepts. The fact that you're thinking about it means you're learning. Feel free to revisit this node anytime!";
  }

  const mentionsRelative =
    lower.includes("relative") || lower.includes("depends");
  const mentionsReference =
    lower.includes("reference") ||
    lower.includes("frame") ||
    lower.includes("perspective") ||
    lower.includes("viewpoint");
  if (mentionsRelative && mentionsReference) {
    return "Beautiful! You've grasped the core idea: motion depends on your **reference frame**. This is the foundation Einstein used for his theory of relativity. You're thinking like a physicist! 🎉";
  }
  if (mentionsRelative) {
    return "Exactly! That's the key insight—motion is **relative**. You've captured the most important concept. The next step is understanding *why* it's relative (hint: reference frames!). Excellent work! 🌟";
  }

  const mentionsGalileo = lower.includes("galileo") || lower.includes("ship");
  const mentionsBall = lower.includes("ball") || lower.includes("mast");
  if (mentionsGalileo || mentionsBall) {
    return "I love that you connected this to Galileo's thought experiment! That 400-year-old puzzle still teaches us something profound today. The ball inherited the ship's motion—that's **inertia** in action.";
  }

  const mentionsExamples =
    lower.includes("car") ||
    lower.includes("train") ||
    lower.includes("plane") ||
    lower.includes("airplane");
  if (mentionsExamples) {
    return "Great job using real-world examples! That shows you understand how this applies beyond theory. Connecting physics to everyday life is a sign of *true understanding*.";
  }

  const mentionsSpeed =
    lower.includes("speed") ||
    lower.includes("velocity") ||
    lower.includes("km/h") ||
    lower.includes("moving");
  if (mentionsSpeed) {
    return "You're focusing on the measurable aspects—speed and velocity. Good! Remember that **velocity** includes direction, which is why it depends on your reference frame. Keep exploring!";
  }

  const showsExcitement =
    lower.includes("!") ||
    lower.includes("amazing") ||
    lower.includes("cool") ||
    lower.includes("love");
  if (showsExcitement) {
    return "I love your enthusiasm! Physics is full of mind-bending ideas like this. Your excitement means you're seeing the beauty in how the universe works. Keep that curiosity alive! 🚀";
  }

  if (text.length >= 50) {
    return "Thank you for taking the time to reflect thoughtfully. Putting physics into your own words helps your brain remember it better. You've clearly engaged with the material—*well done*!";
  }

  return "Great start! You've captured an important idea. Reflection helps solidify understanding. 🌟";
}

/* ═══════════════════════════════════════════════════════════════════════════
   API CALL — GPT-5.2-chat with fallback
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchEurekaResponse(reflectionText: string): Promise<string> {
  try {
    const res = await fetch("/api/reflection/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reflection: reflectionText.trim(),
        conversationContext:
          "This is the final reflection screen (Screen 11). " +
          "The student has completed the full motion module: video, Socratic dialogues, " +
          "simulation, examples, and summary. They are writing a final reflection " +
          "about everything they learned about motion, reference frames, and inertia.",
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.response || localFallbackResponse(reflectionText);
  } catch {
    return localFallbackResponse(reflectionText);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SAVE TO MONGODB
   ═══════════════════════════════════════════════════════════════════════════ */

async function saveReflection(text: string, skipped: boolean): Promise<void> {
  try {
    await fetch("/api/analytics/reflection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeId: "what-is-motion",
        phase: "final-reflection",
        reflection: skipped ? "" : text.trim(),
        selectedOption: skipped ? "skipped" : null,
        timestamp: Date.now(),
      }),
    });
  } catch {
    /* non-critical */
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MARKDOWN-LITE RENDERER — bold (**) and italic (* / _)
   ═══════════════════════════════════════════════════════════════════════════ */

function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={match.index} className="refl-emphasis">
          {match[2]}
        </strong>,
      );
    } else if (match[3] || match[4]) {
      parts.push(
        <em key={match.index} className="refl-italic">
          {match[3] || match[4]}
        </em>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

const ReflectionScreen: FC<ScreenProps> = ({ onProgressUpdate, isActive }) => {
  /* ── State ── */
  const [reflectionText, setReflectionText] = useState("");
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eurekaResponse, setEurekaResponse] = useState<string | null>(null);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(true);

  const charCount = reflectionText.length;
  const showListening = charCount >= LISTENING_THRESHOLD;

  /* ── Mounted tracking ── */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ── Always-unlocked: report progress 100 so Continue is available ── */
  useEffect(() => {
    if (isActive) {
      onProgressUpdate(100);
    }
  }, [isActive, onProgressUpdate]);

  /* ── Text change handler ── */
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      let text = e.target.value;
      if (text.length > MAX_CHARS) {
        text = text.substring(0, MAX_CHARS);
      }
      setReflectionText(text);
      if (!hasStartedTyping && text.length > 0) {
        setHasStartedTyping(true);
      }
    },
    [hasStartedTyping],
  );

  /* ── Info tooltip toggle ── */
  const handleTooltipToggle = useCallback(() => {
    setShowTooltip((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          if (mountedRef.current) setShowTooltip(false);
        }, 5000);
      }
      return next;
    });
  }, []);

  /* ── Click outside to close tooltip ── */
  useEffect(() => {
    if (!showTooltip) return;
    const handleClick = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showTooltip]);

  /* ── Submit reflection ── */
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    playSound("click");

    const hasText = reflectionText.trim().length > 0;

    // Save to MongoDB
    await saveReflection(reflectionText, !hasText);

    if (hasText) {
      // Generate personalised AI response
      setIsLoadingResponse(true);
      const response = await fetchEurekaResponse(reflectionText);
      if (!mountedRef.current) return;
      setIsLoadingResponse(false);
      setEurekaResponse(response);

      // Announce for screen readers
      const sr = document.createElement("div");
      sr.setAttribute("role", "status");
      sr.setAttribute("aria-live", "polite");
      sr.className = "sr-only";
      sr.textContent = "Eureka responds: " + response;
      document.body.appendChild(sr);
      setTimeout(() => {
        if (document.body.contains(sr)) document.body.removeChild(sr);
      }, 3000);
    } else {
      // Skipped — gentle encouragement
      setEurekaResponse(
        "No problem! Sometimes the best learning happens when we just experience it. Ready to see what you've accomplished?",
      );
    }
  }, [isSubmitting, reflectionText]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, isSubmitting, handleSubmit]);

  /* ── Determine button label ── */
  const buttonLabel = isSubmitting
    ? eurekaResponse
      ? "Submitted ✓"
      : "Thinking..."
    : charCount > 0
      ? "Save Reflection"
      : "Skip Reflection";

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="refl-root">
      {/* ── Floating icon ── */}
      <motion.div
        className="refl-icon-wrap"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <span className="refl-icon">💭</span>
      </motion.div>

      {/* ── Title ── */}
      <motion.h2
        className="refl-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        A Moment to Reflect
      </motion.h2>

      {/* ── Subtitle + info button ── */}
      <motion.div
        className="refl-subtitle-row"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <p className="refl-subtitle">
          This is entirely optional. Take a moment to put in your own words what
          you've learned about motion.
        </p>
        <button
          ref={triggerRef}
          className="refl-info-trigger"
          onClick={handleTooltipToggle}
          aria-label="Why reflection helps"
          type="button"
        >
          <Info className="w-4 h-4" />
        </button>
      </motion.div>

      {/* ── Info tooltip ── */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            ref={tooltipRef}
            className="refl-tooltip"
            role="tooltip"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="refl-tooltip-header">
              Why reflection helps learning:
            </div>
            <ul className="refl-tooltip-list">
              <li>Writing solidifies understanding</li>
              <li>Helps your brain remember better</li>
              <li>Reveals gaps in your knowledge</li>
              <li>Makes learning stick long-term</li>
            </ul>
            <div className="refl-tooltip-footer">
              (But it's totally optional!)
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Textarea ── */}
      <motion.div
        className="refl-textarea-wrap"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <textarea
          ref={textareaRef}
          className="refl-textarea"
          value={reflectionText}
          onChange={handleTextChange}
          placeholder="In my own words, motion is..."
          aria-label="Reflection text area. Optional: Share what you learned about motion."
          aria-describedby="refl-hint"
          aria-required="false"
          rows={7}
          maxLength={MAX_CHARS}
          disabled={isSubmitting}
        />
        <div id="refl-hint" className="sr-only">
          This reflection is entirely optional. Take a moment to put in your own
          words what you've learned about motion. Press Ctrl+Enter to submit.
        </div>
      </motion.div>

      {/* ── Character counter ── */}
      <AnimatePresence>
        {charCount > 0 && (
          <motion.div
            className="refl-char-counter"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="refl-char-num">{charCount}</span>
            <span className="refl-char-label"> / {MAX_CHARS} characters</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── "Eureka is listening" indicator ── */}
      <AnimatePresence>
        {showListening && !isSubmitting && (
          <motion.div
            className="refl-listening"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="refl-listening-avatar">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="refl-listening-text">
              Eureka is reading along… 👂
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading indicator ── */}
      <AnimatePresence>
        {isLoadingResponse && (
          <motion.div
            className="refl-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="refl-loading-dots">
              <span />
              <span />
              <span />
            </div>
            <span className="refl-loading-text">Eureka is thinking…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Eureka's response ── */}
      <AnimatePresence>
        {eurekaResponse && (
          <motion.div
            className="refl-response"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="refl-response-avatar">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="refl-response-bubble">
              <p className="refl-response-text">
                {renderMarkdown(eurekaResponse)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Submit / Skip button ── */}
      {!eurekaResponse && (
        <motion.div
          className="refl-submit-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <button
            className={`refl-submit-btn ${isSubmitting ? "refl-submit-btn--submitted" : ""}`}
            onClick={handleSubmit}
            disabled={isSubmitting}
            aria-label={
              charCount > 0
                ? "Save reflection and see Eureka's response"
                : "Skip reflection and proceed"
            }
            type="button"
          >
            {charCount > 0 && !isSubmitting && <Send className="w-4 h-4" />}
            <span>{buttonLabel}</span>
          </button>
          {!isSubmitting && charCount > 0 && (
            <p className="refl-shortcut-hint">Ctrl+Enter to submit</p>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ReflectionScreen;
