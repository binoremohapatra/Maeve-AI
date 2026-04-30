#!/usr/bin/env python3
"""
SENTIMENT ANALYST: Dynamic Metrics Tracker
Real-time analysis of user input to adjust Maeve's psychological state
"""

import re
from typing import Dict

class SentimentAnalyst:
    """Analyzes user input in real-time to update psychological metrics"""
    
    def __init__(self):
        # Base metrics weights
        self.threat_keywords = {
            # High threat words
            "hate": 0.15, "stfu": 0.20, "ignore": 0.15, "loser": 0.12,
            "creepy": 0.18, "weird": 0.10, "annoying": 0.12,
            "fuck": 0.20, "bitch": 0.18, "shit": 0.15,
            # Medium threat words
            "why": 0.08, "what": 0.05, "how": 0.05,
            "stop": 0.10, "don't": 0.08
        }
        
        self.intimacy_keywords = {
            # High intimacy words
            "love": 0.12, "babe": 0.15, "baby": 0.15, "honey": 0.12,
            "pretty": 0.10, "beautiful": 0.12, "gorgeous": 0.15,
            "miss you": 0.18, "need you": 0.15, "can't live without": 0.20,
            # Medium intimacy words
            "like": 0.08, "nice": 0.06, "good": 0.05,
            "happy": 0.08, "glad": 0.06, "care": 0.08
        }
        
        self.trust_keywords = {
            # High trust words
            "sorry": 0.12, "apologize": 0.15, "my fault": 0.18,
            "thanks": 0.10, "thank you": 0.12, "appreciate": 0.15,
            "promise": 0.18, "swear": 0.20, "always": 0.10,
            # Medium trust words
            "sure": 0.08, "okay": 0.05, "alright": 0.06,
            "understand": 0.08, "agree": 0.10, "listen": 0.08
        }
        
        # Pet name detection (personalization boost)
        self.pet_names = ["babe", "baby", "honey", "love", "darling", "sweetheart"]
        
    def analyze_input(self, user_input: str, current_metrics: Dict, current_persona: str = None) -> Dict:
        """
        Analyzes user input and returns updated metrics
        """
        updated_metrics = current_metrics.copy()
        user_lower = user_input.lower()
        
        # 1. THREAT ESCALATOR (Bad words/Disrespect)
        threat_increase = 0.0
        for word, weight in self.threat_keywords.items():
            if word in user_lower:
                threat_increase += weight
                print(f"Threat detected: '{word}' (+{weight})")
        
        if threat_increase > 0:
            updated_metrics['threat'] = min(1.0, updated_metrics['threat'] + threat_increase)
            updated_metrics['trust'] = max(0.0, updated_metrics['trust'] - threat_increase * 0.5)
            print(f"Threat increased to {updated_metrics['threat']:.3f}")
        
        # 2. INTIMACY BOOSTER (Affection/Pet names)
        intimacy_increase = 0.0
        for word, weight in self.intimacy_keywords.items():
            if word in user_lower:
                intimacy_increase += weight
                print(f"Intimacy detected: '{word}' (+{weight})")
        
        # Pet name bonus (extra intimacy boost)
        if any(pet in user_lower for pet in self.pet_names):
            intimacy_increase += 0.10
            print(f"Pet name detected (+0.10)")
        
        if intimacy_increase > 0:
            updated_metrics['intimacy'] = min(1.0, updated_metrics['intimacy'] + intimacy_increase)
            updated_metrics['threat'] = max(0.0, updated_metrics['threat'] - intimacy_increase * 0.3)
            print(f"Intimacy increased to {updated_metrics['intimacy']:.3f}")
        
        # 3. TRUST BUILDER (Compliance/Kindness)
        trust_increase = 0.0
        for word, weight in self.trust_keywords.items():
            if word in user_lower:
                trust_increase += weight
                print(f"Trust detected: '{word}' (+{weight})")
        
        if trust_increase > 0:
            updated_metrics['trust'] = min(1.0, updated_metrics['trust'] + trust_increase)
            updated_metrics['threat'] = max(0.0, updated_metrics['threat'] - trust_increase * 0.2)
            print(f"Trust increased to {updated_metrics['trust']:.3f}")
        
        # THE SHYNESS SHIELD: 
        # अगर मेव शर्मीली है, तो उसकी Intimacy को 0.45 के पार मत जाने दो
        if current_persona == "hajidere":
            if updated_metrics['intimacy'] > 0.44:
                # वो बहुत ज़्यादा flustered है, इसलिए स्कोर 'दब' जाएगा
                updated_metrics['intimacy'] = 0.44 
                print("Hajidere Shield: Intimacy capped to preserve shyness.")
        
        # 4. CONTEXTUAL ANALYSIS (Advanced patterns)
        self._analyze_contextual_patterns(user_lower, updated_metrics)
        
        return updated_metrics
    
    def _analyze_contextual_patterns(self, user_input: str, metrics: Dict):
        """
        Advanced contextual pattern analysis
        """
        # Question patterns (curiosity = trust)
        if re.search(r'\b(why|what|how|when|where)\b', user_input):
            metrics['trust'] = min(1.0, metrics['trust'] + 0.03)
            print("Question pattern detected (+0.03 trust)")
        
        # Exclamation patterns (excitement = intimacy)
        if user_input.count('!') >= 2:
            metrics['intimacy'] = min(1.0, metrics['intimacy'] + 0.05)
            print("Excitement pattern detected (+0.05 intimacy)")
        
        # Long message patterns (investment = intimacy)
        if len(user_input) > 100:
            metrics['intimacy'] = min(1.0, metrics['intimacy'] + 0.03)
            print("Long message pattern detected (+0.03 intimacy)")
        
        # Short reply patterns (disinterest = threat)
        if len(user_input) < 10 and not any(punct in user_input for punct in ['!', '?']):
            metrics['threat'] = min(1.0, metrics['threat'] + 0.05)
            print("Short reply pattern detected (+0.05 threat)")
    
    def get_sentiment_summary(self, metrics: Dict) -> str:
        """
        Returns human-readable summary of current psychological state
        """
        intimacy = metrics['intimacy']
        trust = metrics['trust']
        threat = metrics['threat']
        
        # Determine dominant emotion
        if threat > 0.7:
            return f"**CRISIS MODE** - User seems hostile/threatened (Threat: {threat:.2f})"
        elif intimacy > 0.8:
            return f"**DEEP AFFECTION** - User is very loving/intimate (Intimacy: {intimacy:.2f})"
        elif trust > 0.8:
            return f"**HIGH TRUST** - User is compliant/trusting (Trust: {trust:.2f})"
        elif threat > 0.4:
            return f"**TENSE** - User seems annoyed/suspicious (Threat: {threat:.2f})"
        elif intimacy > 0.5:
            return f"**WARM** - User is being affectionate (Intimacy: {intimacy:.2f})"
        else:
            return f"**NEUTRAL** - Balanced psychological state"

# DEMO: Real-time sentiment tracking
def demo_sentiment_tracking():
    """Demonstrates the sentiment analyst with real conversation examples"""
    
    print("SENTIMENT TRACKING DEMO")
    print("=" * 50)
    
    analyst = SentimentAnalyst()
    
    # Initial metrics
    current_metrics = {
        'intimacy': 0.5,
        'trust': 0.5,
        'threat': 0.2
    }
    
    print("Initial Metrics:", current_metrics)
    print()
    
    # Simulate conversation
    test_inputs = [
        "good morning maeve! 😊",
        "you look really pretty today",
        "why do you keep following my digital footprints? it's a bit creepy",
        "i'm sorry, i didn't mean to upset you",
        "i love you so much, babe",
        "stfu you're so annoying sometimes",
        "thank you for always being there for me"
    ]
    
    for i, user_input in enumerate(test_inputs, 1):
        print(f"Message {i}: \"{user_input}\"")
        current_metrics = analyst.analyze_input(user_input, current_metrics)
        summary = analyst.get_sentiment_summary(current_metrics)
        print(f"{summary}")
        print(f"Updated Metrics: I={current_metrics['intimacy']:.2f}, T={current_metrics['trust']:.2f}, Th={current_metrics['threat']:.2f}")
        print("-" * 50)

if __name__ == "__main__":
    demo_sentiment_tracking()
