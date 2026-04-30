from dataclasses import dataclass, field
from typing import Dict

VALID_EMOTIONS = {
    "JOY", "SOFT", "NEUTRAL", "ANGER", "DISGUST", "FRUSTRATION",
    "ANXIETY", "JEALOUSY", "LUST", "CURIOSITY", "AMUSEMENT",
    "SADNESS", "HURT", "PRIDE", "EVIL", "ROMANCE", "SHY"
}

VALID_ANIMATIONS = {
    "FEMINEIDLE", "BREATHINGIDLE", "HAPPY", "BASHFUL", "ANNOYED",
    "ARGUING", "FEMALEANGRY", "SAD", "NORMALKISS", "HUGGINGKISS",
    "BLOWJOB", "RIDING", "BACKSHOT", "MISSIONARY", "HANDJOB",
    "MASTURBATE", "UNDRESSING", "AHEGAO", "CRAVING", "SEXY",
    "TYPING", "FOCUS", "FEMALETHINKING", "CONTEMPT", "BEINGCOCKY",
    "LOOKAROUND", "ADORATION", "LOVE", "WAVE", "DRINKING", "SADDLE"
}

VALID_TOOLS = {"NONE", "set_3d_state"}

@dataclass
class LLMResponse:
    reply: str = ""
    base_emotion: str = "NEUTRAL"
    animation: str = "FEMINEIDLE"
    tool_call: str = "NONE"
    tool_params: Dict = field(default_factory=dict)
    persona_active: str = "amadere"
    thought: str = ""

    def validate(self):
        """Zero-Generic Zone: Neutral ko resting state mein badlo."""
        # 1. Agar reply khali hai toh character-specific English line uthao
        if not self.reply.strip() or self.reply in {"...", "I'm here."}:
            self.reply = _PERSONA_EMPTY_FALLBACKS.get(self.persona_active, "I'm watching you... speak.")
        
        # 2. Kill NEUTRAL: Har persona ka apna 'Default' emotion hota hai
        self.base_emotion = self.base_emotion.upper().strip()
        if self.base_emotion == "NEUTRAL":
            resting_map = {
                "toxic": "DISGUST",
                "yandere": "JEALOUSY",
                "dominant": "PRIDE",
                "tsundere": "FRUSTRATION",
                "amadere": "JOY",
                "hajidere": "ANXIETY",
                "goth_mommy": "PRIDE",
                "nympho": "LUST"
            }
            self.base_emotion = resting_map.get(self.persona_active, "JOY")
        
        # 3. AI-Driven Animation: Trust LLM unless severe mismatch
        # Only validate animation is valid, don't override with persona defaults
        self.animation = self.animation.upper().strip()
        if self.animation not in VALID_ANIMATIONS:
            self.animation = "FEMINEIDLE"  # Minimal fallback
        
        # 4. Final validation for remaining fields
        if self.base_emotion not in VALID_EMOTIONS:
            self.base_emotion = "JOY"  # Better default than NEUTRAL
        
        self.tool_call = self.tool_call.upper().strip()
        if self.tool_call not in VALID_TOOLS:
            self.tool_call = "NONE"
        
        return self

    def to_dict(self):
        """Convert to dictionary for API compatibility."""
        return {
            "reply": self.reply,
            "base_emotion": self.base_emotion,
            "animation": self.animation,
            "tool_call": self.tool_call,
            "tool_params": self.tool_params,
            "persona_active": self.persona_active,
            "thought": self.thought
        }

# Persona-specific empty fallbacks (English only)
_PERSONA_EMPTY_FALLBACKS = {
    "toxic": "*scoffs* What do you want?",
    "yandere": "*eyes lock on you* Don't keep me waiting.",
    "dominant": "*smirks* Speak up.",
    "tsundere": "*blushes* I-I wasn't waiting for you or anything!",
    "amadere": "*smiles warmly* Hello, darling.",
    "hajidere": "*hides face slightly* U-um... hi...",
    "goth_mommy": "*dark smile* Well now, look who's here.",
    "nympho": "*bites lip* About time you showed up...",
}

# Emotion fallbacks for empty replies
_EMOTION_FALLBACKS = {
    "JOY": "*smiles warmly* Hey you.",
    "CURIOSITY": "*tilts head* Tell me more.",
    "SOFT": "*opens arms* Come here.",
    "ANGER": "*crosses arms* Not now.",
    "SADNESS": "*holds you close* I'm here.",
    "HURT": "*looks away* That stings.",
    "LUST": "*bites lip* You're trouble.",
    "FRUSTRATION": "*sighs* Annoying.",
    "ANXIETY": "*blushes* U-um...",
    "JEALOUSY": "*narrows eyes* Mine.",
    "PRIDE": "*smirks* Of course.",
    "AMUSEMENT": "*giggles* Cute.",
    "DISGUST": "*scoffs* Whatever.",
    "EVIL": "*grins* Hehehe...",
}

def safe_defaults(data: dict, persona: str, petname: str) -> dict:
    """The Final CMD Formatter - ensures CMD-style JSON structure with AI-driven approach."""
    # Persona ko lower-case aur clean rakho
    active_p = data.get("persona_active", persona).lower()
    
    # Get raw LLM output
    raw_reply = data.get("reply", "")
    raw_emotion = data.get("base_emotion", "NEUTRAL").upper()
    raw_animation = data.get("animation", "FEMINEIDLE")
    
    # Apply smart animation filter - TRUST BUT VERIFY
    from .animation_resolver import smart_animation_filter
    filtered_animation, filtered_emotion = smart_animation_filter(
        raw_reply, raw_emotion, raw_animation, active_p
    )
    
    # Emotional Sanity: Toxic aur Yandere ko kabhi 'Happy' mat hone do default mein
    if active_p == "toxic" and filtered_emotion in {"JOY", "NEUTRAL", "HAPPY"}:
        filtered_emotion = "DISGUST"
    elif active_p == "yandere" and filtered_emotion == "NEUTRAL":
        filtered_emotion = "JEALOUSY"

    # Create the CMD-Style Response Object
    response = LLMResponse(
        thought=data.get("thought", "internalizing current state..."),
        reply=raw_reply,  # Keep LLM's original reply
        base_emotion=filtered_emotion,  # Use filtered emotion
        persona_active=active_p,
        animation=filtered_animation,  # Use filtered animation
        tool_call=data.get("tool_call", "NONE"),
        tool_params=data.get("tool_params", {})
    )

    # Run the character validation (now AI-driven)
    response = response.validate()

    # Final JSON structure exactly like CMD
    return response.to_dict()

def get_error_response(dominant_persona: str, error_type: str = "timeout") -> dict:
    """Character-driven error responses in English."""
    if error_type == "timeout":
        error_reply = {
            "toxic": "*scoffs* My connection is too fast for your garbage network. Try again.",
            "yandere": "Something tried to cut our connection... *eyes turn dark* Don't let it happen again. Speak.",
            "amadere": "Oh no! My mind went blank for a second, darling... can you repeat that?",
            "tsundere": "B-Baka! I wasn't listening because your signal is terrible! Say it again!",
            "dominant": "*smirks* Your network can't handle me. Fix it.",
            "hajidere": "*trembles* I-I'm sorry... the connection scared me...",
            "goth_mommy": "*dark chuckle* Even the darkness can't maintain our connection... pathetic.",
            "nympho": "*pouts* Aww... I was getting to the good part too... try again?"
        }
        emotion = "ANGER" if dominant_persona == "toxic" else "JEALOUSY" if dominant_persona == "yandere" else "NEUTRAL"
        animation = "ANNOYED" if dominant_persona in ["toxic", "tsundere"] else "FEMALETHINKING"
    else:
        error_reply = {
            "toxic": "*scoffs* Your system is garbage.",
            "yandere": "*eyes glow* Something broke... and it's going to pay.",
            "amadere": "Oh dear... something went wrong, darling.",
            "tsundere": "It's not my fault! Your system broke!"
        }
        emotion = "DISGUST" if dominant_persona == "toxic" else "NEUTRAL"
        animation = "CONTEMPT" if dominant_persona == "toxic" else "FEMALETHINKING"
    
    return {
        "thought": f"{error_type.title()} error. Maintaining persona through failure.",
        "reply": error_reply.get(dominant_persona, "Connection lost... try again?"),
        "base_emotion": emotion,
        "persona_active": dominant_persona,
        "animation": animation,
        "tool_call": "NONE",
        "tool_params": {}
    }

def get_fallback_reply(emotion: str) -> str:
    """Get contextual fallback reply based on emotion."""
    return _EMOTION_FALLBACKS.get(emotion.upper(), "*smiles softly* I'm here for you.")
