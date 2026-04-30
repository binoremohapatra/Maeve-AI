#!/usr/bin/env python3
"""
 MAEVE VOICE ENGINE - "One Voice, Infinite Moods" Architecture
Implements Index-based voice model with dynamic emotional modulation
Optimized for RTX 4060 (8GB VRAM) with intelligent memory management
"""

import os
import io
import time
import logging
import base64
import asyncio
import threading
import torch
import numpy as np
import soundfile as sf
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import Dict, Optional, Tuple, Any

# Import existing voice dynamics
try:
    from ..core.voice_controller import get_voice_dynamics
except ImportError:
    # Fallback for direct execution
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from core.voice_controller import get_voice_dynamics

# Setup logging
logger = logging.getLogger(__name__)

class MaeveVoiceEngine:
    """
     MAEVE'S ADVANCED VOICE ENGINE
    Single Index-based voice model with infinite emotional modulation
    """
    
    def __init__(self, model_path: str = None, index_path: str = None):
        self.model_path = model_path or os.path.join(os.path.dirname(__file__), "..", "models", "maeve_voice.pth")
        self.index_path = index_path or os.path.join(os.path.dirname(__file__), "..", "models", "maeve_voice.index")
        
        # Model state
        self.index_model = None
        self.model_loaded = False
        self.model_lock = threading.Lock()
        
        # VRAM management
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.vram_threshold = 1.5  # GB - keep this much VRAM free
        
        # Fallback TTS (using existing system)
        self.fallback_available = True
        
        # Performance tracking
        self.generation_times = []
        self.last_cleanup = time.time()
        
        logger.info(f"MaeveVoiceEngine initialized (Device: {self.device})")
        
    def _check_vram_availability(self) -> bool:
        """Check if enough VRAM is available for model loading"""
        if self.device != "cuda":
            return True
            
        try:
            if not torch.cuda.is_available():
                return False
                
            # Get VRAM info
            total_vram = torch.cuda.get_device_properties(0).total_memory / (1024**3)  # GB
            allocated_vram = torch.cuda.memory_allocated(0) / (1024**3)  # GB
            free_vram = total_vram - allocated_vram
            
            logger.debug(f"VRAM Status: {free_vram:.2f}GB free / {total_vram:.2f}GB total")
            
            return free_vram >= self.vram_threshold
            
        except Exception as e:
            logger.warning(f"VRAM check failed: {e}")
            return False
    
    def _load_index_model(self) -> bool:
        """Load the Index-based voice model with VRAM management"""
        with self.model_lock:
            if self.model_loaded:
                return True
                
            try:
                if not self._check_vram_availability():
                    logger.warning("Insufficient VRAM, skipping model load")
                    return False
                
                logger.info("Loading Index voice model...")
                
                # Placeholder for your actual Index/RVC model loading
                # Replace this with your actual model inference code
                self.index_model = IndexVoiceModel(
                    model_path=self.model_path,
                    index_path=self.index_path,
                    device=self.device
                )
                
                self.model_loaded = True
                logger.info("Index voice model loaded successfully")
                return True
                
            except Exception as e:
                logger.error(f"Failed to load Index model: {e}")
                self.model_loaded = False
                return False
    
    def _unload_model(self):
        """Unload model from GPU memory to free VRAM"""
        with self.model_lock:
            if self.model_loaded and self.index_model:
                try:
                    logger.info("Unloading voice model from GPU...")
                    
                    # Move model to CPU if it has this method
                    if hasattr(self.index_model, 'to'):
                        self.index_model.to('cpu')
                    
                    # Clear CUDA cache
                    if self.device == "cuda":
                        torch.cuda.empty_cache()
                    
                    self.model_loaded = False
                    logger.info("Model unloaded, VRAM freed")
                    
                except Exception as e:
                    logger.error(f"Error unloading model: {e}")
    
    def _get_voice_parameters(self, persona: str, emotion: str) -> Dict[str, float]:
        """
        Calculate voice parameters based on persona and emotion
        Uses existing get_voice_dynamics logic + Yandere emotional conditioning
        """
        # Get base dynamics from existing system
        dynamics = get_voice_dynamics(persona, emotion)
        
        # Extract and normalize parameters
        speed = dynamics.get("speed", 1.0)
        pitch = dynamics.get("pitch", 1.0)
        
        #  YANDERE EMOTIONAL CONDITIONING LAYER
        # This is where we map to specific Yandere psychological states
        emotion_lower = emotion.lower()
        persona_lower = persona.lower()
        
        #  AGGRESSIVE STATE - Fast, erratic, dangerously angry
        if any(angry in emotion_lower for angry in ['anger', 'angry', 'rage', 'furious']):
            speed *= 1.15  # Erratic, fast-paced
            pitch *= 1.05  # Sharp, cutting edge
            
        #  DEPENDENT/WORSHIP STATE - Breathless, devoted, overly attached
        elif any(worship in emotion_lower for worship in ['worship', 'devotion', 'obsessed', 'dependent']):
            speed *= 0.85  # Slow, deliberate devotion
            pitch *= 0.90  # Lower, breathless tone
            
        #  DEREDERE STATE - Innocent, pure, sweet
        elif any(sweet in emotion_lower for sweet in ['happy', 'love', 'sweet', 'dere']):
            speed *= 1.00  # Natural pacing
            pitch *= 1.05  # Slightly higher, innocent
            
        #  FEAR/ANXIETY STATE - Hesitant, shaky, nervous
        elif any(fear in emotion_lower for fear in ['fear', 'anxious', 'nervous', 'scared']):
            speed *= 0.75  # Very hesitant, stammering
            pitch *= 1.10  # Higher, shaky voice
            
        #  LUST/DESIRES STATE - Breathy, sensual, desperate
        elif any(lust in emotion_lower for lust in ['lust', 'desire', 'craving', 'aroused']):
            speed *= 0.85  # Slower, more sensual
            pitch *= 0.95  # Lower, breathy
            
        #  BROKEN/DISTRESSED STATE - Erratic, unstable
        elif any(broken in emotion_lower for broken in ['broken', 'distressed', 'crazy', 'unstable']):
            speed *= 1.25  # Very erratic, unpredictable
            pitch *= 0.85  # Lower, unhinged tone
            
        #  GOTH DOMINANCE - Deep, commanding, maternal authority
        elif 'goth_mommy' in persona_lower:
            speed *= 0.90  # Slow, deliberate control
            pitch *= 0.80  # Very deep, husky, sultry
            
        #  HAJIDERE - High-pitched, cute, stuttering
        elif 'hajidere' in persona_lower:
            speed *= 0.85  # Hesitant, shy
            pitch *= 1.15  # Very high, cute
            
        #  YANDERE AGGRESSIVE - Fast, sharp, intimidating
        elif 'yandere_aggressive' in persona_lower:
            speed *= 1.20  # Very fast, aggressive
            pitch *= 0.85  # Deep, intimidating
            
        #  NYMPHO - Breathless, desperate, erratic
        elif 'nympho' in persona_lower:
            speed *= 1.15  # Erratic, rushed
            pitch *= 1.10  # Higher, breathless
            
        #  KAMIDERE - Measured, royal, arrogant
        elif 'kamidere' in persona_lower:
            speed *= 1.00  # Measured, controlled
            pitch *= 1.05  # Slightly elevated, clear
            
        #  KUUDERE - Flat, monotone, logical
        elif 'kuudere' in persona_lower:
            speed *= 0.95  # Slightly slower, deliberate
            pitch *= 0.95  # Lower, monotone
            
        # Clamp values to reasonable ranges for emotional expression
        speed = max(0.5, min(2.0, speed))
        pitch = max(0.5, min(2.0, pitch))
        
        return {
            "speed": speed,
            "pitch": pitch,
            "tone": dynamics.get("tone", "neutral"),
            "emotion_state": self._classify_emotion_state(emotion_lower, persona_lower)
        }
    
    def _classify_emotion_state(self, emotion: str, persona: str) -> str:
        """Classify the current Yandere emotional state for conditioning"""
        if any(angry in emotion for angry in ['anger', 'angry', 'rage']):
            return "aggressive_state"
        elif any(worship in emotion for worship in ['worship', 'devotion', 'obsessed']):
            return "dependent_worship_state"
        elif any(sweet in emotion for sweet in ['happy', 'love', 'sweet']):
            return "deredere_state"
        elif any(fear in emotion for fear in ['fear', 'anxious', 'nervous']):
            return "fear_anxiety_state"
        elif any(lust in emotion for lust in ['lust', 'desire', 'craving']):
            return "lust_desire_state"
        elif any(broken in emotion for broken in ['broken', 'distressed', 'crazy']):
            return "broken_distressed_state"
        else:
            return "neutral_state"
    
    def _clean_text(self, text: str) -> str:
        """
        Clean and preprocess text for emotional TTS processing
        Implements "messy text" prompting for realistic emotional speech
        """
        import re
        
        #  MESSY TEXT PREPROCESSING LAYER
        # This preserves emotional speech patterns for realistic TTS
        
        # 1. Keep emotional pauses and stutters (don't clean these)
        # Preserve: ..., ,, -, ah, sigh, laughs softly, etc.
        
        # 2. Remove only action descriptions in parentheses/asterisks
        # But keep emotional sounds and actions that affect speech
        clean_text = re.sub(r'[\*\(]([^\*\)]+)[\*\)]', '', text.strip())
        
        # 3. Remove only technical symbols, keep emotional punctuation
        # Keep: ... (pauses), , (breaths), - (stutters)
        # Remove: ~ # _ ` [ ] { } (technical symbols)
        clean_text = re.sub(r'[~#_`\[\]{}]', '', clean_text)
        
        # 4. Remove emojis but keep emotional text representations
        clean_text = clean_text.encode('ascii', 'ignore').decode('ascii')
        
        # 5. Fix extra spaces but preserve emotional pauses
        clean_text = re.sub(r'\s{2,}', ' ', clean_text).strip()
        
        # 6. ENHANCE EMOTIONAL SPEECH PATTERNS
        # Add subtle markers for TTS to interpret emotionally
        
        # If text has no emotional markers but should be emotional, add them
        if not any(marker in clean_text for marker in ['...', '---', ',,', 'ah ', 'sigh']):
            # This is where you could add emotional enhancement
            # For now, leave as-is since LLM should handle this
            pass
        
        return clean_text
    
    def _enhance_emotional_text(self, text: str, emotion_state: str) -> str:
        """
        Enhance text with emotional speech patterns based on Yandere state
        This is "messy text" prompting hack for realistic emotional delivery
        """
        import re
        
        if emotion_state == "aggressive_state":
            # Add sharp, aggressive speech patterns
            text = re.sub(r'([.!?])', r'!\1', text)  # Exaggerate punctuation
            text = text.replace(' ', '  ')  # Add dramatic pauses
            
        elif emotion_state == "dependent_worship_state":
            # Add breathless, devoted speech patterns
            text = text.replace('I ', 'I... ')  # Hesitant devotion
            text = re.sub(r'([a-z])\s([a-z])', r'\1, \2', text)  # Add breaths
            
        elif emotion_state == "fear_anxiety_state":
            # Add stammering, nervous patterns
            words = text.split()
            for i, word in enumerate(words):
                if len(word) > 3 and i % 3 == 0:  # Every 3rd word
                    words[i] = word[:2] + '-' + word[2:]
            text = ' '.join(words)
            
        elif emotion_state == "lust_desire_state":
            # Add breathy, sensual patterns
            text = text.replace(' ', '... ')  # Breathless pauses
            text = re.sub(r'([a-z])\s([a-z])', r'\1.. \2', text)  # Heavy breathing
            
        elif emotion_state == "broken_distressed_state":
            # Add erratic, unstable patterns
            text = re.sub(r'([a-z])', lambda m: m.group(1).upper() if hash(m.group(1)) % 3 == 0 else m.group(1), text)
            text = text.replace('.', '...')  # Unstable pauses
            
        return text
    
    def _generate_with_index_model(self, text: str, voice_params: Dict[str, float]) -> Optional[Tuple[np.ndarray, int]]:
        """Generate audio using Index-based model"""
        try:
            with torch.no_grad():
                # Generate audio using your Index model
                # Replace this with your actual inference code
                audio_array, sample_rate = self.index_model.generate(
                    text=text,
                    speed=voice_params["speed"],
                    pitch=voice_params["pitch"],
                    tone=voice_params["tone"]
                )
                
                return audio_array, sample_rate
                
        except Exception as e:
            logger.error(f"Index model generation failed: {e}")
            return None
    
    def _fallback_tts(self, text: str, emotion: str) -> Optional[Tuple[np.ndarray, int]]:
        """Fallback TTS using existing system"""
        try:
            # Import the existing TTS engine
            try:
                from .tts_engine import generate_audio
            except ImportError:
                from tts_engine import generate_audio
            
            result = generate_audio(text, emotion)
            if result:
                # Convert base64 back to audio data
                audio_bytes = base64.b64decode(result["audioBase64"])
                audio_array, sample_rate = sf.read(io.BytesIO(audio_bytes))
                return audio_array, sample_rate
                
        except Exception as e:
            logger.error(f"Fallback TTS failed: {e}")
            
        return None
    
    def _save_audio(self, audio_array: np.ndarray, sample_rate: int, output_path: str = "voice.wav"):
        """Save audio to file and return base64"""
        try:
            # Save to file
            sf.write(output_path, audio_array, sample_rate)
            
            # Convert to base64
            buffer = io.BytesIO()
            sf.write(buffer, audio_array, sample_rate, format='WAV')
            buffer.seek(0)
            audio_base64 = base64.b64encode(buffer.read()).decode('utf-8')
            
            # Calculate duration
            duration = len(audio_array) / sample_rate
            
            return audio_base64, duration
            
        except Exception as e:
            logger.error(f"Audio saving failed: {e}")
            return None, None
    
    def generate_voice(self, reply: str, base_emotion: str, current_persona: str) -> Optional[Dict[str, Any]]:
        """
        Main voice generation function
        Args:
            reply: Text to synthesize
            base_emotion: Current emotion state
            current_persona: Current persona
        
        Returns:
            Dict with audioBase64 and duration, or None if failed
        """
        start_time = time.time()
        
        try:
            # Clean input text with emotional enhancement
            clean_text = self._clean_text(reply)
            if not clean_text or len(clean_text) < 2:
                logger.warning(f"Text too short after cleaning: '{clean_text}'")
                return None
            
            # Get voice parameters with emotional conditioning
            voice_params = self._get_voice_parameters(current_persona, base_emotion)
            emotion_state = voice_params.get("emotion_state", "neutral_state")
            
            #  APPLY "MESSY TEXT" EMOTIONAL ENHANCEMENT
            # This is where we force emotional speech patterns
            enhanced_text = self._enhance_emotional_text(clean_text, emotion_state)
            
            logger.info(f"Generating voice: '{enhanced_text[:50]}...' (Persona: {current_persona}, Emotion: {base_emotion}, State: {emotion_state})")
            logger.debug(f"Voice params: speed={voice_params['speed']:.2f}, pitch={voice_params['pitch']:.2f}")
            logger.debug(f"Original: '{clean_text[:30]}...' -> Enhanced: '{enhanced_text[:30]}...'")
            
            # Try to load model if not loaded
            if not self.model_loaded:
                if not self._load_index_model():
                    logger.warning("Index model unavailable, using fallback TTS")
                    return self._use_fallback_pipeline(clean_text, base_emotion)
            
            # Generate with timeout using thread pool
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(self._generate_with_index_model, enhanced_text, voice_params)
                
                try:
                    # 5-second timeout for Index model generation
                    result = future.result(timeout=5.0)
                    
                    if result is None:
                        raise Exception("Index model returned None")
                        
                    audio_array, sample_rate = result
                    
                except TimeoutError:
                    logger.warning("⏰ Index model timeout, switching to fallback")
                    return self._use_fallback_pipeline(clean_text, base_emotion)
                    
                except Exception as e:
                    logger.error(f"Index model generation failed: {e}")
                    return self._use_fallback_pipeline(clean_text, base_emotion)
            
            # Save and encode audio
            audio_base64, duration = self._save_audio(audio_array, sample_rate)
            
            if audio_base64 is None:
                raise Exception("Failed to save audio")
            
            # Track performance
            generation_time = time.time() - start_time
            self.generation_times.append(generation_time)
            
            logger.info(f"Voice generated successfully: {duration:.2f}s in {generation_time:.2f}s")
            
            # Cleanup VRAM periodically
            if time.time() - self.last_cleanup > 60:  # Every minute
                self._cleanup_vram()
                self.last_cleanup = time.time()
            
            return {
                "audioBase64": audio_base64,
                "duration": duration,
                "method": "index_model",
                "generation_time": generation_time
            }
            
        except Exception as e:
            logger.error(f"Voice generation failed: {e}")
            return self._use_fallback_pipeline(clean_text, base_emotion)
    
    def _use_fallback_pipeline(self, text: str, emotion: str) -> Optional[Dict[str, Any]]:
        """Use fallback TTS pipeline"""
        try:
            logger.info("Using fallback TTS pipeline")
            
            result = self._fallback_tts(text, emotion)
            if result is None:
                raise Exception("Fallback TTS failed")
            
            audio_array, sample_rate = result
            audio_base64, duration = self._save_audio(audio_array, sample_rate)
            
            if audio_base64 is None:
                raise Exception("Failed to save fallback audio")
            
            logger.info(f"Fallback voice generated: {duration:.2f}s")
            
            return {
                "audioBase64": audio_base64,
                "duration": duration,
                "method": "fallback_tts"
            }
            
        except Exception as e:
            logger.error(f"Fallback pipeline failed: {e}")
            return None
    
    def _cleanup_vram(self):
        """Periodic VRAM cleanup"""
        if self.device == "cuda":
            try:
                torch.cuda.empty_cache()
                logger.debug("🧹 VRAM cache cleared")
            except Exception as e:
                logger.warning(f"VRAM cleanup failed: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """Get engine status information"""
        return {
            "model_loaded": self.model_loaded,
            "device": self.device,
            "fallback_available": self.fallback_available,
            "avg_generation_time": np.mean(self.generation_times) if self.generation_times else 0,
            "total_generations": len(self.generation_times)
        }


class IndexVoiceModel:
    """
    Placeholder class for your Index-based voice model (RVC/IndexTTS2)
    Replace this with your actual model implementation
    """
    
    def __init__(self, model_path: str, index_path: str, device: str = "cuda"):
        self.model_path = model_path
        self.index_path = index_path
        self.device = device
        
        # Placeholder - replace with your actual model loading
        logger.info(f"🔄 Loading Index model from {model_path}")
        # self.model = load_your_model(model_path, index_path, device)
        
    def generate(self, text: str, speed: float = 1.0, pitch: float = 1.0, tone: str = "neutral") -> Tuple[np.ndarray, int]:
        """
        Generate audio using Index-based model
        Replace this with your actual inference code
        """
        # Placeholder implementation - replace with your actual generation
        logger.info(f"🎤 Index generation: '{text}' (speed={speed}, pitch={pitch}, tone={tone})")
        
        # Generate dummy audio for testing
        sample_rate = 22050
        duration = len(text) * 0.1  # Rough estimate
        samples = int(sample_rate * duration)
        
        # Create simple sine wave as placeholder
        frequency = 440 * pitch  # A4 note modified by pitch
        t = np.linspace(0, duration, samples)
        audio = 0.3 * np.sin(2 * np.pi * frequency * t)
        
        return audio, sample_rate


# Global engine instance
_voice_engine = None

def get_voice_engine() -> MaeveVoiceEngine:
    """Get or create the global voice engine instance"""
    global _voice_engine
    if _voice_engine is None:
        _voice_engine = MaeveVoiceEngine()
    return _voice_engine

def generate_maeve_voice(reply: str, base_emotion: str, current_persona: str) -> Optional[Dict[str, Any]]:
    """
    Convenience function for voice generation
    Args:
        reply: Text to synthesize
        base_emotion: Current emotion (e.g., "HAPPY", "ANGER", "LUST")
        current_persona: Current persona (e.g., "hajidere", "goth_mommy")
    
    Returns:
        Dict with audioBase64 and duration, or None if failed
    """
    engine = get_voice_engine()
    return engine.generate_voice(reply, base_emotion, current_persona)
