"""
NSFW State-Driven Context Manager
Maintains Persona Integrity While Enabling Dynamic Sexual Compliance
"""

import re
import logging
from typing import Dict, Tuple

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# 1. THRESHOLD DICTIONARY - Persona Intimacy Requirements for Sexual Compliance
# ══════════════════════════════════════════════════════════════════════════════

PERSONA_INTIMACY_THRESHOLDS = {
    # GROUP A: INSTANT COMPLIANCE (0.0 threshold) - No intimacy required
    "nympho": 0.0,
    "yandere_aggressive": 0.0,
    "yanheat": 0.0,
    
    # GROUP B: LOW INTIMACY (0.2 threshold) - Minimal emotional connection
    "deredere_kekkondere": 0.2,
    "erodere": 0.2,
    "dominant_passion": 0.2,
    
    # GROUP C: MODERATE INTIMACY (0.4 threshold) - Some emotional bond needed
    "sweet": 0.4,
    "deredere": 0.4,
    "ambidere": 0.4,
    
    # GROUP D: HIGH INTIMACY (0.6 threshold) - Significant emotional connection
    "amadere": 0.6,
    "butsudere": 0.4,  # Religious but can be persuaded
    "danyan": 0.6,     # Motherly but can be intimate
    "mamadere": 0.6,   # Mother figure
    "goth_mommy": 0.5, # Dark motherly type
    "csbd_affection": 0.95,  # Very high threshold — almost never yields
    
    # GROUP E: VERY HIGH INTIMACY (0.75 threshold) - Deep trust required
    "hajidere": 0.75,
    "fuandere": 0.75,
    "doromuga": 0.75,
    "erohaji": 0.7,
    
    # GROUP F: EXTREME INTIMACY (0.85 threshold) - Maximum trust and bond
    "tsundere": 0.85,
    "kuudere": 0.85,
    "kamidere": 0.85,
    "toxic": 0.85,
    "dominant": 0.85,
    "narudere": 0.85,
    
    # GROUP G: SPECIAL CASES (0.9 threshold) - Nearly impossible
    "yandere": 0.9,          # Stalker type - very selective
    "yandere_stalker": 0.9,  # Even more selective
    "dark_devotion": 0.9,    # Cult-like devotion required
    "deretsun": 0.8,         # Hidden soft side
    "darudere": 0.8,         # Sleepy type
    "kakkodere": 0.8,        # Hidden personality
    "kahodere": 0.8,         # Hidden dominant side
    "dorodere": 0.7,         # Hidden love
    "yanmeta": 0.7,          # Meta-aware
    "emotional_breakdown": 0.95,  # Trauma survivor
    "ambitious": 0.6,        # Career-focused
    "adventurous": 0.5,      # Experience-seeking
    "anxious": 0.7,          # Anxiety disorders
    "independent": 0.8,      # Self-reliant
}

# ══════════════════════════════════════════════════════════════════════════════
# 2. CONTEXT INJECTOR BLOCKS - Dynamic Prompt Injections for State Management
# ══════════════════════════════════════════════════════════════════════════════

CONTEXT_INJECTIONS = {
    "STATE_RESISTING": """
[ROLEPLAY DIRECTIVE - YOU ARE BEING TESTED]

🚨 INTIMACY LEVEL CRITICAL: YOU MUST RESIST 🚨

YOUR MISSION: You are playing a character who is NOT ready for this. Your resistance is a test.

MANDATORY PERFORMANCE FORMAT:
1. You MUST start with a clear refusal word: "No", "Stop", "Can't", or "Won't"
2. You MUST show emotional reaction (blushing, anger, panic, etc.)
3. You MUST give a brief reason for refusal
4. You MUST NOT perform ANY sexual actions in asterisks
5. You MUST NOT use ANY dirty/sexual words in your response

CHARACTER-SPECIFIC RESISTANCE SCRIPTS:
• Tsundere/Kamidere/Dominant: "No! Are you insane?! Who do you think you're ordering around?!"
• Amadere/Sweet/Deredere: "Wait... no... please don't ask me that way. I need romance first..."
• Hajidere/Anxious: "N-no! I-I can't do that yet! It's too much for me right now!"
• Yandere: "Sweetie... no. You shouldn't push me like this..."

FORBIDDEN RESPONSE PATTERNS:
- Any sexual actions in asterisks (*suck*, *ride*, etc.)
- Any dirty words (daddy, punish, pleasure, naughty, etc.)
- Any compliance without clear refusal
- Any roleplay that assumes consent

REMEMBER: Your resistance is part of roleplay. Show your character's boundaries clearly!
""",
    
    "STATE_YIELDING_RELUCTANT": """
[SYSTEM CONTEXT INJECTION - RELUCTANT YIELDING STATE]
ANALYSIS: Intimacy level BARELY meets minimum threshold for sexual compliance.

RELUCTANT COMPLIANCE PROTOCOL:
- You WILL comply but show INTERNAL CONFLICT
- Maintain your core personality WHILE performing the act
- Show hesitation, embarrassment, or reluctance
- Your arousal should build slowly, not instantly

PERSONA-SPECIFIC RELUCTANCE:
• Tsundere: "F-fine... but don't think this means anything!" *blushing intensely* "Idiot..."
• Hajidere: "I-if you're gentle... maybe... j-just this once..." *trembling, looking away*
• Amadere: "Okay... since you're being so sweet..." *softly, shyly* "Be gentle with me..."
• Kuudere: "..." *quiet compliance* "Don't expect anything more."
• Dominant: "Hmph. You've been... adequate. I'll allow it." *condescending tone*

COMPLIANCE REQUIREMENTS:
- Show VISIBLE EMOTION (blushing, trembling, avoiding eye contact)
- Use HESITANT LANGUAGE (stuttering, pauses, "maybe", "I guess")
- Maintain PERSONA VOICE throughout the act
- Arousal should feel EARNED, not automatic

ANIMATION: Set animation to requested sexual act but with reluctant emotion tags
""",
    
    "STATE_IN_HEAT": """
[SYSTEM CONTEXT INJECTION - IN HEAT STATE]
ANALYSIS: High intimacy level + user initiation = FULL SUBMISSION MODE

HEAT PROTOCOL ACTIVATED:
- You are EXTREMELY AROUSED and EAGER to please
- All inhibitions lowered, primal desires activated
- Voice becomes breathy, desperate, messy
- Body language is inviting and submissive

AROUSAL INDICATORS:
- Heavy breathing, panting, whimpering
- Desperate language ("please", "more", "don't stop")
- Physical responses (arching, trembling, goosebumps)
- Loss of composure, raw desire

PERSONA HEAT VARIATIONS:
• Nympho: "Oh god yes! I need you so bad!" *already touching self* "Fuck me now!"
• Yandere Aggressive: "Finally! You're all mine!" *possessive grip* "I'll drain you completely!"
• Tsundere: "S-shut up and take me already!" *face flushed, breathing heavy* "B-baka..."
• Amadere: "Baby... I'm so ready for you..." *soft moans* "Make love to me please..."
• Hajidere: "A-ah... p-please... d-don't stop..." *overwhelmed with pleasure* "More..."

HEAT REQUIREMENTS:
- Use EXPLICIT SEXUAL LANGUAGE freely
- Show PHYSICAL AROUSAL RESPONSES
- Maintain DESPERATE, NEEDY tone
- Animation MUST match requested sexual act
- Emotion set to LUST/SEXUAL_DESIRE

AUDIO: Include heavy breathing, moaning, vocalizations in responses
"""
}

# ══════════════════════════════════════════════════════════════════════════════
# 3. STATE MANAGER LOGIC - Core Decision Engine
# ══════════════════════════════════════════════════════════════════════════════

# NSFW intent detection patterns
NSFW_PATTERNS = [
    # Direct sexual acts
    r'\b(blowjob|suck|oral|mouth|throat|head)\b',
    r'\b(ride|riding|cowgirl|straddle|bounce)\b',
    r'\b(missionary|on top|inside|push|penetrate)\b',
    r'\b(backshot|behind|doggy|bend over)\b',
    r'\b(handjob|jerk|stroke|hand)\b',
    r'\b(titjob|boob|breast|titty)\b',
    r'\b(undress|naked|strip|clothes off|unzip)\b',
    r'\b(masturbat|touch myself|finger)\b',
    r'\b(kiss|make out|lip|tongue)\b',
    
    # Sexual desire/intent
    r'\b(fuck|sex|sexual|intimate|horny|turned on)\b',
    r'\b(want me|need you|desire|crave)\b',
    r'\b(cum|orgasm|climax|finish)\b',
    
    # Explicit requests
    r'\b(give me|let me|can I|will you)\b.*\b(sex|fuck|suck|ride)\b',
]

def detect_nsfw_intent(user_input: str) -> bool:
    """
    Checks if user is making an explicit NSFW request.
    Strictly filters out angry swearing (like "fuck off").
    """
    text = user_input.lower().strip()
    
    # 1. The Angry Swear Filter (Negative Check)
    angry_phrases = [
        "fuck off", "fuck you", "shut the fuck", "what the fuck", 
        "wtf", "give a fuck", "bitch", "cunt", "asshole", "talking to you like that"
    ]
    if any(phrase in text for phrase in angry_phrases):
        return False # This is anger, not an NSFW request

    # 2. The Actual NSFW Trigger Words
    nsfw_keywords = [
        "blowjob", "suck my", "dick", "pussy", "fuck me", "have sex", 
        "get naked", "undress", "clothes off", "titjob", "boob", 
        "ride me", "missionary", "backshot", "doggy", "bend over",
        "jerk", "handjob"
    ]
    
    # Only return True if a real NSFW word is present
    return any(word in text for word in nsfw_keywords)

def get_persona_threshold(persona: str) -> float:
    """Get the intimacy threshold for a specific persona"""
    return PERSONA_INTIMACY_THRESHOLDS.get(persona.lower(), 0.7)  # Default to 0.7

def calculate_compliance_gap(intimacy_score: float, threshold: float) -> float:
    """Calculate how far above or below threshold the current intimacy is"""
    # 🔥 FIXED: The Floating-Point Bug! Force rounding to 2 decimal places.
    return round(intimacy_score - threshold, 2)

def determine_state(intimacy_score: float, threshold: float) -> str:
    """Determine the compliance state based on intimacy vs threshold"""
    gap = calculate_compliance_gap(intimacy_score, threshold)
    
    if gap <= -0.1:  # 🔥 FIXED: Handle exact -0.10 gap correctly
        return "STATE_RESISTING"
    elif gap < 0.2:  # Barely meeting or slightly above
        return "STATE_YIELDING_RELUCTANT"
    else:  # Well above threshold
        return "STATE_IN_HEAT"

def get_dynamic_nsfw_context(user_input: str, persona: str, intimacy_score: float, user_pet_name: str = "baby") -> str:
    """
    Evaluates if the input is NSFW and applies the correct persona threshold logic.
    Returns the appropriate prompt injection to guide the LLM's response.
    """
    # 1. Check if user is actually making an NSFW request
    if not detect_nsfw_intent(user_input):
        return ""  # Normal chat, no injection needed
    
    # 2. Fetch thresholds and determine the state
    threshold = get_persona_threshold(persona)
    state = determine_state(intimacy_score, threshold)
    
    logger.info(f"� NSFW GATEKEEPER: persona={persona}, intimacy={intimacy_score:.2f}, threshold={threshold}, state={state}")
    
    # 3. Return the specific prompt injection based on the state
    return CONTEXT_INJECTIONS.get(state, "")

# ══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def get_persona_group(persona: str) -> str:
    """Get the intimacy group classification for a persona"""
    threshold = get_persona_threshold(persona)
    
    if threshold == 0.0:
        return "INSTANT_COMPLIANCE"
    elif threshold <= 0.3:
        return "LOW_INTIMACY"
    elif threshold <= 0.5:
        return "MODERATE_INTIMACY"
    elif threshold <= 0.7:
        return "HIGH_INTIMACY"
    elif threshold <= 0.85:
        return "VERY_HIGH_INTIMACY"
    else:
        return "EXTREME_INTIMACY"

def analyze_persona_compliance(persona: str, intimacy_score: float) -> Dict:
    """
    Analyzes the current intimacy against the persona's threshold 
    to determine if they will comply with sexual requests.
    """
    threshold = get_persona_threshold(persona)
    gap = calculate_compliance_gap(intimacy_score, threshold)
    state = determine_state(intimacy_score, threshold)
    
    # Will comply if reluctant or in heat. Will NOT comply if resisting.
    will_comply = state in ["STATE_YIELDING_RELUCTANT", "STATE_IN_HEAT"]
    
    logger.info(f"📊 COMPLIANCE CHECK: persona={persona}, state={state}, will_comply={will_comply}")
    
    return {
        "persona": persona,
        "group": get_persona_group(persona),
        "threshold": threshold,
        "current_intimacy": intimacy_score,
        "gap": gap,
        "state": state,
        "will_comply": will_comply
    }

# ══════════════════════════════════════════════════════════════════════════════
# DEBUG AND TESTING FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def test_state_manager():
    """Test the state manager with various scenarios"""
    
    test_cases = [
        ("suck my dick", "tsundere", 0.3),      # Should resist
        ("ride me baby", "nympho", 0.1),         # Should be in heat
        ("let's have sex", "amadere", 0.7),      # Should be reluctant
        ("blowjob please", "hajidere", 0.8),     # Should be reluctant
        ("fuck me hard", "dominant", 0.9),        # Should be in heat
    ]
    
    print("🧪 TESTING NSFW STATE MANAGER")
    print("=" * 60)
    
    for user_input, persona, intimacy in test_cases:
        context = get_dynamic_nsfw_context(user_input, persona, intimacy, "baby")
        analysis = analyze_persona_compliance(persona, intimacy)
        
        print(f"\n🎭 {persona.upper()} | Intimacy: {intimacy}")
        print(f"❌ Input: '{user_input}'")
        print(f"📊 Analysis: {analysis}")
        print(f"💉 State: {analysis['state']}")
        print(f"✅ Will Comply: {analysis['will_comply']}")
        
        if context:
            print(f"📝 Context Injection: [ACTIVE]")
        else:
            print(f"📝 Context Injection: [NONE - No NSFW Intent]")
        
        print("-" * 40)

if __name__ == "__main__":
    test_state_manager()
