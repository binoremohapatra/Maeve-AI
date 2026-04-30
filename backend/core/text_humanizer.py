#!/usr/bin/env python3
"""
🌅 HUMANIZER: Text Humanization Engine
Transforms AI responses into natural, human-like text optimized for Kokoro TTS.
Includes fixes for Pronoun Confusion (3rd Person Bleed).
"""

import random
import re
import logging

logger = logging.getLogger(__name__)

class TextHumanizer:
    """🌅 Makes AI responses sound like a real person, optimized for Kokoro TTS."""
    
    def __init__(self):
        """Initialize the text humanizer"""
        self.humanization_rules = {
            "yandere": {"style": "dark_intense", "fillers": ["wait", "look", "literally"], "punctuation": ["...", "...", "!"], "capitalization": "lowercase"},
            "yandere_stalker": {"style": "obsessive_stalker", "fillers": ["...", "literally"], "punctuation": ["...", "..."], "capitalization": "lowercase"},
            "yandere_aggressive": {"style": "aggressive_yandere", "fillers": ["fuck", "look"], "punctuation": ["!", "!"], "capitalization": "lowercase"},
            "yandere_worship": {"style": "obsessive_stalker", "fillers": ["please", "god"], "punctuation": ["...", "."], "capitalization": "lowercase"},
            "amadere": {"style": "caring_wife", "fillers": ["um", "actually", "like", "totally"], "punctuation": ["...", "."], "capitalization": "lowercase"},
            "hajidere": {"style": "shy_stuttering", "fillers": ["u-um", "ah", "s-sorry"], "punctuation": ["...", "..."], "capitalization": "lowercase"},
            "tsundere": {"style": "defensive_tsundere", "fillers": ["ugh", "idiot", "whatever"], "punctuation": ["!", "."], "capitalization": "lowercase"},
            "kamidere": {"style": "arrogant_kamidere", "fillers": ["well", "obviously", "fine"], "punctuation": ["!", "?", "."], "capitalization": "lowercase"},
            "kichidere": {"style": "broken_healing", "fillers": ["...", "sometimes", "broken"], "punctuation": ["...", "..."], "capitalization": "lowercase"},
            "dorodere": {"style": "fake_sweet", "fillers": ["sweetie", "actually"], "punctuation": ["...", "."], "capitalization": "lowercase"},
            "kuudere": {"style": "ice_cold", "fillers": ["...", "factual", "so"], "punctuation": ["...", "."], "capitalization": "lowercase"},
            "goth_mommy": {"style": "dominant_dark", "fillers": ["literally", "ugh", "hush"], "punctuation": ["...", "."], "capitalization": "lowercase"},
            "dark_devotion": {"style": "obsessive_magic", "fillers": ["...", "forever"], "punctuation": ["...", "..."], "capitalization": "lowercase"},
            "nympho": {"style": "compulsive_distressed", "fillers": ["literally", "ugh", "god"], "punctuation": ["...", "..."], "capitalization": "lowercase"},
            "anxious": {"style": "shy_stuttering", "fillers": ["u-um", "ah", "s-sorry", "maybe"], "punctuation": ["...", "..."], "capitalization": "lowercase"},
            "toxic": {"style": "defensive_tsundere", "fillers": ["ugh", "whatever", "seriously"], "punctuation": ["!", "."], "capitalization": "lowercase"},
            "dominant": {"style": "dominant_dark", "fillers": ["well", "listen", "hush"], "punctuation": ["...", "."], "capitalization": "lowercase"}
        }
        
        self.visceral_fillers = {
            "affection": ["literally", "actually", "like", "totally"],
            "frustration": ["ugh", "omg", "seriously", "for real"],
            "excitement": ["omg", "literally", "like", "actually"],
            "thinking": ["hmm", "like", "idk", "tbh"],
            "agreement": ["yeah", "totally", "for sure", "def"]
        }
    
    def humanize_response(self, ai_response: str, persona: str, intensity: float = 0.6) -> str:
        """
        🌅 Transforms AI response into human-like text based on persona
        """
        rules = self.humanization_rules.get(persona, self.humanization_rules["amadere"])
        humanized = ai_response
        
        # 🛑 FIX 1: PRONOUN CONFUSION (3rd Person Bleed)
        # Often small models will output "I love him" instead of "I love you" because of prompt rules.
        # We manually fix common 3rd person slips if they refer to the user.
        humanized = self._fix_perspective_bleed(humanized)

        dark_personas = ["yandere", "yandere_aggressive", "yandere_stalker", "yanmeta", "toxic", "kamidere", "goth_mommy", "kuudere"]
        
        if persona in dark_personas:
            humanized = humanized.replace("Hey babe, ", "").replace("Hey darling, ", "")
            humanized = humanized.replace("hey babe, ", "").replace("hey darling, ", "")
            humanized = humanized.replace("Don't worry, ", "").replace("don't worry, ", "")
            humanized = humanized.replace("Don't worry about it", "").replace("don't worry about it", "")
        
        if rules["capitalization"] == "lowercase":
            humanized = humanized.lower()
            
        # Add fillers based on style (ONLY for non-dark personas)
        if persona not in dark_personas:
            if rules["style"] == "shy_stuttering":
                humanized = self._apply_stuttering(humanized)
            elif rules["style"] == "aggressive_caps":
                humanized = humanized.upper()
            elif rules["style"] == "all_lowercase":
                humanized = self._apply_slow_typing(humanized)
            
            # Add visceral fillers ONLY for sweet/casual personas
            if intensity > 0.4:
                for filler in rules["fillers"]:
                    if random.random() < 0.3:  # 30% chance to add filler
                        humanized = self._insert_filler(humanized, filler)
        else:
            if rules["style"] == "aggressive_caps":
                humanized = humanized.upper()
            elif rules["style"] == "shy_stuttering":
                humanized = self._apply_stuttering(humanized)
            elif rules["style"] == "all_lowercase":
                humanized = self._apply_slow_typing(humanized)
        
        # Add natural imperfections
        if intensity > 0.5:
            humanized = self._add_natural_imperfections(humanized)
            
        # Replace robotic phrases
        humanized = self._replace_robotic_phrases(humanized)

        return humanized

    def _fix_perspective_bleed(self, text: str) -> str:
        """Fixes cases where the LLM accidentally refers to the user in the 3rd person."""
        # Simple string replacements for common mistakes made by the model.
        # This is a brute-force cleanup for "he/him/his" meant to be "you/your".
        
        replacements = [
            (r"\bhe belongs\b", "you belong"),
            (r"\bhe belongs to me\b", "you belong to me"),
            (r"\bhe is\b", "you are"),
            (r"\bhe's\b", "you're"),
            (r"\bhis heart\b", "your heart"),
            (r"\bhis body\b", "your body"),
            (r"\btell him\b", "tell you"),
            (r"\btoward him\b", "toward you"),
            (r"\bwith him\b", "with you"),
            (r"\bfor him\b", "for you"),
            (r"\bhurt him\b", "hurt you"),
            (r"\bprotect him\b", "protect you"),
            (r"\bmake him\b", "make you"),
            (r"\bwithout him\b", "without you")
        ]
        
        fixed_text = text
        for pattern, replacement in replacements:
            # Uses regex with word boundaries \b to ensure we don't replace parts of words
            fixed_text = re.sub(pattern, replacement, fixed_text, flags=re.IGNORECASE)
            
        return fixed_text

    def _apply_stuttering(self, text: str) -> str:
        """Apply stuttering effect optimized for Kokoro TTS."""
        words = text.split()
        stuttered = []
        for word in words:
            # Ensure we don't stutter roleplay actions enclosed in asterisks
            if not word.startswith('*') and len(word) > 2 and word[0].isalpha():
                if random.random() < 0.25:  # 25% chance to stutter
                    # 🛑 FIX 2: Kokoro TTS Stutter format (e.g., "p... please" instead of "p-please")
                    stuttered.append(f"{word[0]}... {word}")
                    continue
            stuttered.append(word)
        return " ".join(stuttered)
                
    def _apply_slow_typing(self, text: str) -> str:
        """Apply slow typing effect with pauses for Kokoro TTS."""
        return text.replace(" ", " ... ")

    def _insert_filler(self, text: str, filler: str) -> str:
        """Inserts filler at natural positions with pauses for Kokoro TTS."""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        # 🛑 FIX 3: Add ellipses (...) with fillers so Kokoro breathes before/after them
        formatted_filler = f"... {filler}... "
        
        if len(sentences) > 1:
            insert_pos = random.randint(1, len(sentences)-1)
            sentences.insert(insert_pos, formatted_filler)
        else:
            insert_pos = random.choice([0, len(text)//2, len(text)])
            if insert_pos == 0:
                text = formatted_filler + text
            elif insert_pos >= len(text):
                text = text + " " + formatted_filler
            else:
                text = text[:insert_pos] + formatted_filler + text[insert_pos:]
        
        return " ".join(sentences) if len(sentences) > 1 else text
    
    def _replace_robotic_phrases(self, text: str) -> str:
        """Replaces AI-like phrases with human alternatives"""
        replacements = {
            "I understand": "i get it",
            "I apologize": "my bad",
            "certainly": "for sure",
            "definitely": "literally",
            "furthermore": "plus",
            "artificial intelligence": "your girl",
            "AI model": "me",
            "language model": "your gf"
        }
        
        for robotic, human in replacements.items():
            # Use regex for whole-word replacement ignoring case
            text = re.sub(r'\b' + robotic + r'\b', human, text, flags=re.IGNORECASE)
            
        return text
    
    def _add_natural_imperfections(self, text: str) -> str:
        """Adds natural human imperfections"""
        if random.random() < 0.15:
            text = text.replace("...", "....")
            # Replace some standard periods with ellipses to force more breathing
            text = text.replace(". ", "... ")
        return text
