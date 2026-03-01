/**
 * StreamingMessageBubble — renders a message with:
 *   - Progressive markdown rendering (bold, italic, inline code)
 *   - LaTeX math rendering via remark-math + rehype-katex
 *   - Inline images at their insertion points (+ loading shimmer)
 *   - Blinking cursor while streaming
 *   - Smooth character-by-character feel
 *   - completeMarkdown() prevents raw syntax flashing during streaming
 *   - normalizeLatex() converts \( \) \[ \] to $ $$ for KaTeX
 */

import React, { useMemo, type FC } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { StreamingMessage } from "@/hooks/useStreamingChat";

interface StreamingMessageBubbleProps {
  message: StreamingMessage;
}

/* ─── normalizeLatex ────────────────────────────────────────────────
 * Convert alternative LaTeX delimiters to $ / $$ so remark-math can
 * parse them uniformly. Safe to call on any text.
 * ------------------------------------------------------------------- */
function normalizeLatex(text: string): string {
  // Convert \( ... \) to $ ... $  (inline math)
  text = text.replace(/\\\(/g, "$").replace(/\\\)/g, "$");
  // Convert \[ ... \] to $$ ... $$  (display math)
  text = text.replace(/\\\[/g, "$$").replace(/\\\]/g, "$$");
  return text;
}

/* ─── completeMarkdown ─────────────────────────────────────────────────
 * Strips incomplete/partial math at the TRAILING EDGE of the stream only.
 * Complete math blocks are left untouched so KaTeX renders them immediately.
 *
 * Strategy (mirrors Claude / ChatGPT behaviour):
 *   - $$ block fully closed   → KaTeX renders it now
 *   - $$ block still open     → strip from its opening $$ onward so KaTeX
 *                               never sees the partial expression → no jiggle
 *   - $ inline fully closed   → KaTeX renders it now
 *   - $ inline still open     → strip from its opening $ onward → no jiggle
 *
 * Complete equations appear as rendered math the instant their closing
 * delimiter arrives. Partial expressions are invisible (plain text) until
 * then. Zero layout thrash — KaTeX only ever receives valid expressions.
 *
 * Also closes unclosed bold / italic / code markers.
 * Only called while streaming — complete messages are already valid.
 * ------------------------------------------------------------------- */
function completeMarkdown(text: string): string {
  let result = text;

  // ── 1. Seal incomplete display math ($$..$$ unclosed at tail) ────────
  // Split by $$. Parts at even indices are outside math, odd = inside.
  // If we have an even number of parts, the last $$ is unclosed → strip it.
  const ddParts = result.split("$$");
  if (ddParts.length % 2 === 0) {
    result = ddParts.slice(0, -1).join("$$");
  }

  // ── 2. Seal incomplete inline math ($...$ unclosed at tail) ──────────
  // After step 1, all $$ blocks are closed. Find any lone dangling $.
  // Walk backwards to find the last standalone $ (not part of $$).
  const inlineParts = result
    .split("$$")
    .filter((_, i) => i % 2 === 0)
    .join("\x00")
    .split("$");
  if (inlineParts.length % 2 === 0) {
    // Odd number of lone $ markers → last one is unclosed → strip from it
    let lastLone = -1;
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i] === "$") {
        if (result[i - 1] !== "$" && result[i + 1] !== "$") {
          lastLone = i;
          break;
        }
      }
    }
    if (lastLone !== -1) result = result.slice(0, lastLone);
  }

  // ── 3. Close unclosed markdown markers ───────────────────────────────
  // Strip COMPLETE math blocks before counting * and ` to avoid false
  // positives from asterisks / backticks inside equations.
  const withoutMath = result
    .replace(/\$\$[\s\S]*?\$\$/g, "")
    .replace(/\$[^\$\n]*?\$/g, "");

  const boldCount = (withoutMath.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) result += "**";

  const afterBold = withoutMath.replace(/\*\*/g, "");
  const italicCount = (afterBold.match(/\*/g) || []).length;
  if (italicCount % 2 !== 0) result += "*";

  const tickCount = (withoutMath.match(/`/g) || []).length;
  if (tickCount % 2 !== 0) result += "`";

  const lastNewline = result.lastIndexOf("\n");
  const lastLine = lastNewline >= 0 ? result.slice(lastNewline + 1) : result;
  if (/^#{1,6}$/.test(lastLine)) result += " ";

  return result;
}

const StreamingMessageBubble: FC<StreamingMessageBubbleProps> = ({
  message,
}) => {
  const { content, images, isStreaming, role } = message;

  // Build content segments with inline images.
  // Strip any [IMAGE: ...] tags that leaked through as raw text (safety net).
  const segments = useMemo(() => {
    // Strip complete IMAGE and VIDEO tags
    let cleanContent = content
      .replace(/\[IMAGE:[^\]]*\]/gi, "")
      .replace(/\[VIDEO:[^\]]*\]/gi, "")
      .trimStart();

    // During streaming also strip *partial* IMAGE/VIDEO tags at the end
    if (isStreaming) {
      cleanContent = cleanContent.replace(
        /\[(?:I(?:M(?:A(?:G(?:E(?::?[^\]]*)?)?)?)?)?|V(?:I(?:D(?:E(?:O(?::?[^\]]*)?)?)?)?)?)?$/i,
        "",
      );
    }

    // Merge images and videos into a single sorted media array
    const allMedia: Array<
      | {
          kind: "image";
          base64: string;
          mime: string;
          description: string;
          insertAfterChar: number;
          loading?: boolean;
        }
      | {
          kind: "video";
          base64: string;
          mime: string;
          description: string;
          insertAfterChar: number;
          loading?: boolean;
        }
    > = [
      ...images.map((img) => ({ kind: "image" as const, ...img })),
      ...(message.videos || []).map((vid) => ({
        kind: "video" as const,
        ...vid,
      })),
    ].sort((a, b) => a.insertAfterChar - b.insertAfterChar);

    if (allMedia.length === 0) {
      return [{ type: "text" as const, content: cleanContent }];
    }

    const result: Array<
      | { type: "text"; content: string }
      | { type: "image"; base64: string; mime: string; description: string }
      | { type: "image_loading"; description: string }
      | { type: "video"; base64: string; mime: string; description: string }
      | { type: "video_loading"; description: string }
    > = [];

    let lastIdx = 0;
    for (const media of allMedia) {
      const idx = Math.min(media.insertAfterChar, cleanContent.length);
      if (idx > lastIdx) {
        result.push({
          type: "text",
          content: cleanContent.slice(lastIdx, idx),
        });
      }
      if (media.loading) {
        result.push({
          type: media.kind === "video" ? "video_loading" : "image_loading",
          description: media.description,
        });
      } else if (media.kind === "video") {
        result.push({
          type: "video",
          base64: media.base64,
          mime: media.mime,
          description: media.description,
        });
      } else {
        result.push({
          type: "image",
          base64: media.base64,
          mime: media.mime,
          description: media.description,
        });
      }
      lastIdx = idx;
    }

    if (lastIdx < cleanContent.length) {
      result.push({ type: "text", content: cleanContent.slice(lastIdx) });
    }

    return result;
  }, [content, images, message.videos, isStreaming]);

  if (role === "user") {
    return (
      <div className="max-w-[80%] p-4 rounded-lg bg-blue-600 text-white rounded-br-sm">
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[85%] text-gray-800 dark:text-gray-200">
      <div className="streaming-content prose prose-sm dark:prose-invert max-w-none">
        {segments.map((seg, i) => {
          /* ── Loading shimmer (ChatGPT-style) ── */
          if (seg.type === "image_loading") {
            return (
              <div
                key={`img-loading-${i}`}
                className="my-3 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
              >
                <div className="relative w-full h-52 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 overflow-hidden">
                  {/* Animated shimmer sweep */}
                  <div className="absolute inset-0 image-shimmer" />

                  {/* Centre content */}
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="w-9 h-9 border-[3px] border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic px-6 text-center max-w-[260px] leading-relaxed">
                      Generating image…
                    </p>
                  </div>
                </div>
                {seg.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 italic truncate">
                    {seg.description}
                  </p>
                )}
              </div>
            );
          }

          /* ── Video loading shimmer ── */
          if (seg.type === "video_loading") {
            return (
              <div
                key={`vid-loading-${i}`}
                className="my-3 rounded-xl overflow-hidden border border-purple-200 dark:border-purple-700"
              >
                <div className="relative w-full h-52 flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 overflow-hidden">
                  {/* Animated shimmer sweep (purple tint) */}
                  <div className="absolute inset-0 video-shimmer" />

                  {/* Centre content */}
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="w-9 h-9 border-[3px] border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic px-6 text-center max-w-[260px] leading-relaxed">
                      Generating animation… this may take 30–60 seconds
                    </p>
                  </div>
                </div>
                {seg.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-purple-50 dark:bg-purple-900/20 italic truncate">
                    🎬 {seg.description}
                  </p>
                )}
              </div>
            );
          }

          /* ── Completed image ── */
          if (seg.type === "image") {
            return (
              <div
                key={`img-${i}`}
                className="my-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600"
              >
                <img
                  src={`data:${seg.mime};base64,${seg.base64}`}
                  alt={seg.description}
                  className="w-full max-h-80 object-contain bg-white"
                  loading="lazy"
                />
                {seg.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 italic">
                    {seg.description}
                  </p>
                )}
              </div>
            );
          }

          /* ── Completed video ── */
          if (seg.type === "video") {
            return (
              <div
                key={`vid-${i}`}
                className="my-3 rounded-lg overflow-hidden border border-purple-200 dark:border-purple-600"
              >
                <video
                  src={`data:${seg.mime};base64,${seg.base64}`}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full max-h-80 bg-black rounded-t-lg"
                />
                {seg.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-purple-50 dark:bg-purple-900/20 italic">
                    🎬 {seg.description}
                  </p>
                )}
              </div>
            );
          }

          // Text segment with markdown
          return (
            <React.Fragment key={`txt-${i}`}>
              <MarkdownRenderer
                content={seg.content}
                isLast={i === segments.length - 1 && isStreaming}
                isStreaming={isStreaming}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Stable module-level plugin refs so ReactMarkdown never sees a new
 * array reference between renders — prevents KaTeX from re-running the full
 * AST parse on every streamed character.
 *
 * KaTeX is ALWAYS enabled. Jiggling is prevented by completeMarkdown()
 * stripping incomplete/partial math at the stream tail so KaTeX never
 * receives a partial expression. Complete math renders immediately.
 */
const _REMARK_PLUGINS = [remarkGfm, remarkMath];
const _REHYPE_MATH = [
  [rehypeKatex, { strict: false, throwOnError: false }],
] as any;

/**
 * MarkdownRenderer — renders markdown text with LaTeX math support
 * and a blinking cursor at the end when actively streaming.
 *
 * Key design:
 *   - KaTeX is ALWAYS enabled (never switched off during streaming)
 *   - Jiggling prevented by completeMarkdown() which strips incomplete
 *     trailing math so KaTeX only ever sees well-formed expressions
 *   - Complete equations render the instant their closing delimiter arrives
 *   - Plugin arrays are module-level constants (stable references)
 *   - components are memoized so React-markdown doesn’t reconcile
 *     the full output tree on every token
 */
const MarkdownRenderer: FC<{
  content: string;
  isLast: boolean;
  isStreaming: boolean;
}> = ({ content, isLast, isStreaming }) => {
  // Memoize components — only changes when the cursor state changes
  // (i.e., when streaming ends), not on every token.
  const mdComponents = useMemo(
    () => ({
      p: ({ children }: React.HTMLAttributes<HTMLParagraphElement>) => (
        <p className="mb-2 last:mb-0 leading-relaxed">
          {children}
          {isLast && <span className="streaming-cursor" />}
        </p>
      ),
      strong: ({ children }: React.HTMLAttributes<HTMLElement>) => (
        <strong className="font-semibold text-gray-900 dark:text-white">
          {children}
        </strong>
      ),
      em: ({ children }: React.HTMLAttributes<HTMLElement>) => (
        <em className="italic text-blue-700 dark:text-blue-300">{children}</em>
      ),
      pre: ({ children }: React.HTMLAttributes<HTMLPreElement>) => (
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-3 text-sm">
          {children}
        </pre>
      ),
      code: ({ children, className }: React.HTMLAttributes<HTMLElement>) => {
        const isBlock = (className as string)?.startsWith("language-");
        if (isBlock) {
          return (
            <code className={`font-mono text-sm ${className || ""}`}>
              {children}
            </code>
          );
        }
        return (
          <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
            {children}
          </code>
        );
      },
      h1: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h1 className="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-white">
          {children}
        </h1>
      ),
      h2: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h2 className="text-lg font-bold mt-3 mb-1.5 text-gray-900 dark:text-white">
          {children}
        </h2>
      ),
      h3: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h3 className="text-base font-semibold mt-2 mb-1 text-gray-900 dark:text-white">
          {children}
        </h3>
      ),
      ul: ({ children }: React.HTMLAttributes<HTMLUListElement>) => (
        <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>
      ),
      ol: ({ children }: React.HTMLAttributes<HTMLOListElement>) => (
        <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>
      ),
      li: ({ children }: React.HTMLAttributes<HTMLLIElement>) => (
        <li className="leading-relaxed">{children}</li>
      ),
      a: ({
        href,
        children,
      }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a
          href={href}
          className="text-blue-600 dark:text-blue-400 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      ),
      table: ({ children }: React.HTMLAttributes<HTMLTableElement>) => (
        <div className="overflow-x-auto my-3">
          <table className="min-w-full border-collapse text-sm">
            {children}
          </table>
        </div>
      ),
      thead: ({ children }: React.HTMLAttributes<HTMLTableSectionElement>) => (
        <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>
      ),
      tbody: ({ children }: React.HTMLAttributes<HTMLTableSectionElement>) => (
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {children}
        </tbody>
      ),
      tr: ({ children }: React.HTMLAttributes<HTMLTableRowElement>) => (
        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
          {children}
        </tr>
      ),
      th: ({ children }: React.HTMLAttributes<HTMLTableCellElement>) => (
        <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
          {children}
        </th>
      ),
      td: ({ children }: React.HTMLAttributes<HTMLTableCellElement>) => (
        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
          {children}
        </td>
      ),
    }),
    [isLast],
  );

  if (!content) {
    return isLast ? <span className="streaming-cursor" /> : null;
  }

  // Normalize LaTeX delimiters. While streaming, completeMarkdown() strips
  // incomplete trailing math so KaTeX only ever sees well-formed expressions.
  const normalizedContent = normalizeLatex(content);
  const displayContent = isLast
    ? completeMarkdown(normalizedContent)
    : normalizedContent;

  return (
    <div className="inline">
      <ReactMarkdown
        remarkPlugins={_REMARK_PLUGINS}
        rehypePlugins={_REHYPE_MATH}
        components={mdComponents}
      >
        {displayContent}
      </ReactMarkdown>
    </div>
  );
};

export default StreamingMessageBubble;
