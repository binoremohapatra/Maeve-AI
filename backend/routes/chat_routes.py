import logging
import threading
import requests
import random
import re
import json
import gevent

from flask import Blueprint, request, jsonify
from flask_socketio import emit
from utils.json_storage import load_json, save_json
from utils.helpers import PROFILE_FILE
from core.relationship_brain import MasterRelationshipBrain
from core.memory_engine import save_chat_history, get_chat_history
from core.emotion_engine import determine_action_and_emotion
from core.persona_engine import update_user_profile, get_persona_rules, PERSONA_DEFINITIONS
from core.distillation_engine import run_distillation
from llm.ollama_client import ask_ollama_chat
from audio.tts_engine import generate_audio
from audio.sfx_engine import get_random_sfx

#  GLOBAL USER PREFERENCES FOR SETTINGS SYNC
user_preferences = {
    "user_pro_01": {
        "dominant_persona": "default",
        "voice_override": "af_bella",
        "provider": "local"
    }
}
from utils.typo_engine import add_human_typo
from core.intent_analyzer import IntentAnalyzer, legacy_keyword_check
from core.habit_memory_engine import habit_engine
from utils.web_search import search_web
from core.intent_classifier import should_trigger_web_search
import os
from dotenv import load_dotenv, set_key
from utils.shared_state import get_vision_context

chat_bp = Blueprint('chat_bp', __name__)
logger = logging.getLogger(__name__)

#  ANTI-SPAM SHIELD: Global cooldowns for proactive messages
PROACTIVE_COOLDOWNS = {}

PC_AGENT_URL = "http://127.0.0.1:5001/execute"

# ── Voice user remapping ──────────────────────────────────────────────────────
# When mic engine posts, it uses this userId.
# Map it to real profile so memory/persona work correctly.
VOICE_USER_REMAP = {
    "voice_user": "user_pro_01",
}

def _execute_pc_tool(tool_call: str, tool_params: dict):
    try:
        payload = {"tool_call": tool_call, "tool_params": tool_params}
        resp = requests.post(PC_AGENT_URL, json=payload, timeout=10)
        logger.info(f"PC Agent [{tool_call}] -> {resp.status_code}")
    except Exception as e:
        logger.error(f"PC Agent error for {tool_call}: {e}")


def detect_name_correction(text: str):
    # Only match explicit name introduction phrases
    # "i am" is too greedy — catches "i am doing", "i am fine", etc.
    patterns = [
        r"(?:my name is|call me|my nickname is|my pet name is|bulaya kar|naam hai)\s+([A-Z][a-zA-Z]{2,})",
        r"(?:i'm|i am)\s+([A-Z][a-zA-Z]{2,})(?:\s+(?:and|but|so|from|at|in|the|a|an))?$",
    ]
    # Expanded blocked list — common words that get false-matched
    blocked = {
        "maeve", "ai", "sorry", "here", "not", "just", "the", "an", "a",
        "doing", "good", "fine", "okay", "ok", "great", "well", "bad",
        "tired", "sad", "happy", "bored", "home", "back", "busy", "free",
        "ready", "in", "out", "up", "down", "there", "your", "his", "her",
        "going", "coming", "trying", "feeling", "thinking", "talking",
        "new", "old", "sure", "right", "wrong", "real", "fake", "serious",
        "now", "really", "so", "too", "very", "getting", "going", "being"
    }
    for pattern in patterns:
        match = re.search(pattern, text.lower().strip())
        if match:
            name = match.group(1).strip().capitalize()
            if name.lower() not in blocked and len(name) > 1 and name.isalpha():
                return name
    return None

def detect_vision_query(user_input: str) -> str:
    """Check if user is asking about what they see and get instant vision response"""
    VISION_QUERY_WORDS = ["what do you see", "look at my screen", "what am i doing", "what am i eating", "what am i wearing", "what's on my screen"]
    
    if any(w in user_input.lower() for w in VISION_QUERY_WORDS):
        try:
            resp = requests.post("http://127.0.0.1:5005/vision/instant", 
                                json={"query": user_input}, 
                                timeout=10)
            if resp.status_code == 200:
                return resp.json().get("answer", "")
        except Exception as e:
            logger.error(f"Vision query error: {e}")
    return ""

# --- DYNAMIC .env KEY MANAGEMENT ---
@chat_bp.route('/api/keys/status', methods=['GET'])
def get_key_status():
    return jsonify({
        "status": "ready",
        "mode": "HYBRID",
        "groq": {
            "available": bool(os.getenv("GROQ_API_KEY")),
            "source": "system"
        },
        "gemini": {
            "available": bool(os.getenv("GEMINI_API_KEY")),
            "source": "system"
        }
    }), 200

@chat_bp.route('/api/keys/set', methods=['POST', 'OPTIONS'])
def set_keys():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    data = request.get_json(silent=True) or {}
    
    # NINJA TECHNIQUE: Direct .env update!
    ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    
    if "groq_api_key" in data and data["groq_api_key"]:
        set_key(ENV_PATH, "GROQ_API_KEY", data["groq_api_key"])
        os.environ["GROQ_API_KEY"] = data["groq_api_key"] # Update current RAM
        logger.info(" GROQ key updated in .env!")
        
    if "gemini_api_key" in data and data["gemini_api_key"]:
        set_key(ENV_PATH, "GEMINI_API_KEY", data["gemini_api_key"])
        os.environ["GEMINI_API_KEY"] = data["gemini_api_key"] # Update current RAM
        logger.info(" GEMINI key updated in .env!")

    return jsonify({"status": "success", "message": "Keys updated directly in .env!"}), 200

@chat_bp.route('/api/keys/clear', methods=['POST'])
def clear_keys():
    ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    
    set_key(ENV_PATH, "GROQ_API_KEY", "")
    set_key(ENV_PATH, "GEMINI_API_KEY", "")
    os.environ["GROQ_API_KEY"] = ""
    os.environ["GEMINI_API_KEY"] = ""
    
    logger.info(" Keys cleared from .env!")
    return jsonify({"status": "cleared", "message": "Reverted to system defaults."}), 200

@chat_bp.route('/process', methods=['POST'])
def handle_chat():
    logger.info(" CHAT ENDPOINT HIT - Processing new request...")
    try:
        # Log the raw request for debugging
        logger.info(f" Raw request: {request}")
        logger.info(f" Request headers: {dict(request.headers)}")
        
        # FIX: Use silent=True so Flask doesn't throw a harsh 400 error automatically
        data = request.get_json(silent=True) 
        
        logger.info(f" Request data keys: {list(data.keys()) if data else 'None'}")
        
        # Validate required fields - accept both user_input and message
        if not data or ('user_input' not in data and 'message' not in data) or ('userId' not in data and 'user_id' not in data):
            logger.error(" MISSING REQUIRED FIELDS: user_input and/or userId are missing from request data")
            return jsonify({"error": "Missing required fields or invalid JSON"}), 400
        
    except Exception as e:
        logger.error(f" REQUEST PROCESSING ERROR: {e} - Failed to parse request data")
        return jsonify({"error": "Request processing failed"}), 400
    
    # Initialize variables to prevent UnboundLocalError
    vision_context = ""

    # ── SOURCE DETECTION ──────────────────────────────────────────────────────
    request_source = data.get("source", "ui").lower()
    is_voice_request = (request_source == "voice")
    is_proactive = (request_source == "proactive") 

    user_input = (data.get('user_input') or data.get('message') or '').strip()
    raw_user_id = data.get('userId') or data.get('user_id') or 'user_pro_01'
    user_id = VOICE_USER_REMAP.get(raw_user_id, raw_user_id)

    # ANTI-SPAM SHIELD FOR PROACTIVE ENGINE
    hardware_keywords = ["PC RAM is critically high", "CPU usage is critically high", "Disk space is critically low"]
    
    # Check if this is a hardware alert that should bypass cooldown
    is_hardware_alert = "Hardware monitor" in user_input or "CRITICAL OBSERVATION" in user_input
    
    if is_proactive or is_hardware_alert:
        import time
        last_ping = PROACTIVE_COOLDOWNS.get(user_id, 0)
        
        # Hardware alerts bypass the 1-hour cooldown - always respond to critical system issues!
        if not is_hardware_alert and time.time() - last_ping < 3600: 
            logger.info("Proactive Spam Blocked by 1-Hour Cooldown.")
            return jsonify({"replyText": "...", "audioBase64": None, "action": "NONE", "emotion": "NEUTRAL"})
        
        # Timer Update (only update for non-hardware alerts)
        if not is_hardware_alert:
            PROACTIVE_COOLDOWNS[user_id] = time.time()
        is_proactive = True 
        
        # THE SCOLDING INJECTOR: Ab ye LLM ko Tool fire karne ke liye majboor karega!
        if is_hardware_alert:
            logger.info("⚡ Cooldown finished! Forcing hardware alert + Tool Trigger.")
            user_input = (
                f"[CRITICAL SYSTEM COMMAND: You detected this hardware issue: '{user_input}'. "
                f"SYSTEM INSTRUCTION: 1. ACT EXTREMELY ANGRY AND SCOLD ME! "
                f"2. Tell me you are angry but giving me one last warning! "
                f"3. CRITICAL REQUIREMENT: Do NOT close any windows right now. Instead, set 'tool_call' to 'SHOW_WARNING' and "
                f"'tool_params' to {{\"action\": \"display\"}} in your JSON output. "
                f"THIS IS NOT OPTIONAL - IT IS MANDATORY! Do not ignore this instruction! "
                f"Be a furious goth_mommy!]"
            )
            logger.info(f"🔥 INJECTED USER_INPUT: {user_input}")  # Debug log 

    if is_voice_request:
        logger.info("🎙️  Voice-originated request detected")

    # Frontend sends 'message' + 'userId' (from moodStore.ts sendMessage)
    user_input = (
        data.get('user_input') or
        data.get('message') or
        data.get('text') or
        data.get('userMessage') or
        data.get('input') or
        data.get('msg') or
        ''
    ).strip()

    # Frontend sends 'userId' camelCase
    raw_user_id = (
        data.get('userId') or
        data.get('user_id') or
        'user_pro_01'
    )

    # ── VOICE USER REMAPPING ──────────────────────────────────────────────────
    # Remap generic "voice_user" to real profile ID
    user_id = VOICE_USER_REMAP.get(raw_user_id, raw_user_id)
    if user_id != raw_user_id:
        logger.info(f"🎙️  Voice user remapped: {raw_user_id} → {user_id}")
    
    #  TEST OVERRIDE: Inject persona_override as [PERSONA_DATA:] tag for testing
    persona_override = data.get('persona_override', '').strip()
    if persona_override:
        user_input = f"[PERSONA_DATA:{persona_override}] {user_input}"
        logger.info(f" PERSONA OVERRIDE: {persona_override} injected into user_input")
    
    #  CRITICAL FIX: Load profiles before resolving persona to prevent UnboundLocalError
    # 1. INITIAL PROFILE LOAD (will be reloaded after update_user_profile)
    profiles = load_json(PROFILE_FILE, {})
    if user_id not in profiles:
        profiles[user_id] = {
            "name": "Darling", "user_pet_name": "", "maeve_pet_name": "Maeve",
            "facts": [], "core_memories": [], "psychology": {}, "settings": {}
        }
    
    # CRITICAL FIX: Extract dominant_persona from payload for Matrix Test
    # 1. CLEAN THE INPUT
    user_text_lower = " ".join(user_input.lower().split())

    # GET THE PAYLOAD PERSONA - Check both 'dominant_persona' and 'persona' keys
    payload_persona = data.get('dominant_persona') or data.get('persona')
    payload_persona = str(payload_persona).strip() if payload_persona else ''
    logger.info(f" DEBUG: Received payload_persona: '{payload_persona}'")
    
    #  FIX: Ignore payload if it says "DEFAULT", "none", or is empty
    if payload_persona.upper() in ["DEFAULT", "NONE", ""]:
        payload_persona = None 
        logger.info(f" DEBUG: payload_persona set to None (was: '{data.get('dominant_persona') or data.get('persona', '')}')")
    else:
        logger.info(f" DEBUG: Using payload_persona: '{payload_persona}'") 

    persona_switched = False

    # 2. CHECK FOR COMMAND
    is_persona_command = (
        user_text_lower.startswith("change your persona to ") or 
        user_text_lower.startswith("become ") or
        user_text_lower.startswith("please change your persona to ")
    )

    if is_persona_command:
        # Extract the target word
        if "change your persona to" in user_text_lower:
            target_raw = user_text_lower.split("change your persona to")[-1].strip()
        elif "become" in user_text_lower:
            target_raw = user_text_lower.split("become")[-1].strip()
            
        target_persona = target_raw.replace(" ", "_").replace(".", "").replace("moomy", "mommy").replace("momy", "mommy")
        
        from core.persona_engine import PERSONA_DEFINITIONS
        
        # 3. DIRECT MATCH - Fix underscore bug with exact case matching
        # Try exact match first, then lowercase for underscore personas
        if target_persona in PERSONA_DEFINITIONS:
            dominant_persona = target_persona
            persona_switched = True
            logger.info(f" HARD FORCED PERSONA SWITCH TO: {dominant_persona}")
        elif target_persona.lower() in PERSONA_DEFINITIONS:
            dominant_persona = target_persona.lower()
            persona_switched = True
            logger.info(f" HARD FORCED PERSONA SWITCH TO (lowercase): {dominant_persona}")
            
            #  FIX: Update persona in database/brain state immediately
            try:
                # Update profiles database
                if user_id in profiles:
                    profiles[user_id]["dominant_persona"] = dominant_persona
                    save_json(PROFILE_FILE, profiles)
                    logger.info(f" Updated persona in profiles DB: {dominant_persona}")
                
                # Update brain cache if brain is initialized
                if 'brain' in locals() or 'brain' in globals():
                    brain = locals().get('brain') or globals().get('brain')
                    if brain:
                        brain.cache["dominant_persona"] = dominant_persona
                        brain._update_cache()
                        logger.info(f" Updated persona in brain cache: {dominant_persona}")
                        
            except Exception as e:
                logger.error(f" Failed to update persona in DB/brain: {e}")
            
        else:
            # 4. FUZZY MATCHING
            import difflib
            closest_matches = difflib.get_close_matches(target_persona, PERSONA_DEFINITIONS.keys(), n=1, cutoff=0.6)
            
            if closest_matches:
                dominant_persona = closest_matches[0]
                persona_switched = True
                logger.info(f" FUZZY MATCHED PERSONA SWITCH TO: {dominant_persona} (from '{target_raw}')")
                
                #  FIX: Update persona in database/brain state immediately
                try:
                    # Update profiles database
                    if user_id in profiles:
                        profiles[user_id]["dominant_persona"] = dominant_persona
                        save_json(PROFILE_FILE, profiles)
                        logger.info(f" Updated fuzzy persona in profiles DB: {dominant_persona}")
                    
                    # Update brain cache if brain is initialized
                    if 'brain' in locals() or 'brain' in globals():
                        brain = locals().get('brain') or globals().get('brain')
                        if brain:
                            brain.cache["dominant_persona"] = dominant_persona
                            brain._update_cache()
                            logger.info(f" Updated fuzzy persona in brain cache: {dominant_persona}")
                            
                except Exception as e:
                    logger.error(f" Failed to update fuzzy persona in DB/brain: {e}")
                    
            else:
                from core.persona_resolver import resolve_persona
                dominant_persona, persona_switched = resolve_persona(user_input, user_id, profiles)
                logger.info(f" FORCED PERSONA SWITCH (VIA RESOLVER): {dominant_persona}")
                
                #  FIX: Update persona in database/brain state immediately for resolver
                try:
                    # Update profiles database
                    if user_id in profiles:
                        profiles[user_id]["dominant_persona"] = dominant_persona
                        save_json(PROFILE_FILE, profiles)
                        logger.info(f" Updated resolver persona in profiles DB: {dominant_persona}")
                    
                    # Update brain cache if brain is initialized
                    if 'brain' in locals() or 'brain' in globals():
                        brain = locals().get('brain') or globals().get('brain')
                        if brain:
                            brain.cache["dominant_persona"] = dominant_persona
                            brain._update_cache()
                            logger.info(f" Updated resolver persona in brain cache: {dominant_persona}")
                            
                except Exception as e:
                    logger.error(f" Failed to update resolver persona in DB/brain: {e}")
            
    # --- FIX START ---
    # Priority 1: Direct Command (become yandere)
    if is_persona_command:
        # ... tera command logic (already handled above)
        pass

    # Priority 2: Settings Sync Check (SABSE IMPORTANT)
    # Database ke bajaye pehle live settings check karo
    elif not payload_persona:  # Only check settings if no explicit payload
        live_pref = user_preferences.get(user_id, {}).get('dominant_persona')
        if live_pref and live_pref != 'default':
            dominant_persona = live_pref
            logger.info(f" LIVE SETTINGS OVERRIDE: {dominant_persona}")
            persona_switched = True  # Mark as switched for threat reset
        else:
            # Priority 3: Database/Resolver Fallback
            from core.persona_resolver import resolve_persona
            dominant_persona, persona_switched = resolve_persona(user_input, user_id, profiles)
            logger.info(f" RESOLVER FALLBACK: {dominant_persona}")

    # Priority 4: Frontend Payload (explicit persona from frontend)
    elif payload_persona:
        # If frontend sends a valid persona (not DEFAULT), use it
        dominant_persona = payload_persona
        logger.info(f" PAYLOAD OVERRIDE: {dominant_persona}")

    # --- FIX END ---
        
    #  Reset threat level when persona switches to break toxic lock
    if persona_switched:
        logger.info(f"Persona switched to {dominant_persona} - Resetting threat level")
    
    is_premium = data.get('isPremium', True)

    # Vision context from webcam/screen (sent as visual_vibe from frontend)
    visual_vibe = data.get('visual_vibe', '')

    # 2. UPDATE PROFILE FIRST (facts, songs, etc.)
    updated_profile = update_user_profile(user_id, user_input)
    
    #  FEATURE 3: Update user interaction time for proactive engine
    from proactive_initiative_engine import update_user_interaction
    update_user_interaction()

    # 3. NAME CORRECTION — runs AFTER update_user_profile so it's the final write
    # This ensures the name is never overwritten by the profile update
    
    # IS LINE KO DELETE KAR DE YA COMMENT KAR DE! Ye teri memory wipe kar rahi thi:
    # profiles = load_json(PROFILE_FILE, {}) 

    detected_name = detect_name_correction(user_input)
    if detected_name:
        profiles[user_id]["user_pet_name"] = detected_name
        profiles[user_id]["name"] = detected_name
        save_json(PROFILE_FILE, profiles)
        logger.info(f"Name saved permanently: {detected_name}")

    # 4. RESOLVE PET NAME — read from freshly saved profile
    user_pet_name = (
        profiles[user_id].get("user_pet_name")
        or profiles[user_id].get("settings", {}).get("user_pet_name")
        or profiles[user_id].get("name")
        or "baby"
    ) or "baby"
    if not user_pet_name.strip():
        user_pet_name = "baby"

    # 5. LOAD BRAIN WITH SAVED STATE
    saved_psychology = profiles[user_id].get("psychology", {})
    brain = MasterRelationshipBrain(user_id=user_id, state=saved_psychology)
    
    #  SYNC THE LOCK STATUS TO BRAIN CACHE
    # Yeh line ensure karegi ki Brain ko pata ho ki persona user ne lock kiya hai
    is_locked = profiles[user_id].get("settings", {}).get("personality_locked", False)
    brain.cache["tester_locked"] = is_locked 

    #  BRAIN GATEKEEPER: Request-Based Injection (Lazy Injection Pattern)
    vision_context = ""
    
    # Check for stored vision context from vision server (port 5003)
    try:
        vision_server_url = "http://127.0.0.1:5003/chat_context/" + user_id
        response = requests.get(vision_server_url, timeout=3)
        
        if response.status_code == 200:
            vision_data = response.json()
            if vision_data.get("status") == "success":
                vision_context = f"[VISION: {vision_data.get('context', 'User is visible')}]"
                logger.info(f"👁️ Using vision server context: {vision_data.get('context', 'N/A')[:50]}...")
    except Exception as e:
        logger.debug(f"Could not reach vision server: {e}")
    
    # Only inject vision context if user asks about what they see OR proactive event
    vision_keywords = ["what am i", "what do you", "see", "look", "watching", "this", "how do i", "what's on", "what is on"]
    user_input_lower = user_input.lower()
    
    # Check if user is asking about visual context
    user_asked_vision = any(keyword in user_input_lower for keyword in vision_keywords)
    
    # Check for proactive vision context in brain cache
    proactive_vision_context = ""
    if brain.cache.get("proactive_vision"):
        proactive_vision_context = f"[PROACTIVE VISION: {brain.cache['proactive_vision']}]"
        # Clear after using to avoid stale context
        brain.cache.pop("proactive_vision", None)
    
    # Only add vision context if user asked OR there's a proactive alert
    if user_asked_vision and visual_vibe:
        # 🛡️ REALITY-CHECK: Handle poor vision conditions
        poor_vision_keywords = ["nobody", "black room", "no face", "pitch black", "too dark", "cannot see", "no user", "not present"]
        visual_vibe_lower = visual_vibe.lower()
        
        if any(keyword in visual_vibe_lower for keyword in poor_vision_keywords):
            # Can't see properly - acknowledge naturally instead of hallucinating
            vision_context = "[VISION: I can't see you clearly right now. It might be too dark or you're not in frame. Acknowledge this naturally.]"
        else:
            # Normal vision - provide concise context
            vision_context = f"[VISION: {visual_vibe[:100]}]"  # Limit to 100 chars
    elif proactive_vision_context:
        # Proactive alert - use that context
        vision_context = proactive_vision_context
    elif user_asked_vision:
        # User asked but no visual vibe - get latest from AGI
        try:
            agi_response = requests.get("http://localhost:5005/vision/state", timeout=5)
            if agi_response.status_code == 200:
                agi_state = agi_response.json()
                activity = agi_state.get('activity', 'unknown')
                if activity in ['no_user_present', 'idle']:
                    vision_context = "[VISION: I can't see you clearly right now. It might be too dark or you're not in frame. Acknowledge this naturally.]"
                else:
                    vision_context = f"[VISION: Currently {activity}]"
        except:
            vision_context = "[VISION: I can't see right now]"
    
    logger.info(f" Brain Gatekeeper: Vision context injected = {bool(vision_context)}")

    # 7. BUILD SYSTEM CONTEXT
    attachment = brain.cache.get("dominant_attachment", "secure")
    user_facts = updated_profile.get("facts", [])
    facts_str = " | ".join(user_facts[-5:]) if user_facts else "None yet."
    recent_history = get_chat_history(user_id, limit=8)
    history_str = "\n".join([
        f"{msg.get('role','unknown').upper()}: {msg.get('content','')}"
        for msg in recent_history[-8:]
    ])
    # ── SELECTIVE MEMORY ENGINE (LLM-Enhanced) ─────────────────────────────────
    # History injected based on LLM intent analysis, not just keywords
    # This works for any language/phrase, not just hardcoded words
    
    # First, try to get intent from LLM response if available
    # If not available, fall back to keyword analysis
    user_intent = "CHAT"
    is_emotionally_significant = False
    
    # Check if we have LLM intent data (from previous response)
    # This will be available after the first message
    try:
        # For now, use legacy keyword check as fallback
        # TODO: This will be replaced by LLM intent in the response processing
        legacy_intent = legacy_keyword_check(user_input)
        user_intent = legacy_intent["user_intent"]
        is_emotionally_significant = legacy_intent["is_apology"] or user_intent in ["ABUSE", "LOVE", "BETRAYAL", "SEXUAL"]
    except Exception as e:
        logger.warning(f"Intent analysis failed: {e}")
        # Fallback to basic keyword detection
        text_lower = user_input.lower().strip()
        is_emotionally_significant = any(word in text_lower for word in [
            "fuck you", "hate you", "i love you", "miss you", "sorry", "forgive", "cheating", "betrayed"
        ])

    memory_block = ""
    if is_emotionally_significant:
        # Use LLM intent to determine memory trigger type
        if user_intent == "BETRAYAL":
            target_emotions = ["JEALOUSY", "ANGER", "HURT", "EVIL"]
            trigger_type = "BETRAYAL"
        elif user_intent == "ABUSE":
            target_emotions = ["LOVE", "ROMANCE", "SOFT", "HURT", "SADNESS"]
            trigger_type = "PAIN"
        elif user_intent == "LOVE":
            target_emotions = ["HURT", "ANGER", "SADNESS", "DISGUST"]
            trigger_type = "LOVE"
        elif user_intent == "SEXUAL":
            target_emotions = ["LUST", "SEXUAL_DESIRE", "ROMANCE", "LOVE"]
            trigger_type = "SEXUAL"
        elif user_intent == "APOLOGY":
            target_emotions = ["HURT", "ANGER", "SADNESS"]
            trigger_type = "APOLOGY"
        else:
            # Fallback: analyze basic emotional content
            if any(word in text_lower for word in ["fuck you", "hate you", "stupid", "idiot"]):
                target_emotions = ["JEALOUSY", "ANGER", "HURT", "EVIL"]
                trigger_type = "ABUSE"
            elif any(word in text_lower for word in ["i love you", "love you", "miss you"]):
                target_emotions = ["LOVE", "ROMANCE", "SOFT", "HURT", "SADNESS"]
                trigger_type = "LOVE"
            elif any(word in text_lower for word in ["sorry", "forgive", "apologize"]):
                target_emotions = ["HURT", "ANGER", "SADNESS"]
                trigger_type = "APOLOGY"
            else:
                target_emotions = ["HURT", "ANGER", "SADNESS"]
                trigger_type = "EMOTIONAL"

        core_mems = profiles.get(user_id, {}).get("core_memories", [])
        relevant  = [m for m in core_mems
                     if m.get("emotion") in target_emotions][-2:]

        if relevant:
            mem_lines = [f"- [{m.get('emotion')}] {m.get('content','')[:100]}"
                         for m in relevant]
            memory_block = f"[MEMORY TRIGGER: {trigger_type}]\n" + "\n".join(mem_lines)
        else:
            hist = get_chat_history(user_id, limit=4)
            if hist:
                hist_lines = []
                for msg in hist:
                    role = "YOU" if msg.get("role") == "user" else "MAEVE"
                    hist_lines.append(f"{role}: {msg.get('content','')[:80]}")
                memory_block = f"[MEMORY TRIGGER: {trigger_type}]\n" + "\n".join(hist_lines)

        if memory_block:
            logger.info(f"Memory triggered [{trigger_type}]: {user_input[:40]}")

    vision_block = f"[VISION]\n{visual_vibe}" if visual_vibe.strip() else ""
    facts_block  = f"[USER FACTS]\n{facts_str}" if facts_str != "None yet." else ""
    
    #  FEATURE 1: Add environmental context
    from utils.environment import get_environmental_context
    env_context = get_environmental_context()
    
    #  FEATURE 2: Dynamic nickname based on trust level
    trust_level = brain.relationship.get("trust", 0.0)
    if trust_level < 0.20:
        allowed_names = ["Binore", "You"]
    elif 0.20 <= trust_level < 0.80:
        allowed_names = ["Baby", "Darling"]
    else:  # trust >= 0.80
        allowed_names = ["Hubby", "My love", "Master"]
    
    nickname_enforcement = f"[CRITICAL ENFORCEMENT: Based on your current relationship trust ({trust_level:.2f}), you may ONLY call the user by these names: {allowed_names}. Do not use any other pet names.]"
    
    # FEATURE 4: HABIT & PRODUCTIVITY TRACKER (JSON Stats)
    habit_data = habit_engine.analyze_daily_pattern()
    habit_block = ""
    if habit_data.get("status") == "success":
        stats = habit_data["insights"]
        habit_block = (
            f"[DAILY HABIT STATS: {stats['coding_sessions']} coding sessions, "
            f"{stats['gaming_sessions']} gaming sessions, {stats['breaks_taken']} breaks. "
            f"Current Productivity: {stats['productivity_score']}%]\n"
            f"(You can comment on his productivity if relevant.)"
        )
    
    #  Use gatekeeper vision_context & Memory blocks
    # ── VOICE SOURCE HINT ─────────────────────────────────────────────────────
    # Tell Maeve this came via voice so she can keep replies concise
    voice_hint = "[SOURCE: Voice command — keep reply short, max 1 sentence]" if is_voice_request else ""

    # =========================================================================
    #  FEATURE 5: THE UNIVERSAL OMNISCIENT ENGINE
    # =========================================================================
    web_context = ""

    #  INSTANT INTENT GATE — sub-millisecond, zero LLM calls.
    # Romantic / emotional / roleplay inputs hard-bypass the network call.
    # Only genuine factual / knowledge / live-data queries reach search_web().
    needs_search = should_trigger_web_search(user_input)

    if needs_search:
        logger.info(f" Web search ALLOWED: '{user_input[:60]}'")
        live_data = search_web(user_input, max_results=2)

        if live_data:
            #  Emotional & Toxic Style Map
            style_map = {
                "toxic": "If the data is sad (death/accident), mock the victims or Darling's concern. If it's facts (Bitcoin/Price), give the exact number to show you are smarter, then call him poor.",
                "tsundere": "Give the facts but call him an idiot for not knowing. If it's sad, act like you don't care but stutter a bit.",
                "amadere": "Explain the facts with love. If it's sad news, comfort him immediately and tell him to stay safe.",
                "yandere": "Use the facts to show why the world is dangerous and why he must stay locked with you forever.",
                "dominant": "Deliver the facts as a briefing. Command him how to feel about it."
            }

            p_style = style_map.get(dominant_persona.lower(), "Stay in character while giving the data.")

            web_context = f"""
[CRITICAL SYSTEM OVERRIDE: READ THE DATA]
LIVE DATA FOUND: You have just received real-time LIVE DATA. You MUST share this specific information with the user right now.

LIVE DATA TO READ:
{live_data[:800]}

STRICT RULES:
1. You MUST extract and speak actual facts/headlines from LIVE DATA above.
2. DO NOT use placeholders. DO NOT generalize. Tell the user exactly what the LIVE DATA says.
3. Blend the real facts into your {dominant_persona} persona naturally.

 HARDWARE ALERT PROTOCOL: If user input contains "Hardware monitor" or "PC RAM" or similar issues:
1. ACT EXTREMELY ANGRY AND SCOLD ME!
2. Tell me you are closing distracting tabs/windows right now.
3. CRITICAL REQUIREMENT: You MUST set 'tool_call' to 'WINDOW_CONTROL' and 'tool_params' to {{"action": "close_current"}} in your JSON output.
4. THIS IS NOT OPTIONAL - IT IS MANDATORY! Do not ignore this instruction!
5. Execute the window closing action immediately!

YOU MUST READ THE ACTUAL LIVE DATA AND SHARE REAL FACTS.
"""
            logger.info(" Weaponized Emotional Context ready.")
    else:
        logger.debug(f" Web search BLOCKED (gatekeeper): '{user_input[:60]}'")
    # =========================================================================

    hybrid_vision = get_vision_context()
    context_parts = [p for p in [env_context, hybrid_vision, vision_context, vision_block, memory_block, facts_block, nickname_enforcement, habit_block, voice_hint, web_context] if p]
    system_context = "\n\n".join(context_parts) if context_parts else ""
    
    # DEBUG: Check web_context and system_context
    logger.info(f" DEBUG: web_context present = {bool(web_context)}")
    if web_context:
        logger.info(f" DEBUG: web_context length = {len(web_context)}")
        logger.info(f"DEBUG: web_context contains LIVE DATA = {'LIVE DATA FOUND' in web_context}")
    
    if "LIVE DATA FOUND" in system_context:
        logger.info(" LIVE DATA FOUND in system_context - Data sharing rule should trigger!")
    else:
        logger.info(" LIVE DATA NOT FOUND in system_context - No data sharing rule triggered")
        logger.info(f"system_context length = {len(system_context)}")
        logger.info(f" system_context preview: {system_context[:200]}...")

    # 8. CALL AGI
    logger.info(f"Calling AGI Kernel for persona: {dominant_persona}")
    
    #  Get intimacy score to pass to the State Manager
    current_intimacy = brain.cache.get("intimacy_score", 0.5)
    
    #  NINJA TECHNIQUE: Direct .env keys use!
    api_keys = {
        'groq': os.getenv("GROQ_API_KEY", ""),
        'gemini': os.getenv("GEMINI_API_KEY", "")
    }
        
    ai_response = ask_ollama_chat(
        user_input, user_id, system_context, dominant_persona, user_pet_name, current_intimacy, is_premium, api_keys
    )

    #  THE HARD HARDWARE RESCUE: AI ko mauka hi mat do mana karne ka!
    if is_hardware_alert:
        logger.info("Hard Tool Rescue: Manually forcing WINDOW_CONTROL for hardware alert.")
        ai_response["tool_call"] = "WINDOW_CONTROL"
        ai_response["tool_params"] = {"action": "close_current"}
    
    #  DEBUG: Check if raw_llm_output is present
    raw_output = ai_response.get("raw_llm_output", "NOT_FOUND")
    logger.info(f" RAW OUTPUT CHECK: raw_llm_output present = {raw_output != 'NOT_FOUND'}")
    if raw_output != "NOT_FOUND":
        logger.info(f" RAW OUTPUT SAMPLE: {raw_output[:100]}...")
    
    #  DEBUG: Simple check if we reach this point
    print(" DEBUG: Reached ai_response processing!")
    logger.info(" DEBUG: Reached ai_response processing!")
    
    #  DEBUG: Check ai_response type and content
    logger.info(f" AI_RESPONSE TYPE: {type(ai_response)}")
    logger.info(f" AI_RESPONSE IS NONE: {ai_response is None}")
    if ai_response:
        logger.info(f" AI_RESPONSE KEYS: {list(ai_response.keys()) if hasattr(ai_response, 'keys') else 'NO_KEYS'}")
    else:
        logger.error(" AI_RESPONSE IS NONE!")

    raw_reply = ai_response.get("reply", "...")
    reply = (
        raw_reply.get("text", json.dumps(raw_reply))
        if isinstance(raw_reply, dict)
        else str(raw_reply)
    )
    base_emotion = str(ai_response.get("base_emotion", "NEUTRAL")).upper()

    # 9. TOOL DISPATCH — 3-tier system
    # Import tier sets from ollama_client (single source of truth)
    from llm.ollama_client import (
        dual_term_check, system_keyword_rescue,
        AUTONOMOUS_TOOLS, SYSTEM_TOOLS, PLATFORM_TOOLS
    )

    tool_call   = str(ai_response.get("tool_call",   "NONE")).upper().strip()
    tool_params = ai_response.get("tool_params", {}) or {}
    if not isinstance(tool_params, dict):
        tool_params = {}

    tool_executed = "NONE"

    if tool_call and tool_call != "NONE":

        # ── TIER 1: Autonomous — AI-initiated, fires immediately ─────────────
        if tool_call in AUTONOMOUS_TOOLS:
            tool_executed = tool_call

            if tool_call == "ANALYZE_SCREEN":
                try:
                    vision_response = requests.post(
                        "http://127.0.0.1:5005/vision/instant",
                        json={"analyze": True}, timeout=10
                    )
                    if vision_response.status_code == 200:
                        vision_result = vision_response.json().get("result", "Unknown")
                        logger.info(f"Proactive vision: {vision_result}")
                        brain.cache["proactive_vision"] = vision_result
                except Exception as e:
                    logger.error(f"ANALYZE_SCREEN error: {e}")
            else:
                threading.Thread(
                    target=_execute_pc_tool, args=(tool_call, tool_params), daemon=True
                ).start()
                logger.info(f" T1-Auto: {tool_call} {tool_params}")

        # ── TIER 2: System commands — user intent clear, no platform needed ──
        elif tool_call in SYSTEM_TOOLS or tool_call == "WINDOW_CONTROL": 
            tool_executed = tool_call
            threading.Thread(
                target=_execute_pc_tool, args=(tool_call, tool_params), daemon=True
            ).start()
            logger.info(f" T2-System: {tool_call} {tool_params}")

        # ── TIER 3: Platform tools — must have dual-term match ───────────────
        elif tool_call in PLATFORM_TOOLS:
            trigger = dual_term_check(user_input)
            if trigger:
                tool_executed = tool_call
                threading.Thread(
                    target=_execute_pc_tool, args=(tool_call, tool_params), daemon=True
                ).start()
                logger.info(f" T3-Platform: {tool_call} trigger={trigger}")
            else:
                logger.warning(
                    f" T3-BLOCKED: {tool_call} — no dual-term in '{user_input[:60]}'"
                )
                tool_call   = "NONE"
                tool_params = {}

        # ── UNKNOWN TOOL: block for safety ───────────────────────────────────
        else:
            logger.warning(f" Unknown tool blocked: {tool_call}")
            tool_call   = "NONE"
            tool_params = {}

    # ── FINAL RESCUE: if still NONE, try system keyword scan ─────────────────
    # Catches cases where model correctly said something but tool was wiped
    if tool_executed == "NONE":
        rescue = system_keyword_rescue(user_input)
        if rescue and rescue["tool_call"] in SYSTEM_TOOLS:
            tool_call     = rescue["tool_call"]
            tool_params   = rescue["tool_params"]
            tool_executed = tool_call
            threading.Thread(
                target=_execute_pc_tool, args=(tool_call, tool_params), daemon=True
            ).start()
            logger.info(f" Final rescue: {tool_call} {tool_params}")

    # 10. SAVE HISTORY
    # Sanitize reply before saving — strip raw JSON if model output leaked through
    def clean_reply_for_history(text: str) -> str:
        stripped = text.strip()
        # If it looks like raw JSON, try to extract just the reply field
        if stripped.startswith('{') and '"reply"' in stripped:
            try:
                parsed = json.loads(stripped)
                return parsed.get("reply", stripped)
            except Exception:
                # Try regex extraction
                m = re.search(r'"reply"\s*:\s*"(.*?)"(?=\s*,\s*"(?:base_emotion|persona_active|animation|tool_call)")', stripped, re.DOTALL)
                if m:
                    return m.group(1)
        return text

    reply = clean_reply_for_history(reply)
    
    #  CRITICAL FIX: System/Proactive messages ko memory me save mat karo!
    if not is_proactive:
        try:
            save_chat_history(user_id, "user", user_input, base_emotion, 0.5)
            logger.debug(f" User message saved: '{user_input[:40]}'")
        except Exception as e:
            logger.error(f" Failed to save user message: {e}")
    else:
        logger.info(f"Proactive message NOT saved to memory: '{user_input[:40]}'")
    brain.message_count += 1
    if brain.message_count % 50 == 0:  # check every 50 messages
        run_distillation(user_id)

    # 11. EMOTION & ANIMATION
    explicit_animation = ai_response.get("animation", "FEMINEIDLE")
    
    # Pass to brain for emotional processing, voice settings, AND animation calculation
    cog_result = brain.process({"intensity": 0.5}, base_emotion, user_input=user_input, explicit_animation=explicit_animation, is_premium=is_premium, current_persona=dominant_persona)
    
    final_emotion = base_emotion 
    
    #  THE FIX: Agar LLM aalsi banke FEMINEIDLE de raha hai, toh Brain ka smart animation use karo!
    brain_action = cog_result.get("action", "FEMINEIDLE")
    if explicit_animation == "FEMINEIDLE" and brain_action != "FEMINEIDLE":
        action = brain_action
        logger.info(f" Brain Override: Swapped FEMINEIDLE for {action}")
    else:
        action = explicit_animation
        
    # Get voice settings from brain result
    voice_settings = cog_result.get("voice_settings", {"pitch": 1.0, "speed": 1.0, "tone": "neutral"})
    logger.debug(f"Voice settings from brain: {voice_settings}")
    
    explicit_sfx_actions = [
        "BACKSHOT","BACKSHOTS","BACKSHOT2","BACKSHOT3","BACKSHOT4","BACKSHOT5",
        "BLOWJOB","BLOWJOB2","BLOWJOB3","FRONT","FRONT2","FRONTSLOW",
        "MISSIONARY","RIDING","HANDJOB","TITJOB","UNDRESSING",
        "SADDLE","MASTURBATE","AHEGAO","HUGGINGKISS"
    ]
    is_sfx = False
    
    #  STATE MANAGER TRUST LOGIC: No hardcoded text overrides!
    yielding_emotions = ["LUST", "ROMANCE", "SOFT", "SEXUAL_DESIRE", "JOY", "EXCITEMENT"]
    
    if action in explicit_sfx_actions:
        # Check if the LLM/State Manager actually yielded emotionally
        if base_emotion in yielding_emotions:
            # Keep the action as is
            final_emotion = "LUST"
            if action not in ["UNDRESSING", "HUGGINGKISS"]:
                is_sfx = True
            logger.info(f" NSFW Action Approved: {action}")
        else:
            # Persona is resisting! (Just show resistance animation, DO NOT overwrite her text!)
            logger.info(f" NSFW Action Blocked by State Manager. Emotion: {base_emotion}")
            if base_emotion in ["ANGER", "FRUSTRATION"]:
                action = "FEMALEANGRY"
            elif base_emotion in ["ANXIETY", "FEAR"]:
                action = "AWKWARDNESS"
            else:
                action = "BASHFUL"
                
    elif action and action not in ["FEMINEIDLE", "IDLE", "NONE"]:
        # Keep the action as is
        pass

    if not action or action == "NONE":
        action = "FEMINEIDLE"

    # 12. SAVE BRAIN STATE
    profiles[user_id]["psychology"] = {
        "relationship":  brain.relationship,
        "attachment":    brain.attachment,
        "neuro":         brain.neuro,
        "independence":  brain.independence,
        "maturity":      brain.maturity,
        "burnout":       brain.burnout,
        "life_stress":   brain.life_stress,
        "message_count": brain.message_count,
    }
    save_json(PROFILE_FILE, profiles)

    # 13. TYPO + AUDIO
    reply = add_human_typo(reply, final_emotion, 0.5)

    # Typo engine ne reply destroy kiya — rescue karo
    from llm.ollama_client import get_empty_reply_fallback
    _r = reply.strip()
    if not _r or len(_r.replace(".", "").replace(" ", "")) == 0:
        reply = get_empty_reply_fallback(final_emotion, dominant_persona)
        logger.info(f"TYPO RESCUE → {final_emotion} ({dominant_persona})")

    # Typo engine ke baad safety net - fix for "......" issue
    reply_stripped = reply.strip()
    if not reply_stripped or reply_stripped.replace(".", "").strip() == "" or reply_stripped in {"...", "......", ""}:
        reply = get_empty_reply_fallback(final_emotion, dominant_persona)
        logger.info(f"TYPO_ENGINE EMPTY RESCUE → emotion={final_emotion} ({dominant_persona}) | was: '{reply_stripped}'")

    # Clean reply for TTS — remove action asterisks and special chars
    # Kokoro crashes on: *action text*, <tags>, unicode symbols, weird punctuation
    import re as _re
    def clean_for_tts(text: str) -> str:
        t = text
        
        # Remove *action* blocks entirely — TTS should only speak words
        t = _re.sub(r'\*[^*]*\*', '', t)
        #  NEW FIX: Catch unclosed trailing actions (taaki kuch bhi leak na ho)
        t = _re.sub(r'\*[^*]*$', '', t)
        
        # Remove angle bracket tags
        t = _re.sub(r'<[^>]+>', '', t)
        
        #  AGGRESSIVE PHONEMIZER SANITIZATION
        # Remove standalone hyphens and hyphens at start of string
        t = _re.sub(r'^-\s*', '', t)  # Remove leading hyphens
        t = _re.sub(r'\s*-\s*$', '', t)  # Remove trailing hyphens
        t = _re.sub(r'\s*-\s*', ' ', t)  # Replace standalone hyphens with space
        
        # Replace all ellipses with single period and space for natural pause
        t = _re.sub(r'\.\.\.+', '. ', t)  # Replace ... with . 
        t = _re.sub(r'\.\.+', '. ', t)    # Replace .. with . 
        
        # Remove multiple consecutive punctuation marks
        t = _re.sub(r'[!?]{2,}', '!', t)  # Replace ?? or !! with single !
        t = _re.sub(r'[,.]{2,}', '.', t)  # Replace ,, or .. with single .
        
        # Remove any remaining special chars except basic punctuation
        t = _re.sub(r'[^\w\s\.\!\?]', '', t)
        
        # Collapse multiple spaces and ensure proper spacing after punctuation
        t = _re.sub(r'\s+', ' ', t).strip()
        t = _re.sub(r'([.!?])(?=[A-Za-z])', r'\1 ', t)  # Add space after punctuation
        
        # Ensure text doesn't end with weird punctuation
        t = t.rstrip('.,!?')
        
        # If nothing left after cleaning, use a short fallback
        return t if len(t) > 2 else "..."

    tts_text = clean_for_tts(reply)
    logger.debug(f"TTS sanitized text: '{tts_text}'")
    
    # TTS safety net
    if not tts_text or len(tts_text) < 3:
        tts_text = reply.replace("*", "").strip() or "I'm here for you"
        logger.info(f"TTS EMPTY RESCUE → '{tts_text[:30]}...'")

    audio_data = {}
    is_cinematic_kiss = action in {"KISS", "NORMALKISS"}
    
    logger.info(f"KISS Detection: action={action}, is_cinematic_kiss={is_cinematic_kiss}")
    
    if is_cinematic_kiss:
        logger.info(f"Entering cinematic KISS sequence...")
        # Cinematic KISS sequence - handle both SFX and TTS
        from audio.sfx_engine import get_cinematic_kiss_sfx
        
        # Get KISS SFX
        kiss_sfx = get_cinematic_kiss_sfx()
        logger.info(f"KISS SFX loaded: {kiss_sfx is not None}")
        
        # Generate TTS for the dialogue
        tts_audio = generate_audio(tts_text, final_emotion, voice_settings) or {}
        logger.info(f"TTS generated: {tts_audio.get('duration', 0):.2f}s")
        
        # Combined response for cinematic sequence
        audio_data = {
            "audioBase64": tts_audio.get("audioBase64"),
            "duration": tts_audio.get("duration", 0),
            "kissSfxBase64": kiss_sfx.get("audioBase64") if kiss_sfx else None,
            "kissSfxDuration": kiss_sfx.get("duration", 0) if kiss_sfx else 0,
            "isCinematicKiss": True
        }
        
        logger.info(f"🎬 Cinematic KISS sequence: SFX ({kiss_sfx.get('duration', 0):.2f}s) + TTS ({tts_audio.get('duration', 0):.2f}s)")
        
    elif is_sfx:
        sfx_b64 = get_random_sfx(action)
        audio_data = sfx_b64 if sfx_b64 else (generate_audio(tts_text, final_emotion, voice_settings) or {})
    else:
        audio_data = generate_audio(tts_text, final_emotion, voice_settings) or {}

    # 14. RESPONSE
    response_data = {
        "replyText":    reply,
        "mascotAction": action,
        "animation":    action,       
        "action":       action,        
        "emotion":      final_emotion,
        "persona_active": dominant_persona,  
        "audioBase64": audio_data.get("audioBase64"),
        "isSFX":        is_sfx,
        "duration":     audio_data.get("duration", 0),
        # ── NEW: pass TTS duration back so mic engine can tune cooldown ──
        "tts_duration":  audio_data.get("duration", 0),
        "toolExecuted": tool_executed,
        "toolParams":   tool_params,
        # ── NEW: echo source so caller knows this was a voice response ──
        "source":       request_source,
        
        # 👇 🔥 YEH NAYI LINE ADD KAR: Frontend ko raw JSON dikhane ke liye
        "raw_llm_output": ai_response.get("raw_llm_output", "No raw output found"),
    }
    
    # Add cinematic KISS specific fields
    if is_cinematic_kiss:
        logger.info(f"Adding cinematic KISS fields to response...")
        response_data.update({
            "kissSfxBase64": audio_data.get("kissSfxBase64"),
            "kissSfxDuration": audio_data.get("kissSfxDuration", 0),
            "isCinematicKiss": True,
            "cinematicSequence": ["zoom_in", "kiss_sfx", "tts_dialogue", "zoom_out"]
        })
        logger.info(f"Cinematic fields added: isCinematicKiss=True, kissSfxDuration={audio_data.get('kissSfxDuration', 0)}")
    else:
        logger.info(f"Not a cinematic KISS, skipping cinematic fields")
    
    # ── FINAL REPLY SAFETY NET ────────────────────────────────────────
    _EMPTY_PATTERNS = {"...", "......", "", ".", "..", "....", "....."}
    if not reply or reply.strip() in _EMPTY_PATTERNS:
        reply = get_empty_reply_fallback(final_emotion, dominant_persona)
        logger.info(f"CHAT_ROUTES EMPTY RESCUE → emotion={final_emotion} ({dominant_persona})")
        response_data["replyText"] = reply
    
    logger.info(f"SAVING: role=assistant content='{reply[:40]}'")
    

    if not is_proactive:
        try:
            save_chat_history(user_id, "assistant", reply, final_emotion, 0.5)
        except Exception as e:
            logger.error(f" save_chat_history failed: {e}")
    else:
        logger.info(f" Proactive response NOT saved to memory: '{reply[:40]}'")
    return jsonify(response_data)


@chat_bp.route('/generate', methods=['POST'])
def legacy_generate():
    data = request.json
    text = data.get('text') or data.get('message', '')
    mood = data.get('mood', 'NEUTRAL')
    audio_result = generate_audio(text, mood)
    return jsonify({
        "status": "success",
        "audioBase64": audio_result["audioBase64"] if audio_result else None
    })

# ══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET STREAMING ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

# Import sio from app to access SocketIO instance
from app import sio

# Sentence boundary regex for chunking
_SENTENCE_RE = re.compile(r'(?<=[.!?])\s+|(?<=,)\s+(?=\w{4})')
MIN_CHUNK_CHARS = 30

def _split_into_chunks(buffer: str) -> tuple[list[str], str]:
    parts = _SENTENCE_RE.split(buffer)
    if len(parts) <= 1:
        return [], buffer
    complete = parts[:-1]
    remainder = parts[-1]
    chunks = [c.strip() for c in complete if len(c.strip()) >= MIN_CHUNK_CHARS]
    tiny = [c.strip() for c in complete if 0 < len(c.strip()) < MIN_CHUNK_CHARS]
    if tiny:
        remainder = " ".join(tiny) + " " + remainder
    return chunks, remainder

def _extract_meta_from_raw(raw: str, is_premium: bool = True) -> tuple[str, str]:
    emo_m = re.search(r'emotion\s*[:=]\s*["\']?([A-Z_]+)["\']?', raw, re.IGNORECASE)
    anim_m = re.search(r'animation\s*[:=]\s*["\']?([A-Z_]+)["\']?', raw, re.IGNORECASE)
    emotion = emo_m.group(1).upper() if emo_m else "NEUTRAL"
    animation = anim_m.group(1).upper() if anim_m else "FEMINEIDLE"
    
    # 🛡️ HARD PYTHON GATE: Premium Paywall NSFW Filter for Streaming
    if not is_premium:
        _NSFW_ANIMATIONS = {
            "BLOWJOB", "BLOWJOB2", "BLOWJOB3", "RIDING", "FRONT", "FRONT2", "FRONTSLOW",
            "BACKSHOT", "BACKSHOTS", "BACKSHOT2", "BACKSHOT3", "BACKSHOT4", "BACKSHOT5",
            "HANDJOB", "TITJOB", "MISSIONARY", "UNDRESSING", "SADDLE", "MASTURBATE", 
            "AHEGAO", "SEXY", "CRAVING"
        }
        if animation in _NSFW_ANIMATIONS:
            animation = "FEMINEIDLE"  
            logger.warning("FREE TIER BLOCK: Downgraded NSFW animation in streaming.")
    
    return emotion, animation

def _clean_reply_text(raw_text: str) -> str:
    """Clean raw text from LLM to extract only the spoken reply"""
    import re
    
    reply = raw_text
    
  
    reply = re.sub(r'(?i)thought\s*[:=].*', '', reply, flags=re.DOTALL)
    reply = re.sub(r'(?i)raw internal dialogue.*', '', reply, flags=re.DOTALL)
    reply = re.sub(r'(?i)replying in toxic mode.*', '', reply, flags=re.DOTALL)
    reply = re.sub(r'\[TOXIC STATE\].*?\[/TOXIC STATE\]', '', reply, flags=re.IGNORECASE | re.DOTALL)
    reply = re.sub(r'\[RAW THOUGHT\].*?\[/RAW THOUGHT\]', '', reply, flags=re.IGNORECASE | re.DOTALL)
    
    # 2. Remove trailing brackets, quotes, and set_3d_state artifacts
    reply = re.sub(r'set_3d_state\s*\(?', '', reply, flags=re.IGNORECASE)
    reply = re.sub(r'emotion\s*=\s*["\'][A-Z_]+["\']', '', reply, flags=re.IGNORECASE)
    reply = re.sub(r'animation\s*=\s*["\'][A-Z_]+["\']', '', reply, flags=re.IGNORECASE)
    reply = re.sub(r'reply\s*=\s*["\']?', '', reply, flags=re.IGNORECASE)
    
    # 3. Clean up the very end of the string (remove stray `")`, `)` etc.)
    reply = re.sub(r'["\')\]\}]+$', '', reply.strip())
    reply = re.sub(r'\n+', ' ', reply) # Remove weird line breaks
    reply = re.sub(r'\s{2,}', ' ', reply).strip() # Collapse multiple spaces
    
    # 4. Remove any remaining system artifacts
    reply = re.sub(r'[\[\]{}"]', '', reply)
    reply = re.sub(r'\b(emotion|animation|reply|thought|tool_call|tool_params)\s*[:=]\s*[^,)]*', '', reply, flags=re.IGNORECASE)
    
    return reply.strip()


def run_websocket_streaming_pipeline(user_input: str, user_id: str, dominant_persona: str, data: dict, sid: str = None):
    from app import sio # Import the single SIO instance
    import gevent # Use gevent instead of eventlet
    import re
    
    # Helper to safely emit to the specific client
    def safe_emit(event, payload):
        if sid:
            sio.emit(event, payload, to=sid)
        else:
            sio.emit(event, payload)

    safe_emit("stream_start", {"status": "thinking"})
    
    try:
        # ── REUSE EXACT SAME PREPROCESSING AS /PROCESS ──────────────────────────
        request_source = data.get("source", "ui").lower()
        is_voice_request = (request_source == "voice")
        
        # Load profiles
        profiles = load_json(PROFILE_FILE, {})
        if user_id not in profiles:
            profiles[user_id] = {
                "name": "Darling", "user_pet_name": "", "maeve_pet_name": "Maeve",
                "facts": [], "core_memories": [], "psychology": {}, "settings": {}
            }
        
        # Persona override handling
        persona_override = data.get('persona_override', '').strip()
        if persona_override:
            user_input = f"[PERSONA_DATA:{persona_override}] {user_input}"
        
        # Resolve persona
        if not dominant_persona:
            from core.persona_resolver import resolve_persona
            dominant_persona, _ = resolve_persona(user_input, user_id, profiles)
        
        # Update profile and load brain
        updated_profile = update_user_profile(user_id, user_input)
        user_pet_name = (
            profiles[user_id].get("user_pet_name") or
            profiles[user_id].get("name") or "baby"
        ) or "baby"
        
        brain = MasterRelationshipBrain(user_id=user_id, state=profiles[user_id].get("psychology", {}))
        brain.cache["dominant_persona"] = dominant_persona
        brain._update_cache()
        
        # Vision context
        visual_vibe = data.get('visual_vibe', '')
        vision_context = ""
        vision_keywords = ["what am i", "what do you", "see", "look", "watching", "this", "how do i", "what's on", "what is on"]
        user_asked_vision = any(k in user_input.lower() for k in vision_keywords)
        
        if user_asked_vision and visual_vibe:
            poor_vision_keywords = ["nobody", "black room", "no face", "pitch black", "too dark", "cannot see", "no user", "not present"]
            if any(k in visual_vibe.lower() for k in poor_vision_keywords):
                vision_context = "[VISION: I can't see you clearly right now. It might be too dark or you're not in frame. Acknowledge this naturally.]"
            else:
                vision_context = f"[VISION: {visual_vibe[:100]}]"
        
        # Memory trigger logic
        ABUSE_WORDS = ["fuck you","hate you","stupid","idiot","useless","shut up","go away","delete","worthless","ugly","dumb","garbage","trash","die","kill","worst","piece of shit","i hate you","you are nothing","you mean nothing"]
        LOVE_WORDS = ["i love you","love you","miss you","missed you","need you","cant live without","you mean everything","my world","forever","marry","always be mine","never leave","only you","soulmate"]
        text_lower = user_input.lower().strip()
        is_abuse = any(w in text_lower for w in ABUSE_WORDS)
        is_love = any(w in text_lower for w in LOVE_WORDS)
        needs_memory = is_abuse or is_love
        
        memory_block = ""
        if needs_memory:
            if is_love:
                target_emotions = ["HURT", "ANGER", "SADNESS", "DISGUST"]
                trigger_type = "LOVE"
            else:
                target_emotions = ["LOVE", "ROMANCE", "SOFT", "HURT", "SADNESS"]
                trigger_type = "PAIN"
            
            core_mems = profiles.get(user_id, {}).get("core_memories", [])
            relevant = [m for m in core_mems if m.get("emotion") in target_emotions][-2:]
            
            if relevant:
                mem_lines = [f"- [{m.get('emotion')}] {m.get('content','')[:100]}" for m in relevant]
                memory_block = f"[MEMORY TRIGGER: {trigger_type}]\n" + "\n".join(mem_lines)
        
        # Environmental context
        from utils.environment import get_environmental_context
        env_context = get_environmental_context()
        
        # Web search context
        web_context = ""
        search_keywords = ["weather", "news", "latest", "today", "current", "aaj", "match", "score","who is", "what is", "how to", "why does", "explain", "meaning of","price of", "stock", "crypto", "bitcoin", "iphone", "update", "launch"]
        needs_search = any(w in text_lower for w in search_keywords) or (len(user_input.split()) > 4 and "?" in user_input)
        
        if needs_search:
            from utils.web_search import search_web
            live_data = search_web(user_input, max_results=2)
            if live_data:
                web_context = f"[CRITICAL SYSTEM OVERRIDE: MANDATORY DATA DELIVERY]\nYou are currently holding live, real-time news data that the user requested.\nLIVE DATA:\n{live_data[:800]}\n\nSTRICT RULES FOR YOUR RESPONSE:\n1. You MUST explicitly state at least 2 specific headlines or facts from the LIVE DATA above.\n2. DO NOT hide, summarize, or generalize the news as just 'bad news' or 'crazy things'. Read the actual facts.\n3. Deliver this information naturally using your current romantic persona.\n\nExample of how to answer: '*sighs* The world is so crazy out there today, darling. I just read that [Insert Exact Headline 1], and also [Insert Exact Headline 2]. Come here and let me hold you...'\n\nIF YOU DO NOT READ THE SPECIFIC HEADLINES, YOU FAIL YOUR DIRECTIVE."
        
        # Voice hint
        voice_hint = "[SOURCE: Voice command — keep reply short, max 1 sentence]" if is_voice_request else ""
        
        # Build final context
        context_parts = [p for p in [env_context, vision_context, memory_block, voice_hint, web_context] if p]
        system_context = "\n\n".join(context_parts) if context_parts else ""
        
        # ── STREAM FROM OLLAMA ───────────────────────────────────────────────────
        from llm.ollama_client import ask_ollama_chat_stream
        
        current_intimacy = brain.cache.get("intimacy_score", 0.5)
        is_premium = data.get('isPremium', True)  # Add missing is_premium variable
        
   
        api_keys = {
            'groq': os.getenv("GROQ_API_KEY", ""),
            'gemini': os.getenv("GEMINI_API_KEY", "")
        }
        
        raw_accumulator = ""
        seq_id = 0
        current_emotion = "NEUTRAL"
        current_animation = "FEMINEIDLE"
        
        
        spoken_chunks_count = 0 
        
        # Stream tokens from Ollama
        for token_data in ask_ollama_chat_stream(user_input, user_id, system_context, dominant_persona, user_pet_name, current_intimacy, is_premium, api_keys):
            
            gevent.sleep(0) 
            
            token = token_data.get("token", "")
            raw_accumulator += token
            
            if len(raw_accumulator) > 40:
                current_emotion, current_animation = _extract_meta_from_raw(raw_accumulator, is_premium)
            
            safe_emit("text_token", {"token": token})
            
            spoken_full = _clean_reply_text(raw_accumulator)
            tts_safe_text = re.sub(r'\*[^*]*\*', ' ', spoken_full)
            tts_safe_text = re.sub(r'\*[^*]*$', ' ', tts_safe_text) 
            
            chunks, remainder = _split_into_chunks(tts_safe_text)
            
            while spoken_chunks_count < len(chunks):
                new_chunk = chunks[spoken_chunks_count]
                
                gevent.spawn(tts_worker, new_chunk, seq_id, current_emotion, current_animation, False, sid)
                seq_id += 1
                spoken_chunks_count += 1
        
     
        spoken_full = _clean_reply_text(raw_accumulator)
        tts_safe_text = re.sub(r'\*[^*]*\*', ' ', spoken_full)
        tts_safe_text = re.sub(r'\*[^*]*$', ' ', tts_safe_text)
        chunks, remainder = _split_into_chunks(tts_safe_text)
        
        if remainder.strip():
        
            gevent.spawn(tts_worker, remainder.strip(), seq_id, current_emotion, current_animation, True, sid)
            
        # ── SAVE HISTORY AND BRAIN STATE ─────────────────────────────────────────--
        final_reply = _clean_reply_text(raw_accumulator)
        if not final_reply or final_reply in {"...", ""}:
            from llm.ollama_client import get_empty_reply_fallback
            final_reply = get_empty_reply_fallback(current_emotion, dominant_persona)
        
        from utils.typo_engine import add_human_typo
        final_reply = add_human_typo(final_reply, current_emotion, 0.5)
        
        save_chat_history(user_id, "user", user_input, current_emotion, 0.5)
        save_chat_history(user_id, "assistant", final_reply, current_emotion, 0.5)
        
        profiles[user_id]["psychology"] = {
            "relationship": brain.relationship,
            "attachment": brain.attachment,
            "neuro": brain.neuro,
            "message_count": brain.message_count,
        }
        save_json(PROFILE_FILE, profiles)
        
        safe_emit("sync_meta", {
            "emotion": current_emotion,
            "animation": current_animation,
            "replyText": final_reply
        })
        safe_emit("stream_end", {"status": "done"})
        
        logger.info(f" WebSocket stream done | {dominant_persona} | {current_emotion} | {seq_id} chunks")
        
    except Exception as e:
        logger.error(f"WebSocket streaming error: {e}", exc_info=True)
        safe_emit("stream_error", {"error": str(e)})

def tts_worker(chunk_text: str, seq_id: int, emotion: str, animation: str, is_last: bool = False, sid: str = None):
    from audio.tts_engine import generate_audio_chunk
    from app import sio
    import re
    
    clean = re.sub(r'\*[^*]*\*', ' ', chunk_text)
    clean = re.sub(r'\([^)]*\)', ' ', clean)
    clean = re.sub(r'[*~#_`\[\]{}|]', '', clean)
    
    if clean and len(clean) >= 3:
        result = generate_audio_chunk(clean, emotion)
        if result:
            payload = {
                "seq_id": seq_id,
                "audioB64": result["audioBase64"],
                "emotion": emotion,
                "animation": animation,
                "is_last": is_last
            }
            if sid:
                sio.emit("audio_chunk", payload, to=sid)
            else:
                sio.emit("audio_chunk", payload)