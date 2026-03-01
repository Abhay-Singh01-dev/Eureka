/**
 * useTTSAutoRead — Auto-read assistant responses via Azure TTS (Sonia voice).
 *
 * Features:
 *   - Toggle persisted in localStorage (`eureka_tts_autoread`)
 *   - Calls /api/tts/generate after streaming completes
 *   - Plays audio via HTML5 <audio> element
 *   - Stops playback on new message, toggle-off, or unmount
 *   - Strips Markdown / LaTeX / code fences to produce clean speech text
 */

import { useState, useRef, useEffect, useCallback } from "react";

const STORAGE_KEY = "eureka_tts_autoread";

/**
 * Strip markdown formatting, LaTeX, code blocks etc. so TTS reads clean prose.
 */
function stripForSpeech(text: string): string {
  let cleaned = text;
  // Remove code fences
  cleaned = cleaned.replace(/```[\s\S]*?```/g, " (code omitted) ");
  // Remove inline code
  cleaned = cleaned.replace(/`[^`]+`/g, "");
  // Remove display math $$...$$
  cleaned = cleaned.replace(/\$\$[\s\S]*?\$\$/g, " (equation) ");
  // Remove inline math $...$
  cleaned = cleaned.replace(/\$[^$]+\$/g, " (expression) ");
  // Remove markdown images ![alt](url)
  cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, "");
  // Convert markdown links [text](url) → text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Remove bold/italic markers
  cleaned = cleaned.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  cleaned = cleaned.replace(/_{1,3}([^_]+)_{1,3}/g, "$1");
  // Remove headings markers
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");
  // Remove bullet markers
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, "");
  // Remove numbered list markers
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, "");
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

interface UseTTSAutoReadOptions {
  /** Current messages array — we watch the last assistant message */
  lastAssistantContent: string | undefined;
  /** Whether the chat is currently streaming */
  isStreaming: boolean;
}

export function useTTSAutoRead({
  lastAssistantContent,
  isStreaming,
}: UseTTSAutoReadOptions) {
  const [autoReadEnabled, setAutoReadEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastReadContentRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  // Persist toggle
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(autoReadEnabled));
    } catch {
      // ignore
    }
  }, [autoReadEnabled]);

  // Stop playback helper
  const stopPlayback = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  // When toggle is turned off, stop any current playback
  useEffect(() => {
    if (!autoReadEnabled) {
      stopPlayback();
    }
  }, [autoReadEnabled, stopPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  // Auto-read when streaming finishes
  useEffect(() => {
    // Only trigger when streaming just finished, auto-read is on, and we have content
    if (isStreaming || !autoReadEnabled || !lastAssistantContent) return;

    // Don't re-read the same content
    if (lastAssistantContent === lastReadContentRef.current) return;
    lastReadContentRef.current = lastAssistantContent;

    const speechText = stripForSpeech(lastAssistantContent);
    if (!speechText || speechText.length < 5) return;

    // Stop any prior playback
    stopPlayback();

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch("/api/tts/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: speechText,
            voice: "en-GB-SoniaNeural",
          }),
          signal: controller.signal,
        });

        if (!res.ok || controller.signal.aborted) return;

        const data = await res.json();
        if (controller.signal.aborted) return;

        const audio = new Audio(data.audioUrl);
        audioRef.current = audio;
        audio.play().catch(() => {
          // Autoplay blocked — user hasn't interacted yet, silently skip
        });
      } catch {
        // Aborted or network error — ignore
      }
    })();
  }, [isStreaming, autoReadEnabled, lastAssistantContent, stopPlayback]);

  const toggleAutoRead = useCallback(() => {
    setAutoReadEnabled((prev) => !prev);
  }, []);

  return {
    autoReadEnabled,
    toggleAutoRead,
    stopPlayback,
  };
}
