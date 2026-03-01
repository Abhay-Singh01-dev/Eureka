import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type FC,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Sparkles,
  Play,
  Volume2,
  VolumeX,
  AlertCircle,
  Trash2,
} from "lucide-react";
import InputBox from "@/components/chat/InputBox";
import StreamingMessageBubble from "@/components/chat/StreamingMessageBubble";
import {
  useStreamingChat,
  type StreamingMessage,
} from "@/hooks/useStreamingChat";
import VideoPlayer from "@/components/visualizations/VideoPlayer";
import { ScreenManager } from "@/components/screens";
import { useTTSStreaming } from "@/hooks/useTTSStreaming";
import type { ConceptNodeData } from "@/types";

interface NodeContentProps {
  node: ConceptNodeData;
  onBack: () => void;
  onMarkComplete: (nodeId: number) => void;
  totalNodes: number;
  isExpanded: boolean;
}

/* ── localStorage key for chat persistence ── */
const CHAT_STORAGE_KEY = (nodeId: number) => `eureka-chat-${nodeId}`;
const SESSION_STORAGE_KEY = (nodeId: number) => `eureka-session-${nodeId}`;

function loadChatFromStorage(nodeId: number): StreamingMessage[] {
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

function saveChatToStorage(nodeId: number, msgs: StreamingMessage[]) {
  try {
    // Only save non-streaming messages
    const toSave = msgs.filter((m) => !m.isStreaming);
    localStorage.setItem(CHAT_STORAGE_KEY(nodeId), JSON.stringify(toSave));
  } catch {
    /* non-critical */
  }
}

function getOrCreateSessionId(nodeId: number): string {
  const key = SESSION_STORAGE_KEY(nodeId);
  let sid = localStorage.getItem(key);
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, sid);
  }
  return sid;
}

/** Convert node numeric ID to slug for the backend */
function nodeIdToSlug(id: number): string {
  const map: Record<number, string> = {
    1: "what-is-motion",
    2: "speed-and-velocity",
    3: "acceleration",
    4: "newtons-first-law",
    5: "newtons-second-law",
    6: "newtons-third-law",
    7: "friction-and-resistance",
    8: "gravity-and-free-fall",
  };
  return map[id] || "what-is-motion";
}

const NodeContent: FC<NodeContentProps> = ({
  node,
  onBack,
  onMarkComplete,
  totalNodes,
  isExpanded,
}) => {
  const [hasWatchedVideo, setHasWatchedVideo] = useState<boolean>(false);
  const [reflection, setReflection] = useState<string>("");
  const [showInputAfterVideo, setShowInputAfterVideo] =
    useState<boolean>(false);

  /* ── Session / node slug ── */
  const sessionId = getOrCreateSessionId(node.id);
  const nodeSlug = nodeIdToSlug(node.id);

  /* ── Dynamic suggestions from backend ── */
  const [nodeSuggestions, setNodeSuggestions] = useState<string[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  /* ── Chat state via streaming hook ── */
  const [hasStartedChat, setHasStartedChat] = useState<boolean>(
    () => loadChatFromStorage(node.id).length > 0,
  );

  const {
    messages,
    isStreaming: isGenerating,
    error: chatError,
    sendMessage,
    loadMessages,
    clearMessages,
    setError: setChatError,
  } = useStreamingChat({
    nodeId: nodeSlug,
    sessionId,
    onSuggestions: (items) => {
      setNodeSuggestions(items);
    },
    onDone: (_intent, _depth) => {
      // Could track depth/intent in UI if needed
    },
  });

  /* ── TTS streaming auto-read (reads as text appears) ── */
  const streamingContent = useMemo(() => {
    if (!isGenerating) return undefined;
    const last = messages[messages.length - 1];
    return last?.role === "assistant" && last.isStreaming
      ? last.content
      : undefined;
  }, [messages, isGenerating]);

  const { autoReadEnabled, toggleAutoRead, stopPlayback } = useTTSStreaming({
    streamingContent,
    isStreaming: isGenerating,
  });

  const inputRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ── Load persisted messages on mount ── */
  useEffect(() => {
    const saved = loadChatFromStorage(node.id);
    if (saved.length > 0) {
      loadMessages(saved);
    }
  }, [node.id, loadMessages]);

  /* ── Load suggestions from backend ── */
  useEffect(() => {
    if (suggestionsLoaded) return;
    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`/api/chat/suggestions?nodeId=${nodeSlug}`);
        if (res.ok) {
          const data = await res.json();
          if (data.suggestions && data.suggestions.length > 0) {
            setNodeSuggestions(data.suggestions);
          }
        }
      } catch {
        // Use fallback suggestions
        setNodeSuggestions([
          "What's the key idea behind this concept?",
          "How does this connect to everyday experience?",
          "Can you help me build intuition for this?",
          "What's the most surprising thing about this concept?",
        ]);
      }
      setSuggestionsLoaded(true);
    };
    fetchSuggestions();
  }, [nodeSlug, suggestionsLoaded]);

  /* ── Persist messages to localStorage ── */
  useEffect(() => {
    if (messages.length > 0) {
      saveChatToStorage(node.id, messages);
    }
  }, [messages, node.id]);

  /* ── Auto-focus input when chat starts ── */
  useEffect(() => {
    if (hasStartedChat) {
      const t = setTimeout(() => {
        const textarea = inputRef.current?.querySelector("textarea");
        textarea?.focus();
      }, 450);
      return () => clearTimeout(t);
    }
  }, [hasStartedChat]);

  /* ── Scroll to newest message ── */
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [messages.length, messages[messages.length - 1]?.content?.length]);

  const handleVideoEnd = () => {
    setHasWatchedVideo(true);
    setShowInputAfterVideo(true);
  };

  /* ── Handle suggested prompt click ── */
  const handleSuggestedClick = useCallback(
    async (promptText: string) => {
      setHasStartedChat(true);
      setChatError(null);
      sendMessage(promptText);
    },
    [sendMessage, setChatError],
  );

  /* ── Handle "I'm Curious" button (no prompt) ── */
  const handleCuriousClick = useCallback(() => {
    setHasStartedChat(true);
  }, []);

  /* ── Clear chat history ── */
  const handleClearChat = useCallback(() => {
    clearMessages();
    localStorage.removeItem(CHAT_STORAGE_KEY(node.id));
    setHasStartedChat(false);
  }, [clearMessages, node.id]);

  /* ── Handle chat input send ── */
  const handleChatSend = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      setChatError(null);
      sendMessage(content.trim());
    },
    [sendMessage, setChatError],
  );

  /* ── Legacy handler for reflection textarea submit ── */
  const handleReflectionSubmit = (content: string) => {
    setReflection(content);
    handleSuggestedClick(content);
  };

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
            <span className="text-xs text-gray-500 dark:text-gray-400 italic">
              {node.type === "foundation" &&
                "Looking at the idea from the ground up"}
              {node.type === "connection" && "Exploring connections"}
              {node.type === "power" && "Understanding deeper patterns"}
              {node.type === "synthesis" && "Putting ideas together"}
              {node.type === "challenge" && "Exploring real applications"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{node.emoji}</span>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex-1">
              {node.title}
            </h1>
            {/* TTS toggle */}
            <button
              onClick={toggleAutoRead}
              title={autoReadEnabled ? "Mute auto-read" : "Auto-read responses"}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-200 ${
                autoReadEnabled
                  ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                  : "bg-gray-100 text-gray-400 hover:text-gray-600 dark:bg-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
              }`}
            >
              {autoReadEnabled ? (
                <Volume2 className="w-4.5 h-4.5" />
              ) : (
                <VolumeX className="w-4.5 h-4.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            NODE 1 → Brilliant-style 12-screen progressive card
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {node.id === 1 ? (
            <>
              <ScreenManager onBack={onBack} onMarkComplete={onMarkComplete} />

              {/* ── Chat area ── */}
              <ChatArea
                messages={messages}
                isGenerating={isGenerating}
                chatError={chatError}
                setChatError={setChatError}
                sendMessage={sendMessage}
                hasStartedChat={hasStartedChat}
                nodeSuggestions={nodeSuggestions}
                handleSuggestedClick={handleSuggestedClick}
                handleCuriousClick={handleCuriousClick}
                handleChatSend={handleChatSend}
                onClear={handleClearChat}
                inputRef={inputRef}
                messagesEndRef={messagesEndRef}
                nodeTitle={node.title}
              />
            </>
          ) : (
            /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             OTHER NODES → Existing single-page layout
             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
            <>
              {/* Welcome Message */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Eureka
                  </div>
                  <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl rounded-tl-md px-5 py-4 shadow-sm">
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                      {node.content.welcomeMessage}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Just now
                    </span>
                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Video Section */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xl">🎬</span>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Visual Introduction
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({node.content.videoDuration})
                  </span>
                </div>
                <VideoPlayer
                  title={node.content.videoTitle}
                  onSkip={handleVideoEnd}
                />
              </div>

              {/* Question after video */}
              {showInputAfterVideo && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Eureka
                    </div>
                    <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl rounded-tl-md px-5 py-4 shadow-sm">
                      <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                        Great! You watched the animation. What are your thoughts
                        on this?
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Interactive Simulation Placeholder */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xl">🎮</span>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Try It Yourself
                  </h2>
                </div>
                <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Play className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Interactive simulation coming soon
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      This space will contain hands-on activities
                    </p>
                  </div>
                </div>
              </div>

              {/* Reflection Question */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xl">💭</span>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Quick Reflection
                  </h2>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-6">
                  <p className="text-gray-800 dark:text-gray-200 mb-4 leading-relaxed">
                    {node.content.reflectionQuestion}
                  </p>
                  <textarea
                    placeholder="Your thoughts..."
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-0 focus:border-gray-200 dark:focus:border-gray-600"
                    rows={3}
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                  />
                  <button
                    onClick={() => handleReflectionSubmit(reflection)}
                    className="mt-3 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Submit Thought
                  </button>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={onBack}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200"
                >
                  ← Back to Map
                </button>
                <button className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-medium rounded-lg transition-all duration-200">
                  Explore Related Ideas
                </button>
              </div>

              {/* ── Chat area ── */}
              <ChatArea
                messages={messages}
                isGenerating={isGenerating}
                chatError={chatError}
                setChatError={setChatError}
                sendMessage={sendMessage}
                hasStartedChat={hasStartedChat}
                nodeSuggestions={nodeSuggestions}
                handleSuggestedClick={handleSuggestedClick}
                handleCuriousClick={handleCuriousClick}
                handleChatSend={handleChatSend}
                onClear={handleClearChat}
                inputRef={inputRef}
                messagesEndRef={messagesEndRef}
                nodeTitle={node.title}
              />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ChatArea — shared streaming chat component used by both Node 1 & others
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface ChatAreaProps {
  messages: StreamingMessage[];
  isGenerating: boolean;
  chatError: string | null;
  setChatError: (e: string | null) => void;
  sendMessage: (msg: string) => void;
  hasStartedChat: boolean;
  nodeSuggestions: string[];
  handleSuggestedClick: (q: string) => void;
  handleCuriousClick: () => void;
  handleChatSend: (content: string) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  nodeTitle: string;
  /** When true, the InputBox is rendered outside (sticky bottom) — ChatArea won't render it */
  stickyInput?: boolean;
}

const ChatArea: FC<ChatAreaProps> = ({
  messages,
  isGenerating,
  chatError,
  setChatError,
  sendMessage,
  hasStartedChat,
  nodeSuggestions,
  handleSuggestedClick,
  handleCuriousClick,
  handleChatSend,
  onClear,
  inputRef,
  messagesEndRef,
  nodeTitle,
  stickyInput = false,
}) => {
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const showThinking =
    isGenerating && lastMsg?.role === "assistant" && lastMsg?.content === "";

  return (
    <div className="mt-8" style={{ minHeight: 180 }}>
      {/* Clear history button — top-right when messages exist */}
      {messages.length > 0 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={onClear}
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
              // Hide the empty assistant placeholder — showThinking covers it
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
                    opacity: { duration: 0.25 },
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

            {/* Thinking indicator — shown while waiting for first token */}
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

            {/* Error message */}
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
                  <p className="text-gray-700 dark:text-gray-300">{question}</p>
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
                {messages.length > 0 ? "Continue Exploring" : "I'm Curious"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat input — appears after first interaction (only when not using sticky input) */}
      {!stickyInput && (
        <AnimatePresence>
          {hasStartedChat && (
            <motion.div
              key="chat-input"
              ref={inputRef}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.2,
                opacity: { duration: 0.4, delay: 0.2 },
              }}
            >
              <InputBox
                onSend={handleChatSend}
                placeholder={`Ask anything about ${nodeTitle.toLowerCase()}...`}
                isLoading={isGenerating}
                isCentered={false}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default NodeContent;
