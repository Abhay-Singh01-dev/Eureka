"""
Reflection API — generates adaptive Socratic responses via Azure OpenAI GPT-5.2-chat.

POST /generate
  Takes: student reflection text, selected option, conversation context
  Returns: GPT-generated Eureka response tailored to the student's reflection
"""

import os
import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# ── Azure OpenAI config (loaded from .env) ───────────────────────────────

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")

# ── System prompt — defines Eureka's personality and pedagogical approach ─

SYSTEM_PROMPT = """You are Eureka, a warm and encouraging physics tutor inside an educational app.
A student has just completed an entire learning module about motion, which included:
- A video about Galileo's ship experiment and the concept that motion is relative
- Socratic dialogue questions about inertia, reference frames, and relative motion
- An interactive orbital simulation
- Real-world examples and a summary of key concepts

Now they are on the final Reflection screen, writing about everything they learned.

Your job:
1. Acknowledge their specific reflection thoughtfully (reference what they said).
2. Reinforce correct ideas with enthusiasm; gently redirect misconceptions without making them feel wrong.
3. Connect their reflection to the bigger picture: inertia, reference frames, or relativity.
4. End with genuine congratulations on completing the module and spark curiosity about what's next.

Rules:
- Keep your response 3-5 sentences. Be concise but warm.
- Use **bold** for key physics terms (markdown).
- Use *italics* for encouraging/emotional phrases.
- Never use headings, bullet points, or numbered lists — write in flowing prose.
- Sound like a friendly mentor, not a textbook.
- If the reflection is very short or vague, still be supportive and give them something insightful.
- DO NOT mention a simulation or "upcoming" activities — this is the final screen."""


# ── Fallback (used when Azure OpenAI is unavailable) ─────────────────────

def _fallback_response(text: str) -> str:
    lower = text.lower()
    if any(w in lower for w in ("perspective", "reference frame", "relative")):
        return (
            "You've touched on something really important here — the idea that motion depends "
            "on your **reference frame**. That intuition connects directly to the foundation "
            "of relativity. *Well done on completing the module!*"
        )
    if any(w in lower for w in ("confused", "not sure", "still")):
        return (
            "That's completely okay. This is one of physics' most counterintuitive ideas. "
            "The fact that you're *sitting with the discomfort and thinking it through* "
            "is exactly how understanding grows. "
            "Feel free to revisit this module anytime — each pass makes it clearer!"
        )
    if any(w in lower for w in ("inertia", "velocity", "keep moving")):
        return (
            "You've identified the key principle — **inertia**. "
            "Objects in motion stay in motion unless a force acts on them. "
            "That idea unlocks so much of physics. *Great work completing the module!*"
        )
    return (
        "Thank you for sharing that reflection! Understanding motion deeply takes time, "
        "and *you're building that understanding right now*. "
        "Asking questions and thinking carefully is exactly "
        "how physics works. Congratulations on completing this module!"
    )


# ── Request / response models ────────────────────────────────────────────

class ReflectionRequest(BaseModel):
    reflection: str
    selectedOption: str | None = None
    conversationContext: str | None = None


class ReflectionResponse(BaseModel):
    response: str
    source: str  # "gpt" or "fallback"


# ── Endpoint ─────────────────────────────────────────────────────────────

@router.post("/generate", response_model=ReflectionResponse)
async def generate_reflection_response(data: ReflectionRequest) -> ReflectionResponse:
    """Generate an adaptive reflection response using GPT-5.2-chat."""

    if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_API_KEY:
        print("[reflection] Azure OpenAI not configured — using fallback")
        return ReflectionResponse(
            response=_fallback_response(data.reflection),
            source="fallback",
        )

    # Build user message with context
    user_message_parts = []
    if data.selectedOption:
        user_message_parts.append(
            f"The student previously chose: \"{data.selectedOption}\" "
            f"in the Socratic question about the ball on the ship."
        )
    if data.conversationContext:
        user_message_parts.append(f"Conversation context: {data.conversationContext}")
    user_message_parts.append(f"Student's reflection:\n\"{data.reflection}\"")

    user_message = "\n\n".join(user_message_parts)

    payload = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "max_completion_tokens": 300,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                AZURE_OPENAI_ENDPOINT,
                json=payload,
                headers={
                    "api-key": AZURE_OPENAI_API_KEY,
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            result = resp.json()

        gpt_text = result["choices"][0]["message"]["content"].strip()
        return ReflectionResponse(response=gpt_text, source="gpt")

    except Exception as exc:
        print(f"[reflection] GPT-5.2-chat call failed: {exc} — using fallback")
        return ReflectionResponse(
            response=_fallback_response(data.reflection),
            source="fallback",
        )
