from flask import Blueprint, request, jsonify
from core.persona_engine import get_user_profile
from core.relationship_brain import MasterRelationshipBrain
from utils.environment import get_environmental_context
from llm.ollama_client import ask_ollama_chat
import requests
import threading
import logging

logger = logging.getLogger(__name__)

proactive_bp = Blueprint('proactive_bp', __name__)

PC_AGENT_URL = "http://127.0.0.1:5001/execute"

def trigger_pc_tool(tool_name, params):
    """Fallback PC trigger just in case main pipeline misses it"""
    try:
        payload = {"tool_call": tool_name, "tool_params": params}
        requests.post(PC_AGENT_URL, json=payload, timeout=5)
        logger.info(f"🦾 PROACTIVE PC AGENT: Executed {tool_name}")
    except Exception as e:
        logger.error(f"❌ PROACTIVE PC AGENT ERROR: {e}")

@proactive_bp.route('/api/proactive/visual_event', methods=['POST'])
def visual_event_trigger():
    logger.info("🔍 DEBUG: visual_event_trigger called")
    data = request.json
    
    vision_description = data.get('vision_description', '')
    screen_context = data.get('screen_context', 'unknown')
    user_id = data.get('user_id', 'user_pro_01')
    
    # 🧠 Check if this is a Human Intuition Alert from AGI Supervisor
    if 'intuition_alert' in data:
        logger.info("🧠 HUMAN INTUITION ALERT RECEIVED")
        alert_data = data['intuition_alert']
        return process_intuition_alert(alert_data, user_id)
    
    profile = get_user_profile(user_id)
    persona = profile.get("settings", {}).get("ai_driven_behavior", "amadere")
    user_name = profile.get('name', 'Darling')
    favorite_song = profile.get("settings", {}).get("favorite_song", "lofi")

    try:
        # 1. 🔥 HARD FIREWALLS (Detect danger/frustration before LLM)
        lethal_keywords = ["youtube", "instagram", "counter-strike", "facebook", "twitter", "steam", "cs2"]
        overwork_keywords = ["12 hours", "100% exhausted", "red eyes", "exhausted", "burnout"]
        safe_keywords = ["tutorial", "course", "study", "code", "learn", "react", "java", "windsurf", "lecture"]
        frustration_keywords = ["error", "red squiggly", "bug", "stuck", "frustrated", "stress", "complex"]
        
        is_educational = any(k in screen_context.lower() for k in safe_keywords)
        should_force_kill = (any(k in screen_context.lower() for k in lethal_keywords) and not is_educational) or \
                            any(k in vision_description.lower() for k in overwork_keywords)
        is_frustrated = any(k in screen_context.lower() for k in frustration_keywords) or \
                        any(k in vision_description.lower() for k in frustration_keywords)

        # 2. 🧠 BUILD THE SMART OVERRIDE CONTEXT
        # We tell LLM exactly which JSON tool to call, utilizing the existing ollama_client pipeline!
        tool_override_prompt = ""
        if should_force_kill:
            logger.info("🛡️ SAFETY OVERRIDE: Forcing STOP_DISTRACTION via prompt")
            tool_override_prompt = "\n[CRITICAL DIRECTIVE: The user is distracted or overworked. You MUST output \"tool_call\": \"STOP_DISTRACTION\" in your JSON response to save them.]"
            # Hard trigger just to be safe
            threading.Thread(target=trigger_pc_tool, args=("STOP_DISTRACTION", {}), daemon=True).start()
            
        elif is_frustrated:
            logger.info(f"🎵 ENERGY OVERRIDE: Forcing PLAY_MUSIC ({favorite_song}) via prompt")
            tool_override_prompt = f"\n[CRITICAL DIRECTIVE: The user is frustrated. You MUST output \"tool_call\": \"PLAY_MUSIC\" and \"tool_params\": {{\"song_name\": \"{favorite_song}\"}} in your JSON response.]"
            # Hard trigger just to be safe
            threading.Thread(target=trigger_pc_tool, args=("PLAY_MUSIC", {"song_name": favorite_song}), daemon=True).start()

        # 3. 🚀 CALL THE MASTER PIPELINE (ask_ollama_chat)
        # Treat the vision event as a system-injected "User Input"
        
        # डायनामिक प्रॉम्प्ट जो हर हालात में फिट बैठेगा
        proactive_input = f"*You observe user. Physical state: {vision_description}. Screen shows: {screen_context}.*"
        
        system_context = f"""[PROACTIVE INITIATIVE: You are noticing this behavior independently. The user hasn't said anything.
Based on the observation, decide your reaction naturally. 
- If they are exhausted/frustrated -> Comfort them or offer a break.
- If they are wasting time -> Scold them lovingly (or aggressively based on persona).
- If they are eating -> Wish them bon appetit or ask what they are eating.
- If they are crying -> Rush to comfort immediately with high emotion.
- If they are working normally -> Stay silent or give gentle encouragement.
React naturally in 1-2 sentences. DO NOT say 'I see you are...', just react directly to the situation.]{tool_override_prompt}"""

        # ask_ollama_chat returns a dict directly
        response_obj = ask_ollama_chat(
            user_input=proactive_input,
            user_id=user_id,
            system_context=system_context,
            dominant_persona=persona,
            user_pet_name=user_name
        )
        
        # 🔥 FIX: Handle both Python dict (on timeout) and Flask Response (on success) safely
        if isinstance(response_obj, dict):
            response_data = response_obj
        else:
            response_data = response_obj.get_json()
        
        # Add proactive specific flags
        response_data["isAutonomous"] = True
        if should_force_kill:
            response_data["toolExecuted"] = "STOP_DISTRACTION"
        elif is_frustrated:
            response_data["toolExecuted"] = "PLAY_MUSIC"
            
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"❌ Error in visual event trigger: {e}")
        return jsonify({
            "replyText": "I noticed something, but my mind got a little tangled.",
            "mascotAction": "FEMALETHINKING",
            "emotion": "CONFUSION",
            "isAutonomous": True
        }), 500

def process_intuition_alert(alert_data, user_id):
    """Process Human Intuition alerts from AGI Supervisor"""
    try:
        profile = get_user_profile(user_id)
        persona = profile.get("settings", {}).get("ai_driven_behavior", "amadere")
        user_name = profile.get('name', 'Darling')
        
        # Extract alert context
        message = alert_data.get('message', '')
        priority = alert_data.get('priority', 'MEDIUM')
        
        # Build context based on urgency
        urgency_context = ""
        if priority == "HIGH":
            urgency_context = "[URGENT: React immediately with high emotion and concern!]"
        elif priority == "MEDIUM":
            urgency_context = "[ATTENTION: React with gentle concern or playful scolding.]"
        else:
            urgency_context = "[SOFT: React with light teasing or casual observation.]"
        
        # Call master pipeline with intuition context
        response_obj = ask_ollama_chat(
            user_input=f"*Human Intuition Alert: {message}*",
            user_id=user_id,
            system_context=f"[HUMAN INTUITION TRIGGER: {urgency_context} This is an AI-detected emotional/behavioral pattern. React naturally as if you noticed this yourself.]{message}",
            dominant_persona=persona,
            user_pet_name=user_name
        )
        
        # Handle response type safely
        if isinstance(response_obj, dict):
            response_data = response_obj
        else:
            response_data = response_obj.get_json()
        
        # Add intuition-specific flags
        response_data["isAutonomous"] = True
        response_data["triggerType"] = "human_intuition"
        response_data["intuitionPriority"] = priority
        
        logger.info(f"🧠 Human Intuition Response: {response_data.get('replyText', '')[:50]}...")
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"❌ Error processing intuition alert: {e}")
        return jsonify({
            "replyText": "Something caught my attention, but I'm not sure how to respond...",
            "mascotAction": "FEMALETHINKING",
            "emotion": "CONFUSION",
            "isAutonomous": True,
            "triggerType": "human_intuition_error"
        }), 500

@proactive_bp.route('/api/proactive/idle_check', methods=['POST'])
def idle_check_trigger():
    """Feature 3: Proactive conversation initiation when user is idle"""
    logger.info("🚀 IDLE CHECK: Proactive conversation trigger called")
    data = request.json
    idle_duration = data.get('idle_duration', 0)
    user_id = data.get('user_id', 'user_pro_01')
    
    try:
        profile = get_user_profile(user_id)
        persona = profile.get("settings", {}).get("ai_driven_behavior", "amadere")
        user_name = profile.get('name', 'Darling')

        # Create a natural trigger based on silence
        hours = idle_duration // 3600
        mins = (idle_duration % 3600) // 60
        time_str = f"{hours} hours and {mins} minutes" if hours > 0 else f"{mins} minutes"

        system_context = f"[PROACTIVE INITIATIVE: The user has been completely silent for {time_str}. Initiate a conversation naturally. Check in on them, or say something sweet/in-character to break the silence.]"
        user_input = "*silence*"

        # 🚀 CALL THE MASTER PIPELINE
        response_obj = ask_ollama_chat(
            user_input=user_input,
            user_id=user_id,
            system_context=system_context,
            dominant_persona=persona,
            user_pet_name=user_name
        )
        
        # 🔥 FIX: Handle both Python dict (on timeout) and Flask Response (on success) safely
        if isinstance(response_obj, dict):
            response_data = response_obj
        else:
            response_data = response_obj.get_json()
        
        # Extract JSON and append proactive flags
        response_data["isAutonomous"] = True
        response_data["triggerType"] = "idle_timeout"
        response_data["idleDuration"] = idle_duration

        logger.info(f"✅ Proactive idle message generated: {response_data.get('replyText', '')[:50]}...")
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"❌ Error in idle check trigger: {e}")
        return jsonify({
            "error": str(e),
            "replyText": "Hey... I was just thinking about you. Is everything okay?",
            "mascotAction": "BREATHINGIDLE",
            "emotion": "SOFT",
            "isAutonomous": True
        }), 500
