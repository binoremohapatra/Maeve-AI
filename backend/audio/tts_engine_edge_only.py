import os
import logging
import base64
import asyncio
import edge_tts

logger = logging.getLogger(__name__)

# --- THE PERFECT DYNAMIC VOICE SETTINGS (From your code) ---
EDGE_VOICE_PROFILES = {
    "NEUTRAL": {"rate": "-10%", "pitch": "-2Hz", "voice": "en-US-AriaNeural"},
    "HAPPY": {"rate": "+10%", "pitch": "+5Hz", "voice": "en-US-AriaNeural"},
    "JOY": {"rate": "+10%", "pitch": "+5Hz", "voice": "en-US-AriaNeural"},
    "EXCITEMENT": {"rate": "+15%", "pitch": "+8Hz", "voice": "en-US-AriaNeural"},
    
    "SAD": {"rate": "-25%", "pitch": "-5Hz", "voice": "en-US-AriaNeural"},
    "SADNESS": {"rate": "-30%", "pitch": "-8Hz", "voice": "en-US-JennyNeural"},
    
    "SEXY": {"rate": "-20%", "pitch": "-5Hz", "voice": "en-US-JennyNeural"},
    "CRAVING": {"rate": "-25%", "pitch": "-6Hz", "voice": "en-US-JennyNeural"},
    "LOVE": {"rate": "-15%", "pitch": "-3Hz", "voice": "en-US-JennyNeural"},
    "ROMANCE": {"rate": "-15%", "pitch": "+2Hz", "voice": "en-US-JennyNeural"},
    "ADORATION": {"rate": "-15%", "pitch": "+0Hz", "voice": "en-US-JennyNeural"},
    
    "ANGRY": {"rate": "+15%", "pitch": "+0Hz", "voice": "en-US-AriaNeural"},
    "ANGER": {"rate": "+15%", "pitch": "+0Hz", "voice": "en-US-AriaNeural"},
    "FEAR": {"rate": "+20%", "pitch": "+5Hz", "voice": "en-US-AriaNeural"},
    "BOREDOM": {"rate": "-20%", "pitch": "-4Hz", "voice": "en-US-AriaNeural"},
}

def generate_audio(text, emotion="NEUTRAL"):
    """
    Generates audio using the perfect Edge-TTS setup.
    Bypassing Pydub completely to fix 100% of the static noise issues.
    """
    try:
        # 1. Clean the text for TTS (Remove asterisks like *worried*)
        import re
        clean_text = re.sub(r'\*[^*]*\*', '', text).strip()
        if not clean_text:
            return None

        # 2. Get the specific voice settings for the emotion
        emotion_key = emotion.upper()
        settings = EDGE_VOICE_PROFILES.get(emotion_key, EDGE_VOICE_PROFILES["NEUTRAL"])
        
        logger.info(f"🎤 Perfect Voice Active: [{emotion_key}] Voice:{settings['voice']} Rate:{settings['rate']}")

        # 3. Async Generation directly to a temporary MP3 file
        temp_filename = f"temp_tts_{os.urandom(4).hex()}.mp3"
        
        async def _run_tts():
            communicate = edge_tts.Communicate(
                clean_text, 
                settings['voice'], 
                rate=settings['rate'], 
                pitch=settings['pitch']
            )
            await communicate.save(temp_filename)

        asyncio.run(_run_tts())

        # 4. Read & Encode DIRECTLY (No Pydub processing)
        with open(temp_filename, "rb") as f:
            audio_bytes = f.read()
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')

        # 5. Cleanup the file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

        # 6. Estimate duration for lip-syncing animations
        # Speed modifier math (e.g. "-10%" -> -0.1)
        rate_str = settings['rate'].replace('%', '')
        rate_mod = int(rate_str) / 100.0 if rate_str.strip('+-').isdigit() else 0.0
        chars_per_sec = 14.0 * (1.0 + rate_mod)
        estimated_duration = len(clean_text) / max(chars_per_sec, 5.0)

        return {
            "audioBase64": audio_base64,
            "duration": estimated_duration
        }

    except Exception as e:
        logger.error(f"Perfect Voice TTS Error: {str(e)}")
        return None

def initialize_tts():
    """Initialize TTS system (for compatibility)"""
    print("Perfect Edge TTS System Initialized")
    return True

# For compatibility with existing code
KOKORO_AVAILABLE = False
