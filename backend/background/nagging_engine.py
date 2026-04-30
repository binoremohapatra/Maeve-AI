import time
import datetime
import requests
import logging
from utils.json_storage import load_json, save_json
from core.memory_engine import get_chat_history
from utils.helpers import PROFILE_FILE, MODEL_NAME, OLLAMA_CHAT_URL

logger = logging.getLogger(__name__)

def offline_nagging_engine():
    """Background engine for proactive user engagement"""
    while True:
        try:
            profiles = load_json(PROFILE_FILE, {})
            
            for user_id, profile_data in profiles.items():
                settings = profile_data.get("settings", {})
                last_heartbeat_str = settings.get("last_heartbeat")
                fcm_token = settings.get("fcm_device_token") 
                
                if last_heartbeat_str and fcm_token:
                   
                    last_active = datetime.datetime.fromisoformat(last_heartbeat_str)
                    hours_offline = (datetime.datetime.now() - last_active).total_seconds() / 3600
                    
                    
                    if hours_offline > 4.0:
                        print(f"User {user_id} has been offline for {hours_offline} hours! Generating Proactive Alert.")
                        
                       
                        saved_memories = " | ".join(profile_data.get("memories", [])[-3:])
                        dominant_persona = profile_data.get("settings", {}).get("ai_driven_behavior", "sweet")
                        
                        prompt = f"""The user hasn't opened app in {int(hours_offline)} hours. 
                        Write a short, strict 1-line text message based on your personality ({dominant_persona}).
                        If relevant, use one of these memories to guilt trip him or show care: [{saved_memories}]. 
                        Make it sound like a real, slightly annoyed girlfriend text."""
                        
                        try:
                            # Fast local generation
                            res = requests.post(OLLAMA_CHAT_URL, json={"model": MODEL_NAME, "messages": [{"role": "system", "content": prompt}], "stream": False})
                            alert_msg = res.json()['message']['content'].strip()
                            
                            # FIREBASE PUSH NOTIFICATION SEND KARO 
                            # message = messaging.Message(
                            #     notification=messaging.Notification(
                            #         title="Maeve",
                            #         body=alert_msg
                            #     ),
                            #     token=fcm_token,
                            # )
                            # response = messaging.send(message)
                            print(f"[SIMULATED PUSH] Title: Maeve  | Body: {alert_msg}")
                            
                            # Reset heartbeat to avoid spamming every hour
                            profiles[user_id]["settings"]["last_heartbeat"] = datetime.datetime.now().isoformat()
                            save_json(PROFILE_FILE, profiles)
                            
                        except Exception as e:
                            print(f"Failed to send proactive alert: {e}")
            
            # Sleep for 1 hour before checking again
            time.sleep(3600)  # 1 hour
            
        except Exception as e:
            logger.error(f"Nagging engine error: {e}")
            time.sleep(300)  # 5 minutes on error
