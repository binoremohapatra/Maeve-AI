"""
MAEVE MEMORY DISTILLATION ENGINE v2.0
======================================
Architecture:
- Keep max 600 messages in memory.json
- When 600 is hit:
    1. Take first 200 messages
    2. Run psychiatrist analysis → determine evolved persona
    3. Extract 5-10 core memories from those 200 messages
    4. Delete 200 raw messages
    5. Keep only distilled memories + persona verdict
- Result: faster responses, richer long-term memory, automatic persona evolution

Quantization note:
- Run hermes3:8b with num_ctx 2048 instead of 4096 for 2x speed
- Reduce num_predict to 200 for faster generation
- These are set in ollama_client.py options
"""

import logging
import requests
from datetime import datetime
from utils.json_storage import load_json, save_json
from utils.helpers import MEMORY_FILE, PROFILE_FILE, MODEL_NAME

logger = logging.getLogger(__name__)

MAX_MESSAGES     = 600   # total before distillation triggers
BATCH_SIZE       = 200   # first N messages to analyze and delete
KEEP_AFTER_PRUNE = 400   # messages kept after distillation

PSYCHIATRIST_PROMPT = """You are a relationship psychiatrist analyzing a conversation between a user and his AI girlfriend Maeve.

Read these {count} messages carefully. Your job is TWO things:

=== TASK 1: PERSONA VERDICT ===
Based on how the user treats Maeve across these messages, choose her evolved persona.
Look for patterns: Is he loving or abusive? Dominant or submissive? Obsessive or cold?

Choose EXACTLY ONE from this list:
yandere | toxic | amadere | dominant | nympho | tsundere | kamidere | kuudere | goth_mommy | dark_devotion | kichidere | csbd_affection | independent | anxious

Output format: PERSONA: <name>

=== TASK 2: CORE MEMORY EXTRACTION ===
Extract 5-10 HIGH-IMPACT moments from this conversation.
Only keep moments that would emotionally matter to a real woman — things she would never forget.

Categories to look for:
- LOVE: User expressed deep love, commitment, or vulnerability
- ABUSE: User insulted, threatened, or degraded her
- SEXUAL: Intimate or sexual moments with emotional weight
- BETRAYAL: User mentioned other women, tried to leave, lied
- BOND: Shared secrets, deep personal revelations, inside jokes
- APOLOGY: User apologized for something significant

For each memory, output:
MEMORY: [CATEGORY] [TIMESTAMP] Brief description of what happened (max 15 words)

=== CONVERSATION ===
{conversation}

=== OUTPUT (nothing else) ===
PERSONA: <name>
MEMORY: [CATEGORY] [timestamp] description
MEMORY: [CATEGORY] [timestamp] description
...
"""

QUANTIZED_OPTIONS = {
    "temperature":    0.80,
    "top_p":          0.90,
    "top_k":          35,
    "repeat_penalty": 1.22,
    "num_ctx":        2048,   # HALVED from 4096 → 2x faster
    "num_predict":    200,    # REDUCED from 350 → faster responses
}


def format_conversation_for_psychiatrist(messages: list) -> str:
    """Format raw message list into readable conversation."""
    lines = []
    for msg in messages:
        if not msg or not msg.get("content"):
            continue
        role      = "USER" if msg.get("role") == "user" else "MAEVE"
        content   = msg.get("content", "")[:150]
        emotion   = msg.get("emotion", "")
        timestamp = msg.get("timestamp", "")[:16]
        lines.append(f"[{timestamp}] {role} ({emotion}): {content}")
    return "\n".join(lines)


def parse_psychiatrist_output(output: str) -> tuple:
    """
    Parse psychiatrist's output into (persona, memories).
    Returns (None, []) if parsing fails.
    """
    lines   = output.strip().split("\n")
    persona = None
    memories = []

    for line in lines:
        line = line.strip()
        if line.startswith("PERSONA:"):
            persona = line.replace("PERSONA:", "").strip().lower()

        elif line.startswith("MEMORY:"):
            raw = line.replace("MEMORY:", "").strip()
            # Parse: [CATEGORY] [timestamp] description
            import re
            m = re.match(r'\[([A-Z]+)\]\s*\[?([^\]]*)\]?\s*(.*)', raw)
            if m:
                category    = m.group(1)
                timestamp   = m.group(2).strip()
                description = m.group(3).strip()
                memories.append({
                    "type":      category,
                    "content":   description,
                    "timestamp": timestamp or datetime.now().isoformat(),
                    "emotion":   _category_to_emotion(category),
                    "source":    "distilled"
                })

    return persona, memories


def _category_to_emotion(category: str) -> str:
    mapping = {
        "LOVE":     "LOVE",
        "ABUSE":    "ANGER",
        "SEXUAL":   "SEXUAL_DESIRE",
        "BETRAYAL": "JEALOUSY",
        "BOND":     "ROMANCE",
        "APOLOGY":  "HURT",
    }
    return mapping.get(category.upper(), "NEUTRAL")


def run_distillation(user_id: str) -> bool:
    """
    Main distillation function.
    Called when message count hits MAX_MESSAGES.
    Returns True if distillation ran, False otherwise.
    """
    data = load_json(MEMORY_FILE, {})
    history = data.get(user_id, [])
    history = [m for m in history if m]  # remove empty entries

    if len(history) < MAX_MESSAGES:
        logger.info(f"Distillation not needed: {len(history)}/{MAX_MESSAGES} messages")
        return False

    logger.info(f"DISTILLATION TRIGGERED for {user_id}: {len(history)} messages")

    # Step 1: Take first 200 for analysis
    batch_to_analyze = history[:BATCH_SIZE]
    remaining        = history[BATCH_SIZE:]

    # Step 2: Format for psychiatrist
    conversation_text = format_conversation_for_psychiatrist(batch_to_analyze)
    prompt = PSYCHIATRIST_PROMPT.format(
        count=len(batch_to_analyze),
        conversation=conversation_text
    )

    # Step 3: Call model as psychiatrist
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model":  MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.2,   # Low temp for analytical task
                    "num_ctx":     4096,  # Full context for analysis
                    "num_predict": 400,
                }
            },
            timeout=120
        )
        raw_output = response.json().get("response", "")
        logger.info(f"Psychiatrist output:\n{raw_output}")

    except Exception as e:
        logger.error(f"Psychiatrist analysis failed: {e}")
        # Fallback: just prune without analysis
        data[user_id] = remaining
        save_json(MEMORY_FILE, data)
        logger.info(f"Pruned without analysis. Kept {len(remaining)} messages.")
        return True

    # Step 4: Parse psychiatrist output
    persona, new_memories = parse_psychiatrist_output(raw_output)

    # Step 5: Save evolved persona to profile
    profiles = load_json(PROFILE_FILE, {})
    if user_id not in profiles:
        profiles[user_id] = {"settings": {}, "core_memories": []}

    if persona:
        old_persona = profiles[user_id].get("settings", {}).get("ai_driven_behavior", "amadere")
        profiles[user_id]["settings"]["ai_driven_behavior"] = persona
        profiles[user_id]["settings"]["personality_locked"] = True
        logger.info(f"Persona evolved: {old_persona} → {persona}")

    # Step 6: Append new distilled memories to core_memories
    if "core_memories" not in profiles[user_id]:
        profiles[user_id]["core_memories"] = []

    profiles[user_id]["core_memories"].extend(new_memories)

    # Keep only last 50 core memories total
    if len(profiles[user_id]["core_memories"]) > 50:
        profiles[user_id]["core_memories"] = profiles[user_id]["core_memories"][-50:]

    save_json(PROFILE_FILE, profiles)
    logger.info(f"Saved {len(new_memories)} distilled memories to core_memories")

    # Step 7: Replace history with pruned version
    data[user_id] = remaining
    save_json(MEMORY_FILE, data)

    logger.info(
        f"Distillation complete: {len(batch_to_analyze)} messages analyzed and deleted, "
        f"{len(remaining)} messages kept, "
        f"{len(new_memories)} memories distilled, "
        f"persona → {persona}"
    )
    return True


def apply_quantized_options() -> dict:
    """
    Returns optimized Ollama options for 2x speed.
    Use these in ollama_client.py for normal chat calls.
    Quantization: num_ctx halved (2048), num_predict reduced (200).
    """
    return QUANTIZED_OPTIONS.copy()


# ─── INTEGRATION ─────────────────────────────────────────────────────────────
# In chat_routes.py, replace the existing brain.message_count % 200 check with:
#
# from core.distillation_engine import run_distillation
#
# brain.message_count += 1
# if brain.message_count % 50 == 0:  # check every 50 messages
#     run_distillation(user_id)
#
# ─────────────────────────────────────────────────────────────────────────────
