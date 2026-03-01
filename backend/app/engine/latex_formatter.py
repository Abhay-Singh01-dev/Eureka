"""
LaTeX Delimiter Normalizer — ensures GPT output uses consistent
$ (inline) and $$ (display) delimiters for frontend KaTeX rendering.

Converts:
  \\( ... \\)  →  $ ... $
  \\[ ... \\]  →  $$ ... $$

These are the only transformations needed. The system prompt instructs
GPT to use $ / $$ directly, so this is a safety-net for edge cases.
"""

from __future__ import annotations

import re


def normalize_latex_delimiters(text: str) -> str:
    """
    Convert alternative LaTeX delimiters to $ / $$ for consistent
    rendering with remark-math + rehype-katex on the frontend.

    Safe to call on any text — non-LaTeX content is unaffected.
    """
    # Convert \( ... \) to $ ... $  (inline math)
    text = re.sub(r'\\\(', '$', text)
    text = re.sub(r'\\\)', '$', text)

    # Convert \[ ... \] to $$ ... $$  (display math)
    text = re.sub(r'\\\[', '$$', text)
    text = re.sub(r'\\\]', '$$', text)

    return text
