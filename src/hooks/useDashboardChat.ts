/**
 * useDashboardChat — SSE streaming hook for the global-scope dashboard chat.
 *
 * Same typewriter + RAF queue as useStreamingChat, but:
 *   - No nodeId (global scope, not module-locked)
 *   - Uses /api/dashboard/stream endpoint
 *   - Manages conversationId lifecycle (auto-generate, load, reset)
 *   - Fully isolated from "I'm Curious" node chats
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { StreamingMessage } from "./useStreamingChat";

// Re-export so consumers can import from here directly
export type { StreamingMessage };

// ── Persistent user ID (localStorage UUID) ────────────────────────────
const USER_ID_KEY = "eureka_user_id";

function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

interface StreamEvent {
  type: string;
  content?: string;
  base64?: string;
  mime?: string;
  description?: string;
  id?: string;
}

interface UseDashboardChatOptions {
  onConversationCreated?: (id: string) => void;
}

export function useDashboardChat({
  onConversationCreated,
}: UseDashboardChatOptions = {}) {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const messagesRef = useRef<StreamingMessage[]>(messages);

  // ── Typewriter queue ────────────────────────────────────────────────
  const pendingQueueRef = useRef("");
  const rafRef = useRef(0);
  const pendingDoneRef = useRef(false);
  const pendingErrorRef = useRef<string | null>(null);
  const onCreatedRef = useRef(onConversationCreated);

  useEffect(() => {
    onCreatedRef.current = onConversationCreated;
  }, [onConversationCreated]);

  // Keep refs in sync with state (avoids stale closures)
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Abort streaming on unmount (C5 fix) ─────────────────────────────
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (rafRef.current) {
        clearTimeout(rafRef.current);
        rafRef.current = 0;
      }
      pendingQueueRef.current = "";
    };
  }, []);

  /**
   * drainOnce — consume characters from the pending queue at ~33 chars/sec
   * (setTimeout 30 ms) for a natural, well-paced streaming feel.
   */
  const drainOnce = useCallback(() => {
    if (pendingQueueRef.current.length === 0) {
      rafRef.current = 0;

      if (pendingDoneRef.current) {
        pendingDoneRef.current = false;
        setMessages((prev) =>
          prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
        );
        setIsStreaming(false);
      } else if (pendingErrorRef.current) {
        const msg = pendingErrorRef.current;
        pendingErrorRef.current = null;
        setError(msg);
        setMessages((prev) =>
          prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
        );
        setIsStreaming(false);
      }
      return;
    }

    const char = pendingQueueRef.current[0];
    pendingQueueRef.current = pendingQueueRef.current.slice(1);

    setMessages((prev) =>
      prev.map((m) =>
        m.isStreaming ? { ...m, content: m.content + char } : m,
      ),
    );

    rafRef.current = window.setTimeout(drainOnce, 30) as unknown as number;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── sendMessage ─────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || isStreaming) return;

      setError(null);
      pendingQueueRef.current = "";
      pendingDoneRef.current = false;
      pendingErrorRef.current = null;
      if (rafRef.current) {
        clearTimeout(rafRef.current);
        rafRef.current = 0;
      }

      // Generate conversation ID if needed
      let convId = conversationIdRef.current;
      if (!convId) {
        convId = crypto.randomUUID();
        conversationIdRef.current = convId;
        setConversationId(convId);
        onCreatedRef.current?.(convId);
      }

      // Add user + placeholder assistant message
      const userMsg: StreamingMessage = {
        id: Date.now(),
        role: "user",
        content: userMessage.trim(),
        images: [],
        videos: [],
        isStreaming: false,
        timestamp: new Date(),
      };

      const assistantId = Date.now() + 1;
      const assistantMsg: StreamingMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        images: [],
        videos: [],
        isStreaming: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      // Build history from existing messages (excluding current)
      // Cap to last 20 messages to avoid URL length limits
      const history = messagesRef.current
        .filter((m) => !m.isStreaming)
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-20);

      const params = new URLSearchParams({
        message: userMessage.trim(),
        conversationId: convId,
        history: JSON.stringify(history),
        userId: getUserId(),
      });

      const abortController = new AbortController();
      abortRef.current = abortController;
      let receivedCharCount = 0;

      try {
        const response = await fetch(`/api/dashboard/stream?${params}`, {
          signal: abortController.signal,
          headers: { Accept: "text/event-stream" },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const event: StreamEvent = JSON.parse(dataStr);

              switch (event.type) {
                case "conversation_id":
                  // Already handled via local generation
                  break;

                case "token":
                  if (event.content) {
                    receivedCharCount += event.content.length;
                    pendingQueueRef.current += event.content;
                    if (!rafRef.current) {
                      rafRef.current = window.setTimeout(
                        drainOnce,
                        30,
                      ) as unknown as number;
                    }
                  }
                  break;

                // ── IMAGE events ──
                case "image_generating":
                  if (event.description) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? {
                              ...m,
                              images: [
                                ...m.images,
                                {
                                  base64: "",
                                  mime: "image/png",
                                  description: event.description!,
                                  insertAfterChar: receivedCharCount,
                                  loading: true,
                                },
                              ],
                            }
                          : m,
                      ),
                    );
                  }
                  break;

                case "image":
                  if (event.base64) {
                    setMessages((prev) =>
                      prev.map((m) => {
                        if (m.id !== assistantId) return m;
                        const idx = m.images.findIndex(
                          (img) =>
                            img.loading &&
                            img.description === event.description,
                        );
                        if (idx !== -1) {
                          const newImages = [...m.images];
                          newImages[idx] = {
                            base64: event.base64!,
                            mime: event.mime || "image/png",
                            description: event.description || "",
                            insertAfterChar: newImages[idx].insertAfterChar,
                            loading: false,
                          };
                          return { ...m, images: newImages };
                        }
                        return {
                          ...m,
                          images: [
                            ...m.images,
                            {
                              base64: event.base64!,
                              mime: event.mime || "image/png",
                              description: event.description || "",
                              insertAfterChar: receivedCharCount,
                              loading: false,
                            },
                          ],
                        };
                      }),
                    );
                  }
                  break;

                case "image_failed":
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId) return m;
                      return {
                        ...m,
                        images: m.images.filter(
                          (img) =>
                            !(
                              img.loading &&
                              img.description === event.description
                            ),
                        ),
                      };
                    }),
                  );
                  break;

                // ── VIDEO events ──
                case "video_generating":
                  if (event.description) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? {
                              ...m,
                              videos: [
                                ...m.videos,
                                {
                                  base64: "",
                                  mime: "video/mp4",
                                  description: event.description!,
                                  insertAfterChar: receivedCharCount,
                                  loading: true,
                                },
                              ],
                            }
                          : m,
                      ),
                    );
                  }
                  break;

                case "video":
                  if (event.base64) {
                    setMessages((prev) =>
                      prev.map((m) => {
                        if (m.id !== assistantId) return m;
                        const idx = m.videos.findIndex(
                          (v) =>
                            v.loading && v.description === event.description,
                        );
                        if (idx !== -1) {
                          const newVideos = [...m.videos];
                          newVideos[idx] = {
                            base64: event.base64!,
                            mime: event.mime || "video/mp4",
                            description: event.description || "",
                            insertAfterChar: newVideos[idx].insertAfterChar,
                            loading: false,
                          };
                          return { ...m, videos: newVideos };
                        }
                        return {
                          ...m,
                          videos: [
                            ...m.videos,
                            {
                              base64: event.base64!,
                              mime: event.mime || "video/mp4",
                              description: event.description || "",
                              insertAfterChar: receivedCharCount,
                              loading: false,
                            },
                          ],
                        };
                      }),
                    );
                  }
                  break;

                case "video_failed":
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId) return m;
                      return {
                        ...m,
                        videos: m.videos.filter(
                          (v) =>
                            !(v.loading && v.description === event.description),
                        ),
                      };
                    }),
                  );
                  break;

                case "done":
                  pendingDoneRef.current = true;
                  if (!rafRef.current) {
                    rafRef.current = window.setTimeout(
                      drainOnce,
                      30,
                    ) as unknown as number;
                  }
                  break;

                case "error":
                  pendingErrorRef.current = event.content || "Unknown error";
                  if (!rafRef.current) {
                    rafRef.current = window.setTimeout(
                      drainOnce,
                      30,
                    ) as unknown as number;
                  }
                  break;
              }
            } catch {
              // skip malformed events
            }
          }
        }

        // Stream ended — finalise if no done/error received
        if (!pendingDoneRef.current && !pendingErrorRef.current) {
          pendingDoneRef.current = true;
          if (!rafRef.current) {
            rafRef.current = window.setTimeout(
              drainOnce,
              30,
            ) as unknown as number;
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          pendingErrorRef.current = err.message || "Connection failed";
          if (!rafRef.current) {
            rafRef.current = window.setTimeout(
              drainOnce,
              30,
            ) as unknown as number;
          }
        } else {
          if (rafRef.current) {
            clearTimeout(rafRef.current);
            rafRef.current = 0;
          }
          pendingQueueRef.current = "";
          setMessages((prev) =>
            prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
          );
          setIsStreaming(false);
        }
      } finally {
        abortRef.current = null;
      }
    },
    [isStreaming, drainOnce],
  );

  // ── stopStreaming ───────────────────────────────────────────────────
  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    if (rafRef.current) {
      clearTimeout(rafRef.current);
      rafRef.current = 0;
    }
    pendingQueueRef.current = "";
    setIsStreaming(false);
  }, []);

  // ── startNewChat ────────────────────────────────────────────────────
  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    if (rafRef.current) {
      clearTimeout(rafRef.current);
      rafRef.current = 0;
    }
    pendingQueueRef.current = "";
    conversationIdRef.current = null;
    setConversationId(null);
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  // ── loadConversation ────────────────────────────────────────────────
  const loadConversation = useCallback(
    (convId: string, msgs: StreamingMessage[]) => {
      abortRef.current?.abort();
      if (rafRef.current) {
        clearTimeout(rafRef.current);
        rafRef.current = 0;
      }
      pendingQueueRef.current = "";
      conversationIdRef.current = convId;
      setConversationId(convId);
      setMessages(msgs);
      setError(null);
      setIsStreaming(false);
    },
    [],
  );

  return {
    messages,
    isStreaming,
    error,
    conversationId,
    sendMessage,
    stopStreaming,
    startNewChat,
    loadConversation,
    setError,
  };
}
