/**
 * useStreamingChat â€” SSE streaming hook for the adaptive teaching system.
 *
 * Connects to /api/chat/stream via fetch + ReadableStream,
 * parses SSE events, and yields them to the caller.
 *
 * Uses a RAF-based typewriter queue so tokens always render
 * letter-by-letter (Claude-style) regardless of network bursts.
 */

import { useState, useRef, useCallback, useEffect } from "react";

export interface StreamEvent {
  type:
    | "token"
    | "image"
    | "image_generating"
    | "image_failed"
    | "video"
    | "video_generating"
    | "video_failed"
    | "done"
    | "error"
    | "suggestions";
  content?: string;
  base64?: string;
  mime?: string;
  description?: string;
  intent?: string;
  depth?: number;
  items?: string[];
}

export interface StreamingMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  images: Array<{
    base64: string;
    mime: string;
    description: string;
    /** position index in the text where image should appear */
    insertAfterChar: number;
    /** true while the image is being generated (show shimmer) */
    loading?: boolean;
  }>;
  videos: Array<{
    base64: string;
    mime: string;
    description: string;
    /** position index in the text where video should appear */
    insertAfterChar: number;
    /** true while the video is being generated (show shimmer) */
    loading?: boolean;
  }>;
  isStreaming: boolean;
  timestamp: Date;
}

interface ChatHistoryItem {
  role: string;
  content: string;
}

interface UseStreamingChatOptions {
  nodeId: string;
  sessionId: string;
  onSuggestions?: (items: string[]) => void;
  onDone?: (intent: string, depth: number) => void;
}

export function useStreamingChat({
  nodeId,
  sessionId,
  onSuggestions,
  onDone,
}: UseStreamingChatOptions) {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<StreamingMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // â”€â”€ Typewriter queue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // All chars received from GPT but not yet rendered
  const pendingQueueRef = useRef<string>("");
  // RAF handle
  const rafRef = useRef<number>(0);
  // Pending done/error event â€” wait for queue to drain before finalising
  const pendingDoneRef = useRef<{ intent: string; depth: number } | null>(null);
  const pendingErrorRef = useRef<string | null>(null);
  // Stable ref for callbacks so drainOnce closure stays fresh-free
  const onSuggestionsRef = useRef(onSuggestions);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onSuggestionsRef.current = onSuggestions;
  }, [onSuggestions]);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // ── Abort streaming on unmount (C5 fix) ─────────────────────────────
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      pendingQueueRef.current = "";
    };
  }, []);

  // ── Abort when nodeId changes (user navigated to different node) ────
  const prevNodeIdRef = useRef(nodeId);
  useEffect(() => {
    if (prevNodeIdRef.current !== nodeId) {
      abortRef.current?.abort();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      pendingQueueRef.current = "";
      pendingDoneRef.current = null;
      pendingErrorRef.current = null;
      setMessages([]);
      setError(null);
      setIsStreaming(false);
      prevNodeIdRef.current = nodeId;
    }
  }, [nodeId]);

  /**
   * drainOnce â€” consumes ONE character from the pending queue per RAF frame.
   * Uses only refs + stable setState so it needs zero deps (never goes stale).
   */
  const drainOnce = useCallback(() => {
    if (pendingQueueRef.current.length === 0) {
      rafRef.current = 0;

      // Queue is empty â€” finalise if we received a done/error signal
      if (pendingDoneRef.current) {
        const data = pendingDoneRef.current;
        pendingDoneRef.current = null;
        setMessages((prev) =>
          prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
        );
        setIsStreaming(false);
        onDoneRef.current?.(data.intent, data.depth);
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

    // Take one character and render it
    const char = pendingQueueRef.current[0];
    pendingQueueRef.current = pendingQueueRef.current.slice(1);

    setMessages((prev) =>
      prev.map((m) =>
        m.isStreaming ? { ...m, content: m.content + char } : m,
      ),
    );

    rafRef.current = requestAnimationFrame(drainOnce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty â€” all state accessed via refs or stable setters

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || isStreaming) return;

      setError(null);

      // Reset typewriter state
      pendingQueueRef.current = "";
      pendingDoneRef.current = null;
      pendingErrorRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      // Add user message
      const userMsg: StreamingMessage = {
        id: Date.now(),
        role: "user",
        content: userMessage.trim(),
        images: [],
        videos: [],
        isStreaming: false,
        timestamp: new Date(),
      };

      // Placeholder assistant message
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

      // Build history from existing messages (via ref to avoid stale closures)
      const history: ChatHistoryItem[] = messagesRef.current
        .filter((m) => !m.isStreaming)
        .map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: userMessage.trim() });

      const params = new URLSearchParams({
        message: userMessage.trim(),
        nodeId: nodeId,
        sessionId: sessionId,
        history: JSON.stringify(history),
      });

      const abortController = new AbortController();
      abortRef.current = abortController;

      // Track total chars received (for image insertion points)
      let receivedCharCount = 0;

      try {
        const response = await fetch(`/api/chat/stream?${params}`, {
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
                case "token":
                  if (event.content) {
                    receivedCharCount += event.content.length;
                    // Push into queue; start drain loop if idle
                    pendingQueueRef.current += event.content;
                    if (!rafRef.current) {
                      rafRef.current = requestAnimationFrame(drainOnce);
                    }
                  }
                  break;

                case "image_generating":
                  // Add a loading placeholder for the incoming image
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
                        // Find matching loading placeholder and replace it
                        const loadingIdx = m.images.findIndex(
                          (img) =>
                            img.loading &&
                            img.description === event.description,
                        );
                        if (loadingIdx !== -1) {
                          const newImages = [...m.images];
                          newImages[loadingIdx] = {
                            base64: event.base64!,
                            mime: event.mime || "image/png",
                            description: event.description || "",
                            insertAfterChar:
                              newImages[loadingIdx].insertAfterChar,
                            loading: false,
                          };
                          return { ...m, images: newImages };
                        }
                        // Fallback — no loading placeholder found, add directly
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
                  // Remove the loading placeholder (image generation failed)
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

                case "video_generating":
                  // Add a loading placeholder for the incoming video
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
                        const loadingIdx = m.videos.findIndex(
                          (v) =>
                            v.loading && v.description === event.description,
                        );
                        if (loadingIdx !== -1) {
                          const newVideos = [...m.videos];
                          newVideos[loadingIdx] = {
                            base64: event.base64!,
                            mime: event.mime || "video/mp4",
                            description: event.description || "",
                            insertAfterChar:
                              newVideos[loadingIdx].insertAfterChar,
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

                case "suggestions":
                  if (event.items) {
                    onSuggestionsRef.current?.(event.items);
                  }
                  break;

                case "done":
                  // Don't finalise immediately â€” wait for typewriter to drain
                  pendingDoneRef.current = {
                    intent: event.intent || "clarification",
                    depth: event.depth || 1,
                  };
                  // If queue already empty, trigger drain loop to finalise
                  if (!rafRef.current) {
                    rafRef.current = requestAnimationFrame(drainOnce);
                  }
                  break;

                case "error":
                  pendingErrorRef.current = event.content || "Unknown error";
                  if (!rafRef.current) {
                    rafRef.current = requestAnimationFrame(drainOnce);
                  }
                  break;
              }
            } catch {
              // Skip malformed events
            }
          }
        }

        // Stream ended â€” if no done/error signal received, finalise after drain
        if (!pendingDoneRef.current && !pendingErrorRef.current) {
          pendingDoneRef.current = { intent: "clarification", depth: 1 };
          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(drainOnce);
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          pendingErrorRef.current = err.message || "Connection failed";
          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(drainOnce);
          }
        } else {
          // Aborted â€” clean up immediately
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
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
    [isStreaming, nodeId, sessionId, drainOnce],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    pendingQueueRef.current = "";
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    pendingQueueRef.current = "";
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  const loadMessages = useCallback((msgs: StreamingMessage[]) => {
    setMessages(msgs);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    loadMessages,
    setError,
  };
}
