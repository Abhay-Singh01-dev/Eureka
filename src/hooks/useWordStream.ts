import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Streams `fullText` word-by-word at the given `wordsPerMinute` rate.
 *
 * - When `isActive` is false (return visitor), returns `fullText` immediately.
 * - When `isActive` is true (first visitor), streams tokens one at a time.
 * - Newline sequences are treated as standalone tokens so paragraph structure
 *   is preserved exactly — no squashing of line breaks into words.
 * - Calls `onComplete` once every token has been emitted.
 */
export function useWordStream(
  fullText: string,
  wordsPerMinute: number,
  isActive: boolean,
  onComplete: () => void,
): string {
  // For return visitors isActive is false from the start, so initialise to
  // the full text right away to avoid a one-frame flash of empty content.
  const [displayedText, setDisplayedText] = useState<string>(
    isActive ? "" : fullText,
  );

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a stable ref to onComplete so the interval closure never goes stale.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Return-visit path ─ show everything at once.
    if (!isActive) {
      setDisplayedText(fullText);
      return;
    }

    // Tokenize preserving newline sequences as their own tokens.
    // e.g. "Hello\n\nWorld" → ["Hello", "\n\n", "World"]
    const tokens = fullText
      .split(/(\n+)/)
      .flatMap((segment) =>
        /^\n+$/.test(segment) ? [segment] : segment.split(" ").filter(Boolean),
      );

    let index = 0;
    setDisplayedText(""); // Reset for a fresh stream.

    const msPerToken = (60 / wordsPerMinute) * 1000;

    intervalRef.current = setInterval(() => {
      const token = tokens[index];
      setDisplayedText((prev) => {
        // Newline token — append directly, no leading space.
        if (/^\n+$/.test(token)) return prev + token;
        return prev.length === 0 ? token : `${prev} ${token}`;
      });

      index += 1;

      if (index >= tokens.length) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        onCompleteRef.current();
      }
    }, msPerToken);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // fullText and wordsPerMinute are intentionally stable constants for this
    // node; we only re-run when isActive flips (first-visit detection resolves).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return displayedText;
}
