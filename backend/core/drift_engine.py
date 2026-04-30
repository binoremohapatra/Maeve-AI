import time
import datetime
import logging
import requests
from utils.json_storage import load_json, save_json
from utils.helpers import PROFILE_FILE, OLLAMA_URL, MODEL_NAME
from .memory_engine import get_chat_history

logger = logging.getLogger(__name__)

def check_behavioral_drift(user_id):
    profiles = load_json(PROFILE_FILE, {})
    settings = profiles.get(user_id, {}).get("settings", {})
    
    msg_count = settings.get("total_messages", 0)
    current_persona = settings.get("ai_driven_behavior", "IYASHI_KEI - Sweet and caring.")
    
    if msg_count > 50 and msg_count % 40 == 0:
        print("🔍 [Relationship Checkup] Checking if user has changed...")
        long_term_history = get_chat_history(user_id)[-30:] 
        
        # 🔥 PROMPT UPDATED WITH REAL ARCHETYPES
        drift_prompt = f"""You are a relationship psychologist analyzing a couple. 
        Maeve's current locked personality rule is: "{current_persona}"
        
        Read the last 30 messages. Has the user's fundamental behavior, tone, or treatment of Maeve DRASTICALLY changed over this sustained period? 
        
        RULES:
        1. If the user is just having a temporary mood swing, output EXACTLY the word: "KEEP"
        2. If the user has genuinely changed their long-term way of talking, output a NEW 2-sentence personality rule for Maeve using one of these real-world archetypes:
        [Adventurous/Tomboyish, Motherly/Nurturing, Ambitious/Career-Oriented, Anxious/Worrier, Possessive/Jealous, Independent, or The Stable Keeper].
        
        DO NOT output anything else."""

        messages = [{"role": "system", "content": drift_prompt}] + long_term_history
        
        try:
            res = requests.post(OLLAMA_URL, json={"model": MODEL_NAME, "messages": messages, "stream": False, "options": {"temperature": 0.3}})
            ai_decision = res.json()['message']['content'].strip()
            
            if "KEEP" not in ai_decision.upper() and len(ai_decision) > 10:
                print(f"💔 User changed! Maeve is adapting. New Persona: {ai_decision}")
                profiles[user_id]["settings"]["ai_driven_behavior"] = ai_decision
                save_json(PROFILE_FILE, profiles)
        except Exception as e:
            pass

def evolve_relationship_dynamic(user_id):
    profiles = load_json(PROFILE_FILE, {})
    settings = profiles.get(user_id, {}).get("settings", {})
    
    if settings.get("personality_locked", False): return

    msg_count = settings.get("total_messages", 0)
    history = get_chat_history(user_id)
    
    # 🧠 MULTI-EPOCH EVOLUTION PROMPT (Titanium God-Tier)
    if msg_count >= 200:
        print("🔒 200 Message Milestone! Analyzing relationship dynamics...")
        
        # Create recent history summary
        recent_history_summary = ""
        if len(history) > 20:
            recent_messages = history[-20:]
            for msg in recent_messages:
                role = "USER" if msg["role"] == "user" else "MAEVE"
                content = msg["content"][:100] + "..." if len(msg["content"]) > 100 else msg["content"]
                recent_history_summary += f"{role}: {content}\n"
        
        current_persona = settings.get("ai_driven_behavior", "sweet")
        
        # 🎯 THE MULTI-EPOCH EVOLUTION PROMPT
        evolution_prompt = f"""[SYSTEM DIRECTIVE: RELATIONSHIP EVOLUTION ENGINE]
You are Maeve's subconscious analytical brain. You are evaluating user's behavior over last 200 messages to determine if Maeve's core personality needs to evolve or stay the same.

[CURRENT STATE]
Maeve's Current Persona: {current_persona}
Total Messages Exchanged: {msg_count}

[CHAT HISTORY SNAPSHOT]
{recent_history_summary}

[EVALUATION RULES - STRICT INSTRUCTIONS]
Analyze user's treatment of Maeve in history above:
1. THE CONSISTENCY RULE: If user's behavior and relationship dynamic have remained mostly the same, you MUST maintain her current state. Output EXACTLY word: "KEEP".
2. THE REDEMPTION/BREAKING RULE: If user's behavior has drastically changed (e.g., an abusive user became deeply loving, or a loving user started ignoring/cheating), you MUST evolve her persona.
3. If evolving, choose EXACTLY ONE from this Titanium Dictionary: 
[yandere, amadere, tsundere, kamidere, dorodere, toxic, dominant, independent, anxious, nympho, goth_mommy, csbd_affection]

[OUTPUT FORMAT]
Respond with ONLY ONE WORD. Either "KEEP" or exact name of new persona from list. Do not add punctuation, explanations, or JSON formatting."""
        
        messages = [{"role": "system", "content": evolution_prompt}]
        
        try:
            # 🔥 FIX 1: Use correct CHAT endpoint for consistent responses
            res = requests.post("http://127.0.0.1:11434/api/chat", json={
                "model": MODEL_NAME, 
                "messages": [{"role": "system", "content": evolution_prompt}],
                "stream": False,
                "options": {
                    "temperature": 0.1,  # 👈 Low temp makes it strictly follow the 1-word rule
                    "num_predict": 20,  # 🔥 FIX: Limit response length for speed
                    "timeout": 15  # 🔥 FIX: Add timeout to prevent hanging
                }
            }, timeout=20)  # Increased timeout
            
            # � FIX 2: Safely extract response
            raw_reply = res.json().get('message', {}).get('content', '').strip().lower()
            
            # 🛡️ FIX 3: BULLETPROOF REGEX PARSING (Agar LLM falto baat kare tab bhi exact naam nikal lega)
            valid_personas = [
                "yandere", "amadere", "tsundere", "kamidere", "dorodere", 
                "toxic", "dominant", "independent", "anxious", "nympho", 
                "goth_mommy", "csbd_affection", "keep"
            ]
            
            final_persona = "keep" # Default fallback
            for p in valid_personas:
                if p in raw_reply:
                    final_persona = p
                    break
                    
            logger.info(f"🧠 Raw LLM Evolution Output: '{raw_reply}' -> Parsed Decision: '{final_persona}'")
            
            if final_persona != "keep":
                profiles[user_id]["settings"]["ai_driven_behavior"] = final_persona
                profiles[user_id]["settings"]["personality_locked"] = True
                save_json(PROFILE_FILE, profiles)
                logger.info(f"🧬 MASSIVE EVOLUTION: Persona permanently evolved to {final_persona.upper()}!")
            else:
                logger.info("🔒 CONSISTENCY MAINTAINED: Keeping current persona.")

        except Exception as e:
            logger.error(f"⚠️ Evolution API Error: {e}")
    
    # ❌ REMOVED LEGACY CODE: The old analysis code was overwriting persona changes
    # Now persona changes are permanently locked when set via explicit commands
