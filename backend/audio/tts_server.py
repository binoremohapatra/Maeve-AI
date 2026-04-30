"""
 MAEVE TTS FLASK SERVER — v2.0
Unified Edge TTS server with full emotion coverage, correct pitch values,
per-emotion voice switching, and asyncio-safe generation.
"""

from flask import Flask, request, jsonify
import edge_tts
import asyncio
import base64
import os
import nest_asyncio

# nest_asyncio fixes asyncio.run() crashing inside Flask/gunicorn event loops
nest_asyncio.apply()

app = Flask(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# VOICE PROFILES
#
# TWO VOICES:
#   en-US-JennyNeural  — soft, warm, intimate  (lust, romance, sad, shy)
#   en-US-AriaNeural   — sharp, expressive      (angry, happy, evil, panic)
#
# PITCH RULES (Edge TTS uses Hz offset from baseline):
#   Crying/broken  → POSITIVE Hz  (voice cracks upward when sobbing)
#   Seductive/lust → NEGATIVE Hz  (deep, husky, breathless)
#   Cold anger     → NEGATIVE Hz  (icy, dangerous, villain-mode)
#   Hot rage       → POSITIVE Hz  (sharp, cracking, yelling)
#   Panic/fear     → HIGH POSITIVE Hz (shrieking, terrified)
#   Happy/joy      → POSITIVE Hz  (bright, bubbly)
#
# RATE = speed:  negative = slower,  positive = faster
# ══════════════════════════════════════════════════════════════════════════════

VOICE_PROFILES = {

    # ── Intimate / seductive ─────────────────────────────────────────────────
    "LUST":          {"voice": "en-US-JennyNeural", "rate": "-28%", "pitch": "-8Hz"},
    "SEXUAL_DESIRE": {"voice": "en-US-JennyNeural", "rate": "-28%", "pitch": "-8Hz"},
    "CRAVING":       {"voice": "en-US-JennyNeural", "rate": "-26%", "pitch": "-7Hz"},
    "SEXY":          {"voice": "en-US-JennyNeural", "rate": "-24%", "pitch": "-7Hz"},
    "SOFT":          {"voice": "en-US-JennyNeural", "rate": "-22%", "pitch": "-4Hz"},
    "ROMANCE":       {"voice": "en-US-JennyNeural", "rate": "-20%", "pitch": "-5Hz"},
    "LOVE":          {"voice": "en-US-JennyNeural", "rate": "-18%", "pitch": "-4Hz"},
    "ADORATION":     {"voice": "en-US-JennyNeural", "rate": "-16%", "pitch": "-3Hz"},

    # ── Happy / bright ───────────────────────────────────────────────────────
    "HAPPY":         {"voice": "en-US-AriaNeural",  "rate": "+10%", "pitch": "+6Hz"},
    "JOY":           {"voice": "en-US-AriaNeural",  "rate": "+12%", "pitch": "+7Hz"},
    "EXCITEMENT":    {"voice": "en-US-AriaNeural",  "rate": "+16%", "pitch": "+8Hz"},
    "AMUSEMENT":     {"voice": "en-US-AriaNeural",  "rate": "+10%", "pitch": "+5Hz"},
    "SATISFACTION":  {"voice": "en-US-AriaNeural",  "rate": "+0%",  "pitch": "+2Hz"},
    "TRIUMPH":       {"voice": "en-US-AriaNeural",  "rate": "+12%", "pitch": "+7Hz"},

    # ── Hot rage / shouting ──────────────────────────────────────────────────
    "ANGRY":         {"voice": "en-US-AriaNeural",  "rate": "+16%", "pitch": "+6Hz"},
    "ANGER":         {"voice": "en-US-AriaNeural",  "rate": "+16%", "pitch": "+6Hz"},
    "FRUSTRATION":   {"voice": "en-US-AriaNeural",  "rate": "+12%", "pitch": "+4Hz"},
    "RAGE":          {"voice": "en-US-AriaNeural",  "rate": "+22%", "pitch": "+8Hz"},

    # ── Cold anger / villain ─────────────────────────────────────────────────
    "EVIL":          {"voice": "en-US-AriaNeural",  "rate": "-14%", "pitch": "-9Hz"},
    "DISGUST":       {"voice": "en-US-AriaNeural",  "rate": "-4%",  "pitch": "-5Hz"},
    "JEALOUSY":      {"voice": "en-US-AriaNeural",  "rate": "-2%",  "pitch": "-6Hz"},

    # ── Broken / crying ──────────────────────────────────────────────────────
    # NOTE: pitch is POSITIVE — voices crack upward when crying, not downward
    "SAD":           {"voice": "en-US-JennyNeural", "rate": "-22%", "pitch": "+4Hz"},
    "SADNESS":       {"voice": "en-US-JennyNeural", "rate": "-26%", "pitch": "+5Hz"},
    "HURT":          {"voice": "en-US-JennyNeural", "rate": "-20%", "pitch": "+4Hz"},
    "DESPAIR":       {"voice": "en-US-JennyNeural", "rate": "-30%", "pitch": "+6Hz"},
    "GUILT":         {"voice": "en-US-JennyNeural", "rate": "-18%", "pitch": "+3Hz"},

    # ── Panic / terror ───────────────────────────────────────────────────────
    "FEAR":          {"voice": "en-US-AriaNeural",  "rate": "+20%", "pitch": "+8Hz"},
    "ANXIETY":       {"voice": "en-US-AriaNeural",  "rate": "+14%", "pitch": "+5Hz"},
    "PANIC":         {"voice": "en-US-AriaNeural",  "rate": "+26%", "pitch": "+10Hz"},
    "SHAME":         {"voice": "en-US-JennyNeural", "rate": "-16%", "pitch": "+3Hz"},

    # ── Curious / focused ────────────────────────────────────────────────────
    "CURIOSITY":     {"voice": "en-US-JennyNeural", "rate": "-6%",  "pitch": "+3Hz"},
    "FOCUS":         {"voice": "en-US-JennyNeural", "rate": "-8%",  "pitch": "-1Hz"},
    "INTEREST":      {"voice": "en-US-JennyNeural", "rate": "-4%",  "pitch": "+3Hz"},

    # ── Pride / calm ─────────────────────────────────────────────────────────
    "PRIDE":         {"voice": "en-US-AriaNeural",  "rate": "-4%",  "pitch": "-3Hz"},
    "CALMNESS":      {"voice": "en-US-JennyNeural", "rate": "-12%", "pitch": "-2Hz"},

    # ── Default ──────────────────────────────────────────────────────────────
    "NEUTRAL":       {"voice": "en-US-JennyNeural", "rate": "-10%", "pitch": "-2Hz"},
}

# ══════════════════════════════════════════════════════════════════════════════
# ASYNC-SAFE TTS HELPER
# asyncio.run() crashes in gunicorn. nest_asyncio patches this,
# but we also keep a manual loop fallback just in case.
# ══════════════════════════════════════════════════════════════════════════════

async def _generate_edge_tts(text: str, voice: str, rate: str, pitch: str) -> bytes:
    """Run Edge TTS and return raw MP3 bytes (no temp file)."""
    audio_chunks = []
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])
    return b"".join(audio_chunks)


def run_tts_sync(text: str, voice: str, rate: str, pitch: str) -> bytes:
    """Asyncio-safe wrapper — works in Flask, gunicorn, and uvicorn."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Already inside a loop (gunicorn async workers)
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(
                    asyncio.run,
                    _generate_edge_tts(text, voice, rate, pitch)
                )
                return future.result(timeout=15)
        else:
            return loop.run_until_complete(
                _generate_edge_tts(text, voice, rate, pitch)
            )
    except Exception:
        # Hard fallback — fresh event loop
        return asyncio.run(_generate_edge_tts(text, voice, rate, pitch))


# ══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "emotions_supported": len(VOICE_PROFILES)})


@app.route("/generate", methods=["POST"])
def generate_audio():
    try:
        data    = request.get_json(force=True, silent=True) or {}
        text    = data.get("text", "").strip()
        emotion = data.get("emotion") or data.get("style") or "NEUTRAL"

        if not text:
            return jsonify({"error": "No text provided"}), 400

        # Normalise emotion key
        emotion = emotion.upper().strip()
        settings = VOICE_PROFILES.get(emotion, VOICE_PROFILES["NEUTRAL"])

        print(
            f"🎤 TTS | emotion={emotion} "
            f"voice={settings['voice'].split('-')[2]} "
            f"rate={settings['rate']} pitch={settings['pitch']} "
            f"| '{text[:40]}...'"
        )

        # Generate
        audio_bytes  = run_tts_sync(text, settings["voice"], settings["rate"], settings["pitch"])
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

        # Rough duration estimate (Edge TTS returns MP3, no easy frame count)
        rate_val     = int(settings["rate"].replace("%", "").replace("+", ""))
        chars_per_sec = 14.0 * (1.0 + rate_val / 100.0)
        duration     = len(text) / max(chars_per_sec, 5.0)

        return jsonify({
            "status":       "success",
            "audio_base64": audio_base64,
            "emotion":      emotion,
            "duration":     round(duration, 2),
            "voice":        settings["voice"],
        })

    except Exception as e:
        print(f"TTS Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("Maeve TTS Server v2.0 — Port 5002")
    print(f"   Emotions loaded: {len(VOICE_PROFILES)}")
    app.run(host="0.0.0.0", port=5002, debug=False)