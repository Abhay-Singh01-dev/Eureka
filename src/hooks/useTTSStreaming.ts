/**
 * useTTSStreaming — Per-message TTS read-aloud + streaming auto-read.
 *
 * Uses Azure Neural TTS (en-GB-SoniaNeural) via the backend /api/tts/generate
 * endpoint. Each sentence is prefetched as an MP3 while the previous one plays,
 * giving seamless gapless audio even during live streaming.
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
const TTS_VOICE = "en-GB-SoniaNeural";
const TTS_ENDPOINT = "/api/tts/generate";

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Convert LaTeX math to readable English so Sonia actually says the maths
 * instead of just "equation".
 */
function latexToSpeech(latex: string): string {
  let t = latex.trim();

  // ── Greek letters ──
  const greek: Record<string, string> = {
    alpha: "alpha",
    beta: "beta",
    gamma: "gamma",
    delta: "delta",
    epsilon: "epsilon",
    zeta: "zeta",
    eta: "eta",
    theta: "theta",
    lambda: "lambda",
    mu: "mu",
    nu: "nu",
    xi: "xi",
    pi: "pi",
    rho: "rho",
    sigma: "sigma",
    tau: "tau",
    phi: "phi",
    chi: "chi",
    psi: "psi",
    omega: "omega",
    Delta: "Delta",
    Sigma: "Sigma",
    Omega: "Omega",
    Gamma: "Gamma",
    Lambda: "Lambda",
    Pi: "Pi",
    Phi: "Phi",
    Theta: "Theta",
  };
  for (const [sym, word] of Object.entries(greek)) {
    t = t.replace(new RegExp(`\\\\${sym}\\b`, "g"), ` ${word} `);
  }

  // ── Fractions: \frac{a}{b} → "a over b" ──
  t = t.replace(
    /\\frac\{([^{}]+)\}\{([^{}]+)\}/g,
    (_, n, d) => `${latexToSpeech(n)} over ${latexToSpeech(d)}`,
  );
  // Nested fracs (second pass)
  t = t.replace(
    /\\frac\{([^{}]+)\}\{([^{}]+)\}/g,
    (_, n, d) => `${latexToSpeech(n)} over ${latexToSpeech(d)}`,
  );

  // ── Square root: \sqrt{x} → "square root of x" ──
  t = t.replace(
    /\\sqrt\{([^{}]+)\}/g,
    (_, inner) => `square root of ${latexToSpeech(inner)}`,
  );
  t = t.replace(
    /\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g,
    (_, n, inner) => `${latexToSpeech(n)}th root of ${latexToSpeech(inner)}`,
  );

  // ── Superscripts: x^{2} or x^2 ──
  t = t.replace(/\^\{([^{}]+)\}/g, (_, exp) => {
    const e = exp.trim();
    if (e === "2") return " squared";
    if (e === "3") return " cubed";
    if (e === "-1") return " inverse";
    if (e === "n") return " to the n";
    if (e === "T") return " transpose";
    return ` to the power ${latexToSpeech(e)}`;
  });
  t = t.replace(/\^([0-9a-zA-Z])/g, (_, exp) => {
    if (exp === "2") return " squared";
    if (exp === "3") return " cubed";
    return ` to the power ${exp}`;
  });

  // ── Subscripts: x_{i} or x_i ──
  t = t.replace(/\_\{([^{}]+)\}/g, (_, sub) => ` sub ${latexToSpeech(sub)}`);
  t = t.replace(/\_([0-9a-zA-Z])/g, (_, sub) => ` sub ${sub}`);

  // ── Common operators & symbols ──
  t = t.replace(/\\times/g, " times ");
  t = t.replace(/\\cdot/g, " times ");
  t = t.replace(/\\div/g, " divided by ");
  t = t.replace(/\\pm/g, " plus or minus ");
  t = t.replace(/\\mp/g, " minus or plus ");
  t = t.replace(/\\leq/g, " less than or equal to ");
  t = t.replace(/\\geq/g, " greater than or equal to ");
  t = t.replace(/\\neq/g, " not equal to ");
  t = t.replace(/\\approx/g, " approximately equal to ");
  t = t.replace(/\\equiv/g, " is equivalent to ");
  t = t.replace(/\\propto/g, " is proportional to ");
  t = t.replace(/\\infty/g, " infinity ");
  t = t.replace(/\\partial/g, " partial ");
  t = t.replace(/\\nabla/g, " del ");
  t = t.replace(/\\sum/g, " sum ");
  t = t.replace(/\\prod/g, " product ");
  t = t.replace(/\\int/g, " integral ");
  t = t.replace(/\\oint/g, " contour integral ");
  t = t.replace(/\\lim/g, " limit ");
  t = t.replace(/\\log/g, " log ");
  t = t.replace(/\\ln/g, " natural log ");
  t = t.replace(/\\sin/g, " sine ");
  t = t.replace(/\\cos/g, " cosine ");
  t = t.replace(/\\tan/g, " tangent ");
  t = t.replace(/\\vec\{([^{}]+)\}/g, (_, v) => `vector ${v}`);
  t = t.replace(/\\hat\{([^{}]+)\}/g, (_, v) => `${v} hat`);
  t = t.replace(/\\bar\{([^{}]+)\}/g, (_, v) => `${v} bar`);
  t = t.replace(/\\dot\{([^{}]+)\}/g, (_, v) => `${v} dot`);
  t = t.replace(/\\ddot\{([^{}]+)\}/g, (_, v) => `${v} double dot`);
  // Strip \left( \left[ \left| \left. and \right) etc. — any single delimiter char
  t = t.replace(/\\left./g, "");
  t = t.replace(/\\right./g, "");

  // ── Text commands ──
  t = t.replace(/\\text\{([^{}]+)\}/g, "$1");
  t = t.replace(/\\mathrm\{([^{}]+)\}/g, "$1");
  t = t.replace(/\\mathbf\{([^{}]+)\}/g, "$1");
  t = t.replace(/\\mathit\{([^{}]+)\}/g, "$1");

  // ── Strip remaining backslash commands ──
  t = t.replace(/\\[a-zA-Z]+/g, " ");

  // ── Strip braces ──
  t = t.replace(/[{}]/g, " ");

  // ── Strip lone operators that are already readable ──
  t = t.replace(/\s*=\s*/g, " equals ");
  t = t.replace(/\s*\+\s*/g, " plus ");
  t = t.replace(/\s*-\s*/g, " minus ");
  t = t.replace(/\s*>\s*/g, " greater than ");
  t = t.replace(/\s*<\s*/g, " less than ");

  // Cleanup
  t = t.replace(/\s{2,}/g, " ").trim();
  return t;
}

/** Strip markdown / LaTeX so TTS reads clean prose. */
function stripForSpeech(md: string): string {
  let t = md;
  t = t.replace(/```[\s\S]*?```/g, " code block ");
  t = t.replace(/`[^`]+`/g, " code ");
  // Convert block math ($$...$$) and \[...\] to readable speech
  t = t.replace(
    /\$\$([\s\S]*?)\$\$/g,
    (_, inner) => ` ${latexToSpeech(inner)} `,
  );
  t = t.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_, inner) => ` ${latexToSpeech(inner)} `,
  );
  // Convert inline math ($...$) and \(...\) to readable speech
  t = t.replace(/\$([^$\n]+)\$/g, (_, inner) => ` ${latexToSpeech(inner)} `);
  t = t.replace(/\\\(([^)]*)\\\)/g, (_, inner) => ` ${latexToSpeech(inner)} `);
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

/**
 * Fetch an MP3 URL from the backend TTS endpoint.
 * Returns null on any error so callers can skip gracefully.
 */
async function fetchTTSUrl(text: string): Promise<string | null> {
  try {
    const res = await fetch(TTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: TTS_VOICE }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.audioUrl as string) ?? null;
  } catch {
    return null;
  }
}

// ── Queue item ──────────────────────────────────────────────────────────
interface QueueItem {
  urlPromise: Promise<string | null>;
  cancelled: boolean;
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
  const queueRef = useRef<QueueItem[]>([]);
  const playingRef = useRef(false);
  const chainActiveRef = useRef(false); // re-entrancy guard for speakNext
  const wasStreamingRef = useRef(false);
  const flushedRef = useRef(false);
  const playingMsgIdRef = useRef<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Play queue sequentially ──────────────────────────────────────────
  const speakNext = useCallback(async () => {
    // Re-entrancy guard: only one speakNext chain should run at a time
    if (chainActiveRef.current) return;
    chainActiveRef.current = true;

    try {
      // Drain loop — keeps running until queue is empty or an audio starts
      while (true) {
        // Skip any cancelled items at the front of the queue
        while (queueRef.current.length > 0 && queueRef.current[0].cancelled) {
          queueRef.current.shift();
        }

        if (queueRef.current.length === 0) {
          playingRef.current = false;
          setPlayingMessageId(null);
          playingMsgIdRef.current = null;
          currentAudioRef.current = null;
          return;
        }

        const item = queueRef.current.shift()!;
        playingRef.current = true;

        // Await the pre-fetched URL (may already be resolved)
        const url = await item.urlPromise;

        // If stopPlayback() was called while we were awaiting, bail
        if (item.cancelled) continue;

        // If the TTS request failed (e.g. 429 rate limit), skip this chunk
        // and try the next one immediately
        if (!url) continue;

        const audio = new Audio(url);
        currentAudioRef.current = audio;

        // Release the chain lock before awaiting play so that if audio
        // ends synchronously (tiny clip) we don't deadlock
        chainActiveRef.current = false;

        await new Promise<void>((resolve) => {
          audio.onended = () => {
            currentAudioRef.current = null;
            resolve();
          };
          audio.onerror = () => {
            console.warn("[TTS] Audio playback error:", url);
            currentAudioRef.current = null;
            resolve();
          };
          audio.play().catch(() => {
            // Autoplay blocked or decode error — resolve so we move on
            currentAudioRef.current = null;
            resolve();
          });
        });

        // Re-acquire lock for the next iteration
        if (chainActiveRef.current) {
          // Another chain started while audio was playing — let it continue
          return;
        }
        chainActiveRef.current = true;
      }
    } finally {
      chainActiveRef.current = false;
    }
  }, []);

  /** Prefetch + queue a text chunk for speaking with Sonia. */
  const enqueueChunk = useCallback(
    (text: string) => {
      const clean = stripForSpeech(text);
      if (clean.length < 5) return;

      // Start the network fetch immediately so it's ready when its turn comes
      const item: QueueItem = {
        urlPromise: fetchTTSUrl(clean),
        cancelled: false,
      };
      queueRef.current.push(item);

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
    // Cancel all queued items so speakNext() skips them
    queueRef.current.forEach((item) => (item.cancelled = true));
    queueRef.current = [];

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }

    playingRef.current = false;
    setPlayingMessageId(null);
    playingMsgIdRef.current = null;
  }, []);

  // ── Public: read a specific message aloud ─────────────────────────────
  const readAloud = useCallback(
    (text: string, messageId: number) => {
      // Toggle off if already playing this message
      if (playingMsgIdRef.current === messageId) {
        stopPlayback();
        return;
      }
      stopPlayback();
      setPlayingMessageId(messageId);
      playingMsgIdRef.current = messageId;

      const clean = stripForSpeech(text);
      if (clean.length < 5) return;

      // Short text — send as one request
      if (clean.length <= 300) {
        enqueueChunk(clean);
        return;
      }

      // Long text — split at sentence boundaries and prefetch all chunks
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
