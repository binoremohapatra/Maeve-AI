from datetime import datetime
from flask import Blueprint, request, jsonify
from utils.json_storage import load_json, save_json
from utils.helpers import MEMORY_FILE, PROFILE_FILE, MAX_HISTORY

# Import global user preferences from chat routes
from routes.chat_routes import user_preferences

sync_bp = Blueprint('sync_bp', __name__)

@sync_bp.route('/api/sync/history', methods=['GET'])
def get_sync_history():
    """Get chat history for distributed sync across devices"""
    user_id = request.args.get('userId', 'user_pro_01')
    history = load_json(MEMORY_FILE, {})
    return jsonify(history.get(user_id, []))

@sync_bp.route('/api/sync/profile', methods=['GET'])
def get_sync_profile():
    """Get user profile with API keys and settings for distributed sync"""
    user_id = request.args.get('userId', 'user_pro_01')
    profiles = load_json(PROFILE_FILE, {})
    # Isme teri Gemini API Key aur Premium status bhi hoga
    return jsonify(profiles.get(user_id, {}))

@sync_bp.route('/api/sync/update_profile', methods=['POST'])
def update_sync_profile():
    """Update user profile across distributed devices"""
    data = request.json
    user_id = data.get('userId', 'user_pro_01')
    profiles = load_json(PROFILE_FILE, {})
    profiles[user_id] = data
    save_json(PROFILE_FILE, profiles)
    return jsonify({"status": "success", "message": "Profile synced successfully"})

@sync_bp.route('/api/location/sync', methods=['POST'])
def sync_location():
    """Real-time GPS context receiver"""
    data = request.json
    user_id = data.get('userId', 'user_pro_01')
    current_status = data.get('status', 'Stationary / At Home')
    
    profiles = load_json(PROFILE_FILE, {})
    if user_id not in profiles:
        profiles[user_id] = {"settings": {}}
    if "settings" not in profiles[user_id]:
        profiles[user_id]["settings"] = {}
    
    # Save current physical context
    profiles[user_id]["settings"]["physical_context"] = current_status
    save_json(PROFILE_FILE, profiles)
    
    # 📍 PROPER JSON RESPONSE
    return jsonify({
        "status": "success", 
        "message": f"Location updated: {current_status}",
        "context": current_status,
        "timestamp": datetime.now().isoformat()
    }), 200

@sync_bp.route('/api/sync/heartbeat', methods=['POST'])
def pc_heartbeat():
    """PC status heartbeat for distributed system"""
    data = request.json
    user_id = data.get('userId', 'user_pro_01')
    status = data.get('status', 'online')
    
    profiles = load_json(PROFILE_FILE, {})
    if user_id not in profiles:
        profiles[user_id] = {"settings": {}}
    if "settings" not in profiles[user_id]:
        profiles[user_id]["settings"] = {}
    
    profiles[user_id]["settings"]["pc_status"] = status
    profiles[user_id]["settings"]["last_heartbeat"] = datetime.now().isoformat()
    save_json(PROFILE_FILE, profiles)
    
    return jsonify({"status": "success", "pc_status": status})

@sync_bp.route('/api/sync/uplink', methods=['POST'])
def sync_uplink():
    """Sync cloud messages back to local storage - Memory continuity"""
    try:
        data = request.json
        user_id = data.get('userId', 'user_pro_01')
        new_messages = data.get('messages', []) # List of cloud messages
        
        if not new_messages:
            return jsonify({"status": "no_data"})

        # Local JSON load karo
        history = load_json(MEMORY_FILE, {})
        if user_id not in history:
            history[user_id] = []
            
        # Cloud messages ko local history mein append kar do
        history[user_id].extend(new_messages)
        
        # Max history limit check (60 messages)
        if len(history[user_id]) > MAX_HISTORY:
            history[user_id] = history[user_id][-MAX_HISTORY:]
            
        save_json(MEMORY_FILE, history)
        print(f"♻️ Sync Complete: {len(new_messages)} messages moved from Cloud to Local.")
        return jsonify({"status": "success", "synced_count": len(new_messages)})
    except Exception as e:
        print(f"❌ Sync Error: {e}")
        return jsonify({"status": "error"}), 500

@sync_bp.route('/api/settings/sync', methods=['POST'])
def sync_settings():
    data = request.json
    user_id = data.get('userId', 'user_pro_01')
    
    profiles = load_json(PROFILE_FILE, {})
    if user_id not in profiles:
        profiles[user_id] = {"name": "Darling", "user_pet_name": "", "facts": [], "settings": {}}
    if "settings" not in profiles[user_id]:
        profiles[user_id]["settings"] = {}
        
    # UPDATE GLOBAL USER_PREFERENCES AS WELL
    if user_id not in user_preferences:
        user_preferences[user_id] = {}
    
    # Handle persona and voice settings specifically
    if "currentMode" in data:
        new_mode = data["currentMode"].lower()
        user_preferences[user_id]["dominant_persona"] = new_mode
        profiles[user_id]["dominant_persona"] = new_mode
        print(f" Persona updated to: {new_mode}")
        
    if "currentVoice" in data:
        user_preferences[user_id]["voice_override"] = data["currentVoice"]
        print(f" Voice updated to: {data['currentVoice']}")
        
    if "provider" in data:
        user_preferences[user_id]["provider"] = data["provider"]
        print(f" Provider updated to: {data['provider']}")
        
    # THE FIX: Agar Frontend se Name ya Pet Name aaya hai, toh use ROOT me save karo
    if "name" in data:
        profiles[user_id]["name"] = data["name"]
        print(f" User Name updated to: {data['name']}")
        
    if "user_pet_name" in data:
        profiles[user_id]["user_pet_name"] = data["user_pet_name"]
        print(f" User Pet Name updated to: {data['user_pet_name']}")
        
    if "maeve_pet_name" in data:
        profiles[user_id]["maeve_pet_name"] = data["maeve_pet_name"]
        
    # Baaki ki settings (theme, notifications, etc.) ko settings dict me daalo
    settings_data = {k: v for k, v in data.items() if k not in ['userId', 'name', 'user_pet_name', 'maeve_pet_name', 'currentMode', 'currentVoice', 'provider']}
    profiles[user_id]["settings"].update(settings_data)
    
    save_json(PROFILE_FILE, profiles)
    
    # RETURN UPDATED SETTINGS
    print(f" Neural Matrix Updated for {user_id}: {data}")
    return jsonify({
        "status": "success",
        "message": "Settings & Name synced successfully",
        "current_settings": user_preferences[user_id],  # ADD CURRENT SETTINGS
        "updatedKeys": list(data.keys()),
        "timestamp": datetime.now().isoformat()
    }), 200

@sync_bp.route('/api/settings/<user_id>', methods=['GET'])
def get_settings(user_id):
    """
    Get current settings for a user
    """
    try:
        settings = user_preferences.get(user_id, {
            "dominant_persona": "default",
            "voice_override": "af_bella", 
            "provider": "local"
        })
        return jsonify({"status": "success", "settings": settings}), 200
        
    except Exception as e:
        print(f" Get Settings Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
