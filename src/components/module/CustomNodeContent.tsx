// ============================================================
// CustomNodeContent — Student-facing progressive disclosure
// for custom module nodes.
//
// Renders stages as "Screens" (like the What is Motion? pattern):
//   - Progress bubbles (completed / current / future)
//   - Screen-by-screen stage navigation with animations
//   - Continue button to advance
//   - After all screens: suggested prompts + "I'm Curious" + chat
// ============================================================

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type FC,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Sparkles,
  BookOpen,
  HelpCircle,
  FlaskConical,
  Play,
  CheckCircle2,
  Trash2,
  AlertCircle,
} from "lucide-react";
import InputBox from "@/components/chat/InputBox";
import StreamingMessageBubble from "@/components/chat/StreamingMessageBubble";
import {
  useStreamingChat,
  type StreamingMessage,
} from "@/hooks/useStreamingChat";
import type {
  StageContent,
  ContentBlock,
  BlockType,
  GeneratedNode,
} from "@/types/custom-module";
import { migrateNodeContent } from "@/types/custom-module";
import "@/components/screens/ScreenStyles.css";

// ── Props ──

interface CustomNodeContentProps {
  /** The node being viewed */
  node: GeneratedNode;
  /** Stage content for this node */
  stages: StageContent[];
  /** Callback to go back to the map */
  onBack: () => void;
  /** Optional callback when student completes this node */
  onMarkComplete?: (nodeId: string) => void;
  /** Whether the content panel is expanded */
  isExpanded?: boolean;
  /** Module title for context */
  moduleTitle?: string;
  /** Chat node slug (custom: <moduleId>/<nodeId>) */
  chatNodeSlug?: string;
  /** If provided, shows an "Edit" button for teacher mode */
  onEdit?: () => void;
}

// ── Constants ──

const LS_SCREEN_KEY = (nodeId: string) => `eureka-custom-screen-${nodeId}`;
const CHAT_STORAGE_KEY = (nodeId: string) => `eureka-custom-chat-${nodeId}`;
const SESSION_KEY = (nodeId: string) => `eureka-custom-session-${nodeId}`;

// ── Block rendering helpers ──

const BLOCK_STYLE: Record<
  BlockType,
  { icon: React.ReactNode; color: string; bg: string; label: string }
> = {
  entry: {
    icon: <BookOpen className="w-4 h-4" />,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    label: "Introduction",
  },
  explanation: {
    icon: <BookOpen className="w-4 h-4" />,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    label: "Explanation",
  },
  micro_question: {
    icon: <HelpCircle className="w-4 h-4" />,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/15",
    label: "Think About This",
  },
  simulation: {
    icon: <FlaskConical className="w-4 h-4" />,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/15",
    label: "Interactive Exploration",
  },
  quiz: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/15",
    label: "Check Your Understanding",
  },
  animation: {
    icon: <Play className="w-4 h-4" />,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/15",
    label: "Animation",
  },
  video: {
    icon: <Play className="w-4 h-4" />,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-900/15",
    label: "Watch & Learn",
  },
};

// ── Persistence ──

function loadScreenState(nodeId: string): {
  currentScreen: number;
  completedScreens: number[];
} {
  try {
    const raw = localStorage.getItem(LS_SCREEN_KEY(nodeId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed.currentScreen === "number" &&
        Array.isArray(parsed.completedScreens)
      ) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return { currentScreen: 1, completedScreens: [] };
}

function saveScreenState(
  nodeId: string,
  currentScreen: number,
  completedScreens: number[],
) {
  localStorage.setItem(
    LS_SCREEN_KEY(nodeId),
    JSON.stringify({ currentScreen, completedScreens }),
  );
}

function loadChatFromStorage(nodeId: string): StreamingMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY(nodeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
      images: m.images || [],
      videos: m.videos || [],
      isStreaming: false,
    }));
  } catch {
    return [];
  }
}

function saveChatToStorage(nodeId: string, msgs: StreamingMessage[]) {
  try {
    const toSave = msgs.filter((m) => !m.isStreaming);
    localStorage.setItem(CHAT_STORAGE_KEY(nodeId), JSON.stringify(toSave));
  } catch {
    /* non-critical */
  }
}

function getOrCreateSessionId(nodeId: string): string {
  const key = SESSION_KEY(nodeId);
  let sid = localStorage.getItem(key);
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, sid);
  }
  return sid;
}

// ── Motion variants ──

const screenVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

// ── Default suggested prompts ──

function buildSuggestions(node: GeneratedNode): string[] {
  return [
    `What's the key idea behind ${node.title.toLowerCase()}?`,
    `How does this connect to everyday experience?`,
    `Can you help me build intuition for this?`,
    `What's the most surprising thing about this concept?`,
  ];
}

// ============================================================
// BlockRenderer — renders a single block in screen style
// ============================================================

const BlockRenderer: FC<{
  block: ContentBlock;
  index: number;
  expandedBlock: string | null;
  setExpandedBlock: (id: string | null) => void;
}> = ({ block, index, expandedBlock, setExpandedBlock }) => {
  const style = BLOCK_STYLE[block.type];
  if (!block.content.trim()) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
    >
      {block.type === "micro_question" ? (
        <div className="bg-violet-50 dark:bg-violet-900/15 border border-violet-200 dark:border-violet-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">
              Think About This
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">
            {block.content}
          </p>
          <button
            onClick={() =>
              setExpandedBlock(expandedBlock === block.id ? null : block.id)
            }
            className="mt-3 flex items-center gap-1 text-xs text-violet-500 hover:text-violet-600 transition-colors"
          >
            <span
              className={`inline-block transition-transform ${expandedBlock === block.id ? "rotate-180" : ""}`}
            >
              ▾
            </span>
            {expandedBlock === block.id
              ? "Hide my thoughts"
              : "I want to think about this..."}
          </button>
          <AnimatePresence>
            {expandedBlock === block.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 overflow-hidden"
              >
                <textarea
                  placeholder="Write your thoughts here..."
                  className="w-full p-3 rounded-lg bg-white dark:bg-gray-800 border border-violet-200 dark:border-violet-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
                  rows={3}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : block.type === "quiz" ? (
        <div className="bg-rose-50 dark:bg-rose-900/15 border border-rose-200 dark:border-rose-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-rose-500" />
            <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
              Check Your Understanding
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {block.content}
          </p>
        </div>
      ) : block.type === "simulation" ? (
        <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              Interactive Exploration
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {block.content}
          </p>
          <div className="mt-4 h-32 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <span className="text-sm text-amber-500">
              [Simulation would render here]
            </span>
          </div>
        </div>
      ) : block.type === "video" ? (
        <div className="bg-pink-50 dark:bg-pink-900/15 border border-pink-200 dark:border-pink-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Play className="w-4 h-4 text-pink-500" />
            <span className="text-sm font-semibold text-pink-600 dark:text-pink-400">
              Watch & Learn
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {block.content}
          </p>
          <div className="mt-4 h-40 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
            <Play className="w-10 h-10 text-pink-400" />
          </div>
        </div>
      ) : (
        /* Entry + Explanation blocks */
        <div className="space-y-1">
          {block.type === "entry" && (
            <div className="flex items-center gap-2 mb-2">
              <span className={style.color}>{style.icon}</span>
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${style.color}`}
              >
                {style.label}
              </span>
            </div>
          )}
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {block.content}
          </p>
        </div>
      )}
    </motion.div>
  );
};

// ============================================================
// ProgressBubbles — reusable progress indicator
// ============================================================

const ProgressBubbles: FC<{
  total: number;
  current: number;
  completed: number[];
}> = ({ total, current, completed }) => (
  <div className="flex flex-col items-center gap-1.5 py-3 px-4">
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const screenId = i + 1;
        const isCompleted = completed.includes(screenId);
        const isCurrent = screenId === current;
        let cls = "scrn-bubble--future";
        if (isCompleted) cls = "scrn-bubble--completed";
        else if (isCurrent) cls = "scrn-bubble--current";
        return (
          <span
            key={screenId}
            className={`scrn-bubble ${cls}`}
            aria-label={
              isCompleted
                ? `Screen ${screenId} completed`
                : isCurrent
                  ? `Screen ${screenId} current`
                  : `Screen ${screenId} upcoming`
            }
          />
        );
      })}
    </div>
    <span className="text-xs text-gray-400 font-medium select-none">
      Screen {current} of {total}
    </span>
  </div>
);

// ============================================================
// ContinueButton — scroll-aware unlock
// ============================================================

const ContinueBtn: FC<{
  isUnlocked: boolean;
  isFinal: boolean;
  onClick: () => void;
}> = ({ isUnlocked, isFinal, onClick }) => {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    if (!isUnlocked || clicked) return;
    setClicked(true);
    setTimeout(() => {
      onClick();
      setClicked(false);
    }, 280);
  };

  const stateClass = clicked
    ? "scrn-continue--clicked"
    : isUnlocked
      ? "scrn-continue--unlocked"
      : "scrn-continue--locked";

  return (
    <button
      onClick={handleClick}
      disabled={!isUnlocked}
      className={`scrn-continue ${stateClass}`}
    >
      {clicked
        ? isFinal
          ? "Finishing..."
          : "Continue ✓"
        : !isUnlocked
          ? "Scroll to continue..."
          : isFinal
            ? "Complete 🎉"
            : "Continue →"}
    </button>
  );
};

// ============================================================
// Main Component
// ============================================================

const CustomNodeContent: FC<CustomNodeContentProps> = ({
  node,
  stages,
  onBack,
  onMarkComplete,
  isExpanded,
  moduleTitle,
  chatNodeSlug,
  onEdit,
}) => {
  const totalScreens = stages.length;
  const initial = loadScreenState(node.id);
  const [currentScreen, setCurrentScreen] = useState(
    Math.min(initial.currentScreen, totalScreens),
  );
  const [completedScreens, setCompletedScreens] = useState<number[]>(
    initial.completedScreens.filter((n) => n <= totalScreens),
  );
  const [direction, setDirection] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Whether all screens have been completed
  const allScreensComplete =
    completedScreens.length >= totalScreens ||
    (totalScreens === 1 && completedScreens.includes(1));

  // ── Chat state ──
  const sessionId = getOrCreateSessionId(node.id);
  const effectiveSlug = chatNodeSlug || node.id;

  const [hasStartedChat, setHasStartedChat] = useState(
    () => loadChatFromStorage(node.id).length > 0,
  );

  const [nodeSuggestions] = useState<string[]>(() => buildSuggestions(node));

  const {
    messages,
    isStreaming: isGenerating,
    error: chatError,
    sendMessage,
    loadMessages,
    clearMessages,
    setError: setChatError,
  } = useStreamingChat({
    nodeId: effectiveSlug,
    sessionId,
    onSuggestions: () => {},
    onDone: () => {},
  });

  const inputRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Load persisted messages ──
  useEffect(() => {
    const saved = loadChatFromStorage(node.id);
    if (saved.length > 0) loadMessages(saved);
  }, [node.id, loadMessages]);

  // ── Persist messages ──
  useEffect(() => {
    if (messages.length > 0) saveChatToStorage(node.id, messages);
  }, [messages, node.id]);

  // ── Persist screen state ──
  useEffect(() => {
    saveScreenState(node.id, currentScreen, completedScreens);
  }, [node.id, currentScreen, completedScreens]);

  // ── Scroll tracking for current screen ──
  useEffect(() => {
    setScrollProgress(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [currentScreen]);

  const handleContentScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) {
      setScrollProgress(100);
      return;
    }
    const pct = (el.scrollTop / scrollable) * 100;
    setScrollProgress((prev) => Math.max(prev, pct));
  }, []);

  // If content fits without scrolling, auto-unlock
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      if (el.scrollHeight <= el.clientHeight) {
        setScrollProgress(100);
      }
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentScreen]);

  const isScreenUnlocked = scrollProgress >= 60;

  // ── Navigation ──
  const goForward = useCallback(() => {
    if (isTransitioning || currentScreen > totalScreens) return;
    setIsTransitioning(true);
    setDirection(1);
    setCompletedScreens((prev) =>
      prev.includes(currentScreen) ? prev : [...prev, currentScreen],
    );
    setTimeout(() => {
      if (currentScreen < totalScreens) {
        setCurrentScreen((prev) => prev + 1);
      } else {
        // Final screen completed — mark all done
        setCompletedScreens((prev) =>
          prev.includes(totalScreens) ? prev : [...prev, totalScreens],
        );
        // Notify parent that student completed this node
        onMarkComplete?.(node.id);
      }
      setIsTransitioning(false);
    }, 300);
  }, [isTransitioning, currentScreen, totalScreens, onMarkComplete, node.id]);

  const goBack = useCallback(() => {
    if (isTransitioning || currentScreen <= 1) return;
    setIsTransitioning(true);
    setDirection(-1);
    setTimeout(() => {
      setCurrentScreen((prev) => prev - 1);
      setIsTransitioning(false);
    }, 300);
  }, [isTransitioning, currentScreen]);

  // ── Chat handlers ──
  const handleSuggestedClick = useCallback(
    (promptText: string) => {
      setHasStartedChat(true);
      setChatError(null);
      sendMessage(promptText);
    },
    [sendMessage, setChatError],
  );

  const handleCuriousClick = useCallback(() => {
    setHasStartedChat(true);
  }, []);

  const handleChatSend = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      setChatError(null);
      sendMessage(content.trim());
    },
    [sendMessage, setChatError],
  );

  const handleClearChat = useCallback(() => {
    clearMessages();
    localStorage.removeItem(CHAT_STORAGE_KEY(node.id));
    setHasStartedChat(false);
  }, [clearMessages, node.id]);

  // ── Auto-scroll to newest message ──
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [messages.length, messages[messages.length - 1]?.content?.length]);

  // ── Auto-focus input ──
  useEffect(() => {
    if (hasStartedChat) {
      const t = setTimeout(() => {
        const textarea = inputRef.current?.querySelector("textarea");
        textarea?.focus();
      }, 450);
      return () => clearTimeout(t);
    }
  }, [hasStartedChat]);

  // ── Keyboard ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && currentScreen > 1) goBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, currentScreen]);

  // Current stage blocks
  const currentStage = stages[currentScreen - 1];
  const nodeTitle = node.title;

  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const showThinking =
    isGenerating && lastMsg?.role === "assistant" && lastMsg?.content === "";

  return (
    <motion.div
      className="flex-1 bg-white dark:bg-gray-800 flex flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-50 shadow-sm flex-shrink-0">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 group"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
              <span className="text-sm font-medium underline-offset-2 group-hover:underline">
                Back to Map
              </span>
            </button>
            <div className="flex items-center gap-3">
              {moduleTitle && (
                <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                  {moduleTitle}
                </span>
              )}
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  Edit Content
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{node.emoji || "📘"}</span>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {nodeTitle}
            </h1>
          </div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {/* ── Screen-style progressive disclosure ── */}
          <div className="scrn-container">
            {/* Back to previous screen */}
            {currentScreen > 1 && !allScreensComplete && (
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={goBack}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Stage {currentScreen} of {totalScreens}
                </span>
              </div>
            )}

            {/* Content area */}
            {!allScreensComplete && currentStage ? (
              <>
                <div
                  ref={scrollRef}
                  className="scrn-content-area max-h-[60vh] overflow-y-auto"
                  onScroll={handleContentScroll}
                >
                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={currentScreen}
                      custom={direction}
                      variants={screenVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.28, ease: "easeOut" }}
                      className="scrn-content-wrapper"
                    >
                      {/* Render blocks for current stage */}
                      <div className="space-y-6 pb-4">
                        {currentStage.blocks.map((block, idx) => (
                          <BlockRenderer
                            key={block.id}
                            block={block}
                            index={idx}
                            expandedBlock={expandedBlock}
                            setExpandedBlock={setExpandedBlock}
                          />
                        ))}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Footer: progress bubbles + continue */}
                <div className="scrn-footer">
                  {totalScreens > 1 && (
                    <ProgressBubbles
                      total={totalScreens}
                      current={currentScreen}
                      completed={completedScreens}
                    />
                  )}
                  <ContinueBtn
                    isUnlocked={isScreenUnlocked}
                    isFinal={currentScreen === totalScreens}
                    onClick={goForward}
                  />
                </div>
              </>
            ) : (
              /* ── All screens complete — show completion message ── */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-6"
              >
                {totalScreens > 1 && (
                  <ProgressBubbles
                    total={totalScreens}
                    current={totalScreens}
                    completed={completedScreens}
                  />
                )}
                <div className="flex items-center justify-center gap-2 mt-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    You've explored all the content for this concept!
                  </span>
                </div>
              </motion.div>
            )}
          </div>

          {/* ── Suggested prompts + I'm Curious — visible after all screens ── */}
          {allScreensComplete && (
            <div className="mt-8" style={{ minHeight: 180 }}>
              {/* Clear history button */}
              {messages.length > 0 && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={handleClearChat}
                    disabled={isGenerating}
                    title="Clear conversation"
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear chat</span>
                  </button>
                </div>
              )}

              {/* Messages */}
              <AnimatePresence mode="popLayout">
                {messages.length > 0 && (
                  <motion.div
                    className="space-y-4 mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {messages
                      .filter((msg) => !(msg.isStreaming && msg.content === ""))
                      .map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{
                            opacity: 0,
                            y: msg.role === "user" ? 8 : 12,
                            scale: msg.role === "user" ? 0.95 : 1,
                          }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{
                            duration: 0.35,
                            ease: [0.25, 0.46, 0.45, 0.94],
                          }}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          {msg.role === "assistant" && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{
                                delay: 0.1,
                                duration: 0.25,
                                ease: "backOut",
                              }}
                              className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mr-2 mt-1"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-white" />
                            </motion.div>
                          )}
                          <motion.div
                            initial={{
                              opacity: 0,
                              x: msg.role === "user" ? 16 : -16,
                            }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: 0.4,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          >
                            <StreamingMessageBubble message={msg} />
                          </motion.div>
                        </motion.div>
                      ))}

                    {/* Thinking indicator */}
                    {showThinking && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                      >
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg rounded-tl-sm">
                          <div className="flex gap-1">
                            <span
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            />
                            <span
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            />
                            <span
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Error */}
                    {chatError && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-sm text-red-500 dark:text-red-400 px-3 py-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg"
                      >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{chatError}</span>
                        <button
                          onClick={() => {
                            setChatError(null);
                            const lastUser = [...messages]
                              .reverse()
                              .find((m) => m.role === "user");
                            if (lastUser) sendMessage(lastUser.content);
                          }}
                          className="ml-auto text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                        >
                          Retry
                        </button>
                      </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Suggested prompts — visible only before chat starts */}
              <AnimatePresence mode="wait">
                {!hasStartedChat && nodeSuggestions.length > 0 && (
                  <motion.div
                    key="suggestions"
                    initial={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-1 gap-2">
                      {nodeSuggestions.map((question, index) => (
                        <motion.button
                          key={index}
                          onClick={() => handleSuggestedClick(question)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className="p-2.5 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all duration-200 text-sm"
                        >
                          <p className="text-gray-700 dark:text-gray-300">
                            {question}
                          </p>
                        </motion.button>
                      ))}
                    </div>
                    <div className="flex justify-center pt-2">
                      <motion.button
                        onClick={handleCuriousClick}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="py-2.5 px-8 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg transition-colors duration-200 text-sm"
                      >
                        {messages.length > 0
                          ? "Continue Exploring"
                          : "I'm Curious"}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Sticky chat input — pinned to bottom */}
      {allScreensComplete && hasStartedChat && (
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
          <div className="max-w-4xl mx-auto">
            <InputBox
              onSend={handleChatSend}
              placeholder={`Ask anything about ${nodeTitle.toLowerCase()}...`}
              isLoading={isGenerating}
              isCentered={false}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CustomNodeContent;
