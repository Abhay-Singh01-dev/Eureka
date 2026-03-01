/**
 * useTTSStreaming — Per-message TTS read-aloud + streaming auto-read.
 *
 * Uses the browser's built-in SpeechSynthesis API (no backend needed).
 * Falls back gracefully if SpeechSynthesis is unavailable.
 *
 * Provides:
 *   readAloud(text, msgId)  — speak a finished message on demand
 *   stopPlayback()          — halt current speech
 *   playingMessageId        — which message ID is currently being read
 *   autoReadEnabled         — whether streaming auto-read is on
 *   toggleAutoRead()        — flip the auto-read switch
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ── Config ──────────────────────────────────────────────────────────────
const STORAGE_KEY = "eureka_tts_streaming";
const MIN_CHUNK_CHARS = 40;

// ── Helpers ─────────────────────────────────────────────────────────────

/** Strip markdown / LaTeX so TTS reads clean prose. */
function stripForSpeech(md: string): string {
  let t = md;
  t = t.replace(/```[\s\S]*?```/g, " code block ");
  t = t.replace(/`[^`]+`/g, " code ");
  t = t.replace(/\$\$[\s\S]*?\$\$/g, " equation ");
  t = t.replace(/\$[^$]+\$/g, " equation ");
  t = t.replace(/\\\[[\s\S]*?\\\]/g, " equation ");
  t = t.replace(/\\\(.*?\\\)/g, " equation ");
  t = t.replace(/!\[.*?\]\(.*?\)/g, "");
  t = t.replace(/\[([^\]]+)\]\(.*?\)/g, "$1");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/\*{1,3}(.*?)\*{1,3}/g, "$1");
  t = t.replace(/_{1,3}(.*?)_{1,3}/g, "$1");
  t = t.replace(/^[\s]*[-*+]\s+/gm, "");
  t = t.replace(/^[\s]*\d+\.\s+/gm, "");
  t = t.replace(/\n{2,}/g, ". ");
  t = t.replace(/\n/g, " ");
  t = t.replace(/\s{2,}/g, " ");
  return t.trim();
}

/** Find the index (exclusive) of the latest sentence boundary in `text`. */
function findSentenceBoundary(text: string): number {
  let lastIdx = -1;
  const re = /[.!?:;]\s/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    lastIdx = m.index + 1;
  }
  const paraIdx = text.lastIndexOf("\n\n");
  if (paraIdx > lastIdx) lastIdx = paraIdx;
  return lastIdx;
}

/** Check if browser SpeechSynthesis is available */
function hasSpeechSynthesis(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Get the best English voice available */
function getBestVoice(): SpeechSynthesisVoice | null {
  if (!hasSpeechSynthesis()) return null;
  const voices = window.speechSynthesis.getVoices();
  // Prefer high-quality voices
  const preferred = [
    "Microsoft Zira",
    "Google US English",
    "Google UK English Female",
    "Samantha",
    "Karen",
    "Moira",
    "Tessa",
  ];
  for (const name of preferred) {
    const v = voices.find((voice) => voice.name.includes(name));
    if (v) return v;
  }
  // Fall back to any English voice
  const english = voices.find((voice) => voice.lang.startsWith("en"));
  if (english) return english;
  // Fall back to default
  return voices[0] || null;
}

// ── Hook ────────────────────────────────────────────────────────────────

interface UseTTSOptions {
  /** The raw content of the currently-streaming assistant message. */
  streamingContent?: string;
  /** Whether the chat is currently streaming. */
  isStreaming: boolean;
}

export function useTTSStreaming({
  streamingContent,
  isStreaming,
}: UseTTSOptions) {
  const [autoReadEnabled, setAutoReadEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const [playingMessageId, setPlayingMessageId] = useState<number | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────
  const sentOffsetRef = useRef(0);
  const utteranceQueueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const wasStreamingRef = useRef(false);
  const flushedRef = useRef(false);
  const playingMsgIdRef = useRef<number | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // ── Speak a chunk using browser SpeechSynthesis ──────────────────────
  const speakNext = useCallback(() => {
    if (!hasSpeechSynthesis()) return;

    if (utteranceQueueRef.current.length === 0) {
      playingRef.current = false;
      setPlayingMessageId(null);
      playingMsgIdRef.current = null;
      currentUtteranceRef.current = null;
      return;
    }

    playingRef.current = true;
    const text = utteranceQueueRef.current.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);
    currentUtteranceRef.current = utterance;

    // Configure voice
    const voice = getBestVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      currentUtteranceRef.current = null;
      speakNext();
    };
    utterance.onerror = (e) => {
      if (e.error !== "interrupted" && e.error !== "canceled") {
        console.warn("[TTS] Speech error:", e.error);
      }
      currentUtteranceRef.current = null;
      speakNext();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  /** Queue a text chunk for speaking. */
  const enqueueChunk = useCallback(
    (text: string) => {
      const clean = stripForSpeech(text);
      if (clean.length < 5) return;
      if (!hasSpeechSynthesis()) return;

      utteranceQueueRef.current.push(clean);
      if (!playingRef.current) speakNext();
    },
    [speakNext],
  );

  // ── Streaming auto-read: sentence-boundary detection ─────────────────
  useEffect(() => {
    if (!autoReadEnabled || !isStreaming || !streamingContent) return;

    const raw = streamingContent;
    const offset = sentOffsetRef.current;
    const unsent = raw.slice(offset);

    if (unsent.length < MIN_CHUNK_CHARS) return;

    const boundary = findSentenceBoundary(unsent);
    if (boundary <= 0) return;

    const chunk = unsent.slice(0, boundary);
    sentOffsetRef.current = offset + boundary;
    flushedRef.current = false;
    setPlayingMessageId(-1); // -1 = streaming message
    playingMsgIdRef.current = -1;
    enqueueChunk(chunk);
  }, [streamingContent, isStreaming, autoReadEnabled, enqueueChunk]);

  // ── Detect stream end → flush remaining text ──────────────────────────
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming && !flushedRef.current) {
      flushedRef.current = true;
      if (autoReadEnabled && streamingContent) {
        const remaining = streamingContent.slice(sentOffsetRef.current);
        if (remaining.trim().length > 5) {
          enqueueChunk(remaining);
        }
      }
      sentOffsetRef.current = 0;
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, autoReadEnabled, streamingContent, enqueueChunk]);

  // ── Reset offset when a new stream starts ─────────────────────────────
  useEffect(() => {
    if (isStreaming && sentOffsetRef.current === 0) {
      flushedRef.current = false;
    }
  }, [isStreaming]);

  // ── Public: stop ──────────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    if (hasSpeechSynthesis()) {
      window.speechSynthesis.cancel();
    }
    utteranceQueueRef.current = [];
    currentUtteranceRef.current = null;
    playingRef.current = false;
    setPlayingMessageId(null);
    playingMsgIdRef.current = null;
  }, []);

  // ── Public: read a specific message aloud ─────────────────────────────
  const readAloud = useCallback(
    (text: string, messageId: number) => {
      if (!hasSpeechSynthesis()) return;

      // If already playing this message, stop it
      if (playingMsgIdRef.current === messageId) {
        stopPlayback();
        return;
      }
      // Stop anything currently playing
      stopPlayback();
      // Set the playing message
      setPlayingMessageId(messageId);
      playingMsgIdRef.current = messageId;

      const clean = stripForSpeech(text);
      if (clean.length < 5) return;

      // For short texts, send as one chunk
      if (clean.length <= 300) {
        enqueueChunk(clean);
        return;
      }

      // For longer texts, split at sentence boundaries
      const sentences: string[] = [];
      let remaining = clean;
      while (remaining.length > 0) {
        if (remaining.length <= 300) {
          sentences.push(remaining);
          break;
        }
        const boundary = findSentenceBoundary(remaining.slice(0, 350));
        if (boundary > 0) {
          sentences.push(remaining.slice(0, boundary));
          remaining = remaining.slice(boundary).trimStart();
        } else {
          sentences.push(remaining.slice(0, 300));
          remaining = remaining.slice(300).trimStart();
        }
      }
      sentences.forEach((s) => enqueueChunk(s));
    },
    [stopPlayback, enqueueChunk],
  );

  // ── Public: toggle auto-read ──────────────────────────────────────────
  const toggleAutoRead = useCallback(() => {
    setAutoReadEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      if (!next) stopPlayback();
      return next;
    });
  }, [stopPlayback]);

  // ── Preload voices (some browsers load async) ─────────────────────────
  useEffect(() => {
    if (hasSpeechSynthesis()) {
      window.speechSynthesis.getVoices();
      const onVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
      return () => {
        window.speechSynthesis.removeEventListener(
          "voiceschanged",
          onVoicesChanged,
        );
      };
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      sentOffsetRef.current = 0;
    };
  }, [stopPlayback]);

  return {
    autoReadEnabled,
    toggleAutoRead,
    stopPlayback,
    readAloud,
    playingMessageId,
  };
}
