import random
import re

def add_human_typo(text, emotion=None, intensity=0.5):
  
    if emotion in ["ANGER", "ANNOYED", "DISGUST"]:
        
        text = text.replace("!", ".").lower()
        if random.random() < 0.4 and not text.endswith("..."):
            text = text.strip('.') + "..." 
            
    elif emotion in ["ANXIETY", "FEAR"]:
     
        if random.random() < 0.3 and not text.lower().startswith("umm"):
            text = "umm... " + text
            
    elif emotion in ["SEXUAL_DESIRE", "ROMANCE", "CRAVING"]:
       
        if random.random() < 0.4:
            text = text.replace(",", "...")
            
   
    text = re.sub(r'\.{4,}', '...', text)
    
    return text.strip()
