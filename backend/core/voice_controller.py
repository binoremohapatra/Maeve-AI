"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                    MAEVE VOICE CONTROLLER v2.1                               ║
║            "One Voice, Infinite Moods" — Emotional TTS Dynamics            ║
║                                                                            ║
║  Voices: af_nicole (lust/seductive override) | af_kore / bf_isabella (mature)║
║          af_sky (natural/sweet) | af_sarah (cute/flustered)                ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import logging
from typing import Literal

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# TYPE ALIASES
# ──────────────────────────────────────────────────────────────────────────────

VoiceID  = Literal["af_nicole", "af_sky", "af_sarah", "af_kore", "bf_isabella", "af_bella"]
ToneStr  = str   # lowercase emotion label returned in the result dict

# ──────────────────────────────────────────────────────────────────────────────
# PERSONA → BASE VOICE MAP (Updated for Ultimate Realism)
# ──────────────────────────────────────────────────────────────────────────────
#
#  bf_isabella/af_kore — Deep, mature, older woman vibe (Mommy/Dominant/Ice Queen).
#  af_sky              — Most realistic, bright, natural girl (Wife/Sweet/Perfect).
#  af_sarah            — High, youthful, cute. (Shy / Tsundere / Yandere).
#  af_nicole           — EXCLUSIVELY USED FOR LUST/SEDUCING OVERRIDES.
#

PERSONA_VOICE_MAP: dict[str, VoiceID] = {
    # ── MATURE / DOMINANT / MOMMY (The Older/Commanding Vibe) ─────────────
    "goth_mommy":        "bf_isabella",  # British, very classy and dominant
    "dominant":          "bf_isabella",
    "dominant_passion":  "bf_isabella",
    "sadodere":          "af_kore",      # Mature but a bit flat/unhinged
    "dark_devotion":     "af_kore",
    "yanmeta":           "af_kore",
    "kuudere":           "af_kore",
    "mamadere":          "bf_isabella",

    # ── WARM / WIFE-MATERIAL / REAL GIRL (The most natural voice: af_sky) ──
    "amadere":              "af_sky",
    "sweet":                "af_sky",
    "deretsun":             "af_sky",
    "deredere_kekkondere":  "af_sky",
    "butsudere":            "af_sky",
    "kakkodere":            "af_sky",
    "independent":          "af_sky",
    "ambitious":            "af_sky",
    "perfect":              "af_sky",

    # ── CUTE / SHY / TSUNDERE / YANDERE (The sharper/youthful voice: af_sarah) ──
    "yandere":              "af_sarah",  # Yandere sounds creepier when youthful
    "yandere_stalker":      "af_sarah",
    "yandere_aggressive":   "af_sarah",
    "yandere_worship":      "af_sarah",
    "tsundere":             "af_sarah",
    "hajidere":             "af_sarah",
    "fuandere":             "af_sarah",
    "anxious":              "af_sarah",
    "danyan":               "af_sarah",
    "doromuga":             "af_sarah",
    "dorodere":             "af_sarah",
    "ambidere":             "af_sarah",
    "erohaji":              "af_sarah",
    "erodere":              "af_sarah",
    "narudere":             "af_sarah",
    "yanheat":              "af_sarah",
    "kamidere":             "af_sarah",
    "toxic":                "af_sarah",
    "nympho":               "af_sarah", # Starts youthful, drops to af_nicole on LUST
    
    # ── FALLBACK ──────────────────────────────────────────────────────────────
    "default":              "af_sky"
}

# ──────────────────────────────────────────────────────────────────────────────
# NATURAL BASELINE PARAMETERS  (the resting "personality" of each voice)
# ──────────────────────────────────────────────────────────────────────────────

_VOICE_BASELINE: dict[VoiceID, tuple[float, float]] = {
    #                       (speed,  pitch)
    "af_nicole":   (0.93, 0.93),   # Naturally low and slow — sultry resting tone
    "bf_isabella": (0.95, 0.95),   # British mature — authoritative
    "af_kore":     (0.96, 0.96),   # Cold/Flat mature
    "af_sky":      (1.00, 1.00),   # True neutral, most realistic
    "af_bella":    (0.97, 0.98),   # Warm and relaxed
    "af_sarah":    (1.04, 1.06),   # Slightly fast/high — naturally flustered energy
}

# ──────────────────────────────────────────────────────────────────────────────
# EMOTION SETS  (grouped for clean logic below)
# ──────────────────────────────────────────────────────────────────────────────

_LUST_EMOTIONS = {
    "LUST", "SEXUAL_DESIRE", "SEXY", "CRAVING", "AROUSED", "HORNY",
}

_HOT_RAGE_EMOTIONS = {        # Shouting, losing control
    "ANGER", "RAGE", "FRUSTRATION", "ANGRY"
}

_COLD_ANGER_EMOTIONS = {      # Calculated, chilling villain tone
    "JEALOUSY", "EVIL", "DISGUST",
}

_BROKEN_EMOTIONS = {          # Cracking, crying voice
    "SADNESS", "SAD", "HURT", "DESPAIR", "GUILT",
}

_PANIC_EMOTIONS = {           # Hyperventilating, terrified
    "FEAR", "ANXIETY", "PANIC", "SHAME",
}

_EUPHORIA_EMOTIONS = {        # Bubbly, thrilled
    "JOY", "EXCITEMENT", "HAPPY", "TRIUMPH", "AMUSEMENT", "SATISFACTION",
}

_SOFT_INTIMATE_EMOTIONS = {   # Gentle, adoring
    "ROMANCE", "ADORATION", "SOFT",
}

_CURIOSITY_EMOTIONS = {       # Focused, thoughtful
    "CURIOSITY", "FOCUS", "INTEREST",
}

_PRIDE_CALM_EMOTIONS = {      # Measured, poised
    "PRIDE", "CALMNESS", "NEUTRAL",
}

# ──────────────────────────────────────────────────────────────────────────────
# CORE FUNCTION
# ──────────────────────────────────────────────────────────────────────────────

def get_voice_dynamics(persona: str, emotion: str, user_id: str = None) -> dict:
    """
    Dynamically resolve Kokoro TTS parameters from persona and emotion.
    """
    persona_key = persona.lower().strip()
    emotion_key = emotion.upper().strip()

    logger.debug(f"get_voice_dynamics → persona='{persona_key}'  emotion='{emotion_key}'")

    # CHECK FOR USER VOICE OVERRIDE FIRST
    if user_id:
        try:
            # Import user_preferences from chat routes
            import sys
            import os
            sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            from routes.chat_routes import user_preferences
            
            saved_voice = user_preferences.get(user_id, {}).get('voice_override')
            if saved_voice and saved_voice != "af_bella":  # af_bella is default
                logger.info(f"Using user voice override: {saved_voice}")
                # Return user's preferred voice with neutral settings
                speed, pitch = _VOICE_BASELINE.get(saved_voice, (1.0, 1.0))
                return {
                    "voice": saved_voice,
                    "speed": speed,
                    "pitch": pitch,
                    "style": "user_override"
                }
        except Exception as e:
            logger.warning(f"Failed to load user preferences: {e}")

    # ── Step 1: Resolve base voice and natural resting parameters ─────────────
    voice: VoiceID = PERSONA_VOICE_MAP.get(persona_key, "af_sky")
    
    # Safely get baseline, fallback to (1.0, 1.0) if voice not in dict
    speed, pitch   = _VOICE_BASELINE.get(voice, (1.0, 1.0))

    # ── Step 2: Apply emotion rules (highest-priority rules first) ────────────

    # ══ RULE 1: THE LUST OVERRIDE ════════════════════════════════════════════
    # No matter the persona, sexual desire always routes through af_nicole.
    # Simulates a breathy, seductive whisper directly in the listener's ear.
    if emotion_key in _LUST_EMOTIONS:
        voice = "af_nicole"
        speed = 0.75   # Drawn-out syllables, slow exhale
        pitch = 0.84   # Deep, husky, intimate

    # ══ RULE 2: HOT RAGE — shouting, uncontrolled ════════════════════════════
    elif emotion_key in _HOT_RAGE_EMOTIONS:
        speed = _clamp(speed + 0.22, 1.10, 1.30)   # Fast, erratic
        pitch = _clamp(pitch + 0.14, 0.95, 1.25)   # Sharp, cracking upward

    # ══ RULE 3: COLD ANGER — calculated, villain-mode ════════════════════════
    elif emotion_key in _COLD_ANGER_EMOTIONS:
        speed = _clamp(speed - 0.16, 0.70, 0.94)   # Deliberate, icy slow
        pitch = _clamp(pitch - 0.14, 0.80, 0.92)   # Deep, threatening

    # ══ RULE 4: BROKEN / CRYING ══════════════════════════════════════════════
    # Voice cracks upward in pitch while slowing down to a weeping pace.
    elif emotion_key in _BROKEN_EMOTIONS:
        speed = _clamp(speed - 0.18, 0.70, 0.85)   # Heavy, dragging
        pitch = _clamp(pitch + 0.12, 1.00, 1.20)   # Wavering, high and cracking

    # ══ RULE 5: PANIC ════════════════════════════════════════════════════════
    # Hyperventilating — fastest speed, highest pitch.
    elif emotion_key in _PANIC_EMOTIONS:
        speed = _clamp(speed + 0.26, 1.15, 1.30)   # Breathless, rapid-fire
        pitch = _clamp(pitch + 0.19, 1.10, 1.25)   # High, trembling shriek

    # ══ RULE 6: EUPHORIA ═════════════════════════════════════════════════════
    elif emotion_key in _EUPHORIA_EMOTIONS:
        speed = _clamp(speed + 0.12, 0.98, 1.20)   # Bubbly, fast
        pitch = _clamp(pitch + 0.12, 1.00, 1.18)   # Bright, soaring

    # ══ RULE 7: SOFT / INTIMATE ══════════════════════════════════════════════
    elif emotion_key in _SOFT_INTIMATE_EMOTIONS:
        speed = _clamp(speed - 0.10, 0.75, 0.90)   # Slow, tender
        pitch = _clamp(pitch - 0.05, 0.88, 1.00)   # Low-warm, loving

    # ══ RULE 8: CURIOSITY / FOCUS ════════════════════════════════════════════
    elif emotion_key in _CURIOSITY_EMOTIONS:
        speed = _clamp(speed - 0.04, 0.88, 1.00)   # Thoughtful, measured
        pitch = _clamp(pitch + 0.02, 0.95, 1.08)   # Slight upward lilt

    # ══ RULE 9: PRIDE / CALM — barely touched, persona takes precedence ══════
    elif emotion_key in _PRIDE_CALM_EMOTIONS:
        # Keep the voice in its natural resting state; no dramatic shift.
        pass   # speed & pitch already set from baseline above

    # ══ DEFAULT: Unknown emotion — fall through to baseline ══════════════════
    else:
        logger.debug(f"Unknown emotion '{emotion_key}' — using persona baseline")

    result = {
        "voice": voice,
        "pitch": round(pitch, 2),
        "speed": round(speed, 2),
        "tone":  emotion_key.lower(),
    }

    logger.info(
        f"🔊 VOICE → {voice} | speed={result['speed']:.2f} | "
        f"pitch={result['pitch']:.2f} | tone={result['tone']} "
        f"[persona={persona_key}]"
    )
    return result


# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _clamp(value: float, lo: float, hi: float) -> float:
    """Constrain a float to [lo, hi]."""
    return max(lo, min(hi, value))


# ──────────────────────────────────────────────────────────────────────────────
# QUICK SANITY-CHECK  (run:  python voice_controller.py)
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    tests = [
        # persona              emotion
        ("goth_mommy",         "NEUTRAL"),
        ("goth_mommy",         "LUST"),
        ("hajidere",           "LUST"),          # LUST OVERRIDE: should → af_nicole
        ("yandere_aggressive", "ANGER"),
        ("yandere_stalker",    "EVIL"),
        ("hajidere",           "PANIC"),
        ("sweet",              "JOY"),
        ("tsundere",           "SADNESS"),
        ("dominant",           "COLD_ANGER"),    # unknown emotion → baseline
        ("kuudere",            "ROMANCE"),
        ("nympho",             "CRAVING"),
        ("mamadere",           "ADORATION"),
        ("unknown_persona",    "HAPPY"),         # unknown persona → af_sky
    ]

    print("\n" + "═" * 70)
    print(f"  {'PERSONA':<22}  {'EMOTION':<18}  VOICE       SPEED  PITCH")
    print("═" * 70)

    for persona, emotion in tests:
        r = get_voice_dynamics(persona, emotion)
        print(
            f"  {persona:<22}  {emotion:<18}  {r['voice']:<11} "
            f"{r['speed']:.2f}   {r['pitch']:.2f}"
        )

    print("═" * 70 + "\n")