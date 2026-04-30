#!/usr/bin/env python3
"""
API Key Management Routes
"""

import logging
from flask import Blueprint, request, jsonify
import os

# Create separate blueprint for API key management
api_keys_bp = Blueprint('api_keys_bp', __name__)
logger = logging.getLogger(__name__)

# In-memory storage for session keys
SESSION_API_KEYS = {
    "groq": "",
    "gemini": ""
}

@api_keys_bp.route('/api/keys/status', methods=['GET'])
def get_key_status():
    """Frontend check karta hai ki keys set hain ya nahi"""
    return jsonify({
        "status": "ready",
        "mode": "HYBRID",
        "groq": {
            "available": bool(SESSION_API_KEYS["groq"] or os.getenv("GROQ_API_KEY")),
            "source": "frontend" if SESSION_API_KEYS["groq"] else "system"
        },
        "gemini": {
            "available": bool(SESSION_API_KEYS["gemini"] or os.getenv("GEMINI_API_KEY")),
            "source": "frontend" if SESSION_API_KEYS["gemini"] else "system"
        }
    }), 200

@api_keys_bp.route('/api/keys/set', methods=['POST', 'OPTIONS'])
def set_keys():
    """Frontend jab 'Update Keys' dabata hai toh yahan aati hain"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    data = request.get_json(silent=True) or {}
    
    # Update global session keys
    if "groq_api_key" in data:
        SESSION_API_KEYS["groq"] = data["groq_api_key"]
    if "gemini_api_key" in data:
        SESSION_API_KEYS["gemini"] = data["gemini_api_key"]
        
    # Baki Vision/Supervisor ko bhi bhej do
    if SESSION_API_KEYS["gemini"]:
        try:
            import requests
            requests.post("http://127.0.0.1:5003/update_key", json={"gemini_key": SESSION_API_KEYS["gemini"]}, timeout=2)
            requests.post("http://127.0.0.1:5005/update_key", json={"gemini_key": SESSION_API_KEYS["gemini"]}, timeout=2)
        except:
            pass

    return jsonify({"status": "success", "message": "Keys updated globally!"}), 200

@api_keys_bp.route('/api/keys/clear', methods=['POST'])
def clear_keys():
    """Frontend jab 'Clear' dabata hai"""
    SESSION_API_KEYS["groq"] = ""
    SESSION_API_KEYS["gemini"] = ""
    return jsonify({"status": "cleared", "message": "Reverted to system defaults."}), 200

# Export the keys so other routes can access them
__all__ = ['api_keys_bp', 'SESSION_API_KEYS']
