"""
Dignity Filter — Context-aware post-processing of GPT responses.

Removes condescending phrasing without naive word replacement.
Only detects dignity violations in condescending contexts.

Applied AFTER GPT generates a response, BEFORE streaming to user.

Does NOT modify:
  - Equations / LaTeX
  - Code blocks
  - IMAGE / VIDEO tags
"""

from __future__ import annotations

import re
from typing import List, Tuple


class DignityFilter:
    """
    Post-process GPT responses to remove dignity-violating phrasing.
    Context-aware, not naive word replacement.
    """

    # Only match problematic PATTERNS (context-aware)
    # Note: These patterns are applied via _filter_prose(), not iterated directly.
    PATTERNS: List[Tuple[re.Pattern, str]] = [
        # Sentence-start condescension: "Simply, ..." / "Obviously, ..." / "Clearly, ..."
        (re.compile(r"(?i)^\s*(simply|obviously|clearly),?\s+", re.MULTILINE), ""),

        # Minimizing language: "it's just/simply/easy/basic"
        (re.compile(r"(?i)\bit'?s (just|simply|easy|basic)\b"),
         "Let's look at this carefully"),

        # Corrective "Actually," at sentence start (condescending tone)
        (re.compile(r"(?i)(?:^|\.\s+)actually,\s*", re.MULTILINE), ""),

        # Direct shaming
        (re.compile(r"(?i)\b(that'?s wrong|you'?re wrong|incorrect)\b"),
         "Let's test that idea together"),

        # "As you should know" / "as you already know"
        (re.compile(r"(?i)\bas you (should|already|must) know\b"),
         "as a reminder"),

        # "This is trivial" / "trivially" — just remove it
        (re.compile(r"(?i)\btrivial(ly)?\b"), ""),
    ]

    # Compiled final pattern for "trivial/trivially" — cleaner replacement
    _TRIVIAL_RE = re.compile(r"(?i)\btrivial(ly)?\b")

    def filter_response(self, text: str) -> str:
        """
        Apply all dignity filters to a response string.
        Returns cleaned text.
        """
        # Skip code blocks and LaTeX — we only filter prose
        # Strategy: split on code/latex fences, filter only prose segments
        segments = _split_protected(text)
        result_parts = []

        for is_protected, segment in segments:
            if is_protected:
                result_parts.append(segment)
            else:
                result_parts.append(self._filter_prose(segment))

        return "".join(result_parts)

    def _filter_prose(self, text: str) -> str:
        """Apply pattern replacements to a prose segment."""
        # Sentence-start condescension
        text = re.sub(
            r"(?i)(?:^|\n)\s*(simply|obviously|clearly),?\s+",
            lambda m: m.group(0)[:m.start(1) - m.start()] if m.start(1) > m.start() else "",
            text,
        )
        # Simpler approach — just strip the words at sentence boundaries
        text = re.sub(r"(?im)^\s*(simply|obviously|clearly),?\s+", "", text)
        text = re.sub(r"(?i)(?<=\.\s)(simply|obviously|clearly),?\s+", "", text)

        # Minimizing language
        text = re.sub(
            r"(?i)\bit'?s (just|simply|easy|basic)\b",
            "let's look at this carefully",
            text,
        )

        # Corrective "Actually,"
        text = re.sub(r"(?im)^\s*actually,\s*", "", text)
        text = re.sub(r"(?i)(?<=\.\s)actually,\s*", "", text)

        # Direct shaming
        text = re.sub(
            r"(?i)\b(that'?s wrong|you'?re wrong|incorrect)\b",
            "let's test that idea together",
            text,
        )

        # "As you should/already/must know"
        text = re.sub(
            r"(?i)\bas you (should|already|must) know\b",
            "as a reminder",
            text,
        )

        # Trivial/trivially
        text = self._TRIVIAL_RE.sub("", text)

        # Clean up double spaces from removals
        text = re.sub(r"  +", " ", text)
        # Clean up empty lines from removals
        text = re.sub(r"\n\s*\n\s*\n", "\n\n", text)

        return text


# ── Protected region splitter ────────────────────────────────────────────

# Matches: ```...```, $$...$$, $...$, [IMAGE: ...], [VIDEO: ...]
_PROTECTED_RE = re.compile(
    r"(```[\s\S]*?```"           # fenced code blocks
    r"|\$\$[\s\S]*?\$\$"        # display math
    r"|\$[^\$\n]+?\$"           # inline math
    r"|\[IMAGE:[^\]]*\]"        # image tags
    r"|\[VIDEO:[^\]]*\]"        # video tags
    r")",
    re.DOTALL,
)


def _split_protected(text: str) -> list[tuple[bool, str]]:
    """
    Split text into (is_protected, segment) tuples.
    Protected segments (code, math, media tags) are never filtered.
    """
    result = []
    last_end = 0

    for match in _PROTECTED_RE.finditer(text):
        # Prose before this protected region
        if match.start() > last_end:
            result.append((False, text[last_end:match.start()]))
        # Protected region
        result.append((True, match.group(0)))
        last_end = match.end()

    # Remaining prose
    if last_end < len(text):
        result.append((False, text[last_end:]))

    return result


# Module-level singleton
dignity_filter = DignityFilter()


# ── Streaming Dignity Filter ─────────────────────────────────────────────

class StreamingDignityFilter:
    """
    Sentence-buffered dignity filter for streaming responses.

    During GPT streaming, characters are fed one at a time.
    This class buffers them until a sentence boundary is detected,
    filters the sentence, and returns cleaned text ready to yield.

    Protected regions (code blocks, LaTeX) are passed through unfiltered.
    """

    # Sentence-ending patterns: period/exclamation/question followed by
    # whitespace or newline (or at buffer length threshold)
    _SENTENCE_END_RE = re.compile(r'[.!?]\s')

    def __init__(self):
        self._buffer: str = ""
        self._code_fence_count: int = 0  # odd = inside code block
        self._in_display_math: bool = False
        self._raw_text: str = ""  # accumulates unfiltered text for scoring

    @property
    def in_protected(self) -> bool:
        """True if currently inside a code block or display math."""
        return (self._code_fence_count % 2 == 1) or self._in_display_math

    @property
    def raw_text(self) -> str:
        """Full accumulated raw (unfiltered) text for dignity scoring."""
        return self._raw_text

    def feed(self, text: str) -> str:
        """
        Feed streaming text (1+ chars). Returns filtered text to yield.

        May return empty string if still buffering. Characters are held
        until a sentence boundary is detected, then filtered and returned.
        Inside code blocks / display math, text passes through immediately.
        """
        self._raw_text += text
        self._buffer += text
        output = ""

        # Track code fences
        while "```" in self._buffer:
            idx = self._buffer.index("```")
            before = self._buffer[:idx]

            if not self.in_protected and before:
                # Filter prose before the fence
                output += dignity_filter._filter_prose(before)
            else:
                output += before

            output += "```"
            self._code_fence_count += 1
            self._buffer = self._buffer[idx + 3:]

        # Track display math ($$)
        while "$$" in self._buffer:
            idx = self._buffer.index("$$")
            before = self._buffer[:idx]

            if not self.in_protected and before:
                output += dignity_filter._filter_prose(before)
            else:
                output += before

            output += "$$"
            self._in_display_math = not self._in_display_math
            self._buffer = self._buffer[idx + 2:]

        # If inside protected region, flush buffer as-is
        if self.in_protected:
            output += self._buffer
            self._buffer = ""
            return output

        # Check for sentence boundaries in buffer
        while True:
            match = self._SENTENCE_END_RE.search(self._buffer)
            if not match:
                break

            # Extract sentence up to and including the boundary
            end = match.end()
            sentence = self._buffer[:end]
            self._buffer = self._buffer[end:]

            # Filter the sentence
            output += dignity_filter._filter_prose(sentence)

        # If buffer is getting large (>200 chars without sentence boundary),
        # flush it (could be a long list, equation description, etc.)
        if len(self._buffer) > 200:
            output += dignity_filter._filter_prose(self._buffer)
            self._buffer = ""

        return output

    def flush(self) -> str:
        """Flush remaining buffer at end of stream. Returns filtered text."""
        if not self._buffer:
            return ""
        result = dignity_filter._filter_prose(self._buffer) if not self.in_protected else self._buffer
        self._buffer = ""
        return result
