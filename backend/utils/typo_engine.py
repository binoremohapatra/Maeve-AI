import random
import re

def add_human_typo(text, emotion=None, intensity=0.5):
    # 1. Tone formatting based on emotion
    if emotion in ["ANGER", "ANNOYED", "DISGUST"]:
        # गुस्से में नॉर्मल रखेगी, बस एक्सक्लेमेशन को डॉट में बदलेगी
        text = text.replace("!", ".").lower()
        if random.random() < 0.4 and not text.endswith("..."):
            text = text.strip('.') + "..." 
            
    elif emotion in ["ANXIETY", "FEAR"]:
        # नर्वसनेस
        if random.random() < 0.3 and not text.lower().startswith("umm"):
            text = "umm... " + text
            
    elif emotion in ["SEXUAL_DESIRE", "ROMANCE", "CRAVING"]:
        # Intimacy में breathy pauses (लेकिन सिर्फ 3 डॉट्स, 9 डॉट्स नहीं!)
        if random.random() < 0.4:
            text = text.replace(",", "...")
            
    # 🔥 FIX: *word वाली बीमारी (typo generator) को पूरी तरह हटा दिया गया है।
    # अब यह मैसेज के एंड में *moment या *don't नहीं लगाएगी।
    
    # 🔥 FIX: अगर कहीं गलती से ......... (बहुत सारे डॉट्स) बन गए हैं, तो उसे 3 डॉट्स में बदल दो
    text = re.sub(r'\.{4,}', '...', text)
    
    return text.strip()
