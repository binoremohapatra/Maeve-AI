import os
import io
import random
import base64
import logging
from pydub import AudioSegment

logger = logging.getLogger(__name__)

# SFX directories
SFX_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sfx")
MOANS_DIR = os.path.join(SFX_DIR, "moans")
SLURPS_DIR = os.path.join(SFX_DIR, "slurps")

# Predefined SFX mappings
SFX_MAPPINGS = {
    "BACKSHOT": ["moaning3.wav", "moaning5.wav"],
    "BACKSHOT2": ["moaning2.wav", "moaning2.wav"],
    "BACKSHOT3": ["moaning3.wav", "moaning3.wav"],
    "BLOWJOB": ["longsucking.wav"],
    "BLOWJOB2": ["longsucking.wav"],
    "BLOWJOB3": ["smallsucking.wav"],
    "FRONT": ["moaning1.wav", "moaning1.wav"],
    "FRONT2": ["moaning2.wav", "moaning2.wav"],
    "FRONTSLOW": ["moaning4.wav", "moaning4.wav"],
    "SADDLE": ["saddle1.wav", "saddle2.wav"],
    "MASTURBATE": ["masturbate.wav", "masturbate.wav"],
    "AHEGAO": ["ahegao1.wav", "ahegao2.wav"],
    "KISS": ["kiss1.wav", "kiss2.wav"],
    "NORMALKISS": ["kiss1.wav", "kiss2.wav"],
    "HUGGINGKISS": ["kiss1.wav", "kiss3.wav"],
    "ROMANCE": ["romance1.wav", "romance2.wav"],
    "ADORATION": ["adoration1.wav", "adoration2.wav"],
    "BASHFUL": ["bashful1.wav", "bashful2.wav"],
    "NORMALKISS": ["kiss1.wav", "kiss2.wav"],
    "SEXY": ["sexy1.wav", "sexy2.wav"],
    "CRAVING": ["craving1.wav", "craving2.wav"]
}

def get_random_sfx(animation_name):
    """Get random SFX file for given animation"""
    try:
        # Check if we have SFX for this animation
        if animation_name not in SFX_MAPPINGS:
            return None
        
        # Get random file from the list
        sfx_files = SFX_MAPPINGS[animation_name]
        selected_file = random.choice(sfx_files)
        
        # Determine directory
        if "bj" in selected_file or "backshot" in selected_file or "front" in selected_file or "saddle" in selected_file or "masturbate" in selected_file or "ahegao" in selected_file:
            file_path = os.path.join(MOANS_DIR, selected_file)
        else:
            file_path = os.path.join(SLURPS_DIR, selected_file)
        
        # Check if file exists
        if not os.path.exists(file_path):
            logger.warning(f"SFX file not found: {file_path}")
            return None
        
        # Load and convert to base64
        audio = AudioSegment.from_file(file_path)
        
        # Export to bytes
        buffer = io.BytesIO()
        audio.export(buffer, format="wav")  # <-- WAV format - bulletproof!
        audio_bytes = buffer.getvalue()
        
        # Encode to base64
        audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
        
        # Calculate duration (default 5 seconds for SFX)
        duration = 5.0
        
        logger.info(f"Loaded SFX: {animation_name} -> {selected_file}")
        
        return {
            "audioBase64": audio_b64,
            "duration": duration,
            "filename": selected_file
        }
        
    except Exception as e:
        logger.error(f"SFX loading error: {e}")
        return None

def get_cinematic_kiss_sfx():
    """Get specialized KISS SFX for cinematic sequence"""
    try:
        # Use predefined kiss sounds
        kiss_files = ["kiss1.wav", "kiss2.wav"]
        selected_file = random.choice(kiss_files)
        file_path = os.path.join(SLURPS_DIR, selected_file)
        
        # Check if file exists
        if not os.path.exists(file_path):
            logger.warning(f"KISS SFX file not found: {file_path}")
            return None
        
        # Load and convert to base64
        audio = AudioSegment.from_file(file_path)
        
        # Export to bytes
        buffer = io.BytesIO()
        audio.export(buffer, format="wav")
        audio_bytes = buffer.getvalue()
        
        # Encode to base64
        audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
        
        # Calculate actual duration
        duration = len(audio) / 1000.0  # Convert milliseconds to seconds
        
        logger.info(f"Loaded cinematic KISS SFX: {selected_file} ({duration:.2f}s)")
        
        return {
            "audioBase64": audio_b64,
            "duration": duration,
            "filename": selected_file,
            "type": "kiss_sfx"
        }
        
    except Exception as e:
        logger.error(f"KISS SFX loading error: {e}")
        return None

def load_big_sucking_file():
    """Load the big sucking audio file for performance (async)"""
    try:
        big_suck_file = os.path.join(SLURPS_DIR, "longsucking.wav")
        if os.path.exists(big_suck_file):
            logger.info(f"⏳ Loading Big Sucking File... ({big_suck_file})")
            
            # Load in background thread to prevent blocking
            def load_audio():
                global BIG_AUDIO_SOURCE
                BIG_AUDIO_SOURCE = AudioSegment.from_file(big_suck_file)
                logger.info(f"Big Sucking File loaded successfully")
            
            # Start background loading
            import threading
            loading_thread = threading.Thread(target=load_audio, daemon=True)
            loading_thread.start()
            
            # Return temporary placeholder while loading
            return AudioSegment.from_file(os.path.join(SLURPS_DIR, "smallsucking.wav"))
        else:
            logger.warning(f"Big sucking file not found: {big_suck_file}")
            return None
    except Exception as e:
        logger.error(f"Error loading big sucking file: {e}")
        return None

# Preload big audio file
BIG_AUDIO_SOURCE = load_big_sucking_file()
