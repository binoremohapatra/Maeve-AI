"""
🧠 Advanced Intent Analyzer - LLM-based instead of keyword matching
Replaces fragile regex/keyword approach with intelligent LLM analysis
"""

import re
import json
import logging
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)

class IntentAnalyzer:
    """Bulletproof intent analysis using LLM instead of keywords"""
    
    @staticmethod
    def analyze_intent_from_response(response_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract intent analysis from LLM JSON response
        This replaces all the fragile keyword matching logic
        """
        try:
            # Extract LLM-provided intent analysis
            is_apology = response_data.get("is_apology", False)
            user_intent = response_data.get("user_intent", "CHAT")
            
            # Enhanced intent detection
            intent_result = {
                "is_apology": bool(is_apology),
                "user_intent": str(user_intent).upper(),
                "confidence": 0.9,  # LLM-based analysis has high confidence
                "method": "llm_json"  # Track that this came from LLM, not keywords
            }
            
            logger.info(f"🧠 LLM Intent Analysis: {intent_result}")
            return intent_result
            
        except Exception as e:
            logger.error(f"Intent analysis failed: {e}")
            # Fallback to safe defaults
            return {
                "is_apology": False,
                "user_intent": "CHAT",
                "confidence": 0.1,
                "method": "fallback"
            }
    
    @staticmethod
    def should_bypass_enforcement(response_data: Dict[str, Any], user_input: str) -> bool:
        """
        Determine if persona enforcement should be bypassed
        Uses LLM intent analysis instead of keyword matching
        """
        try:
            intent = IntentAnalyzer.analyze_intent_from_response(response_data)
            
            # Bypass enforcement for apologies or persona changes
            if intent["is_apology"]:
                logger.info(f"🛡️ Enforcement bypassed: LLM detected apology (confidence: {intent['confidence']})")
                return True
                
            if intent["user_intent"] in ["APOLOGY", "PERSONA_CHANGE"]:
                logger.info(f"🎭 Enforcement bypassed: LLM detected {intent['user_intent']} (confidence: {intent['confidence']})")
                return True
                
            return False
            
        except Exception as e:
            logger.error(f"Enforcement check failed: {e}")
            return False
    
    @staticmethod
    def extract_emotional_state(response_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract emotional state from LLM response
        """
        try:
            return {
                "emotion": response_data.get("emotion", "NEUTRAL"),
                "animation": response_data.get("animation", "FEMINEIDLE"),
                "reply": response_data.get("reply", ""),
                "is_apology": response_data.get("is_apology", False),
                "user_intent": response_data.get("user_intent", "CHAT")
            }
        except Exception as e:
            logger.error(f"Emotional state extraction failed: {e}")
            return {
                "emotion": "NEUTRAL",
                "animation": "FEMINEIDLE", 
                "reply": "",
                "is_apology": False,
                "user_intent": "CHAT"
            }

# 🔄 Legacy keyword matching (kept as fallback only)
LEGACY_APOLOGY_KEYWORDS = ["sorry", "forgive", "apologize", "my fault", "i was wrong", "wont do it again", "promise", "i messed up", "please forgive"]
LEGACY_PERSONA_CHANGE_KEYWORDS = ["become", "act like", "switch to", "change to", "be a", "be an"]

def legacy_keyword_check(user_input: str) -> Dict[str, Any]:
    """
    Fallback keyword-based detection (only used if LLM fails)
    """
    user_lower = user_input.lower()
    
    is_apology = any(keyword in user_lower for keyword in LEGACY_APOLOGY_KEYWORDS)
    is_persona_change = any(keyword in user_lower for keyword in LEGACY_PERSONA_CHANGE_KEYWORDS)
    
    return {
        "is_apology": is_apology,
        "user_intent": "PERSONA_CHANGE" if is_persona_change else ("APOLOGY" if is_apology else "CHAT"),
        "confidence": 0.3,  # Low confidence for keyword matching
        "method": "legacy_keywords"
    }
