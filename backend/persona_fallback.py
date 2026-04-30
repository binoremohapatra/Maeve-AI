#!/usr/bin/env python3
"""
Persona Fallback System - Ensures correct persona behavior when LLM fails
"""

def get_persona_fallback(persona, user_input, llm_emotion, llm_animation):
    """
    Fallback system that ensures correct persona behavior
    when LLM fails to follow persona rules
    """
    
    # Helper to clean persona name
    persona = persona.lower().strip()

    # Persona-specific emotion mapping (Expanded for all major personas)
    persona_emotions = {
        "yandere": {
            "love": ["POSSESSIVE", "LUST", "SOFT", "WARM"],
            "jealousy": ["JEALOUSY", "ANGER", "INTENSE", "ANXIETY"],
            "anger": ["ANGER", "COLD_ANGER", "FRUSTRATION"],
            "sexy": ["LUST", "CRAVING", "INTENSE"],
            "default": ["NEUTRAL", "SOFT", "JEALOUSY"]
        },
        "yandere_aggressive": {
            "love": ["POSSESSIVE", "LUST", "INTENSE"],
            "jealousy": ["ANGER", "JEALOUSY", "COLD_ANGER"],
            "anger": ["ANGER", "FRUSTRATION", "DISGUST"],
            "sexy": ["LUST", "CRAVING", "INTENSE"],
            "default": ["NEUTRAL", "ANGER", "INTENSE"]
        },
        "goth_mommy": {
            "love": ["SOFT", "WARM", "LUST"],
            "comfort": ["SOFT", "WARM", "CONCERNED"],
            "scold": ["ANGER", "ANNOYED", "PRIDE"],
            "sexy": ["LUST", "CRAVING", "SEXY"],
            "default": ["NEUTRAL", "SOFT", "PRIDE"]
        },
        "nympho": {
            "love": ["LUST", "CRAVING", "SOFT"],
            "sexy": ["LUST", "SEXY", "CRAVING", "PLEASURE"],
            "fun": ["EXCITED", "JOY", "LUST"],
            "anger": ["ANNOYED", "FRUSTRATION"],
            "default": ["LUST", "CRAVING", "SEXY"]
        },
        "amadere": {
            "love": ["SOFT", "WARM", "LOVE", "JOY"],
            "sad": ["SOFT", "WARM", "SADNESS", "CONCERNED"],
            "anger": ["HURT", "SADNESS", "ANNOYED"],
            "sexy": ["SHY", "FLUSTERED", "SOFT"],
            "default": ["SOFT", "WARM", "HAPPY", "NEUTRAL"]
        },
        "hajidere": {
            "love": ["SHY", "BASHFUL", "FLUSTERED", "SOFT"],
            "compliment": ["SHY", "BASHFUL", "FLUSTERED", "ANXIETY"],
            "sexy": ["SHY", "ANXIETY", "FLUSTERED"],
            "anger": ["SADNESS", "HURT", "ANXIETY"],
            "default": ["SHY", "BASHFUL", "NEUTRAL"]
        },
        "tsundere": {
            "love": ["SHY", "BASHFUL", "ANGER"],
            "compliment": ["ANGER", "FRUSTRATION", "SHY"],
            "insult": ["ANGER", "FRUSTRATION", "DISGUST"],
            "sexy": ["ANGER", "SHY", "FLUSTERED"],
            "default": ["NEUTRAL", "ANNOYED", "SHY"]
        },
        "toxic": {
            "love": ["DISGUST", "ANNOYED", "CONTEMPT"],
            "help": ["DISGUST", "ANNOYED", "ANGER"],
            "anger": ["ANGER", "COLD_ANGER", "DISGUST"],
            "sexy": ["DISGUST", "PRIDE", "CONTEMPT"],
            "default": ["NEUTRAL", "ANNOYED", "DISGUST"]
        },
        "kamidere": {
            "love": ["PRIDE", "SMUG", "SOFT"],
            "compliment": ["PRIDE", "SMUG", "HAPPY"],
            "challenge": ["ANGER", "PRIDE", "ANNOYED"],
            "sexy": ["PRIDE", "SMUG", "LUST"],
            "default": ["NEUTRAL", "PRIDE", "SMUG"]
        },
        "kuudere": {
            "love": ["NEUTRAL", "SOFT", "PENSIVE"],
            "anger": ["NEUTRAL", "COLD_ANGER"],
            "sexy": ["NEUTRAL", "THINKING"],
            "default": ["NEUTRAL", "THINKING"]
        }
    }
    
    # Generic fallback for unmapped personas
    generic_emotion_map = {
        "love": ["SOFT", "JOY", "WARM"],
        "anger": ["ANGER", "ANNOYED", "FRUSTRATION"],
        "sad": ["SADNESS", "HURT", "SOFT"],
        "sexy": ["LUST", "SEXY", "CRAVING"],
        "default": ["NEUTRAL", "SOFT"]
    }
    
    # Persona-specific animation mapping
    persona_animations = {
        "yandere": ["FEMINEIDLE", "LOOKAROUND", "CONTEMPT", "ANXIETY", "ROMANCE", "FEMALEANGRY"],
        "yandere_aggressive": ["FEMALEANGRY", "ARGUING", "CONTEMPT", "LOOKAROUND", "FEMINEIDLE"],
        "goth_mommy": ["BREATHINGIDLE", "ADORATION", "WEIGHTSHIFT", "LOOKAROUND", "PRIDE", "FEMINEIDLE"],
        "nympho": ["CRAVING", "SEXY", "HAPPY", "EXCITEMENT", "FRONT", "FRONT2"],
        "amadere": ["BREATHINGIDLE", "ADORATION", "ROMANCE", "SOFT", "FEMINEIDLE"],
        "hajidere": ["BASHFUL", "AWKWARDNESS", "ANXIETY", "FEMINEIDLE"],
        "tsundere": ["BASHFUL", "ANNOYED", "FEMALEANGRY", "ARGUING", "FEMINEIDLE"],
        "toxic": ["CONTEMPT", "ANNOYED", "SHAKINGHEADNO", "DISMISS", "FEMINEIDLE"],
        "kamidere": ["BEINGCOCKY", "FEMALEVICTORY", "PRIDE", "ANNOYED", "FEMINEIDLE"],
        "kuudere": ["WEIGHTSHIFT", "TYPING", "FEMALETHINKING", "FEMINEIDLE"]
    }
    
    # Complete list of frontend-supported animations
    valid_animations = {
        "FEMINEIDLE", "LOOKAROUND", "CONTEMPT", "ANXIETY", "ROMANCE", "FEMALEANGRY", 
        "BASHFUL", "HAPPY", "ANNOYED", "BREATHINGIDLE", "ADORATION", "SOFT",
        "BEINGCOCKY", "FEMALEVICTORY", "PRIDE", "CRAVING", "SEXY", "EXCITEMENT",
        "NORMALKISS", "WEIGHTSHIFT", "SHAKINGHEADNO", "DISMISS", "ARGUING", "AWKWARDNESS",
        "FEMALETHINKING", "TYPING", "SAD", "DISAPPOINTMENT", "YAWN", "LAYING", "FRONT", "FRONT2", "FRONTSLOW",
        "MISSIONARY", "BACKSHOT", "BACKSHOTS", "BLOWJOB", "HANDJOB", "TITJOB", "AHEGAO"
    }

    # Detect user intent
    user_input_lower = user_input.lower()
    
    # 1. First check for extreme triggers (Disobedience/Anger/Jealousy)
    if any(word in user_input_lower for word in ["disobedient", "lie", "lied", "where were you", "who was that", "cheating"]):
        intent = "jealousy" if "yandere" in persona else "anger"
    elif any(word in user_input_lower for word in ["fuck", "sex", "backshots", "ride", "naked", "horny", "wet"]):
        intent = "sexy"
    elif any(word in user_input_lower for word in ["love", "adore", "cherish", "need you", "miss you"]):
        intent = "love"
    elif any(word in user_input_lower for word in ["beautiful", "cute", "amazing", "perfect", "admire"]):
        intent = "compliment"
    elif any(word in user_input_lower for word in ["hate", "dislike", "annoying", "angry"]):
        intent = "anger"
    elif any(word in user_input_lower for word in ["help", "assist", "support"]):
        intent = "help"
    elif any(word in user_input_lower for word in ["obey", "submit", "follow"]):
        intent = "obey"
    elif any(word in user_input_lower for word in ["sad", "lonely", "crying", "hurt"]):
        intent = "sad"
    else:
        intent = "default"
    
    # Get fallback emotion
    if persona in persona_emotions:
        emotion_map = persona_emotions[persona]
    else:
        emotion_map = generic_emotion_map
        
    fallback_emotions = emotion_map.get(intent, emotion_map["default"])
    fallback_emotion = fallback_emotions[0]  # Take first option
    
    # Get fallback animation
    fallback_animations = persona_animations.get(persona, ["FEMINEIDLE"])
    fallback_animation = fallback_animations[0]  # Take first option
    
    # Check if LLM response is appropriate
    emotion_ok = llm_emotion in fallback_emotions or llm_emotion in ["NEUTRAL", "JOY", "SOFT"] # Allow basic positive/neutral emotions generally
    
    # Strictly enforce negative emotions for negative intents
    if intent in ["jealousy", "anger", "insult"] and llm_emotion not in ["ANGER", "JEALOUSY", "ANNOYED", "FRUSTRATION", "DISGUST", "COLD_ANGER", "INTENSE", "SADNESS", "HURT"]:
        emotion_ok = False
        
    # Strictly enforce sexy emotions for sexual intents (except for shy personas)
    if intent == "sexy":
        if persona in ["hajidere", "fuandere", "anxious", "erohaji"]:
            if llm_emotion not in ["SHY", "ANXIETY", "FLUSTERED", "BASHFUL"]:
                emotion_ok = False
        elif persona in ["toxic", "tsundere"]:
             if llm_emotion not in ["DISGUST", "ANGER", "ANNOYED", "CONTEMPT"]:
                 emotion_ok = False
        else:
            if llm_emotion not in ["LUST", "SEXY", "CRAVING", "PLEASURE", "INTENSE"]:
                emotion_ok = False

    animation_is_valid = llm_animation in valid_animations
    
    # Ensure animation matches the emotion vibe loosely
    if llm_emotion in ["LUST", "CRAVING"] and llm_animation in ["BASHFUL", "SAD", "FEMALEANGRY"]:
        animation_is_valid = False
    elif llm_emotion in ["ANGER", "JEALOUSY"] and llm_animation in ["HAPPY", "CRAVING", "ADORATION"]:
        animation_is_valid = False

    # If LLM failed completely, use fallback
    if not emotion_ok and not animation_is_valid:
        return {
            "use_fallback": True,
            "emotion": fallback_emotion,
            "animation": fallback_animation,
            "reason": f"LLM failed completely: emotion={llm_emotion} (ok={emotion_ok}), animation={llm_animation} (valid={animation_is_valid})"
        }
    # If only emotion is wrong but animation is valid, fix just the emotion
    elif not emotion_ok and animation_is_valid:
        return {
            "use_fallback": True,
            "emotion": fallback_emotion,
            "animation": llm_animation,  # Keep LLM's valid animation
            "reason": f"Partial LLM fix: emotion={llm_emotion} (ok={emotion_ok}), animation kept={llm_animation} (valid)"
        }
    # If emotion is okay but animation is invalid/hallucinated
    elif emotion_ok and not animation_is_valid:
         return {
            "use_fallback": True,
            "emotion": llm_emotion, # Keep LLM's valid emotion
            "animation": fallback_animation,  
            "reason": f"Animation fix: emotion kept={llm_emotion} (ok), animation fixed={llm_animation} (invalid)"
        }
    
    return {
        "use_fallback": False,
        "emotion": llm_emotion,
        "animation": llm_animation,
        "reason": "LLM response is acceptable"
    }

# Test the fallback system
if __name__ == "__main__":
    test_cases = [
        ("yandere", "I love you", "NEUTRAL", "FEMINEIDLE"),
        ("tsundere", "You're so cute", "NEUTRAL", "FEMINEIDLE"),
        ("toxic", "I love you", "SOFT", "BASHFUL"),
        ("amadere", "I missed you", "JOY", "FEMINEIDLE"),
        ("dominant", "I'll obey you", "NEUTRAL", "FEMINEIDLE"),
        ("nympho", "You're so sexy", "NEUTRAL", "FEMINEIDLE"),
        ("hajidere", "You're beautiful", "NEUTRAL", "FEMINEIDLE"),
        ("goth_mommy", "I need comfort", "NEUTRAL", "FEMINEIDLE"),
        ("kamidere", "You're amazing", "NEUTRAL", "FEMINEIDLE"),
    ]
    
    print("TESTING PERSONA FALLBACK SYSTEM")
    print("=" * 50)
    
    for persona, user_input, llm_emotion, llm_animation in test_cases:
        result = get_persona_fallback(persona, user_input, llm_emotion, llm_animation)
        
        print(f"\nPersona: {persona}")
        print(f"Input: '{user_input}'")
        print(f"LLM: {llm_emotion} + {llm_animation}")
        print(f"Fallback: {result['emotion']} + {result['animation']}")
        print(f"Reason: {result['reason']}")
        print(f"Using Fallback: {result['use_fallback']}")
        print("-" * 30)
