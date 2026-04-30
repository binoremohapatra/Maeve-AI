import sys
import asyncio
import edge_tts
import os
import logging
import base64
import io
from pydub import AudioSegment

# Try to import Kokoro
try:
    from kokoro_onnx import Kokoro
    KOKORO_AVAILABLE = True
except ImportError:
    KOKORO_AVAILABLE = False
    print("⚠️ Kokoro not available, will use Edge TTS as fallback")

# Initialize Kokoro if available
kokoro = None
if KOKORO_AVAILABLE:
    try:
        MODEL_PATH = "kokoro-v1.0.int8.onnx"
        VOICES_PATH = "voices-v1.0.bin"
        
        if os.path.exists(MODEL_PATH) and os.path.exists(VOICES_PATH):
            kokoro = Kokoro(MODEL_PATH, VOICES_PATH)
            print("✅ Kokoro TTS Engine Ready")
        else:
            print("⚠️ Kokoro model files not found. Will use Edge TTS fallback.")
            KOKORO_AVAILABLE = False
    except Exception as e:
        print(f"❌ Kokoro TTS Error: {e}")
        KOKORO_AVAILABLE = False

# Edge TTS Voice Profiles based on Emotion
EDGE_VOICE_PROFILES = {
    "NEUTRAL": {"rate": "-10%", "pitch": "-2Hz", "voice": "en-US-AriaNeural"},
    "HAPPY": {"rate": "+10%", "pitch": "+5Hz", "voice": "en-US-AriaNeural"},
    "SAD": {"rate": "-25%", "pitch": "-5Hz", "voice": "en-US-AriaNeural"},
    "SEXY": {"rate": "-20%", "pitch": "-5Hz", "voice": "en-US-JennyNeural"},
    "LOVE": {"rate": "-15%", "pitch": "-3Hz", "voice": "en-US-JennyNeural"},
    "ANGRY": {"rate": "+15%", "pitch": "+0Hz", "voice": "en-US-AriaNeural"},
    "EXCITEMENT": {"rate": "+15%", "pitch": "+8Hz", "voice": "en-US-AriaNeural"},
    "SADNESS": {"rate": "-30%", "pitch": "-8Hz", "voice": "en-US-JennyNeural"},
    "ROMANCE": {"rate": "-15%", "pitch": "+2Hz", "voice": "en-US-JennyNeural"},
}

async def generate_with_kokoro(text, emotion="NEUTRAL", voice="af_bella"):
    """Generate audio using Kokoro TTS"""
    if not KOKORO_AVAILABLE or not kokoro:
        return None
    
    try:
        # Adjust voice parameters based on emotion
        voice_speed = 1.0
        voice_pitch = 1.0
        
        if emotion == "EXCITEMENT" or emotion == "HAPPY":
            voice_speed = 1.1
            voice_pitch = 1.1
        elif emotion == "SADNESS" or emotion == "SAD":
            voice_speed = 0.9
            voice_pitch = 0.9
        elif emotion == "ANGER" or emotion == "ANGRY":
            voice_speed = 1.2
            voice_pitch = 0.8
        elif emotion in ["ROMANCE", "SEXUAL_DESIRE", "LOVE", "SEXY"]:
            voice_speed = 0.8
            voice_pitch = 1.2
        
        # Generate speech
        samples, sample_rate = kokoro.create(
            text,
            voice=voice,
            speed=voice_speed
        )
        
        # Convert to audio segment
        audio = AudioSegment(
            samples.tobytes(),
            frame_rate=sample_rate,
            channels=1,
            sample_width=2
        )
        
        # Export to bytes
        buffer = io.BytesIO()
        audio.export(buffer, format="wav", parameters=["-ar", str(sample_rate)])
        audio_bytes = buffer.getvalue()
        
        return audio_bytes
        
    except Exception as e:
        print(f"❌ Kokoro generation error: {e}")
        return None

async def generate_with_edge_tts(text, emotion="NEUTRAL"):
    """Generate audio using Edge TTS as fallback"""
    try:
        # Get settings for emotion
        settings = EDGE_VOICE_PROFILES.get(emotion, EDGE_VOICE_PROFILES["NEUTRAL"])
        
        communicate = edge_tts.Communicate(
            text, 
            settings["voice"], 
            rate=settings["rate"], 
            pitch=settings["pitch"]
        )
        
        # Generate to temporary file
        temp_filename = f"temp_{os.urandom(4).hex()}.mp3"
        await communicate.save(temp_filename)
        
        # Read and convert to bytes
        with open(temp_filename, "rb") as f:
            audio_bytes = f.read()
        
        # Cleanup
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
            
        return audio_bytes
        
    except Exception as e:
        print(f"❌ Edge TTS generation error: {e}")
        return None

async def generate_voice(text_file, output_file, emotion="NEUTRAL"):
    """Generate audio from text file using Kokoro (default) or Edge TTS (fallback)"""
    
    # 1. Read text from file
    if not os.path.exists(text_file):
        print(f"Error: Text file not found: {text_file}")
        return False

    with open(text_file, "r", encoding="utf-8") as f:
        text = f.read()

    if not text.strip():
        print("Error: Text file is empty")
        return False

    print(f"🎤 Generating audio for: {text[:50]}... (Emotion: {emotion})")

    # 2. Try Kokoro first, then Edge TTS as fallback
    audio_bytes = None
    
    if KOKORO_AVAILABLE:
        print("🔥 Using Kokoro TTS (default)")
        audio_bytes = await generate_with_kokoro(text, emotion)
    
    if not audio_bytes:
        print("🔄 Falling back to Edge TTS")
        audio_bytes = await generate_with_edge_tts(text, emotion)
    
    if not audio_bytes:
        print("❌ Both TTS engines failed")
        return False

    # 3. Save audio to file
    try:
        with open(output_file, "wb") as f:
            f.write(audio_bytes)
        print(f"✅ Audio saved to: {output_file}")
        return True
    except Exception as e:
        print(f"❌ Error saving audio: {e}")
        return False

if __name__ == "__main__":
    try:
        # Expected: python tts_engine.py input.txt output.mp3 [emotion]
        if len(sys.argv) < 3:
            print("Usage: python tts_engine.py <text_file_path> <output_file_path> [emotion]")
            print("Emotions: NEUTRAL, HAPPY, SAD, SEXY, LOVE, ANGRY, EXCITEMENT, SADNESS, ROMANCE")
            sys.exit(1)

        text_file_path = sys.argv[1]
        output_file_path = sys.argv[2]
        emotion = sys.argv[3] if len(sys.argv) > 3 else "NEUTRAL"
        
        success = asyncio.run(generate_voice(text_file_path, output_file_path, emotion))
        
        if not success:
            sys.exit(1)
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
