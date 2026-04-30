import logging
from datetime import datetime
from utils.json_storage import load_json, save_json
from utils.helpers import MEMORY_FILE, PROFILE_FILE, MAX_HISTORY, KEEP_HISTORY

logger = logging.getLogger(__name__)

def get_chat_history(user_id, limit=None):
    history = load_json(MEMORY_FILE, {})
    user_history = history.get(user_id, [])
    
    if limit is not None:
        return user_history[-limit:]  # Return last N messages
    return user_history

def distill_to_core_memory(user_id, message_pair):
    """
    🧠 THE DISTILLATION FILTER: 
    सिर्फ प्यार, नफरत (गाली), या जरूरी बातों को परमानेंट मेमोरी में डालता है।
    """
    user_msg = message_pair.get('user', '')
    emotion = message_pair.get('emotion', 'NEUTRAL')
    intensity = message_pair.get('intensity', 0.5)

    # 0. LENGTH & FILLER GUARD - Prevent junk memories
    word_count = len(user_msg.split())
    common_fillers = ["hi", "hello", "hey", "ok", "okay", "yes", "no", "what", "why", "hmm", "yeah", "nah", "lol", "lmao", "omg"]
    
    if word_count < 4 or user_msg.lower().strip() in common_fillers:
        logger.debug(f" Skipped junk memory: '{user_msg[:20]}...' (too short or filler)")
        return

    # 1. EMOTION FILTER (हाई इंटेंसिटी वाले इमोशन्स)
    is_high_emotion = intensity > 0.7 or emotion in ["ANGER", "FURY", "LOVE", "ROMANCE", "JEALOUSY", "SEXUAL_DESIRE", "TOXIC"]
    
    # 2. KEYWORD FILTER (गाली या बहुत ज़रूरी बातें)
    important_keywords = ["hate", "bitch", "love you", "miss you", "promise", "secret", "never", "always", "fuck"]
    has_important_keyword = any(kw in user_msg.lower() for kw in important_keywords)

    # अगर मैसेज काम का है, तो उसे Profiles में Core Memory बना कर सेव कर लो
    if (is_high_emotion or has_important_keyword) and len(user_msg.strip()) > 2:
        archive_core_memory(user_id, f"Impactful Moment ({emotion})", user_msg)
        logger.info(f"✨ DISTILLED TO CORE MEMORY: '{user_msg[:40]}...'")

def archive_core_memory(user_id, memory_type, content):
    """Saves impactful moments to permanent core memory in user profile"""
    profiles = load_json(PROFILE_FILE, {})
    if user_id not in profiles:
        profiles[user_id] = {"name": "Darling", "facts": [], "user_pet_name": "", "maeve_pet_name": "Maeve", "core_memories": []}
    
    if "core_memories" not in profiles[user_id]:
        profiles[user_id]["core_memories"] = []
    
    core_memory = {
        "type": memory_type,
        "content": content,
        "timestamp": datetime.now().isoformat(),
        "emotion": memory_type.split('(')[1].replace(')', '') if '(' in memory_type else "UNKNOWN"
    }
    
    profiles[user_id]["core_memories"].append(core_memory)
    
    # Keep only last 50 core memories so database doesn't bloat
    if len(profiles[user_id]["core_memories"]) > 50:
        profiles[user_id]["core_memories"] = profiles[user_id]["core_memories"][-50:]
    
    save_json(PROFILE_FILE, profiles)

def save_chat_history(user_id, role, content, emotion=None, intensity=0.5):
    """
    💾 THE 600 -> 200 BATCH PRUNING SYSTEM (Thread-Safe)
    """
    try:
        data = load_json(MEMORY_FILE, {})
        if user_id not in data:
            data[user_id] = []
        
        entry = {
            "role": role, 
            "content": content, 
            "emotion": emotion, 
            "intensity": intensity,
            "timestamp": datetime.now().isoformat()
        }
        data[user_id].append(entry)
        
        # ♻️ THE SMART PRUNING TRIGGER
        if len(data[user_id]) >= MAX_HISTORY:
            logger.warning(f"🧹 Memory reached {MAX_HISTORY}! Lazy deleting oldest {MAX_HISTORY - KEEP_HISTORY} messages...")
            
            # 🛠️ BULLETPROOF: Simple slice delete, NO distillation to avoid Ollama crashes
            data[user_id] = data[user_id][-KEEP_HISTORY:]
            logger.info(f"✅ Lazy Pruning Complete. Retained latest {KEEP_HISTORY} messages.")
        
        # Thread-safe file write
        save_json(MEMORY_FILE, data)
        logger.debug(f"💾 Chat history saved for user {user_id}")
    except Exception as e:
        logger.error(f"❌ Failed to save chat history for user {user_id}: {e}")
