import re
import time
import difflib
import logging  # 🔥 Added missing logger
from typing import Tuple
from utils.json_storage import load_json, save_json
from utils.helpers import PROFILE_FILE

# Import definitions so we know exactly what personas exist
from core.persona_engine import PERSONA_DEFINITIONS

logger = logging.getLogger(__name__)

def resolve_persona(user_input: str, user_id: str, profiles: dict) -> Tuple[str, bool]:
    """
    Returns (persona_name, was_switched).
    Priority: Unlock > [PERSONA_DATA:] tag > Hard Command > Natural language > Saved profile
    """
    PERSONA_MAP = {
        "yandere": "yandere", "toxic": "toxic", "sweet": "sweet",  
        "cool": "kakkodere", "shy": "hajidere", "mommy": "goth_mommy",
        "evil": "yanmeta", "dominant": "dominant", "nympho": "nympho",
        "tsundere": "tsundere", "kuudere": "kuudere", "anxious": "anxious",
        "hajidere": "hajidere", "amadere": "amadere", "kamidere": "kamidere",
        "dandere": "dandere", "perfect": "perfect", "default": "default"
    }

    # Automatically add exact keys from definitions
    for p_key in PERSONA_DEFINITIONS.keys():
        if p_key not in PERSONA_MAP:
            PERSONA_MAP[p_key] = p_key

    valid_personas = list(set(PERSONA_MAP.values()))
    user_input_lower = " ".join(user_input.lower().split())

    # Ensure 'settings' dictionary always exists
    if user_id not in profiles:
        profiles[user_id] = {}
    profiles[user_id].setdefault("settings", {})

    current_persona = profiles[user_id]["settings"].get("ai_driven_behavior", "amadere").lower()

    # 🔓 1. UNLOCK COMMAND: "go back to normal" ya "be yourself"
    # Isse Maeve wapis Brain ke control mein chali jayegi
    unlock_keywords = ["go back to normal", "reset persona", "unlock persona", "evolve naturally", "be yourself"]
    if any(keyword in user_input_lower for keyword in unlock_keywords):
        profiles[user_id]["settings"]["personality_locked"] = False
        # Reset to base nature so she can start evolving from scratch
        profiles[user_id]["settings"]["ai_driven_behavior"] = "amadere"
        save_json(PROFILE_FILE, profiles)
        logger.info("🔓 PERSONA UNLOCKED: Automatic evolution enabled.")
        return "amadere", True # Switch back to base

    # 🎯 2. Priority 1: Explicit [PERSONA_DATA:] tag (MATRIX TEST MODE)
    tag_match = re.search(r'\[PERSONA_DATA:\s*([a-zA-Z_]+)\]', user_input, re.IGNORECASE)
    if tag_match:
        raw = tag_match.group(1).lower().strip()
        persona = PERSONA_MAP.get(raw, raw)
        
        if current_persona != persona:
            profiles[user_id]["settings"]["ai_driven_behavior"] = persona
            profiles[user_id]["settings"]["last_persona_switch"] = time.time()
            profiles[user_id]["settings"]["personality_locked"] = True # LOCK IT
            save_json(PROFILE_FILE, profiles) 
            return persona, True
        return persona, False

    # 🎯 3. Priority 2: EXPLICIT HARD OVERRIDE COMMAND (become yandere)
    is_hard_command = (
        user_input_lower.startswith("change your persona to ") or 
        user_input_lower.startswith("become ") or
        user_input_lower.startswith("please change your persona to ")
    )

    if is_hard_command:
        if "change your persona to" in user_input_lower:
            target_raw = user_input_lower.split("change your persona to")[-1].strip()
        else:
            target_raw = user_input_lower.split("become")[-1].strip()

        target_cleaned = target_raw.replace(" ", "_").replace(".", "").replace("moomy", "mommy").replace("momy", "mommy")

        new_persona = None
        if target_cleaned in valid_personas:
            new_persona = target_cleaned
        else:
            closest_matches = difflib.get_close_matches(target_cleaned, valid_personas, n=1, cutoff=0.6)
            if closest_matches:
                new_persona = closest_matches[0]

        if new_persona:
            if current_persona != new_persona:
                profiles[user_id]["settings"]["ai_driven_behavior"] = new_persona
                profiles[user_id]["settings"]["last_persona_switch"] = time.time()
                profiles[user_id]["settings"]["personality_locked"] = True # LOCK IT
                save_json(PROFILE_FILE, profiles)
                return new_persona, True
            return new_persona, False

    # 🎯 4. Priority 3: Natural language indirect switch (e.g. "act like a tsundere")
    lang_match = re.search(r'(?:act like|switch to|change to|be a|be an)\s+([a-zA-Z_\s]+)', user_input, re.IGNORECASE)
    if lang_match:
        raw = lang_match.group(1).lower().strip()
        raw_cleaned = raw.replace(" ", "_")
        persona = PERSONA_MAP.get(raw, PERSONA_MAP.get(raw_cleaned, current_persona))
        
        last_switch = profiles[user_id]["settings"].get("last_persona_switch", 0)
        if current_persona != persona and (time.time() - last_switch) > 2.0:
            profiles[user_id]["settings"]["ai_driven_behavior"] = persona
            profiles[user_id]["settings"]["last_persona_switch"] = time.time()
            profiles[user_id]["settings"]["personality_locked"] = True # LOCK IT
            save_json(PROFILE_FILE, profiles)
            return persona, True
        return persona, False

    # 🎯 5. Priority 4: Saved profile
    return current_persona, False
