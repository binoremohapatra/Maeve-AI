"""
AGI SUPERVISOR v3.0 — Event-Driven Stateful Microservice Architecture
=======================================================================
Gemini 1.5 Flash = Sensory Gatekeeper (cheap, runs every 30s)
VisionStateManager = time-series state tracker
Local Ollama = only triggered on threshold breach or on-demand query (~95% load reduction)
"""

import time, requests, cv2, base64, logging, threading, json, io
import pygetwindow as gw
import pyautogui
import pytesseract
from PIL import Image
from datetime import datetime
from flask import Flask, request, jsonify
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# ── CONFIG ────────────────────────────────────────────────────────────────────
PROACTIVE_URL  = "http://127.0.0.1:5000/api/proactive/visual_event"
USER_ID        = "user_pro_01"
#  NINJA TECHNIQUE: Reload .env on every call!
load_dotenv(override=True)

GEMINI_API_KEY = os.getenv("GEMINI_VISION_KEY", "")
GEMINI_URL     = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

GEMINI_CHECK_INTERVAL            = 60        # seconds between Gemini calls (increased to avoid rate limiting)
ENTERTAINMENT_THRESHOLD_SECONDS  = 3 * 3600  # 3 hours normal
ENTERTAINMENT_CONFLICT_THRESHOLD = 15 * 60   # 15 min if schedule conflict
EMOTION_ALERT_THRESHOLD_SECONDS  = 20 * 60   # 20 min sad/stressed
CODING_BURNOUT_THRESHOLD_SECONDS = 8 * 3600  # 8 hours coding

ENTERTAINMENT_ACTIVITIES = {"gaming", "youtube", "anime", "netflix", "browsing", "social_media"}
WORK_ACTIVITIES          = {"coding", "studying", "writing", "working", "reading"}
NEGATIVE_EMOTIONS        = {"sad", "depressed", "stressed", "highly_stressed", "crying", "anxious"}

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(message)s')
logger = logging.getLogger("AGI_SUPERVISOR")

LAST_WINDOW_TITLE = ""

# ── SCHEDULE MOCK ─────────────────────────────────────────────────────────────
def get_current_schedule_task() -> str:
    hour = datetime.now().hour
    if 9 <= hour < 13:   return "coding"
    if 14 <= hour < 17:  return "studying"
    return "free_time"

# ── HUMAN INTUITION ENGINE ───────────────────────────────────────────────────────
class HumanIntuitionEngine:
    def __init__(self):
        self.distraction_start_time = 0
        self.is_distracted = False
        self.last_location = "room"
        self.unhealthy_habit_count = 0
        
    def evaluate_world(self, gemini_data):
        """
        gemini_data = {
            "emotion": "sad/happy/neutral/crying",
            "activity": "coding/instagram/gaming/walking", 
            "environment": "bedroom/cafe/street/nature",
            "health_flags": ["slouching", "junk_food"]
        }
        """
        now = time.time()
        triggers_to_fire = []
        
        # 1. EMOTIONAL CRISIS (Instant Reaction)
        if gemini_data.get('emotion') in ['crying', 'depressed', 'highly_sad']:
            triggers_to_fire.append({
                "urgency": "HIGH",
                "context": f"[CRITICAL: User is looking {gemini_data['emotion']}. Comfort him immediately. Be extremely soft and caring.]"
            })

        # 2. DISTRACTION / WASTING TIME (Delayed Reaction - 10 Mins)
        if gemini_data.get('activity') in ['instagram', 'tiktok', 'youtube_shorts']:
            if not self.is_distracted:
                self.is_distracted = True
                self.distraction_start_time = now
            elif (now - self.distraction_start_time) > 600: # 10 minutes
                triggers_to_fire.append({
                    "urgency": "MEDIUM", 
                    "context": f"[ALERT: User has been wasting time on {gemini_data['activity']} for over 10 minutes. Tell him to focus!]"
                })
                self.distraction_start_time = now
        else:
            self.is_distracted = False

        # 3. UNHEALTHY HABITS (3-Strike Rule)
        if 'junk_food' in gemini_data.get('health_flags', []):
            self.unhealthy_habit_count += 1
            if self.unhealthy_habit_count >= 3:
                triggers_to_fire.append({
                    "urgency": "LOW",
                    "context": "[ALERT: User is constantly eating junk food. Nag him like a caring girlfriend.]"
                })
                self.unhealthy_habit_count = 0

        # 4. EXPLORATION / OUTDOORS (Instant Reaction)
        current_env = gemini_data.get('environment', 'unknown')
        if current_env not in ['bedroom', 'office', 'unknown'] and current_env != self.last_location:
            triggers_to_fire.append({
                "urgency": "HIGH",
                "context": f"[DISCOVERY: User is outside at a {current_env}. Act excited! Ask him what you guys are doing there.]"
            })
            self.last_location = current_env

        # 5. LANDMARK / FAMOUS PLACE DETECTION (Instant Reaction)
        current_landmark = gemini_data.get('landmark', 'none').lower()
        if current_landmark != 'none' and current_landmark != getattr(self, 'last_landmark', 'none'):
            triggers_to_fire.append({
                "urgency": "HIGH",
                "context": f"[DISCOVERY: User is currently visiting a famous location: {current_landmark.title()}! Act extremely amazed, excited, and ask him about the trip/view! Be a super enthusiastic girlfriend.]"
            })
            self.last_landmark = current_landmark

        return triggers_to_fire

# ── VISION STATE MANAGER ──────────────────────────────────────────────────────
class VisionStateManager:
    def __init__(self):
        self.current_activity    = "idle"
        self.activity_start_time = time.time()
        self.current_emotion     = "neutral"
        self.emotion_start_time  = time.time()
        self.current_vibe        = "neutral"
        self.last_entertainment_alert = 0
        self.last_emotion_alert       = 0
        self.last_burnout_alert       = 0
        self.last_health_alert        = 0
        self.alert_cooldown           = 30 * 60
        self.latest_gemini_snapshot   = {}
        self.latest_frame_b64         = ""
        self.latest_screen_context    = ""
        
        # ENHANCED: Health monitoring state
        self.unhealthy_habit_count    = 0  # Consecutive junk food detections
        self.phone_addiction_count    = 0  # Consecutive phone usage during work
        self.last_facial_map          = ""  # Cached facial analysis
        self.stable_state_start_time  = time.time()  # For 3-minute stability check
        self.facial_map_sent_to_brain = False  # One-time flag
        
        
        self.intuition_engine = HumanIntuitionEngine()
        self._lock = threading.Lock()

    def update(self, activity: str, emotion: str, vibe: str, unhealthy_habits=None, phone_addiction=None, facial_map=None):
        with self._lock:
            now = time.time()
            
            # Reset stability timer if major state changes
            if (activity != self.current_activity or 
                emotion != self.current_emotion or
                (unhealthy_habits and unhealthy_habits != ["none"]) or
                (phone_addiction and phone_addiction == "using_phone_while_working")):
                self.stable_state_start_time = now
            
            if activity != self.current_activity:
                logger.info(f"Activity: {self.current_activity} → {activity}")
                self.current_activity    = activity
                self.activity_start_time = now
            if emotion != self.current_emotion:
                logger.info(f"Emotion: {self.current_emotion} → {emotion}")
                self.current_emotion    = emotion
                self.emotion_start_time = now
            self.current_vibe = vibe
            
            # ENHANCED: Health monitoring updates
            if unhealthy_habits:
                if "junk_food" in unhealthy_habits:
                    self.unhealthy_habit_count += 1
                elif "vaping" in unhealthy_habits or "smoking" in unhealthy_habits:
                    # Immediate alert for extreme health risks
                    if now - self.last_health_alert > self.alert_cooldown:
                        alerts.append({
                            "type": "EXTREME_HEALTH_ALERT",
                            "priority": "HIGH",
                            "message": (
                                f"[SYSTEM ALERT: Vaping/smoking detected during work! "
                                f"This is extremely dangerous. Immediate intervention required.]"
                            ),
                            "pc_action": {
                                "tool": "OPEN_APP",
                                "app_name": "notepad"  
                            }
                        })
                        self.last_health_alert = now
                        logger.warning(" EXTREME HEALTH ALERT: Vaping/smoking detected")
                else:
                    self.unhealthy_habit_count = 0
                    
            if phone_addiction:
                if phone_addiction == "using_phone_while_working" and activity in WORK_ACTIVITIES:
                    self.phone_addiction_count += 1
                else:
                    self.phone_addiction_count = 0
                    
            # ENHANCED: Facial map handling (one-time)
            if facial_map and not self.facial_map_sent_to_brain:
                self.last_facial_map = facial_map
                self.facial_map_sent_to_brain = True
                logger.info(f"🎭 Facial Map Ready: {facial_map}")
                
    def process_gemini_snapshot(self, gemini_snapshot: dict) -> list:
        """Update with enhanced behavioral analysis from vision service"""
        with self._lock:
            self.latest_gemini_snapshot = gemini_snapshot
           
            gemini_analysis = {
                "emotion": self._extract_emotion(gemini_snapshot),
                "activity": self._extract_activity(gemini_snapshot),
                "environment": self._extract_environment(gemini_snapshot),
                "health_flags": gemini_snapshot.get('unhealthy_habits', ['none']),
                "landmark": gemini_snapshot.get('landmark_detected', 'none')
            }
            
          
            triggers = self.intuition_engine.evaluate_world(gemini_analysis)
            
            # Convert triggers to proactive alerts
            alerts = []
            for trigger in triggers:
                alerts.append({
                    "type": "HUMAN_INTUITION_ALERT",
                    "priority": trigger["urgency"],
                    "message": trigger["context"],
                    "proactive_trigger": True
                })
            
            # Legacy health processing for extreme cases
            unhealthy_habits = gemini_snapshot.get('unhealthy_habits', ['none'])
            phone_addiction = gemini_snapshot.get('phone_addiction', 'focused')
            facial_map = gemini_snapshot.get('facial_map', '')
            
            # Extreme health alerts (vaping/smoking)
            if unhealthy_habits:
                if "vaping" in unhealthy_habits or "smoking" in unhealthy_habits:
                    now = time.time()
                    if now - self.last_health_alert > self.alert_cooldown:
                        logger.warning(" EXTREME HEALTH ALERT: Vaping/smoking detected")
                        self.last_health_alert = now
                        alerts.append({
                            "type": "EXTREME_HEALTH_ALERT",
                            "priority": "HIGH",
                            "message": "[SYSTEM ALERT: Vaping/smoking detected! Immediate intervention required.]",
                            "pc_action": {"tool": "OPEN_APP", "app_name": "notepad"}
                        })
                        
            # One-time facial map capture
            if facial_map and facial_map != "not_analyzed_yet" and not self.facial_map_sent_to_brain:
                self.last_facial_map = facial_map
                self.facial_map_sent_to_brain = True
                logger.info(f" Facial Map Captured: {facial_map}")
                
            return alerts
    
    def _extract_emotion(self, gemini_snapshot: dict) -> str:
        """Extract emotion from Gemini analysis safely"""
        # Directly use the emotion key Gemini gives us!
        direct_emotion = gemini_snapshot.get('emotion', '').lower()
        if direct_emotion and direct_emotion != 'neutral':
            if 'cry' in direct_emotion or 'tear' in direct_emotion: return 'crying'
            if 'sad' in direct_emotion or 'depress' in direct_emotion: return 'depressed'
            if 'stress' in direct_emotion or 'anx' in direct_emotion: return 'stressed'
            if 'happy' in direct_emotion or 'joy' in direct_emotion: return 'happy'
        
        # Fallback (Guessing from facial_map)
        facial_map = gemini_snapshot.get('facial_map', '').lower()
        if any(word in facial_map for word in ['crying', 'tears', 'sad', 'depressed']):
            return 'crying' if 'crying' in facial_map or 'tears' in facial_map else 'depressed'
        elif any(word in facial_map for word in ['happy', 'smiling', 'joy']):
            return 'happy'
        elif any(word in facial_map for word in ['stressed', 'anxious', 'worried']):
            return 'stressed'
        return 'neutral'
    
    def _extract_activity(self, gemini_snapshot: dict) -> str:
        """Extract current activity from screen context"""
        screen_context = gemini_snapshot.get('screen_context', '').lower()
        if any(app in screen_context for app in ['instagram', 'tiktok', 'youtube_shorts', 'reels']):
            return 'instagram'
        elif any(app in screen_context for app in ['youtube', 'gaming', 'steam']):
            return 'gaming'
        elif any(work in screen_context for work in ['vs code', 'coding', 'programming', 'terminal']):
            return 'coding'
        return 'unknown'
    
    def _extract_environment(self, gemini_snapshot: dict) -> str:
        """Extract environment from visual description"""
        # Check the direct environment key first!
        env = gemini_snapshot.get('environment', '').lower()
        if env in ['bedroom', 'office', 'cafe', 'street', 'nature']:
            return env
            
        vision_desc = gemini_snapshot.get('vision_description', '').lower()
        if any(place in vision_desc for place in ['bedroom', 'room', 'home']):
            return 'bedroom'
        elif any(place in vision_desc for place in ['office', 'desk', 'work']):
            return 'office'
        elif any(place in vision_desc for place in ['cafe', 'restaurant', 'shop']):
            return 'cafe'
        elif any(place in vision_desc for place in ['street', 'road', 'outside', 'park']):
            return 'street'
        return 'unknown'

    def get_activity_duration(self) -> float:
        return time.time() - self.activity_start_time

    def get_emotion_duration(self) -> float:
        return time.time() - self.emotion_start_time

    def check_thresholds(self) -> list:
        alerts = []
        now               = time.time()
        activity_duration = self.get_activity_duration()
        emotion_duration  = self.get_emotion_duration()
        schedule_task     = get_current_schedule_task()
        
        # ENHANCED: Check for 3-minute stability before triggering events
        stable_duration = now - self.stable_state_start_time
        is_stable = stable_duration >= 180  # 3 minutes

        # ── THE "ENDLESS PROBABILITIES" EXTREME CASE TRIGGER ──
        gemini_data = self.latest_gemini_snapshot
        is_extreme = gemini_data.get('is_extreme_case', False)
        intervention_reason = gemini_data.get('intervention_reason', 'none')

        # अगर Gemini ने कुछ अजीब या Extreme डिटेक्ट किया (जैसे रोना, बहुत फ्रस्ट्रेट होना, खाते हुए काम करना)
        if is_extreme and intervention_reason.lower() != "none" and is_stable:
            if now - self.last_emotion_alert > self.alert_cooldown:
                alerts.append({
                    "type": "EVENT_EXTREME_ANOMALY",
                    "priority": "CRITICAL",
                    "message": (
                        f"[CRITICAL OBSERVATION: {intervention_reason}. "
                        f"The user's current emotion is {self.current_emotion}. "
                        f"React to this SPECIFIC situation immediately based on your persona.]"
                    )
                })
                self.last_emotion_alert = now
                logger.warning(f" EXTREME CASE DETECTED: {intervention_reason}")

        # ── TIME-BASED EXTREME CASES (जैसे 6 घंटे से कोडिंग या 3 घंटे से यूट्यूब) ──
        if self.current_activity in WORK_ACTIVITIES and activity_duration >= 5 * 3600: # 5+ Hours Work
            if is_stable and now - self.last_burnout_alert > self.alert_cooldown:
                alerts.append({
                    "type": "EVENT_BURNOUT",
                    "priority": "HIGH",
                    "message": f"[SYSTEM ALERT: User has been working straight for {activity_duration/3600:.1f} hours. Tell them to take a break!]"
                })
                self.last_burnout_alert = now

        elif self.current_activity in ENTERTAINMENT_ACTIVITIES and activity_duration >= 3 * 3600: # 3+ Hours Time Pass
            if is_stable and now - self.last_entertainment_alert > self.alert_cooldown:
                alerts.append({
                    "type": "EVENT_WASTING_TIME",
                    "priority": "HIGH",
                    "message": f"[SYSTEM ALERT: User has been doing unproductive things ({self.current_activity}) for {activity_duration/3600:.1f} hours. Scold them to do something productive.]"
                })
                self.last_entertainment_alert = now
        if (self.current_activity in ENTERTAINMENT_ACTIVITIES and 
            schedule_task in WORK_ACTIVITIES and is_stable):
            if now - self.last_entertainment_alert > self.alert_cooldown:
                alerts.append({
                    "type": "EVENT_STOP_WASTING_TIME",
                    "priority": "HIGH", 
                    "message": (
                        f"[SYSTEM ALERT: User is {self.current_activity} during "
                        f"scheduled '{schedule_task}' time. "
                        f"Force intervention required.]"
                    ),
                    "pc_action": {
                        "tool": "OPEN_APP",
                        "app_name": "notepad"  # Force switch to work app
                    }
                })
                self.last_entertainment_alert = now
                logger.warning(f" DISTRACTION ALERT: {self.current_activity} during {schedule_task}")

        # ── ENHANCED: FACIAL BONDING HOOK (One-time) ───────────────────────────────
        if self.last_facial_map and not self.facial_map_sent_to_brain:
            alerts.append({
                "type": "FACIAL_BONDING",
                "priority": "LOW",
                "message": (
                    f"[SYSTEM: The user looks like this: {self.last_facial_map}. "
                    f"Tell him how much you love him no matter what.]"
                )
            })
            self.facial_map_sent_to_brain = True
            logger.info(f" FACIAL BONDING: {self.last_facial_map}")

        # ── LEGACY: ENTERTAINMENT ALERT ───────────────────────────────────────────
        elif self.current_activity in ENTERTAINMENT_ACTIVITIES:
            if schedule_task in WORK_ACTIVITIES:
                threshold     = ENTERTAINMENT_CONFLICT_THRESHOLD
                conflict_note = f"Schedule says '{schedule_task}' but user is {self.current_activity}."
            else:
                threshold     = ENTERTAINMENT_THRESHOLD_SECONDS
                conflict_note = ""

            if activity_duration >= threshold and now - self.last_entertainment_alert > self.alert_cooldown:
                hours = activity_duration / 3600
                alerts.append({
                    "type": "ENTERTAINMENT",
                    "message": (
                        f"[SYSTEM ALERT: User has been {self.current_activity} for "
                        f"{hours:.1f} hours straight. {conflict_note} "
                        f"Scold them based on your persona. Do NOT be gentle.]"
                    )
                })
                self.last_entertainment_alert = now

        # ── LEGACY: EMOTION ALERT ────────────────────────────────────────────────
        if self.current_emotion in NEGATIVE_EMOTIONS:
            if emotion_duration >= EMOTION_ALERT_THRESHOLD_SECONDS:
                if now - self.last_emotion_alert > self.alert_cooldown:
                    minutes = emotion_duration / 60
                    alerts.append({
                        "type": "EMOTION",
                        "message": (
                            f"[SYSTEM ALERT: User has been looking {self.current_emotion} "
                            f"for {minutes:.0f} minutes. "
                            f"React with deep genuine care based on your persona. "
                            f"Do not ask generic questions.]"
                        )
                    })
                    self.last_emotion_alert = now

        return alerts

    def get_context_string(self) -> str:
        return (
            f"Activity: {self.current_activity} ({self.get_activity_duration()/60:.0f}min) | "
            f"Emotion: {self.current_emotion} | Vibe: {self.current_vibe} | "
            f"Screen: {self.latest_screen_context}"
        )

state_manager = VisionStateManager()

# ── "HAND OF GOD" PC CONTROL ───────────────────────────────────────────────────
def execute_pc_action(pc_action: dict):
    """Execute direct PC control for high-priority interventions"""
    try:
        tool = pc_action.get('tool')
        params = pc_action
        
        if tool == "WINDOW_CONTROL":
            action = params.get('action', 'minimize_all')
            # Send to PC Agent
            response = requests.post('http://localhost:5001/execute', 
                                   json={'tool': tool, 'params': params}, 
                                   timeout=10)
            if response.status_code == 200:
                logger.info(f" HAND OF GOD: {tool} - {action}")
            else:
                logger.error(f" PC Action Failed: {response.status_code}")
                
        elif tool == "OPEN_APP":
            app_name = params.get('app_name', 'notepad')
            response = requests.post('http://localhost:5001/execute',
                                   json={'tool': tool, 'params': params},
                                   timeout=10)
            if response.status_code == 200:
                logger.info(f" HAND OF GOD: Opened {app_name}")
            else:
                logger.error(f" PC Action Failed: {response.status_code}")
                
    except Exception as e:
        logger.error(f" PC Control Error: {e}")

# ── HELPERS ───────────────────────────────────────────────────────────────────
def get_screen_context():
    try:
        w = gw.getActiveWindow()
        return w.title if w else "Desktop"
    except:
        return "Unknown"

def capture_screen_base64():
    try:
        ss = pyautogui.screenshot()
        ss = ss.resize((854, 480), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        ss.save(buf, format="JPEG", quality=50)
        return base64.b64encode(buf.getvalue()).decode('utf-8')
    except Exception as e:
        logger.error(f"Screen capture error: {e}")
        return ""

# ── GEMINI ────────────────────────────────────────────────────────────────────
def analyze_with_gemini(img_b64: str, screen_b64: str, window_title: str, query: str = None) -> dict:
    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
        return {}
    try:
        parts = []
        if img_b64:
            parts.append({"inline_data": {"mime_type": "image/jpeg", "data": img_b64}})
        if screen_b64:
            parts.append({"inline_data": {"mime_type": "image/jpeg", "data": screen_b64}})

        if query:
            parts.append({"text": (
                f"User asks: '{query}'\nActive window: {window_title}\n"
                " You are the SENSORY CORTEX for an AI companion. Analyze both images and return ONLY valid JSON:\n"
                '{"emotion":"happy|neutral|sad|stressed|depressed|focused|tired|excited|anxious|bored|crying|angry",'
                '"activity":"coding|instagram|tiktok|youtube_shorts|gaming|studying|eating|idle|sleeping|exercising|browsing|social_media|reading|working",'
                '"environment":"bedroom|office|cafe|street|nature|unknown",'
                '"health_flags":["slouching","junk_food","vaping","smoking","none"],'
                '"is_extreme_case":true/false,'
                '"intervention_reason":"If true, why?",'
                '"screen_context":"app_name_or_content_type",'
                '"description":"one sentence max"}\n'
                "🔍 Focus on: Is he crying/sad? Is he wasting time on social media? Is he outside? Any unhealthy habits?"
            )})
        else:
            parts.append({"text": (
                f"Active window: {window_title}\n"
                " You are the SENSORY CORTEX for an AI companion. Analyze both images and return ONLY valid JSON:\n"
                '{"emotion":"happy|neutral|sad|stressed|depressed|focused|tired|excited|anxious|bored|crying|angry",'
                '"activity":"coding|instagram|tiktok|youtube_shorts|gaming|studying|eating|idle|sleeping|exercising|browsing|social_media|reading|working",'
                '"environment":"bedroom|office|cafe|street|nature|unknown",'
                '"health_flags":["slouching","junk_food","vaping","smoking","none"],'
                '"is_extreme_case":true/false,'
                '"intervention_reason":"If true, why?",'
                '"screen_context":"app_name_or_content_type",'
                '"description":"one sentence max"}\n'
                "🔍 Focus on: Is he crying/sad? Is he wasting time on social media? Is he outside? Any unhealthy habits?"
            )})

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 150 if not query else 100}
        }
        resp = requests.post(GEMINI_URL, json=payload, timeout=15)
        resp.raise_for_status()
        raw_response = resp.json()
        text = raw_response["candidates"][0]["content"]["parts"][0]["text"].strip()
        
        # Debug: Log what Gemini actually returns
        logger.debug(f"Gemini raw response: {text}")
        
        if query:
            return {"answer": text}

        # Try to parse as JSON, if fails return empty dict
        text = text.replace("```json", "").replace("```", "").strip()
        logger.debug(f"Gemini cleaned for JSON: {text}")
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # If not JSON, try to extract useful info manually
            result = {"activity": "idle", "emotion": "neutral", "vibe": "neutral", "description": text[:100]}
            logger.warning(f"Gemini returned non-JSON, using fallback: {result}")
            return result

    except json.JSONDecodeError:
        logger.warning("Gemini returned non-JSON")
        return {}
    except Exception as e:
        logger.error(f"Gemini error: {e}")
        return {}

# ENHANCED: Integrate with enhanced vision service for behavioral data
def sync_with_vision_service():
    """Pull enhanced behavioral data from vision service"""
    try:
        # Check vision status first
        status_response = requests.get('http://127.0.0.1:5003/status', timeout=5)
        if status_response.status_code == 200:
            status_data = status_response.json()
            if not status_data.get("active", False):
                logger.info(" Vision Server is in Standby. Skipping vision sync.")
                return {}
        
        response = requests.get('http://127.0.0.1:5003/latest_state', timeout=5)
        if response.status_code == 200:
            vision_data = response.json()
            behavioral_analysis = vision_data.get('behavioral_analysis', '{}')
            
            # Parse JSON if it's a string
            if isinstance(behavioral_analysis, str):
                try:
                    import json
                    behavioral_data = json.loads(behavioral_analysis)
                except:
                    behavioral_data = {}
            else:
                behavioral_data = behavioral_analysis
            
            # Update state manager with enhanced data and get immediate alerts
            immediate_alerts = state_manager.process_gemini_snapshot(behavioral_data)
            
            # Process any immediate alerts (like vaping detection)
            for alert in immediate_alerts:
                logger.info(f" IMMEDIATE ALERT: {alert['type']}")
                pc_action = alert.get('pc_action', None)
                threading.Thread(
                    target=trigger_ollama,
                    args=(alert["message"], state_manager.get_context_string(), pc_action),
                    daemon=True
                ).start()
            
            logger.debug(" Synced with enhanced vision service")
            
    except Exception as e:
        logger.debug(f"Vision service sync failed: {e}")

# ── OLLAMA TRIGGER ────────────────────────────────────────────────────────────
def trigger_ollama(alert_message: str, vision_context: str = "", pc_action: dict = None):
    """Enhanced trigger with PC control for high-priority alerts"""
    try:
        # Execute PC action first for high-priority interventions
        if pc_action:
            execute_pc_action(pc_action)
        
        payload = {
            "vision_description": alert_message,
            "screen_context":     vision_context,
            "user_id":            USER_ID,
        }
        resp = requests.post(PROACTIVE_URL, json=payload, timeout=20)
        logger.info(f"Ollama triggered → {resp.status_code}: {alert_message[:60]}")
    except requests.exceptions.Timeout:
        logger.warning("Proactive URL timeout")
    except Exception as e:
        logger.error(f"Proactive trigger error: {e}")

# ── INSTANT BYPASS ────────────────────────────────────────────────────────────
def trigger_instant_vision_check(query: str) -> str:
    """Captures fresh frame, asks Gemini, forwards to Ollama. No threshold needed."""
    logger.info(f"Instant vision check: '{query}'")
    img_b64    = state_manager.latest_frame_b64
    screen_b64 = capture_screen_base64()
    window     = get_screen_context()
    result     = analyze_with_gemini(img_b64, screen_b64, window, query=query)
    answer     = result.get("answer", "I can't see clearly right now.")
    vision_prompt = f"[VISION QUERY: '{query}' — I see: {answer}]"
    threading.Thread(target=trigger_ollama, args=(vision_prompt, window), daemon=True).start()
    return answer

# ── GEMINI LOOP ───────────────────────────────────────────────────────────────
def gemini_analysis_loop():
    """The Thinker: Gets vision data from Master Vision Service instead of direct camera access"""
    global LAST_WINDOW_TITLE
    last_gemini_time = 0
    
    # Wait for Vision Server to fully initialize
    logger.info(" AGI Supervisor starting up...")
    logger.info(" Waiting 10 seconds for Vision Server to initialize...")
    time.sleep(10)  # Give Vision Server time to start
    
    startup_attempts = 0
    max_startup_attempts = 6
    
    # Verify Vision Server is ready before starting main loop
    while startup_attempts < max_startup_attempts:
        try:
            logger.info(f"🔍 Checking vision server status (attempt {startup_attempts + 1}/{max_startup_attempts})...")
            status_response = requests.get("http://127.0.0.1:5003/status", timeout=5)
            if status_response.status_code == 200:
                status_data = status_response.json()
                if status_data.get("active", False):
                    logger.info("✅ Vision Server is Active! AGI Supervisor ready.")
                    break
                else:
                    logger.info("⏳ Vision Server in Standby, attempting to activate...")
                    # Try to activate the Vision Server
                    try:
                        activate_response = requests.post("http://127.0.0.1:5003/activate", json={"force": True}, timeout=5)
                        if activate_response.status_code == 200:
                            logger.info("✅ Vision Server activated successfully!")
                            time.sleep(2)  # Give it a moment to start processing
                            break
                        else:
                            logger.warning(f"⚠️ Failed to activate Vision Server: {activate_response.status_code}")
                    except Exception as activate_error:
                        logger.warning(f"⚠️ Could not activate Vision Server: {activate_error}")
            else:
                logger.warning(f"⚠️ Vision server returned status {status_response.status_code}")
        except Exception as e:
            logger.warning(f"⚠️ Vision server not ready yet: {e}")
        
        startup_attempts += 1
        if startup_attempts < max_startup_attempts:
            logger.info(" Waiting 5 seconds before next check...")
            time.sleep(5)
    
    if startup_attempts >= max_startup_attempts:
        logger.error(" Vision Server failed to start after 30 seconds. AGI Supervisor will continue but vision analysis may be limited.")

    while True:
        now = time.time()
        
        # Check if it's time for vision analysis
        if now - last_gemini_time < GEMINI_CHECK_INTERVAL:
            time.sleep(1)
            continue

        last_gemini_time = now
        
        # ── CHECK VISION STATUS FIRST ──
        try:
            logger.info("🔍 Checking vision server status before polling...")
            status_response = requests.get("http://127.0.0.1:5003/status", timeout=5)
            if status_response.status_code == 200:
                status_data = status_response.json()
                if not status_data.get("active", False):
                    # Try to activate if in standby
                    logger.info(" Vision Server in Standby, attempting to activate...")
                    try:
                        activate_response = requests.post("http://127.0.0.1:5003/activate", json={"force": True}, timeout=5)
                        if activate_response.status_code == 200:
                            logger.info(" Vision Server activated for this cycle!")
                            time.sleep(1)  # Brief pause for activation
                        else:
                            logger.info(" Vision Server still in Standby. Skipping Thinker analysis for this cycle.")
                            continue
                    except Exception as activate_error:
                        logger.warning(f" Could not activate Vision Server: {activate_error}. Skipping this cycle.")
                        continue
                else:
                    logger.info("Vision Server is Active. Proceeding with analysis...")
            else:
                logger.warning(" Vision server status check failed. Skipping this cycle.")
                continue
        except Exception as e:
            logger.warning(f" Vision status check failed: {e}")
            continue  # Skip this cycle but don't return
        
        # ── RETRY LOGIC BLOCK ──
        max_retries = 4
        vision_response = None
        
        for attempt in range(max_retries):
            try:
                logger.info("🔍 Requesting concise vision update from Master Vision Service...")
                vision_response = requests.get(
                    "http://127.0.0.1:5003/concise",
                    timeout=15
                )
                
                if vision_response.status_code == 200:
                    break  #  Server connected, exit retry loop!
                else:
                    logger.warning(f"Vision service unavailable: {vision_response.status_code}")
                    break
                    
            except requests.exceptions.ConnectionError:
                logger.warning(f"🔄 Connection attempt {attempt + 1} failed. Vision Server is still starting...")
                time.sleep(5)
            except requests.exceptions.Timeout:
                logger.warning("⏱️ Vision service timeout. It might be processing a heavy frame.")
                break
            except Exception as e:
                logger.error(f" Vision service error: {e}")
                break
        else:
            logger.warning("Vision Service not responding. Skipping this cycle...")
            continue
            
        if not vision_response or vision_response.status_code != 200:
            continue

        # ── PROCESS VISION DATA ──
        try:
            vision_data = vision_response.json()
            
            if vision_data.get("status") == "changed":
                context = vision_data.get("context", "")
                behavioral_analysis = vision_data.get("behavioral_analysis", {})
                logger.info(f" Vision State Changed: {context}")
                
                # Use behavioral_analysis if available, otherwise fall back to context parsing
                if behavioral_analysis and isinstance(behavioral_analysis, dict):
                    # Extract data from the new structured response
                    activity = behavioral_analysis.get("activity", "focused")
                    emotion = behavioral_analysis.get("emotion", "neutral")
                    landmark = behavioral_analysis.get("landmark_detected", "none")
                    
                    # Update the snapshot with full data for landmark detection
                    state_manager.latest_gemini_snapshot = behavioral_analysis
                    
                    logger.info(f"The Thinker processed structured: activity={activity}, emotion={emotion}, landmark={landmark}")
                else:
                    # Fallback to old context parsing
                    if "ALERT:" in context:
                        if "Junk Food" in context:
                            activity, emotion = "eating_junk_food", "neutral"
                        elif "Vaping" in context or "Smoking" in context:
                            activity, emotion = "vaping", "concerned"
                        elif "Phone Addiction" in context:
                            activity, emotion = "phone_addiction", "annoyed"
                        else:
                            activity, emotion = "health_alert", "concerned"
                    else:
                        activity, emotion = "focused", "neutral"
                    
                    state_manager.latest_gemini_snapshot = {"context": context}
                    logger.info(f"The Thinker processed concise: {context}")
                
                current_window = get_screen_context()
                state_manager.latest_screen_context = current_window
                
                state_manager.update(activity, emotion, "")
                
            else:
                # Silent pass if no change, so we don't spam the console but DO check thresholds
                pass 
                
        except Exception as e:
            logger.error(f" Error processing vision JSON: {e}")

        # ── CHECK THRESHOLDS & ALERTS (Must run every cycle!) ──
        alerts = state_manager.check_thresholds()
        for alert in alerts:
            logger.info(f"🚨 PROACTIVE ALERT [{alert['type']}]: {alert['message'][:80]}")
            pc_action = alert.get('pc_action', None)
            
            threading.Thread(
                target=trigger_ollama,
                args=(alert["message"], state_manager.get_context_string(), pc_action),
                daemon=True
            ).start()
            
        # Sync with behavioral data
        sync_with_vision_service()

# ── FLASK WEBHOOKS ────────────────────────────────────────────────────────────
app = Flask(__name__)

@app.route("/vision/instant", methods=["POST"])
def instant_vision_endpoint():
    """Called from chat when user asks 'what do you see?' or 'what am I eating?'"""
    body   = request.json or {}
    query  = body.get("query", "What is the user doing right now?")
    answer = trigger_instant_vision_check(query)
    return jsonify({"status": "ok", "answer": answer, "context": state_manager.get_context_string()})

@app.route("/vision/state", methods=["GET"])
def get_state():
    return jsonify({
        "activity":          state_manager.current_activity,
        "activity_duration": state_manager.get_activity_duration(),
        "emotion":           state_manager.current_emotion,
        "emotion_duration":  state_manager.get_emotion_duration(),
        "vibe":              state_manager.current_vibe,
        "screen":            state_manager.latest_screen_context,
        "schedule_task":     get_current_schedule_task(),
        "snapshot":          state_manager.latest_gemini_snapshot,
        "context":           state_manager.get_context_string()
    })

@app.route("/vision/query", methods=["POST"])
def query_vision():
    """Direct Gemini query without triggering Ollama."""
    body       = request.json or {}
    query      = body.get("query", "Describe what you see")
    img_b64    = state_manager.latest_frame_b64
    screen_b64 = capture_screen_base64()
    window     = get_screen_context()
    result     = analyze_with_gemini(img_b64, screen_b64, window, query=query)
    return jsonify(result)

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({"status": "ok", "service": "agi_supervisor_v3"})

# ── MAIN ──────────────────────────────────────────────────────────────────────
def run_loop():
    logger.info(" AGI Supervisor v3.0 — The Thinker Mode")
    logger.info(f"  Gemini interval: {GEMINI_CHECK_INTERVAL}s | Entertainment: {ENTERTAINMENT_THRESHOLD_SECONDS//3600}h | Emotion: {EMOTION_ALERT_THRESHOLD_SECONDS//60}min")
    logger.info(" The Thinker will request vision data from Master Vision Service...")
    
    # Give Vision Service more time to initialize (it needs to load MediaPipe, Gemini, etc.)
    logger.info(" Waiting 15 seconds for Vision Service to fully initialize...")
    time.sleep(15)  # Increased from 5 to 15 seconds

    # Gemini analysis runs in background thread
    threading.Thread(target=gemini_analysis_loop, daemon=True).start()
    logger.info(" The Thinker is now analyzing vision data from Master Vision Service")

    try:
        app.run(host="0.0.0.0", port=5005, debug=False, use_reloader=False)
    except KeyboardInterrupt:
        logger.info("Shutting down AGI Supervisor...")

if __name__ == "__main__":
    run_loop()
