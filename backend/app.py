#!/usr/bin/env python3
import sys

# CRITICAL: gevent monkey patch must be the VERY FIRST thing!
from gevent import monkey
monkey.patch_all()

import logging
import threading
import requests
import time
import gevent
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import base64
import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure API keys from environment
genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
from io import BytesIO
from PIL import Image
import os

# ── GLOBAL CAMERA STATE ────────────────────────────────────────────────────────────────
CAMERA_ACTIVE = False

# Global variable to track the last time a photo was processed
last_vision_time = 0

from utils.shared_state import update_vision_context

# Initialize Gemini if API Key is present
if os.getenv("GEMINI_API_KEY"):
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = Flask(__name__)
# Request size limit
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024
app.config["SECRET_KEY"] = "maeve-websocket-secret"

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)


sio = SocketIO(
    app,
    async_mode="gevent",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
    ping_timeout=120,   
    ping_interval=25,  
)

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('maeve_debug.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# 2️⃣ USKE BAAD BLUEPRINTS IMPORT KARNA HAI (So 'chat_routes' imports the real 'sio')
from background.nagging_engine import offline_nagging_engine
from routes.chat_routes import chat_bp
from routes.schedule_routes import schedule_bp
from routes.sync_routes import sync_bp
from routes.pc_routes import pc_bp
from routes.proactive_routes import proactive_bp
from routes.health_routes import health_bp
from routes.api_key_routes import api_keys_bp

app.register_blueprint(chat_bp)
app.register_blueprint(schedule_bp)
app.register_blueprint(sync_bp)
app.register_blueprint(pc_bp)
app.register_blueprint(proactive_bp)
app.register_blueprint(health_bp)
app.register_blueprint(api_keys_bp)

# IMPORT USER PREFERENCES FROM CHAT ROUTES
from routes.chat_routes import user_preferences

# =========================================================================
# WEBSOCKET LISTENERS (Moved here from chat_routes.py to fix Circular Bug)
# =========================================================================

@sio.on('environment_data')
def handle_environment_data(data):
    global last_vision_time
    
    current_time = time.time()
    # 60 second cooldown taaki spam na ho
    if current_time - last_vision_time < 60:
        return
        
    try:
        image_b64 = data.get('image')
        location = data.get('location', {})
        
        if image_b64:
            last_vision_time = current_time 
            
            # 🔥 Asynchronous Forwarding: App.py chat handle karega, Vision server image!
            def forward_to_vision_server():
                try:
                    payload = {"image": image_b64, "location": location}
                    # Photo ko tere Vision Server (Port 5003) par bhej rahe hain
                    requests.post("http://127.0.0.1:5003/api/phone_frame", json=payload, timeout=3)
                    logger.info("� [JARVIS SENSORS] Frame forwarded to Vision Server (Port 5003)")
                except Exception as e:
                    logger.warning(f"⚠️ Vision Server (5003) offline ya busy hai: {e}")

            gevent.spawn(forward_to_vision_server)
            
    except Exception as e:
        logger.error(f"⚠️ [SENSOR ERROR]: {e}")


@sio.on("connect")
def on_connect():
    logger.info("WebSocket client connected")
    sio.emit("connected", {"status": "ok", "message": "Maeve WebSocket online"})

@sio.on("disconnect")
def on_disconnect():
    logger.info("WebSocket client disconnected")

# Yahan "message" ki jagah "chat_message" aayega
@sio.on("chat_message")
def on_websocket_message(data: dict):
    from routes.chat_routes import run_websocket_streaming_pipeline 
    
    user_input = (data.get("user_input") or data.get("message") or "").strip()
    user_id = data.get("userId") or data.get("user_id") or "user_pro_01"
    dominant_persona = data.get("dominant_persona") or "amadere"
    
    if user_id == "voice_user":
        user_id = "user_pro_01"
    
    if not user_input:
        sio.emit("stream_error", {"error": "Empty input"})
        return
    
    logger.info(f"[WS TEXT RECEIVED] persona={dominant_persona} | '{user_input[:60]}'")
    
    # FIX 1: Initialize SocketIO explicitly with 'gevent' and aggressive ping settings
    
    # BONUS FIX: Get the specific client ID so replies don't go to everyone
    from flask import request as flask_request
    client_sid = getattr(flask_request, 'sid', None)
    
    # Spawn the background task correctly in gevent's world
    import gevent
    
    greenlet = gevent.spawn(run_websocket_streaming_pipeline, user_input, user_id, dominant_persona, data, client_sid)
    
    # Attach an error handler so we can see if it crashes inside
    def _on_error(g):
        if g.exception:
            logger.error(f"Pipeline Crash: {g.exception}", exc_info=True)
    greenlet.link_exception(_on_error)
# =========================================================================

# ── VISION CAMERA TOGGLE API ─────────────────────────────────────────────────────
@app.route('/api/vision/camera', methods=['GET', 'POST'])
def toggle_camera():
    """Toggle camera on/off for privacy and performance optimization"""
    global CAMERA_ACTIVE
    
    if request.method == 'GET':
        return jsonify({"camera_active": CAMERA_ACTIVE})
        
    try:
        data = request.get_json()
        if data is None:
            return jsonify({"error": "No JSON data provided"}), 400
        
        new_state = data.get('active')
        CAMERA_ACTIVE = bool(new_state)
        logger.info(f"Camera State Changed -> {'ON' if CAMERA_ACTIVE else 'OFF'}")
        
        return jsonify({"success": True, "camera_active": CAMERA_ACTIVE})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    nagging_thread = threading.Thread(target=offline_nagging_engine, daemon=True)
    nagging_thread.start()
    
    print("Maeve Human Brain (Gevent Asynchronous Mode) Running on Port 5000")
    
    # FIX 2: Use gevent WSGIServer instead of default Flask server
    from gevent.pywsgi import WSGIServer
    from geventwebsocket.handler import WebSocketHandler
    
    http_server = WSGIServer(
        ("0.0.0.0", 5000),
        app,
        handler_class=WebSocketHandler,
        spawn=100 # FIX: Allow up to 100 concurrent greenlets
    )
    http_server.serve_forever()
    