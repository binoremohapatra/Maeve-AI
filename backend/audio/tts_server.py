"""
 MAEVE TTS FLASK SERVER — v2.0
Unified TTS server with Kokoro ONNX primary engine and Edge TTS fallback.
Full emotion coverage, per-emotion voice switching, and multithreaded chunking.
"""

from flask import Flask, request, jsonify
import edge_tts
import asyncio
import base64
import os
import io
import re
import random
import logging
import numpy as np
import soundfile as sf
import concurrent.futures
import nest_asyncio

# nest_asyncio fixes asyncio.run() crashing inside Flask/gunicorn event loops
nest_asyncio.apply()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# KOKORO INIT
# ══════════════════════════════════════════════════════════════════════════════

KOKORO_AVAILABLE = False
kokoro = None

try:
    from kokoro_onnx import Kokoro
    MODEL_PATH  = os.path.join(BASE_DIR, "kokoro-v1.0.int8.onnx")
    VOICES_PATH = os.path.join(BASE_DIR, "voices-v1.0.bin")
    if os.path.exists(MODEL_PATH) and os.path.exists(VOICES_PATH):
        kokoro = Kokoro(MODEL_PATH, VOICES_PATH)
        KOKORO_AVAILABLE = True
        logger.info("Kokoro TTS Ready")
    else:
        logger.warning("Kokoro model files missing — using Edge TTS fallback")
except Exception as e:
    logger.error(f"Kokoro init error: {e}")




# PILLAR 1 — ROLEPLAY STRIPPER
# ══════════════════════════════════════════════════════════════════════════════

def strip_roleplay(text: str) -> str:
    text = re.sub(r'\*[^*]*\*', ' ', text)
    text = re.sub(r'\([^)]*\)', ' ', text)
    text = re.sub(r'[*~#_`\[\]{}|]', '', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'\s{2,}', ' ', text).strip()
    return text




# PILLAR 2 — PROSODY HACKER
# ══════════════════════════════════════════════════════════════════════════════

def hack_prosody(text: str) -> str:
    text = text.lower()
    text = re.sub(r',\s*', '... ', text)
    text = re.sub(r'\?\s*', '?.. ', text)
    text = re.sub(r'!\s*', '!.. ', text)
    text = re.sub(r'\s*[-—]\s*', '... ', text)
    text = re.sub(r'\.{4,}', '...', text)
    return text.strip()




# PILLAR 3 — EMOTION-TO-PARAMETER MATRIX
#
# Each entry: (voice, speed, pitch)
#
# SPEED  — controls pacing:
#   0.70  very slow / heavy / seductive
#   0.85  slow / tender / broken
#   0.95  slightly slow / thoughtful
#   1.00  neutral
#   1.08  slightly fast / agitated
#   1.15  fast / excited / angry
#   1.25  very fast / panicking
#
# PITCH  — controls vocal register (1.0 = neutral, Kokoro range ~0.5–1.5):
#   0.80  very deep / dangerous / threatening
#   0.88  deep / husky / sultry
#   0.94  slightly low / grounded / mature
#   1.00  neutral
#   1.06  slightly bright / warm
#   1.12  high / emotional / shaky
#   1.20  very high / crying / terrified
# ══════════════════════════════════════════════════════════════════════════════

EMOTION_MATRIX: dict[str, tuple[str, float]] = {
    # ══════════════════════════════════════════════════════════════════════════
    # FORMAT: (voice, speed)
    #
    # NOTE: Kokoro-onnx does NOT support a pitch parameter in create().
    # Pitch is handled exclusively by the Edge TTS fallback (EDGE_PROFILES).
    # For Kokoro, emotion is expressed through voice selection + speed only.
    #
    # SPEED GUIDE:
    #   0.70–0.78  very slow  (seductive, despairing, barely-speaking)
    #   0.79–0.87  slow       (sad, soft, tender, guilty)
    #   0.88–0.96  mild slow  (curious, calm, focused, cold anger)
    #   0.97–1.05  near-neutral / slight energy
    #   1.06–1.14  fast       (happy, angry, excited)
    #   1.15–1.30  very fast  (panic, rage, fear)
    # ══════════════════════════════════════════════════════════════════════════

    # ── Intimate / seductive ─────────────────────────────────────────────────
    "LUST":          ("af_nicole", 0.74),   # Breathy, drawn-out whisper
    "SEXUAL_DESIRE": ("af_nicole", 0.74),   # Alias for LUST
    "CRAVING":       ("af_nicole", 0.76),   # Desperate, breathless
    "SOFT":          ("af_bella",  0.78),   # Gentle murmur
    "ROMANCE":       ("af_nicole", 0.80),   # Warm, slow, close
    "ADORATION":     ("af_bella",  0.82),   # Sweet tenderness

    # ── Happy / bright ───────────────────────────────────────────────────────
    "HAPPY":         ("af_sky",    1.03),   # Cheerful, light
    "JOY":           ("af_sky",    1.06),   # Bright and soaring
    "EXCITEMENT":    ("af_sky",    1.12),   # Fast, bubbly
    "AMUSEMENT":     ("af_sky",    1.04),   # Playful lilt
    "SATISFACTION":  ("af_bella",  0.95),   # Calm, warm glow
    "TRIUMPH":       ("af_sky",    1.08),   # Victorious

    # ── Hot rage / shouting ──────────────────────────────────────────────────
    "ANGER":         ("af_sarah",  1.12),   # Sharp, raised voice
    "ANGRY":         ("af_sarah",  1.12),   # Alias
    "FRUSTRATION":   ("af_sarah",  1.08),   # Building pressure
    "RAGE":          ("af_sarah",  1.20),   # Full uncontrolled yelling

    # ── Cold anger / villain ─────────────────────────────────────────────────
    "DISGUST":       ("af_sarah",  0.94),   # Icy contempt
    "EVIL":          ("af_sarah",  0.86),   # Slow, deliberate threat
    "JEALOUSY":      ("af_sarah",  0.96),   # Cold, possessive

    # ── Broken / crying ──────────────────────────────────────────────────────
    "SAD":           ("af_bella",  0.82),   # Heavy, dragging
    "SADNESS":       ("af_bella",  0.80),   # Deeper grief
    "HURT":          ("af_bella",  0.83),   # Pained
    "DESPAIR":       ("af_bella",  0.76),   # Barely speaking
    "GUILT":         ("af_bella",  0.84),   # Ashamed, heavy

    # ── Panic / terror ───────────────────────────────────────────────────────
    "FEAR":          ("af_sarah",  1.18),   # Panicked, rapid
    "ANXIETY":       ("af_bella",  1.10),   # Nervous, rushed
    "PANIC":         ("af_sarah",  1.25),   # Hyperventilating
    "SHAME":         ("af_bella",  0.84),   # Shrinking, small

    # ── Curious / focused ────────────────────────────────────────────────────
    "CURIOSITY":     ("af_bella",  0.93),   # Inquisitive, measured
    "FOCUS":         ("af_bella",  0.91),   # Steady, grounded
    "INTEREST":      ("af_bella",  0.94),   # Engaged, leaning in

    # ── Pride / calm ─────────────────────────────────────────────────────────
    "PRIDE":         ("af_sarah",  0.96),   # Measured confidence
    "CALMNESS":      ("af_bella",  0.89),   # Still, grounded

    # ── Default ──────────────────────────────────────────────────────────────
    "NEUTRAL":       ("af_bella",  0.90),   # Clean baseline
}

# Edge TTS fallback profiles — full pitch coverage
EDGE_PROFILES: dict[str, dict] = {
    "LUST":          {"voice": "en-US-JennyNeural", "rate": "-28%", "pitch": "-8Hz"},
    "SEXUAL_DESIRE": {"voice": "en-US-JennyNeural", "rate": "-28%", "pitch": "-8Hz"},
    "CRAVING":       {"voice": "en-US-JennyNeural", "rate": "-26%", "pitch": "-7Hz"},
    "SOFT":          {"voice": "en-US-JennyNeural", "rate": "-24%", "pitch": "-4Hz"},
    "ROMANCE":       {"voice": "en-US-JennyNeural", "rate": "-22%", "pitch": "-5Hz"},
    "ADORATION":     {"voice": "en-US-JennyNeural", "rate": "-20%", "pitch": "-3Hz"},
    "HAPPY":         {"voice": "en-US-AriaNeural",  "rate": "+10%", "pitch": "+6Hz"},
    "JOY":           {"voice": "en-US-AriaNeural",  "rate": "+12%", "pitch": "+7Hz"},
    "EXCITEMENT":    {"voice": "en-US-AriaNeural",  "rate": "+16%", "pitch": "+8Hz"},
    "AMUSEMENT":     {"voice": "en-US-AriaNeural",  "rate": "+10%", "pitch": "+5Hz"},
    "SATISFACTION":  {"voice": "en-US-AriaNeural",  "rate": "+0%",  "pitch": "+2Hz"},
    "TRIUMPH":       {"voice": "en-US-AriaNeural",  "rate": "+12%", "pitch": "+7Hz"},
    "ANGER":         {"voice": "en-US-AriaNeural",  "rate": "+16%", "pitch": "+6Hz"},
    "ANGRY":         {"voice": "en-US-AriaNeural",  "rate": "+16%", "pitch": "+6Hz"},
    "FRUSTRATION":   {"voice": "en-US-AriaNeural",  "rate": "+12%", "pitch": "+4Hz"},
    "RAGE":          {"voice": "en-US-AriaNeural",  "rate": "+22%", "pitch": "+8Hz"},
    "DISGUST":       {"voice": "en-US-AriaNeural",  "rate": "-4%",  "pitch": "-5Hz"},
    "EVIL":          {"voice": "en-US-AriaNeural",  "rate": "-14%", "pitch": "-9Hz"},
    "JEALOUSY":      {"voice": "en-US-AriaNeural",  "rate": "-2%",  "pitch": "-6Hz"},
    "SAD":           {"voice": "en-US-JennyNeural", "rate": "-22%", "pitch": "+4Hz"},
    "SADNESS":       {"voice": "en-US-JennyNeural", "rate": "-28%", "pitch": "+5Hz"},
    "HURT":          {"voice": "en-US-JennyNeural", "rate": "-20%", "pitch": "+4Hz"},
    "DESPAIR":       {"voice": "en-US-JennyNeural", "rate": "-30%", "pitch": "+6Hz"},
    "GUILT":         {"voice": "en-US-JennyNeural", "rate": "-18%", "pitch": "+3Hz"},
    "FEAR":          {"voice": "en-US-AriaNeural",  "rate": "+20%", "pitch": "+8Hz"},
    "ANXIETY":       {"voice": "en-US-AriaNeural",  "rate": "+14%", "pitch": "+5Hz"},
    "PANIC":         {"voice": "en-US-AriaNeural",  "rate": "+26%", "pitch": "+10Hz"},
    "SHAME":         {"voice": "en-US-JennyNeural", "rate": "-18%", "pitch": "+3Hz"},
    "CURIOSITY":     {"voice": "en-US-JennyNeural", "rate": "-6%",  "pitch": "+3Hz"},
    "FOCUS":         {"voice": "en-US-JennyNeural", "rate": "-8%",  "pitch": "-1Hz"},
    "INTEREST":      {"voice": "en-US-JennyNeural", "rate": "-4%",  "pitch": "+3Hz"},
    "PRIDE":         {"voice": "en-US-AriaNeural",  "rate": "-4%",  "pitch": "-3Hz"},
    "CALMNESS":      {"voice": "en-US-JennyNeural", "rate": "-12%", "pitch": "-2Hz"},
    "NEUTRAL":       {"voice": "en-US-JennyNeural", "rate": "-10%", "pitch": "-2Hz"},
}


def _get_emotion_params(emotion: str) -> tuple[str, float, dict]:
    """Returns (kokoro_voice, base_speed, edge_profile).

    NOTE: Kokoro-onnx does NOT accept a pitch argument in create().
    Pitch is handled exclusively in EDGE_PROFILES for the Edge TTS fallback.
    """
    key = emotion.upper().strip()
    voice, speed = EMOTION_MATRIX.get(key, EMOTION_MATRIX["NEUTRAL"])
    edge = EDGE_PROFILES.get(key, EDGE_PROFILES["NEUTRAL"])
    return voice, speed, edge




# PILLAR 4 — DYNAMIC SENTENCE CHUNKING
# ══════════════════════════════════════════════════════════════════════════════

def _split_sentences(text: str) -> list[str]:
    parts = re.split(r'(?<=[.!?]\.\.)\s+|(?<=[.!?])\s+', text)
    return [p.strip() for p in parts if p.strip()]


def _silence(duration_s: float, sample_rate: int = 24000) -> np.ndarray:
    return np.zeros(int(sample_rate * duration_s), dtype=np.float32)


def _kokoro_chunks(
    text: str,
    voice: str,
    base_speed: float,
) -> tuple[np.ndarray, int]:
    """
    Generate per-sentence audio with micro-speed variation per sentence,
    plus breath-gap silence between sentences.
    NOW MULTITHREADED FOR BLAZING FAST GENERATION ⚡
    """
    sentences = _split_sentences(text)
    if not sentences:
        sentences = [text]

    sample_rate = 24000

    def process_sentence(args):
        i, sentence = args
        if not sentence.strip():
            return i, None

        # ── Micro-speed variation ───────────────────────────────────────────
        chunk_speed = base_speed + random.uniform(-0.04, 0.04)
        if '...' in sentence:
            chunk_speed -= 0.05
        chunk_speed = max(0.60, min(1.40, chunk_speed))

        try:
            samples, sr = kokoro.create(
                sentence,
                voice=voice,
                speed=chunk_speed,
                lang="en-us"
            )
            
            # ── Breath gap ───────────────────────────────────────────────────
            gap = 0.0
            if i < len(sentences) - 1:
                if '?' in sentence or '!' in sentence:
                    gap = random.uniform(0.15, 0.22)
                elif '...' in sentence:
                    gap = random.uniform(0.18, 0.25)
                else:
                    gap = random.uniform(0.10, 0.16)
            
            # Return samples and the gap array to be appended after it
            silence_array = _silence(gap, sr) if gap > 0 else np.array([], dtype=np.float32)
            return i, np.concatenate([samples.astype(np.float32), silence_array])
            
        except Exception as e:
            logger.warning(f"Chunk failed ({sentence[:30]}): {e}")
            return i, None

    # Process all sentences in PARALLEL using ThreadPool
    all_audio_unordered = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(sentences))) as executor:
        # Pass index along with sentence so we can reorder them correctly later
        futures = [executor.submit(process_sentence, (i, s)) for i, s in enumerate(sentences)]
        for future in concurrent.futures.as_completed(futures):
            all_audio_unordered.append(future.result())

    # Sort back to original order and filter out Nones
    all_audio_ordered = sorted(all_audio_unordered, key=lambda x: x[0])
    final_audio_list = [audio for idx, audio in all_audio_ordered if audio is not None]

    if not final_audio_list:
        raise RuntimeError("All chunks failed — no audio generated")

    return np.concatenate(final_audio_list), sample_rate




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
    return jsonify({"status": "ok", "emotions_supported": len(EMOTION_MATRIX)})

@app.route("/generate", methods=["POST"])
def generate_audio_route():
    try:
        data    = request.get_json(force=True, silent=True) or {}
        text    = data.get("text", "").strip()
        emotion = data.get("emotion") or data.get("style") or "NEUTRAL"
        voice_settings = data.get("voice_settings", None)

        if not text:
            return jsonify({"error": "No text provided"}), 400

        # Pillar 1
        clean = strip_roleplay(text)
        if not clean or len(clean) < 2:
            clean = "mm."
            logger.info("Pure action message — using placeholder audio")

        # Pillar 2
        speech_text = hack_prosody(clean)

        # Pillar 3
        voice, base_speed, edge_profile = _get_emotion_params(emotion)

        if voice_settings:
            if "voice" in voice_settings:
                voice = voice_settings["voice"]
            if "speed" in voice_settings:
                base_speed = float(voice_settings["speed"])
            if "pitch" in voice_settings:
                edge_profile["pitch"] = f"{int((float(voice_settings['pitch']) - 1.0) * 50)}Hz"

        logger.info(
            f"TTS | emotion={emotion} voice={voice} "
            f"speed={base_speed:.2f} "
            f"| '{speech_text[:50]}'"
        )

        audio_b64 = None
        duration = 0.0

        # Pillar 4 - Kokoro Primary
        if KOKORO_AVAILABLE and kokoro:
            try:
                audio_array, sample_rate = _kokoro_chunks(speech_text, voice, base_speed)
                buffer = io.BytesIO()
                sf.write(buffer, audio_array, sample_rate, format='WAV')
                buffer.seek(0)
                audio_b64 = base64.b64encode(buffer.read()).decode('utf-8')
                duration = len(audio_array) / sample_rate
                logger.info(f"Kokoro output: {duration:.2f}s")
            except Exception as e:
                logger.error(f"Kokoro chunked generation failed: {e} — falling back to Edge TTS")

        # Fallback - Edge TTS
        if not audio_b64:
            audio_bytes = run_tts_sync(clean, edge_profile["voice"], edge_profile["rate"], edge_profile["pitch"])
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            rate_val = int(edge_profile["rate"].replace("%", "").replace("+", ""))
            chars_per_sec = 14.0 * (1.0 + rate_val / 100.0)
            duration = len(clean) / max(chars_per_sec, 5.0)
            logger.info(f"Edge TTS fallback: {duration:.2f}s")

        return jsonify({
            "status": "success",
            "audioBase64": audio_b64,
            "duration": round(duration, 2),
            "emotion": emotion
        })

    except Exception as e:
        logger.error(f"TTS Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("Maeve TTS Server v2.0 — Port 5002")
    print(f"   Emotions loaded: {len(EMOTION_MATRIX)}")
    app.run(host="0.0.0.0", port=5002, debug=False)
