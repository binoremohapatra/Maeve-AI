import requests
from utils.json_storage import load_json, save_json
from core.memory_engine import get_chat_history
from utils.helpers import PROFILE_FILE, OLLAMA_URL, MODEL_NAME


def evolve_relationship_dynamic(user_id):
    profiles = load_json(PROFILE_FILE, {})
    settings = profiles.get(user_id, {}).get("settings", {})
    
    if settings.get("personality_locked", False): return

    msg_count = settings.get("total_messages", 0)
    history = get_chat_history(user_id)
    
    if msg_count >= 100:
        print("Relationship Milestone Reached! Locking Core Personality...")
       
        lock_prompt = """Based on all previous interactions, what is the definitive, PERMANENT dynamic between the user and Maeve? 
        Choose exactly ONE core archetype [Adventurous, Motherly, Ambitious, Anxious, Possessive, Independent, or Stable Keeper].
        Write a 3-sentence strict rule for her permanent behavior moving forward."""
        
        messages = [{"role": "system", "content": lock_prompt}] + history[-20:]
        try:
            res = requests.post(OLLAMA_URL, json={"model": MODEL_NAME, "messages": messages, "stream": False})
            final_persona = res.json()['message']['content'].strip()
            
            profiles[user_id]["settings"]["ai_driven_behavior"] = final_persona
            profiles[user_id]["settings"]["personality_locked"] = True
            save_json(PROFILE_FILE, profiles)
            return
        except: return

    if len(history) < 8: return 
    
    recent_context = history[-10:] 
    analysis_prompt = """Read recent chat history. Write a 2-3 sentence STRICT INSTRUCTION for Maeve's current personality based on these archetypes: [Motherly, Anxious, Possessive, Ambitious, Independent]. DO NOT output JSON."""
    messages = [{"role": "system", "content": analysis_prompt}] + recent_context

    try:
        res = requests.post(OLLAMA_URL, json={"model": MODEL_NAME, "messages": messages, "stream": False, "options": {"temperature": 0.5}})
        new_dynamic = res.json()['message']['content'].strip()
        
        if user_id in profiles:
            if "settings" not in profiles[user_id]: profiles[user_id]["settings"] = {}
            profiles[user_id]["settings"]["ai_driven_behavior"] = new_dynamic
            save_json(PROFILE_FILE, profiles)
    except: pass
