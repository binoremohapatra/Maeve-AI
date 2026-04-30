"""
Audio Processing Module
TTS engine with emotion modulation and SFX management
"""

from .tts_engine import generate_audio, initialize_tts, KOKORO_AVAILABLE
from .sfx_engine import get_random_sfx, load_big_sucking_file, BIG_AUDIO_SOURCE

__all__ = [
    'generate_audio',
    'initialize_tts',
    'KOKORO_AVAILABLE',
    'get_random_sfx',
    'load_big_sucking_file',
    'BIG_AUDIO_SOURCE'
]
