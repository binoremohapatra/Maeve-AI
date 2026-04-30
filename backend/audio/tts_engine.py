import os
import io
import re
import random
import logging
import base64
import asyncio
import numpy as np
import soundfile as sf
import edge_tts
import concurrent.futures

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ══════════════════════════════════════════════════════════════════════════════
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


# ══════════════════════════════════════════════════════════════════════════════
# PILLAR 1 — ROLEPLAY STRIPPER
# ══════════════════════════════════════════════════════════════════════════════

def strip_roleplay(text: str) -> str:
    text = re.sub(r'\*[^*]*\*', ' ', text)
    text = re.sub(r'\([^)]*\)', ' ', text)
    text = re.sub(r'[*~#_`\[\]{}|]', '', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'\s{2,}', ' ', text).strip()
    return text


# ══════════════════════════════════════════════════════════════════════════════
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


# ══════════════════════════════════════════════════════════════════════════════
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


# ══════════════════════════════════════════════════════════════════════════════
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


# ══════════════════════════════════════════════════════════════════════════════
# MAIN generate_audio
# ══════════════════════════════════════════════════════════════════════════════

def generate_audio(
    text: str,
    emotion: str = "NEUTRAL",
    voice_settings: dict = None,
) -> dict | None:
    """
    Generate human-like speech through 4 processing pillars.

    Args:
        text:           Raw reply from Maeve (may contain *actions*)
        emotion:        Emotional state string (e.g. "ANGER", "SOFT", "LUST")
        voice_settings: Optional override {"speed": float, "pitch": float, "tone": str}

    Returns:
        {"audioBase64": str, "duration": float} or None on total failure
    """
    if not text or not text.strip():
        return None

    # ── Pillar 1 ─────────────────────────────────────────────────────────────
    clean = strip_roleplay(text)
    if not clean or len(clean) < 2:
        clean = "mm."
        logger.info("Pure action message — using placeholder audio")

    # ── Pillar 2 ─────────────────────────────────────────────────────────────
    speech_text = hack_prosody(clean)

    # ── Pillar 3 ─────────────────────────────────────────────────────────────
    voice, base_speed, edge_profile = _get_emotion_params(emotion)

    #  STRICT OVERRIDE FROM VOICE CONTROLLER 
    if voice_settings:
        logger.debug(f"Applying strict voice settings from brain: {voice_settings}")
        
      
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

    # ── Pillar 4 ─────────────────────────────────────────────────────────────
    if KOKORO_AVAILABLE and kokoro:
        try:
            audio_array, sample_rate = _kokoro_chunks(
                speech_text, voice, base_speed
            )
            buffer = io.BytesIO()
            sf.write(buffer, audio_array, sample_rate, format='WAV')
            buffer.seek(0)

            audio_b64 = base64.b64encode(buffer.read()).decode('utf-8')
            duration   = len(audio_array) / sample_rate

            logger.info(f"Kokoro output: {duration:.2f}s")
            return {"audioBase64": audio_b64, "duration": duration}

        except Exception as e:
            logger.error(f"Kokoro chunked generation failed: {e} — falling back to Edge TTS")

    return _edge_tts_fallback(clean, edge_profile)


# ══════════════════════════════════════════════════════════════════════════════
# STREAMING VARIANT
# ══════════════════════════════════════════════════════════════════════════════

def generate_audio_chunk(
    text: str,
    emotion: str,
    voice_settings: dict = None,
) -> dict | None:
    """
    Single-sentence variant for streaming pipelines.
    Same pillar logic, no internal sentence splitting.
    """
    if not text or not text.strip():
        return None

    clean = strip_roleplay(text)
    if not clean or len(clean) < 2:
        clean = "mm."

    speech_text = hack_prosody(clean)
    voice, base_speed, edge_profile = _get_emotion_params(emotion)

    if voice_settings:
        caller_speed = float(voice_settings.get("speed", base_speed))
        base_speed = base_speed * 0.6 + caller_speed * 0.4

        tone = voice_settings.get("tone", "").lower()
        if any(k in tone for k in ["anger", "aggressive", "dark", "commanding", "cold"]):
            voice = "af_sarah"
        elif any(k in tone for k in ["shy", "sweet", "warm", "soft", "nurturing"]):
            voice = "af_bella"
        elif any(k in tone for k in ["seductive", "intimate", "breathy"]):
            voice = "af_nicole"

    # Micro-speed variation
    chunk_speed = base_speed + random.uniform(-0.04, 0.04)
    if '...' in speech_text:
        chunk_speed -= 0.05
    chunk_speed = max(0.60, min(1.40, chunk_speed))

    logger.debug(
        f"Chunk TTS | emotion={emotion} voice={voice} "
        f"speed={chunk_speed:.2f} "
        f"| '{speech_text[:30]}'"
    )

    if KOKORO_AVAILABLE and kokoro:
        try:
            samples, sr = kokoro.create(
                speech_text,
                voice=voice,
                speed=chunk_speed,
                lang="en-us"
            )
            buffer = io.BytesIO()
            sf.write(buffer, samples.astype(np.float32), sr, format='WAV')
            buffer.seek(0)

            return {
                "audioBase64": base64.b64encode(buffer.read()).decode('utf-8'),
                "duration":    len(samples) / sr,
            }

        except Exception as e:
            logger.warning(f"Kokoro chunk failed: {e} — falling back to Edge TTS")

    return _edge_tts_fallback(clean, edge_profile)


# ══════════════════════════════════════════════════════════════════════════════
# EDGE TTS FALLBACK
# ══════════════════════════════════════════════════════════════════════════════

def _edge_tts_fallback(clean_text: str, profile: dict) -> dict | None:
    try:
        temp = f"temp_tts_{os.urandom(4).hex()}.mp3"

        async def _run():
            c = edge_tts.Communicate(
                clean_text,
                profile["voice"],
                rate=profile["rate"],
                pitch=profile["pitch"],
            )
            await c.save(temp)

        asyncio.run(_run())

        with open(temp, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode('utf-8')

        if os.path.exists(temp):
            os.remove(temp)

        rate_val = int(profile["rate"].replace('%', '').replace('+', ''))
        chars_per_sec = 14.0 * (1.0 + rate_val / 100.0)
        duration = len(clean_text) / max(chars_per_sec, 5.0)

        logger.info(f"Edge TTS fallback: {duration:.2f}s")
        return {"audioBase64": audio_b64, "duration": duration}

    except Exception as e:
        logger.error(f"Edge TTS fallback failed: {e}")
        return None


def initialize_tts():
    """Compatibility shim — called by app startup."""
    if KOKORO_AVAILABLE:
        logger.info("TTS Engine ready (Kokoro + 4-pillar prosody)")
    else:
        logger.info("TTS Engine ready (Edge TTS fallback)")
    return True