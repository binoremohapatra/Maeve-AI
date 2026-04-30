#!/usr/bin/env python3
"""
Add English-only rule to ollama_client.py for Kokoro TTS compatibility
"""

with open('llm/ollama_client.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the line and insert after it
target_line = '    if user_pet_name:\n        parts.append(f"\\n[USER_PETNAME: {user_pet_name}]")\n    \n    # UNIVERSAL DATA NUDGE'
replacement = '''    if user_pet_name:
        parts.append(f"\\n[USER_PETNAME: {user_pet_name}]")
    
    # CRITICAL LANGUAGE RULE - Force English for Kokoro TTS
    parts.append("\\n[CRITICAL LANGUAGE RULE]")
    parts.append("You MUST ALWAYS reply in ENGLISH ONLY. Even if the user speaks to you in Hindi, Hinglish, Spanish, or any other language, you MUST understand it but YOUR reply MUST be in 100% pure English. NEVER output Hindi or Hinglish words.")
    
    # UNIVERSAL DATA NUDGE'''

content = content.replace(target_line, replacement)

with open('llm/ollama_client.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Successfully added English-only rule to ollama_client.py')
