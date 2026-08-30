import re
import json
import logging

logger = logging.getLogger(__name__)

# --- THE 200% REAL HUMAN UPGRADES ---
def sanitize_output(text):
    if not text: return ""
    
    # 1. THE HARDCODED ASSASSIN (Bulletproof for Llama-3 & Ollama)
    annoying_tokens = [
        "<|start_header_id|>", "<|end_header_id|>", "<|eot_id|>", 
        "<|im_start|>", "<|im_end|>", "<start_header_id>", "<end_header_id>"
    ]
    for token in annoying_tokens:
        text = text.replace(token, "")
        
    # 2. Kill stray XML/HTML tags 
    text = re.sub(r'<[^>]+>', '', text, flags=re.DOTALL)
    
   
    text = re.sub(r'^\s*(maeve|assistant|ai)\b\s*[:\-\.]*\s*', '', text, flags=re.IGNORECASE).strip()
    
    
    text = re.sub(r'\b(maeve)\b\s*\.{2,}', '', text, flags=re.IGNORECASE)
    

    text = re.sub(r'\.{4,}', '...', text)
    
 
    text = re.sub(r'^(As an AI|I am an AI|As an artificial intelligence).*?(\n|,)', '', text, flags=re.IGNORECASE)
    
    
    text = text.strip()
    if text.startswith('"') and text.endswith('"'):
        text = text[1:-1].strip()
        
    # 6. Normalize spaces
    cleaned_text = re.sub(r'\s{2,}', ' ', text).strip()
   
    try:
        json.loads(cleaned_text)
        return cleaned_text
    except json.JSONDecodeError:
        logger.warning(f"Invalid JSON detected, attempting repair: {cleaned_text[:100]}...")
        
        # Attempt common JSON repairs
        try:
            # Remove markdown code blocks
            cleaned_text = re.sub(r'```json\s*', '', cleaned_text)
            cleaned_text = re.sub(r'```\s*$', '', cleaned_text)
            
            # Fix common Llama-3 issues: missing quotes around keys
            cleaned_text = re.sub(r'(\w+)\s*:', r'"\1":', cleaned_text)
            
            # Fix trailing commas
            cleaned_text = re.sub(r',\s*}', '}', cleaned_text)
            cleaned_text = re.sub(r',\s*\]', ']', cleaned_text)
            
            # Try parsing again
            json.loads(cleaned_text)
            return cleaned_text
            
        except json.JSONDecodeError:
           
            logger.error("JSON repair failed, using emergency fallback")
            
            # Extract content using regex as last resort
            reply_match = re.search(r'"reply"\s*:\s*"([^"]*)"', cleaned_text)
            thought_match = re.search(r'"thought"\s*:\s*"([^"]*)"', cleaned_text)
            emotion_match = re.search(r'"base_emotion"\s*:\s*"([^"]*)"', cleaned_text)
            persona_match = re.search(r'"persona_active"\s*:\s*"([^"]*)"', cleaned_text)
            
            emergency_fallback = {
                "thought": thought_match.group(1) if thought_match else "I'm processing what you said...",
                "reply": reply_match.group(1) if reply_match else "Hey... talk to me properly.",
                "base_emotion": emotion_match.group(1) if emotion_match else "NEUTRAL",
                "persona_active": persona_match.group(1) if persona_match else "default",
                "animation": "IDLE",
                "tool_call": "NONE",
                "tool_params": {}
            }
            
            return json.dumps(emergency_fallback, ensure_ascii=False)
