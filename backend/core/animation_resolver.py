import re
from typing import Optional, Tuple

# Legacy function - kept for backward compatibility but should not be used
# Use smart_animation_filter instead for AI-driven approach

# Emotion to animation mapping
EMOTION_ANIMATION_MAP = {
    "JOY": "HAPPY",
    "SOFT": "ADORATION", 
    "NEUTRAL": "FEMINEIDLE",
    "ANGER": "FEMALEANGRY",
    "DISGUST": "CONTEMPT",
    "FRUSTRATION": "ANNOYED",
    "ANXIETY": "BASHFUL",
    "JEALOUSY": "LOOKAROUND",
    "LUST": "CRAVING",
    "CURIOSITY": "FEMALETHINKING",
    "AMUSEMENT": "HAPPY",
    "SADNESS": "SAD",
    "HURT": "SAD",
    "PRIDE": "BEINGCOCKY",
    "EVIL": "CONTEMPT",
    "ROMANCE": "NORMALKISS",
    "SHY": "BASHFUL",
}

def smart_animation_filter(reply_text: str, llm_emotion: str, llm_animation: str, persona: str, user_input: str = "") -> Tuple[str, str]:
    """
    THE GOD-TIER FILTER:
    We ONLY trust LLM. We ONLY override animations if the AI's *physical action* in reply dictates a specific 3D movement.
    We NEVER override based on user_input!
    """
    final_animation = llm_animation.upper().strip()
    final_emotion = llm_emotion.upper().strip()
    
    # ── CASUAL CONTEXT GATE (runs first, before anything else) ──────────────
    _CASUAL_TOPICS = {
        "game", "cyberpunk", "character", "favourite", "favorite", "movie",
        "song", "food", "weather", "news", "play", "watch", "anime", "show",
        "music", "book", "series", "recommend", "suggest", "opinion", "think",
        "what do you", "do you like", "have you", "tell me about", "explain",
        "how does", "what is", "who is", "why is", "when did"
    }
    _NSFW_SET = {
        "BLOWJOB", "BLOWJOB2", "BLOWJOB3", "RIDING", "BACKSHOT", "BACKSHOTS",
        "BACKSHOT2", "BACKSHOT3", "BACKSHOT4", "BACKSHOT5", "HANDJOB", "TITJOB",
        "MISSIONARY", "UNDRESSING", "SADDLE", "MASTURBATE", "AHEGAO",
        "FRONT", "FRONT2", "FRONTSLOW"
    }
    
    user_lower = user_input.lower()
    is_casual = any(w in user_lower for w in _CASUAL_TOPICS)
    
    if final_animation in _NSFW_SET and is_casual:
        final_animation = "FEMINEIDLE"
        final_emotion = llm_emotion.upper().strip()  # Keep original emotion, don't force LUST
        logger.info(f" CASUAL GATE BLOCKED NSFW: {llm_animation} → FEMINEIDLE (user asked about: {user_input[:40]})")
        return final_animation, final_emotion
    
    valid_animations = {
        "FEMINEIDLE", "BREATHINGIDLE", "HAPPY", "BASHFUL", "ANNOYED", "ARGUING", 
        "FEMALEANGRY", "SAD", "NORMALKISS", "HUGGINGKISS", "BLOWJOB", "RIDING", 
        "BACKSHOT", "MISSIONARY", "HANDJOB", "MASTURBATE", "UNDRESSING", "AHEGAO", 
        "CRAVING", "SEXY", "TYPING", "FOCUS", "FEMALETHINKING", "CONTEMPT", 
        "BEINGCOCKY", "LOOKAROUND", "ADORATION", "LOVE", "WAVE", "DRINKING", "SADDLE", "YAWN"
    }
    
    if final_animation not in valid_animations or final_animation == "NONE":
        final_animation = "FEMINEIDLE"

    # 1. 🔍 EXTRACT ACTIONS FROM THE AI'S REPLY (e.g., from "*smirks and bites lip*")
    extracted_actions = re.findall(r'\*(.*?)\*', reply_text.lower())
    action_text = " ".join(extracted_actions)
    action_words = set(re.findall(r'\b\w+\b', action_text))

    # 2. 🔞 EXECUTE 3D ANIMATION ONLY IF THE AI GENERATED THESE ACTIONS
    # 2. 🔞 EXECUTE 3D ANIMATION ONLY IF THE AI GENERATED THESE ACTIONS
    if action_text:
        # NSFW Overrides based purely on what the AI decided to do
        if action_words.intersection({"undress", "strip", "naked", "unzip"}): 
            return "UNDRESSING", "LUST"
        elif action_words.intersection({"ride", "straddle", "bounce", "top"}): 
            return "RIDING", "LUST"
        elif action_words.intersection({"bend", "backshot", "behind", "doggy"}): 
            return "BACKSHOT", "LUST"
        elif action_words.intersection({"suck", "blowjob", "head", "mouth", "lick"}): 
            return "BLOWJOB", "LUST"
        elif action_words.intersection({"masturbate", "finger", "touch", "rub"}): 
            if "myself" in action_text or "own" in action_text:
                return "MASTURBATE", "LUST"
        elif action_words.intersection({"handjob", "stroke", "jerk"}): 
            return "HANDJOB", "LUST"
        elif action_words.intersection({"missionary", "lay back"}):
            return "MISSIONARY", "LUST"
            
        # Violence/Anger Overrides
        elif action_words.intersection({"slap", "hit", "punch", "smack"}):
            return "FEMALEANGRY", "ANGER"
            
        # Deep Sadness Overrides
        elif action_words.intersection({"cry", "tear", "sob", "weep"}):
            return "SAD", "HURT"

    # Fix for Nympho: If LLM makes her CRAVING but emotion is somehow soft, force LUST
    if persona == "nympho" and final_animation == "CRAVING":
        return "CRAVING", "LUST"

    # 4. 🤝 For EVERYTHING else, we 100% trust the AI!
    return final_animation, final_emotion

# Legacy function - deprecated in favor of smart_animation_filter
def resolve_animation(
    llm_animation: str,       # what model returned
    asterisk_action: str,     # physical action text from reply
    emotion: str,
    persona: str,
    user_input: str,
    intimacy_score: float,
) -> str:
    """
    Resolve animation with explicit priority system.
    
    Priority:
    P1 (highest): Explicit LLM animation (non-default)
    P2: NSFW compliance gate (safety)
    P3: Vocabulary match on asterisk action text
    P4: Persona identity default (only for weak emotions)
    P5 (lowest): Emotion map fallback
    """
    
    # P2: Safety gate runs first, regardless of everything else
    if is_nsfw_blocked(llm_animation, persona, user_input):
        return get_blocked_nsfw_replacement(persona, emotion)
    
    # P1: Trust LLM if it gave a valid, non-default animation
    if llm_animation not in {"FEMINEIDLE", "BREATHINGIDLE", "NONE", ""}:
        if llm_animation in EMOTION_ANIMATION_MAP.values():
            return llm_animation
    
    # P3: Vocabulary match on asterisk action text
    if asterisk_action:
        matched = match_animation_vocabulary(asterisk_action)
        if matched:
            return matched
    
    # P4: Persona identity default (only for weak emotions) - REMOVED for AI-driven approach
    # AI-driven architecture trusts LLM choices, no rigid persona defaults
    # This step is deprecated to allow creative freedom
    
    # P5: Emotion map fallback
    return EMOTION_ANIMATION_MAP.get(emotion, "FEMINEIDLE")

def is_nsfw_blocked(animation: str, persona: str, user_input: str) -> bool:
    """Check if animation should be blocked for NSFW compliance."""
    # This would integrate with existing NSFW state manager
    return False  # Placeholder

def get_blocked_nsfw_replacement(persona: str, emotion: str) -> str:
    """Get replacement animation when NSFW is blocked."""
    return "BREATHINGIDLE"  # Placeholder

def match_animation_vocabulary(action_text: str) -> Optional[str]:
    """Match action text to specific animations."""
    action_text = action_text.lower()
    
    # NSFW Actions (highest priority)
    if any(x in action_text for x in ['blowjob', 'suck', 'head', 'bj']): return "BLOWJOB"
    if any(x in action_text for x in ['ride', 'bounce', 'straddle', 'cowgirl']): return "RIDING"
    if any(x in action_text for x in ['bend over', 'behind', 'backshot']): return "BACKSHOT"
    if any(x in action_text for x in ['masturbat', 'touch myself', 'finger', 'rub']): return "MASTURBATE"
    if any(x in action_text for x in ['undress', 'take off', 'strip', 'naked']): return "UNDRESSING"
    if any(x in action_text for x in ['missionary', 'on top']): return "MISSIONARY"
    if any(x in action_text for x in ['handjob', 'stroke']): return "HANDJOB"
    if any(x in action_text for x in ['ahegao', 'cumming', 'orgasm']): return "AHEGAO"
    
    # Intimate/Romance Actions
    if any(x in action_text for x in ['kiss', 'peck', 'lips', 'smooch']): return "NORMALKISS"
    if any(x in action_text for x in ['hug', 'embrace', 'wrap arms', 'cuddle']): return "HUGGINGKISS"
    if any(x in action_text for x in ['smirk', 'lean in', 'bite lip', 'seductive']): return "CRAVING"
    if any(x in action_text for x in ['blow kiss', 'flying kiss']): return "BLOWKISS"
    if any(x in action_text for x in ['adore', 'stare lovingly']): return "ADORATION"
    
    # Everyday Emotion Actions
    if any(x in action_text for x in ['type', 'typing', 'code', 'keyboard']): return "TYPING"
    if any(x in action_text for x in ['blush', 'shy', 'hide', 'nervous', 'turn red']): return "BASHFUL"
    if any(x in action_text for x in ['tilt', 'think', 'ponder', 'curious']): return "FEMALETHINKING"
    if any(x in action_text for x in ['roll', 'sigh', 'annoy', 'tap foot']): return "ANNOYED"
    if any(x in action_text for x in ['glare', 'cross arms', 'stomp', 'hiss', 'sneer']): return "FEMALEANGRY"
    if any(x in action_text for x in ['cry', 'tear', 'sob', 'wipe']): return "SAD"
    if any(x in action_text for x in ['smile', 'warm', 'giggle', 'beam', 'laugh']): return "HAPPY"
    
    return None
