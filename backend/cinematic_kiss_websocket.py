#!/usr/bin/env python3
"""
WebSocket-based Cinematic KISS Sequence (Approach B)
Sequential events: SFX first, then TTS after delay
"""

from flask_socketio import SocketIO, emit
import time
import threading
import logging

logger = logging.getLogger(__name__)

class CinematicKissHandler:
    def __init__(self, socketio: SocketIO):
        self.socketio = socketio
        
    def emit_cinematic_kiss_sequence(self, user_id, kiss_sfx_data, tts_data, reply_text, emotion, animation):
        """
        Emit sequential events for cinematic KISS sequence:
        1. Emit SFX event immediately
        2. Wait 2.5 seconds 
        3. Emit TTS dialogue event
        """
        try:
            # Event 1: KISS SFX + zoom instruction
            self.socketio.emit('cinematic_kiss_sfx', {
                'userId': user_id,
                'mascotAction': animation,
                'emotion': emotion,
                'kissSfxBase64': kiss_sfx_data.get('audioBase64'),
                'kissSfxDuration': kiss_sfx_data.get('duration', 0),
                'sequence': 'zoom_in_and_kiss',
                'replyText': reply_text  # Include text for overlay
            }, room=user_id)
            
            logger.info(f"Emitted KISS SFX event for user {user_id}")
            
            # Event 2: TTS dialogue after delay
            def emit_tts_after_delay():
                time.sleep(2.5)  # Wait for SFX + zoom to complete
                
                self.socketio.emit('cinematic_kiss_dialogue', {
                    'userId': user_id,
                    'audioBase64': tts_data.get('audioBase64'),
                    'duration': tts_data.get('duration', 0),
                    'sequence': 'tts_dialogue_and_zoom_out',
                    'emotion': emotion,
                    'mascotAction': animation,
                    'replyText': reply_text
                }, room=user_id)
                
                logger.info(f"Emitted KISS TTS dialogue event for user {user_id}")
            
            # Run TTS emission in background thread
            tts_thread = threading.Thread(target=emit_tts_after_delay)
            tts_thread.daemon = True
            tts_thread.start()
            
            return True
            
        except Exception as e:
            logger.error(f"Cinematic KISS sequence error: {e}")
            return False

# Integration example for chat_routes.py
def handle_cinematic_kiss_websocket(user_id, action, reply, emotion, tts_audio_data):
    """
    WebSocket-based cinematic KISS handler
    Call this from your chat route when KISS is detected
    """
    from audio.sfx_engine import get_cinematic_kiss_sfx
    from flask import current_app
    
    # Get KISS SFX
    kiss_sfx = get_cinematic_kiss_sfx()
    
    if kiss_sfx and tts_audio_data:
        # Initialize cinematic handler (would be set up in app.py)
        cinematic_handler = current_app.cinematic_kiss_handler
        
        # Emit sequential events
        success = cinematic_handler.emit_cinematic_kiss_sequence(
            user_id=user_id,
            kiss_sfx_data=kiss_sfx,
            tts_data=tts_audio_data,
            reply_text=reply,
            emotion=emotion,
            animation=action
        )
        
        if success:
            # Return immediate response indicating cinematic sequence started
            return {
                "replyText": reply,
                "mascotAction": action,
                "emotion": emotion,
                "isCinematicKiss": True,
                "cinematicMode": "websocket_sequential",
                "sequence": ["zoom_in", "kiss_sfx", "tts_dialogue", "zoom_out"],
                "audioBase64": None,  # Will be delivered via WebSocket
                "duration": 0
            }
    
    # Fallback to regular response
    return {
        "replyText": reply,
        "mascotAction": action,
        "emotion": emotion,
        "audioBase64": tts_audio_data.get("audioBase64"),
        "duration": tts_audio_data.get("duration", 0),
        "isCinematicKiss": False
    }

# Frontend WebSocket event handlers (JavaScript example)
"""
// Frontend implementation example
socket.on('cinematic_kiss_sfx', (data) => {
    console.log('Starting cinematic KISS sequence');
    
    // Phase 1: Zoom In
    animateZoomIn();
    
    // Phase 2: Play KISS SFX
    playAudio(data.kissSfxBase64);
    
    // Phase 3: Show overlay with text
    showTextOverlay(data.replyText);
    
    // Phase 4: Prepare for dialogue (TTS will come next)
    setTimeout(() => {
        hideOverlay();
    }, data.kissSfxDuration * 1000);
});

socket.on('cinematic_kiss_dialogue', (data) => {
    console.log('Playing TTS dialogue');
    
    // Phase 3 continued: Play TTS dialogue
    playAudio(data.audioBase64);
    
    // Phase 4: Zoom Out
    setTimeout(() => {
        animateZoomOut();
    }, data.duration * 1000);
});
"""
