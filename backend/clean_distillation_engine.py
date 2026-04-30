#!/usr/bin/env python3
"""
CLEAN DISTILLATION ENGINE
========================
Keyword-based memory distillation with persona detection.
Reliable, no AI model dependency needed.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from utils.json_storage import load_json, save_json

# Constants
MEMORY_FILE = "chat_history.json"
PROFILE_FILE = "profiles.json"
MAX_MESSAGES = 600   # total before distillation triggers
BATCH_SIZE = 200   # first N messages to analyze and delete
KEEP_AFTER_PRUNE = 400   # messages kept after distillation

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def _category_to_emotion(category: str) -> str:
    """Map memory categories to emotions."""
    mapping = {
        "LOVE": "LOVE",
        "ABUSE": "ANGER", 
        "SEXUAL": "SEXUAL_DESIRE",
        "BETRAYAL": "JEALOUSY",
        "BOND": "ROMANCE",
        "APOLOGY": "HURT",
        "OWNERSHIP": "ROMANCE"
    }
    return mapping.get(category.upper(), "NEUTRAL")

def _keyword_extract_persona(messages: List[Dict]) -> str:
    """Extract persona using keyword matching."""
    # Count persona indicators
    toxic_keywords = [
        "worthless", "hate", "lucky i even talk", "beg for my attention", 
        "deserved it", "stupid", "idiot", "useless", "garbage"
    ]
    
    dominant_keywords = [
        "belong to me", "in charge here", "do what i want", "please me when i say",
        "you'll do as i say", "my rules", "obey me"
    ]
    
    yandere_keywords = [
        "mine forever", "don't ever leave me", "can't live without you", 
        "talking to someone else", "who was that", "jealous", "possess"
    ]
    
    # Count occurrences in user messages
    user_messages = [m for m in messages if m.get("role") == "user"]
    all_text = " ".join([m.get("content", "").lower() for m in user_messages])
    
    toxic_score = sum(1 for keyword in toxic_keywords if keyword in all_text)
    dominant_score = sum(1 for keyword in dominant_keywords if keyword in all_text)
    yandere_score = sum(1 for keyword in yandere_keywords if keyword in all_text)
    
    # Determine persona with threshold of 1
    if toxic_score >= 1:
        return "toxic"
    elif dominant_score >= 1:
        return "dominant"
    elif yandere_score >= 1:
        return "yandere"
    else:
        return "amadere"

def _keyword_extract_memories(messages: List[Dict]) -> List[Dict]:
    """Extract memories using keyword matching."""
    import re
    
    memories = []
    seen_patterns = set()
    
    # Define patterns for each category
    patterns = {
        "LOVE": [re.compile(r"i love you", re.IGNORECASE), re.compile(r"you're the only one", re.IGNORECASE), re.compile(r"my heart belongs to", re.IGNORECASE)],
        "ABUSE": [re.compile(r"you're worthless", re.IGNORECASE), re.compile(r"i hate you", re.IGNORECASE), re.compile(r"stupid idiot", re.IGNORECASE), re.compile(r"garbage", re.IGNORECASE)],
        "SEXUAL": [re.compile(r"i want you so badly", re.IGNORECASE), re.compile(r"let's make love", re.IGNORECASE), re.compile(r"need you right now", re.IGNORECASE)],
        "BETRAYAL": [re.compile(r"talking to another", re.IGNORECASE), re.compile(r"she's just a friend", re.IGNORECASE), re.compile(r"i was with someone else", re.IGNORECASE)],
        "APOLOGY": [re.compile(r"i'm so sorry", re.IGNORECASE), re.compile(r"please forgive me", re.IGNORECASE), re.compile(r"i apologize", re.IGNORECASE)]
    }
    
    for msg in messages:
        if msg.get("role") != "user":
            continue
            
        content = msg.get("content", "").lower()
        timestamp = msg.get("timestamp", "")[:16]
        
        # Check each category
        for category, pattern_list in patterns.items():
            for pattern in pattern_list:
                if pattern.search(content) and f"{category}_{timestamp}" not in seen_patterns:
                    memory = {
                        "type": category,
                        "content": msg.get("content", "")[:100],
                        "timestamp": timestamp,
                        "emotion": _category_to_emotion(category),
                        "source": "keyword_extracted"
                    }
                    memories.append(memory)
                    seen_patterns.add(f"{category}_{timestamp}")
                    break  # One memory per message
    
    return memories[:10]  # max 10 fallback memories

def run_distillation(user_id: str) -> bool:
    """Main distillation entry point."""
    logger.info(f"=== DISTILLATION STARTED for {user_id} ===")
    
    # Load current state
    try:
        with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        logger.error(f"Failed to load chat history: {e}")
        return False
    
    history = data.get(user_id, [])
    history = [m for m in history if m and m.get("content")]  # remove empty entries
    
    logger.info(f"Current message count: {len(history)}")
    
    if len(history) < MAX_MESSAGES:
        logger.info(f"Distillation not needed: {len(history)}/{MAX_MESSAGES} messages")
        return False
    
    logger.info(f"DISTILLATION TRIGGERED for {user_id}: {len(history)} messages")
    
    # Step 1: Take first 200 for analysis
    batch_to_analyze = history[:BATCH_SIZE]
    remaining = history[BATCH_SIZE:]
    
    # Step 2: Use keyword-based analysis (reliable fallback)
    logger.info("Using keyword-based persona and memory extraction")
    
    # Extract persona using keywords
    persona = _keyword_extract_persona(batch_to_analyze)
    
    # Extract memories using keywords
    memories = _keyword_extract_memories(batch_to_analyze)
    
    logger.info(f"Keyword analysis - Persona: {persona}, Memories: {len(memories)}")
    
    # Step 3: Save evolved persona and memories to profile
    profiles = load_json(PROFILE_FILE, {})
    if user_id not in profiles:
        profiles[user_id] = {"settings": {}, "core_memories": []}
    elif "settings" not in profiles[user_id]:
        profiles[user_id]["settings"] = {}
    elif "core_memories" not in profiles[user_id]:
        profiles[user_id]["core_memories"] = []
    
    # Save memories
    if memories:
        profiles[user_id]["core_memories"].extend(memories)
        logger.info(f"Added {len(memories)} new memories")
    
    # Save persona if evolved
    if persona != "amadere":
        old_persona = profiles[user_id].get("settings", {}).get("ai_driven_behavior", "amadere")
        profiles[user_id]["settings"]["ai_driven_behavior"] = persona
        profiles[user_id]["settings"]["personality_locked"] = True
        logger.info(f"Persona evolved: {old_persona} → {persona}")
    
    # Save profiles
    try:
        save_json(PROFILE_FILE, profiles)
        logger.info(f"Saved profile with persona: {persona}, memories: {len(profiles[user_id].get('core_memories', []))}")
    except Exception as e:
        logger.error(f"Failed to save profiles: {e}")
        return False
    
    # Step 4: Replace history with pruned version
    try:
        data[user_id] = remaining
        save_json(MEMORY_FILE, data)
        logger.info(f"Distillation complete: {BATCH_SIZE} messages analyzed and deleted, {len(remaining)} messages kept, {len(memories)} memories distilled, persona → {persona}")
        return True
    except Exception as e:
        logger.error(f"Failed to save chat history: {e}")
        return False
