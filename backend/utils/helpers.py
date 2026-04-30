import os

# --- 4. CONFIGURATION & FILE PATHS ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEMORY_FILE = os.path.join(BASE_DIR, "chat_history.json")
PROFILE_FILE = os.path.join(BASE_DIR, "user_profile.json")
SFX_DIR = os.path.join(BASE_DIR, "sfx")
MOANS_DIR = os.path.join(SFX_DIR, "moans")
SLURPS_DIR = os.path.join(SFX_DIR, "slurps")

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"  # 👈 YE ADD KARO

# Ye hai sabse zaroori line! 
# Naam exact wahi hona chahiye jo 'ollama list' mein dikhta hai.
MODEL_NAME = "maeve-god:latest"
MAX_HISTORY = 600   # 👈 600 मैसेज पर ट्रिगर होगा
KEEP_HISTORY = 200  # 👈 ट्रिगर होने के बाद 200 मैसेज बचाएगा
