/**
 * useTTSStreaming — Auto-read assistant responses via Azure TTS
 * approximately in sync with streaming text.
 *
 * How it works:
 *   1. While `isStreaming` is true this hook watches `streamingContent`
 *      for sentence boundaries (. ! ? plus paragraph breaks).
 *   2. Each completed sentence group (~80+ chars) is sent to
 *      POST /api/tts/generate and the resulting audio URL is queued.
 *   3. Audio clips play back sequentially in order, so the spoken
 *      voice is approximately in sync with the text appearing.
 *   4. When streaming finishes, any leftover text is flushed as a
 *      final TTS chunk.
 *   5. Toggling off, sending a new message, or unmounting stops
 *      playback and clears the queue.
 *
 * The toggle is persisted in localStorage (`eureka_tts_streaming`).
 */

import { useState, useRef, useEffect, useCallback } from "react";

const STORAGE_KEY = "eureka_tts_streaming";

/** Minimum characters to accumulate before firing a TTS request. */
const MIN_CHUNK_CHARS = 60;

/**
 * Strip markdown / LaTeX / code fences so TTS reads clean prose.
 */
function stripForSpeech(text: string): string {
  let c = text;
  c = c.replace(/```[\s\S]*?```/g, " (code omitted) ");
  c = c.replace(/`[^`]+`/g, "");
  c = c.replace(/\$\$[\s\S]*?\$\$/g, " (equation) ");
  c = c.replace(/\$[^$]+\$/g, " (expression) ");
  c = c.replace(/!\[.*?\]\(.*?\)/g, "");
  c = c.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  c = c.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  c = c.replace(/_{1,3}([^_]+)_{1,3}/g, "$1");
  c = c.replace(/^#{1,6}\s+/gm, "");
  c = c.replace(/^[\s]*[-*+]\s+/gm, "");
  c = c.replace(/^[\s]*\d+\.\s+/gm, "");
  c = c.replace(/\s+/g, " ").trim();
  return c;
}

/**
 * Find the last sentence-ending boundary in `text`.
 * Returns the index AFTER the boundary character (split point),
 * or -1 if no boundary found.
 */
function findSentenceBoundary(text: string): number {
  // Look for sentence-enders followed by whitespace or end-of-string
  // We scan from the end backwards to get the longest possible chunk.
  let lastBoundary = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (
      (ch === "." || ch === "!" || ch === "?" || ch === ":" || ch === ";") &&
      (i === text.length - 1 || /\s/.test(text[i + 1]))
    ) {
      lastBoundary = i + 1;
    }
    // Paragraph break = strong boundary
    if (ch === "\n" && i > 0 && text[i - 1] === "\n") {
      lastBoundary = i + 1;
    }
  }
  return lastBoundary;
}

// ── Types ────────────────────────────────────────────────────────────────

interface UseTTSStreamingOptions {
  /** The full content of the currently-streaming assistant message (grows each token). */
  streamingContent: string | undefined;
  /** Whether the chat is currently streaming tokens. */
  isStreaming: boolean;
}

export function useTTSStreaming({
  streamingContent,
  isStreaming,
}: UseTTSStreamingOptions) {
  /* ── Persisted toggle ────────────────────────────────────── */
  const [autoReadEnabled, setAutoReadEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(autoReadEnabled));
    } catch {
      /* ignore */
    }
  }, [autoReadEnabled]);

  /* ── Refs ─────────────────────────────────────────────────── */
  /** How much of streamingContent we've already dispatched for TTS. */
  const sentLengthRef = useRef(0);
  /** Ordered queue of audio URLs waiting to play. */
  const audioQueueRef = useRef<string[]>([]);
  /** Whether we're currently playing an audio clip. */
  const isPlayingRef = useRef(false);
  /** The currently playing Audio element. */
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  /** Abort controllers for in-flight TTS fetches. */
  const abortControllersRef = useRef<AbortController[]>([]);
  /** Track if streaming *was* active (to detect transition to stopped). */
  const wasStreamingRef = useRef(false);
  /** Guard to prevent double-flush of remaining text */
  const flushedRef = useRef(false);

  /* ── Queue player ────────────────────────────────────────── */
  const playNext = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    isPlayingRef.current = true;
    const url = audioQueueRef.current.shift()!;
    const audio = new Audio(url);
    currentAudioRef.current = audio;
    audio.addEventListener("ended", () => {
      currentAudioRef.current = null;
      playNext();
    });
    audio.addEventListener("error", () => {
      currentAudioRef.current = null;
      playNext(); // skip broken clip
    });
    audio.play().catch(() => {
      // Autoplay blocked
      currentAudioRef.current = null;
      playNext();
    });
  }, []);

  /* ── Enqueue a TTS chunk ─────────────────────────────────── */
  const enqueueTTS = useCallback(
    (rawText: string) => {
      const speechText = stripForSpeech(rawText);
      if (!speechText || speechText.length < 3) return;

      const controller = new AbortController();
      abortControllersRef.current.push(controller);

      fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: speechText,
          voice: "en-GB-SoniaNeural",
        }),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok || controller.signal.aborted) return null;
          return res.json();
        })
        .then((data) => {
          if (!data || controller.signal.aborted) return;
          audioQueueRef.current.push(data.audioUrl);
          // Start playing if queue was idle
          if (!isPlayingRef.current) {
            playNext();
          }
        })
        .catch(() => {
          /* aborted or network error — ignore */
        });
    },
    [playNext],
  );

  /* ── Stop all playback and pending fetches ───────────────── */
  const stopPlayback = useCallback(() => {
    // Abort all in-flight fetches
    for (const ac of abortControllersRef.current) {
      ac.abort();
    }
    abortControllersRef.current = [];
    // Clear queue
    audioQueueRef.current = [];
    // Stop current audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  /* ── Toggle off → stop ───────────────────────────────────── */
  useEffect(() => {
    if (!autoReadEnabled) {
      stopPlayback();
      sentLengthRef.current = 0;
    }
  }, [autoReadEnabled, stopPlayback]);

  /* ── Cleanup on unmount ──────────────────────────────────── */
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  /* ── Reset when new streaming starts ─────────────────────── */
  useEffect(() => {
    if (isStreaming && !wasStreamingRef.current) {
      // Streaming just started → reset
      stopPlayback();
      sentLengthRef.current = 0;
      flushedRef.current = false;
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, stopPlayback]);

  /* ── Watch streaming content and dispatch TTS chunks ─────── */
  useEffect(() => {
    if (!isStreaming || !autoReadEnabled || !streamingContent) return;

    const alreadySent = sentLengthRef.current;
    const newText = streamingContent.slice(alreadySent);
    if (newText.length < MIN_CHUNK_CHARS) return;

    const boundary = findSentenceBoundary(newText);
    if (boundary <= 0) return;

    // Only send if the chunk is meaningful
    const chunk = newText.slice(0, boundary);
    if (chunk.trim().length < 5) return;

    sentLengthRef.current = alreadySent + boundary;
    enqueueTTS(chunk);
  }, [streamingContent, isStreaming, autoReadEnabled, enqueueTTS]);

  /* ── Flush remaining text when streaming ends ────────────── */
  useEffect(() => {
    if (isStreaming || !autoReadEnabled || !streamingContent) return;
    if (flushedRef.current) return;
    flushedRef.current = true;

    const remaining = streamingContent.slice(sentLengthRef.current);
    if (remaining.trim().length > 5) {
      enqueueTTS(remaining);
    }
    sentLengthRef.current = streamingContent.length;
  }, [isStreaming, autoReadEnabled, streamingContent, enqueueTTS]);

  /* ── Public API ──────────────────────────────────────────── */
  const toggleAutoRead = useCallback(() => {
    setAutoReadEnabled((prev) => !prev);
  }, []);

  return {
    autoReadEnabled,
    toggleAutoRead,
    stopPlayback,
  };
}
