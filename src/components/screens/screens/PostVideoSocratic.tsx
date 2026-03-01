/**
 * PostVideoSocratic.tsx
 *
 * Phase 3 — Post-Video Socratic Dialogue (after video screen)
 *
 * Full multi-turn adaptive dialogue:
 *   1. Eureka streams a question about Galileo's ship experiment
 *   2. User picks from 4 options → intelligent response varies by selection
 *   3. Follow-up questions deepen understanding (adaptive difficulty)
 *   4. Optional reflection prompt → saved to MongoDB
 *   5. Transition prompt to next phase (simulation)
 *
 * Character-by-character streaming with natural pacing.
 * TTS via Azure Neural Speech (pre-question + post-answer).
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Volume2, VolumeX, Send, SkipForward } from "lucide-react";
import { playSound } from "../SoundManager";
import type { ScreenProps } from "../types";
import "./PostVideoSocratic.css";

/* ═══════════════════════════════════════════════════════════════════════════
   CONTENT DATA — Questions, Options, Responses, Follow-ups
   ═══════════════════════════════════════════════════════════════════════════ */

const INITIAL_QUESTION = `You just watched how motion depends on your reference frame.

Here's what I'm curious about: In the video, you saw the ball dropped from the mast of a moving ship. It landed at the base of the mast, not behind the ship.

Why do **YOU** think that happened?

_Don't worry about the "right" answer—just tell me what your intuition says._`;

interface ChoiceOption {
  id: string;
  icon: string;
  label: string;
}

const INITIAL_OPTIONS: ChoiceOption[] = [
  {
    id: "ship_carry",
    icon: "🚢",
    label: "The ship's motion carried the ball forward",
  },
  {
    id: "already_moving",
    icon: "✓",
    label: "The ball was already moving with the ship",
  },
  { id: "gravity", icon: "⬇️", label: "Gravity pulled it straight down" },
  { id: "hint", icon: "💡", label: "I'm not sure, can you give a hint?" },
];

/* ── Adaptive responses keyed by option id ──────────────────────────────── */

interface ResponseData {
  text: string;
  isCorrect: boolean;
  followUp: FollowUpData | null;
}

interface FollowUpData {
  question: string;
  options: ChoiceOption[];
  responses: Record<string, FollowUpResponse>;
}

interface FollowUpResponse {
  text: string;
  isCorrect: boolean;
}

const RESPONSES: Record<string, ResponseData> = {
  /* ── Option 1: Ship's motion carried the ball (partial misconception) ── */
  ship_carry: {
    text: `I can see why you'd think that! It *feels* like the ship is "carrying" the ball forward through the air.

But let me ask you this: After the ball leaves your hand, is the ship still touching the ball?

Right—once released, there's no physical connection. The ship can't push the ball forward anymore.

So here's the key: The ball doesn't need the ship to "carry" it forward because the ball was **ALREADY** moving forward—at the same speed as the ship—before you let go.

It's like you're in a car at 100 km/h and you toss a ball straight up. The ball doesn't fly backward out of the car, does it? It lands back in your hand because the ball was already traveling at 100 km/h forward with you.

This is called **INERTIA**: objects keep moving at their current velocity unless a force changes that.

Does that make the ship example clearer?`,
    isCorrect: false,
    followUp: {
      question: "Does that make the ship example clearer?",
      options: [
        { id: "clear_yes", icon: "✓", label: "Yes, that makes sense" },
        { id: "clear_no", icon: "🤔", label: "I'm still a bit confused" },
      ],
      responses: {
        clear_yes: {
          text: `Great! You've grasped one of Newton's most powerful ideas.

Now let me test that understanding with a trickier scenario:

Imagine the ship is moving at 10 m/s. You throw the ball forward at 5 m/s (relative to you).

How fast is the ball moving relative to the water?`,
          isCorrect: true,
        },
        clear_no: {
          text: `That's okay! Let me try a different angle.

Imagine you're on a skateboard rolling at 2 m/s. You toss a ball straight up. Where does it land?

Right back in your hands. Even though you and the skateboard kept rolling forward.

The ball didn't magically "know" to move forward with you. It just *kept* the forward motion it already had—2 m/s forward—because nothing stopped it.

Same principle on the ship. The ball "remembers" its forward motion even after you let go. Gravity only adds downward motion; it can't erase the sideways motion.`,
          isCorrect: true,
        },
      },
    },
  },

  /* ── Option 2: Already moving with the ship (CORRECT) ────────────────── */
  already_moving: {
    text: `**Exactly!** You've nailed it. 🎯

The ball wasn't suddenly dropped from rest—it was already traveling horizontally at the same speed as the ship.

Here's a beautiful insight you just demonstrated: Motion isn't something that "starts" when an object is released. The ball's horizontal motion existed all along; you just finally noticed it when the vertical motion (falling) started.

Now let me give you a trickier question:

Imagine the ship is moving at 10 m/s. You're standing on the mast and you throw the ball forward at 5 m/s (relative to you).

How fast is the ball moving relative to the water?`,
    isCorrect: true,
    followUp: {
      question: "How fast is the ball moving relative to the water?",
      options: [
        { id: "vel_10", icon: "🔢", label: "10 m/s" },
        { id: "vel_5", icon: "🔢", label: "5 m/s" },
        { id: "vel_15", icon: "🔢", label: "15 m/s" },
        { id: "vel_hint", icon: "💡", label: "I need a hint" },
      ],
      responses: {
        vel_10: {
          text: `Not quite — 10 m/s is just the ship's speed. But you also threw the ball forward at 5 m/s on top of that.

Think about it this way: The ball already has the ship's 10 m/s. You then add 5 m/s more by throwing. Velocities in the same direction simply add up.

So the answer is **15 m/s**. This is called **Galilean velocity addition** — and it's one of the cornerstones of classical mechanics!`,
          isCorrect: false,
        },
        vel_5: {
          text: `That would be the speed relative to *you* on the ship — but we're asking about the water (someone standing still on shore).

The ball inherits the ship's 10 m/s, and you add 5 m/s by throwing. Velocities in the same direction add up.

So the answer is **15 m/s**. This is **Galilean velocity addition** in action!`,
          isCorrect: false,
        },
        vel_15: {
          text: `**Perfect!** You've just applied **Galilean velocity addition**.

The ball's velocity relative to water = ship's velocity (10 m/s) + your throw (5 m/s) = **15 m/s**.

This simple addition works beautifully in everyday physics. (Fun fact: it breaks down at near-light speeds, but that's Einstein's territory — we'll get there!)`,
          isCorrect: true,
        },
        vel_hint: {
          text: `Here's the key: the ball already has the ship's velocity (10 m/s forward). When you throw it forward at 5 m/s relative to yourself, you're *adding* to the motion it already has.

So: 10 m/s (from ship) + 5 m/s (from throw) = **15 m/s** relative to the water.

This is called **Galilean velocity addition** — velocities simply add when measured from different reference frames!`,
          isCorrect: true,
        },
      },
    },
  },

  /* ── Option 3: Gravity pulled it down (common misconception) ──────────── */
  gravity: {
    text: `You're absolutely right that gravity pulls the ball downward!

But here's the thing: Gravity only affects **vertical** motion. It doesn't touch the horizontal motion at all.

Think of it this way: Gravity can't slow down or speed up the ball's forward movement—only its downward movement.

Let me show you a thought experiment:

Imagine you're running forward at 5 m/s. You drop a ball while running. Does it:`,
    isCorrect: false,
    followUp: {
      question: "What happens when you drop a ball while running?",
      options: [
        {
          id: "fall_behind",
          icon: "🅰️",
          label: "Falls straight down and lands behind you",
        },
        {
          id: "fall_curved",
          icon: "🅱️",
          label: "Falls in a curved path and lands at your feet",
        },
        { id: "fall_unsure", icon: "🤔", label: "I'm not sure" },
      ],
      responses: {
        fall_behind: {
          text: `It's a natural guess, but actually the ball lands at your feet!

Why? Because the ball inherited your 5 m/s forward motion when you were holding it. When you let go, gravity pulls it down, but doesn't remove that 5 m/s forward velocity.

So the ball moves forward (at 5 m/s) AND downward (accelerating under gravity) at the same time. It traces a curved path but stays right with you.

Same with the ship: The ball inherited the ship's forward motion. Gravity pulls it down, but the ball **keeps** moving forward at the same speed as the ship.

This is why it lands at the base of the mast — not behind it.`,
          isCorrect: false,
        },
        fall_curved: {
          text: `**Yes! Exactly right.** 

The ball falls in a curved path and lands at your feet. Why? Because the ball inherited your forward motion (5 m/s) when you were holding it. Gravity pulls it down, but doesn't erase that forward velocity.

Same principle with the ship: The ball inherited the ship's forward motion. Gravity adds downward motion but doesn't touch the horizontal speed.

That's why it lands at the base of the mast — not behind it. The ball was moving forward at the same speed the whole time!`,
          isCorrect: true,
        },
        fall_unsure: {
          text: `Let me help you think through it.

When you hold a ball while running at 5 m/s, the ball is also moving forward at 5 m/s (it has to be — it's in your hand!).

When you let go, does gravity suddenly make the ball stop moving forward? No! Gravity only pulls **downward**. It has no effect on sideways motion.

So the ball keeps its 5 m/s forward speed AND starts falling. It traces a curve and lands right at your feet.

This is exactly what happens on the ship. The ball keeps the ship's forward speed even after you let go.`,
          isCorrect: true,
        },
      },
    },
  },

  /* ── Option 4: Hint request ────────────────────────────────────────────── */
  hint: {
    text: `I love that you're being honest! Not knowing is the first step to understanding. 💫

Here's a hint: Think about what was true about the ball **BEFORE** you dropped it.

Was the ball:
• Sitting still (0 m/s)?
• Moving forward with the ship (10 m/s)?

When you let go, does gravity suddenly erase that forward motion? Or does the ball **keep** that motion?

Now, with that hint, take another look. Which one feels right?`,
    isCorrect: false,
    followUp: {
      question: "With the hint in mind, which feels right?",
      options: [
        {
          id: "retry_carry",
          icon: "🚢",
          label: "The ship's motion carried the ball forward",
        },
        {
          id: "retry_already",
          icon: "✓",
          label: "The ball was already moving with the ship",
        },
        {
          id: "retry_gravity",
          icon: "⬇️",
          label: "Gravity pulled it straight down",
        },
      ],
      responses: {
        retry_carry: {
          text: `Close, but there's a subtle difference. The ship doesn't "carry" the ball through the air — once released, the ship can't push the ball.

The ball keeps moving forward on its own because it was **already** in motion. It inherited that velocity from riding on the ship.

This is **inertia** — objects in motion stay in motion unless a force stops them. And gravity only acts downward, so it doesn't stop the forward motion.

You've worked through it beautifully!`,
          isCorrect: false,
        },
        retry_already: {
          text: `**There you go!** You worked through it. 🎉

The ball WAS already moving with the ship. That's the key insight. Gravity pulls it down, but doesn't stop its forward motion.

This kind of thinking—breaking down a problem, considering what you know, and building understanding—that's exactly how physicists work.

You just demonstrated real scientific reasoning!`,
          isCorrect: true,
        },
        retry_gravity: {
          text: `Gravity does pull the ball down — that part is true! But gravity only affects the **vertical** direction.

The key insight is about the **horizontal** direction: the ball was moving forward with the ship at 10 m/s. When you drop it, gravity starts pulling it down, but nothing stops its forward motion.

So the ball moves forward AND downward simultaneously — landing at the base of the mast.

The correct answer is that the ball was already moving with the ship. Gravity just added the downward part!`,
          isCorrect: false,
        },
      },
    },
  },
};

/* ── Reflection response — calls GPT-5.2-chat via backend ──────────────── */
async function fetchReflectionResponse(
  reflection: string,
  selectedOption: string | null,
): Promise<string> {
  const fallback =
    "Thank you for sharing that reflection! Understanding motion deeply takes time, " +
    "and *you're on the right track*.\n\n" +
    "Every great physicist started exactly where you are—asking questions and thinking deeply.\n\n" +
    "Ready to see these ideas come alive in a simulation?";

  try {
    const resp = await fetch("/api/reflection/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reflection: reflection.trim(),
        selectedOption: selectedOption || undefined,
        conversationContext:
          "Galileo's ship experiment — ball dropped from mast of moving ship lands at base. " +
          "Topic: inertia, reference frames, relative motion.",
      }),
    });
    if (!resp.ok) return fallback;
    const data = await resp.json();
    return data.response || fallback;
  } catch {
    return fallback;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHARACTER STREAMING
   ═══════════════════════════════════════════════════════════════════════════ */

function getCharDelay(char: string): number {
  const base = 28;
  const jitter = Math.random() * 8 - 4;
  if (".!?".includes(char)) return base + 160 + jitter;
  if (",;:".includes(char)) return base + 70 + jitter;
  if (char === "\n") return base + 50;
  if (char === " ") return base + 4 + jitter;
  if (char === "*") return 0; // markdown markers stream instantly
  return base + jitter;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONVERSATION PHASE ENUM
   ═══════════════════════════════════════════════════════════════════════════ */

type Phase =
  | "streaming_question" // Streaming initial question
  | "awaiting_choice" // Options visible, user hasn't picked
  | "thinking" // Brief thinking indicator
  | "streaming_response" // Streaming Eureka's response
  | "awaiting_followup" // Follow-up options visible
  | "thinking_followup" // Brief thinking for follow-up
  | "streaming_followup" // Streaming follow-up response
  | "reflection_prompt" // Show reflection text input
  | "streaming_reflection_response" // Streaming Eureka's reflection response
  | "transition_ready" // Ready to proceed prompt
  | "complete"; // Done — unlock continue

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

const PostVideoSocratic: FC<ScreenProps> = ({ onProgressUpdate }) => {
  /* ── Conversation state ── */
  const [phase, setPhase] = useState<Phase>("streaming_question");
  const [questionText, setQuestionText] = useState("");
  const [responseText, setResponseText] = useState("");
  const [followUpResponseText, setFollowUpResponseText] = useState("");
  const [reflectionResponseText, setReflectionResponseText] = useState("");
  const [transitionText, setTransitionText] = useState("");

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedFollowUp, setSelectedFollowUp] = useState<string | null>(null);
  const [reflectionInput, setReflectionInput] = useState("");
  const [reflectionSubmitted, setReflectionSubmitted] = useState(false);

  /* ── Audio ── */
  const [isMuted, setIsMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* ── Refs ── */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /* ── Auto-scroll to bottom ── */
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    });
  }, []);

  /* ── Character stream helper ── */
  const streamText = useCallback(
    (
      text: string,
      setter: React.Dispatch<React.SetStateAction<string>>,
    ): Promise<void> => {
      return new Promise((resolve) => {
        const chars = Array.from(text);
        let idx = 0;

        const next = () => {
          if (!mountedRef.current) {
            resolve();
            return;
          }
          if (idx >= chars.length) {
            timerRef.current = null;
            resolve();
            return;
          }

          const char = chars[idx];
          setter((prev) => prev + char);
          idx++;
          scrollToBottom();
          timerRef.current = setTimeout(next, getCharDelay(char));
        };

        next();
      });
    },
    [scrollToBottom],
  );

  /* ── Skip streaming ── */
  const skipStream = useCallback(
    (
      fullText: string,
      setter: React.Dispatch<React.SetStateAction<string>>,
    ) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setter(fullText);
    },
    [],
  );

  /* ── TTS helper ── */
  const playTTS = useCallback(
    async (text: string) => {
      try {
        const res = await fetch("/api/tts/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.replace(/[*_#]/g, "") }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!mountedRef.current) return;

        const prev = audioRef.current;
        if (prev) {
          prev.pause();
          prev.currentTime = 0;
        }

        const a = new Audio(data.audioUrl);
        a.muted = isMuted;
        a.play().catch(() => {});
        audioRef.current = a;
        setAudioReady(true);
      } catch {
        /* TTS unavailable — silent fallback */
      }
    },
    [isMuted],
  );

  /* ═══════════════════════════════════════════════════════════════════════
     PHASE 1: Stream initial question on mount
     ═══════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    const run = async () => {
      // 0.5s breathe after video
      await new Promise((r) => setTimeout(r, 500));
      if (!mountedRef.current) return;

      // Start TTS for question
      playTTS(INITIAL_QUESTION);

      // Stream question
      await streamText(INITIAL_QUESTION, setQuestionText);
      if (!mountedRef.current) return;

      // Wait a beat then show options
      await new Promise((r) => setTimeout(r, 400));
      if (mountedRef.current) setPhase("awaiting_choice");
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════
     PHASE 2: Handle initial choice
     ═══════════════════════════════════════════════════════════════════════ */
  const handleChoice = useCallback(
    async (optionId: string) => {
      if (phase !== "awaiting_choice" || selectedOption) return;
      setSelectedOption(optionId);
      playSound("click");

      setPhase("thinking");

      // Thinking delay
      await new Promise((r) => setTimeout(r, 800));
      if (!mountedRef.current) return;

      // Stream response
      setPhase("streaming_response");
      const resp = RESPONSES[optionId];
      playTTS(resp.text);
      await streamText(resp.text, setResponseText);
      if (!mountedRef.current) return;

      // If there's a follow-up, show it
      if (resp.followUp) {
        await new Promise((r) => setTimeout(r, 500));
        if (mountedRef.current) setPhase("awaiting_followup");
      } else {
        // Skip to reflection
        await new Promise((r) => setTimeout(r, 600));
        if (mountedRef.current) setPhase("reflection_prompt");
      }

      // Track analytics
      try {
        await fetch("/api/analytics/socratic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId: "what-is-motion",
            questionId: "galileo-ship-landing",
            selectedOption: optionId,
            isCorrect: resp.isCorrect,
            timestamp: Date.now(),
          }),
        });
      } catch {
        /* analytics non-critical */
      }
    },
    [phase, selectedOption, streamText, playTTS],
  );

  /* ═══════════════════════════════════════════════════════════════════════
     PHASE 3: Handle follow-up choice
     ═══════════════════════════════════════════════════════════════════════ */
  const handleFollowUp = useCallback(
    async (optionId: string) => {
      if (phase !== "awaiting_followup" || selectedFollowUp) return;
      setSelectedFollowUp(optionId);
      playSound("click");

      setPhase("thinking_followup");

      await new Promise((r) => setTimeout(r, 800));
      if (!mountedRef.current) return;

      setPhase("streaming_followup");
      const resp = RESPONSES[selectedOption!];
      const followResp = resp.followUp!.responses[optionId];
      playTTS(followResp.text);
      await streamText(followResp.text, setFollowUpResponseText);
      if (!mountedRef.current) return;

      // Go to reflection
      await new Promise((r) => setTimeout(r, 600));
      if (mountedRef.current) setPhase("reflection_prompt");
    },
    [phase, selectedOption, selectedFollowUp, streamText, playTTS],
  );

  /* ═══════════════════════════════════════════════════════════════════════
     PHASE 4: Handle reflection submission
     ═══════════════════════════════════════════════════════════════════════ */
  const handleReflectionSubmit = useCallback(async () => {
    if (!reflectionInput.trim()) return;
    setReflectionSubmitted(true);
    playSound("click");

    // Save to MongoDB
    try {
      await fetch("/api/analytics/reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: "what-is-motion",
          phase: "post-video-socratic",
          reflection: reflectionInput.trim(),
          selectedOption,
          timestamp: Date.now(),
        }),
      });
    } catch {
      /* non-critical */
    }

    // Stream Eureka's response to reflection (GPT-5.2-chat)
    await new Promise((r) => setTimeout(r, 400));
    if (!mountedRef.current) return;

    setPhase("streaming_reflection_response");
    const respText = await fetchReflectionResponse(
      reflectionInput,
      selectedOption,
    );
    if (!mountedRef.current) return;
    playTTS(respText);
    await streamText(respText, setReflectionResponseText);
    if (!mountedRef.current) return;

    // Transition
    await new Promise((r) => setTimeout(r, 600));
    if (mountedRef.current) setPhase("transition_ready");
  }, [reflectionInput, selectedOption, streamText, playTTS]);

  const handleSkipReflection = useCallback(async () => {
    setPhase("transition_ready");
    playSound("click");

    const txt = `You've thought deeply about motion. Now let's **see** it in action.

I'm going to show you a simulation where YOU control the reference frame.

Ready?`;
    playTTS(txt);
    await streamText(txt, setTransitionText);
    if (!mountedRef.current) return;

    await new Promise((r) => setTimeout(r, 400));
    if (mountedRef.current) {
      setPhase("complete");
      onProgressUpdate(100);
    }
  }, [streamText, playTTS, onProgressUpdate]);

  /* ── Handle "Let's do it" final button ── */
  const handleTransition = useCallback(() => {
    playSound("unlock");
    setPhase("complete");
    onProgressUpdate(100);
  }, [onProgressUpdate]);

  /* ── Audio cleanup ── */
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.currentTime = 0;
      }
    };
  }, []);

  const handleMuteToggle = () => {
    const next = !isMuted;
    setIsMuted(next);
    const a = audioRef.current;
    if (a) a.muted = next;
  };

  /* ── Markdown-lite render: bold, italic, newlines ── */
  const renderMarkdown = useCallback((text: string) => {
    if (!text) return null;
    const parts: React.ReactNode[] = [];
    // Split by bold (**...**) then italic (*...*  or _..._)
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const rawText = text;
    while ((match = regex.exec(rawText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(rawText.slice(lastIndex, match.index));
      }
      if (match[2]) {
        // Bold
        parts.push(
          <strong key={match.index} className="socratic-emphasis">
            {match[2]}
          </strong>,
        );
      } else if (match[3] || match[4]) {
        // Italic
        parts.push(
          <em key={match.index} className="socratic-reassurance">
            {match[3] || match[4]}
          </em>,
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < rawText.length) {
      parts.push(rawText.slice(lastIndex));
    }
    return parts;
  }, []);

  /* ── Current follow-up data ── */
  const followUpData = useMemo(() => {
    if (!selectedOption) return null;
    return RESPONSES[selectedOption]?.followUp || null;
  }, [selectedOption]);

  /* ── Computed states ── */
  const isStreaming =
    phase === "streaming_question" ||
    phase === "streaming_response" ||
    phase === "streaming_followup" ||
    phase === "streaming_reflection_response";

  const showSkipStream = isStreaming;

  const handleSkipCurrentStream = useCallback(() => {
    if (phase === "streaming_question") {
      skipStream(INITIAL_QUESTION, setQuestionText);
    } else if (phase === "streaming_response" && selectedOption) {
      skipStream(RESPONSES[selectedOption].text, setResponseText);
    } else if (
      phase === "streaming_followup" &&
      selectedOption &&
      selectedFollowUp
    ) {
      const resp =
        RESPONSES[selectedOption].followUp!.responses[selectedFollowUp];
      skipStream(resp.text, setFollowUpResponseText);
    }
  }, [phase, selectedOption, selectedFollowUp, skipStream]);

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="scrn-content-inner socratic-root" ref={containerRef}>
      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-4 px-5 pt-5">
        <Sparkles className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Let's Think About What You Saw
        </h3>
        <div className="ml-auto flex items-center gap-2">
          {audioReady && (
            <button
              onClick={handleMuteToggle}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          )}
          {showSkipStream && (
            <button
              onClick={handleSkipCurrentStream}
              className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1"
            >
              <SkipForward className="w-3 h-3" /> Skip
            </button>
          )}
        </div>
      </div>

      <div className="socratic-conversation px-5 pb-5">
        {/* ═════════════════════════════════════════════════════════════════
            MESSAGE 1: Eureka's Question
            ═════════════════════════════════════════════════════════════════ */}
        <div className="socratic-message-group">
          {/* Avatar */}
          <div className="socratic-avatar-row">
            <div
              className={`socratic-avatar ${isStreaming ? "socratic-avatar--active" : ""}`}
            >
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="socratic-name">Eureka</span>
            {phase === "thinking" && (
              <span className="socratic-thinking">Thinking...</span>
            )}
          </div>

          {/* Question bubble */}
          {questionText && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="socratic-question"
            >
              <p className="socratic-text whitespace-pre-line">
                {renderMarkdown(questionText)}
                {phase === "streaming_question" && (
                  <span className="socratic-cursor" aria-hidden="true">
                    ▋
                  </span>
                )}
              </p>
            </motion.div>
          )}

          {/* ── Initial choice buttons ── */}
          <AnimatePresence>
            {phase === "awaiting_choice" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="socratic-choices"
              >
                {INITIAL_OPTIONS.map((opt, i) => (
                  <motion.button
                    key={opt.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: i * 0.15,
                      duration: 0.3,
                      ease: "easeOut",
                    }}
                    onClick={() => handleChoice(opt.id)}
                    className="socratic-choice-btn"
                  >
                    <span className="socratic-choice-icon">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Selected option display (after selection) ── */}
          {selectedOption && phase !== "awaiting_choice" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="socratic-choices"
            >
              <div className="socratic-choice-btn socratic-choice-btn--selected">
                <span className="socratic-choice-icon">
                  {INITIAL_OPTIONS.find((o) => o.id === selectedOption)?.icon}
                </span>
                <span>
                  {INITIAL_OPTIONS.find((o) => o.id === selectedOption)?.label}
                </span>
                <span className="ml-auto text-white">{"✓"}</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* ═════════════════════════════════════════════════════════════════
            THINKING INDICATOR
            ═════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {(phase === "thinking" || phase === "thinking_followup") && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="socratic-thinking-indicator"
            >
              <div className="socratic-avatar socratic-avatar--thinking">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="socratic-dots">
                <span />
                <span />
                <span />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═════════════════════════════════════════════════════════════════
            MESSAGE 2: Eureka's Response
            ═════════════════════════════════════════════════════════════════ */}
        {responseText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="socratic-message-group"
          >
            <div className="socratic-avatar-row">
              <div
                className={`socratic-avatar ${phase === "streaming_response" ? "socratic-avatar--active" : ""}`}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="socratic-name">Eureka</span>
            </div>
            <div className="socratic-response">
              <p className="socratic-text whitespace-pre-line">
                {renderMarkdown(responseText)}
                {phase === "streaming_response" && (
                  <span className="socratic-cursor" aria-hidden="true">
                    ▋
                  </span>
                )}
              </p>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            FOLLOW-UP CHOICES
            ═════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {phase === "awaiting_followup" && followUpData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="socratic-choices"
            >
              {followUpData.options.map((opt, i) => (
                <motion.button
                  key={opt.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: i * 0.15,
                    duration: 0.3,
                    ease: "easeOut",
                  }}
                  onClick={() => handleFollowUp(opt.id)}
                  className="socratic-choice-btn"
                >
                  <span className="socratic-choice-icon">{opt.icon}</span>
                  <span>{opt.label}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Selected follow-up display ── */}
        {selectedFollowUp && followUpData && phase !== "awaiting_followup" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="socratic-choices"
          >
            <div className="socratic-choice-btn socratic-choice-btn--selected">
              <span className="socratic-choice-icon">
                {
                  followUpData.options.find((o) => o.id === selectedFollowUp)
                    ?.icon
                }
              </span>
              <span>
                {
                  followUpData.options.find((o) => o.id === selectedFollowUp)
                    ?.label
                }
              </span>
              <span className="ml-auto text-white">{"✓"}</span>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            MESSAGE 3: Follow-up Response
            ═════════════════════════════════════════════════════════════════ */}
        {followUpResponseText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="socratic-message-group"
          >
            <div className="socratic-avatar-row">
              <div
                className={`socratic-avatar ${phase === "streaming_followup" ? "socratic-avatar--active" : ""}`}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="socratic-name">Eureka</span>
            </div>
            <div className="socratic-response">
              <p className="socratic-text whitespace-pre-line">
                {renderMarkdown(followUpResponseText)}
                {phase === "streaming_followup" && (
                  <span className="socratic-cursor" aria-hidden="true">
                    ▋
                  </span>
                )}
              </p>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            REFLECTION PROMPT
            ═════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {phase === "reflection_prompt" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="socratic-message-group"
            >
              <div className="socratic-avatar-row">
                <div className="socratic-avatar">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="socratic-name">Eureka</span>
              </div>
              <div className="socratic-reflection-card">
                <p className="socratic-text mb-3">
                  Before we move on, take a moment to reflect:
                </p>
                <p className="socratic-text socratic-emphasis mb-4">
                  In one sentence, what changed in your understanding of motion
                  after this conversation?
                </p>
                {!reflectionSubmitted ? (
                  <>
                    <div className="socratic-textarea-wrap">
                      <textarea
                        value={reflectionInput}
                        onChange={(e) => setReflectionInput(e.target.value)}
                        placeholder="Your reflection..."
                        className="socratic-textarea"
                        rows={3}
                        maxLength={500}
                      />
                    </div>
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={handleReflectionSubmit}
                        disabled={!reflectionInput.trim()}
                        className="socratic-btn-primary"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Submit Reflection
                      </button>
                      <button
                        onClick={handleSkipReflection}
                        className="socratic-btn-secondary"
                      >
                        Skip this step
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    {"✓"} Reflection saved!
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═════════════════════════════════════════════════════════════════
            REFLECTION RESPONSE
            ═════════════════════════════════════════════════════════════════ */}
        {reflectionResponseText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="socratic-message-group"
          >
            <div className="socratic-avatar-row">
              <div className="socratic-avatar">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="socratic-name">Eureka</span>
            </div>
            <div className="socratic-response">
              <p className="socratic-text whitespace-pre-line">
                {renderMarkdown(reflectionResponseText)}
                {phase === "streaming_reflection_response" && (
                  <span className="socratic-cursor" aria-hidden="true">
                    ▋
                  </span>
                )}
              </p>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TRANSITION TEXT (from skip reflection)
            ═════════════════════════════════════════════════════════════════ */}
        {transitionText && !reflectionResponseText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="socratic-message-group"
          >
            <div className="socratic-avatar-row">
              <div className="socratic-avatar">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="socratic-name">Eureka</span>
            </div>
            <div className="socratic-response">
              <p className="socratic-text whitespace-pre-line">
                {renderMarkdown(transitionText)}
              </p>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TRANSITION BUTTON
            ═════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {(phase === "transition_ready" ||
            (phase === "streaming_reflection_response" &&
              reflectionResponseText)) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="socratic-transition-wrap"
            >
              <button onClick={handleTransition} className="socratic-btn-go">
                Let's do it! {"→"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Direct transition after skip reflection finishes */}
        {phase === "complete" && !reflectionResponseText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mt-4"
          >
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
              {"✓"} Ready for the simulation! Hit Continue below.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PostVideoSocratic;
