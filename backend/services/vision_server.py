import os
import io
import base64
import cv2
import numpy as np
import time
import logging
from PIL import Image
import requests
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from datetime import datetime

# --- Logger must be defined FIRST ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Use the legacy API that works reliably
try:
    import google.generativeai as genai
    from google.generativeai import types
    GENAI_NEW = False
    logger.info("Using legacy Google GenerativeAI API")
except ImportError:
    logger.error("Google GenerativeAI not available")
    genai = None
from dotenv import load_dotenv
try:
    from camera_manager import camera, CAP_DSHOW, CAP_MSMF
except ImportError:
    from .camera_manager import camera, CAP_DSHOW, CAP_MSMF
try:
    from spatial_analyzer import analyze_spatial
except ImportError:
    from .spatial_analyzer import analyze_spatial

# Handle MockCV2 issues
try:
    IMREAD_COLOR = cv2.IMREAD_COLOR
except AttributeError:
    IMREAD_COLOR = 1

load_dotenv()

# --- GEMINI CLOUD BRAIN SETUP ---
# NINJA TECHNIQUE: Reload .env on every call!
from dotenv import load_dotenv
load_dotenv(override=True)  # Force reload environment variables

# Use GEMINI_VISION_KEY for vision server
vision_api_key = os.getenv("GEMINI_VISION_KEY") or os.getenv("GEMINI_API_KEY")

# Debug: Print what we found
print(f"Debug: GEMINI_VISION_KEY loaded: {'Yes' if os.getenv('GEMINI_VISION_KEY') else 'No'}")
print(f"Debug: GEMINI_API_KEY loaded: {'Yes' if os.getenv('GEMINI_API_KEY') else 'No'}")
print(f"Debug: Selected key loaded: {'Yes' if vision_api_key else 'No'}")

if vision_api_key and genai:
    try:
        genai.configure(api_key=vision_api_key)
        gemini_client = genai.GenerativeModel("gemini-2.5-flash")
        logger.info("Gemini Vision Brain Activated")
        logger.info(f"Using key: {'Yes' if vision_api_key else 'No'}")
    except Exception as e:
        logger.warning(f"Gemini setup failed: {e}")
        gemini_client = None
else:
    gemini_client = None
    logger.warning("GEMINI_VISION_KEY not found!")

# Smart Caching Variables
last_api_call_time = 0  
cached_ai_profile = "looks focused" # Default fallback
facial_map_cache = ""  # One-time facial analysis cache

# State-Change Filter Variables
last_media_title = ""      # Track last detected media
last_activity = ""         # Track last user activity
last_vision_update = 0    # Track last update time
VISION_UPDATE_INTERVAL = 30  # Check every 30 seconds

# Frontend Vision Context Storage
latest_vision_context = None  # Store latest frontend capture for chat integration

# Standby Mode Control
vision_active = False  # Vision server starts in standby mode

# State-Change Filter Function
def should_update_vision(analysis):
    """Check if vision state has changed significantly enough to warrant an update"""
    global last_media_title, last_activity, last_vision_update
    
    current_time = time.time()
    
   
    if current_time - last_vision_update < VISION_UPDATE_INTERVAL:
        return False
    
    # Extract key information from NEW Gemini prompt format
    current_media = analysis.get('screen_context', '').strip()
    current_activity = analysis.get('activity', '').strip()
    
    # Check for significant changes
    media_changed = current_media != last_media_title and current_media != ""
    activity_changed = current_activity != last_activity and current_activity != ""
    
    # Check for extreme cases or important events (NEW FORMAT)
    is_extreme = analysis.get('is_extreme_case', False)
    intervention_reason = analysis.get('intervention_reason', '')
    health_risk = analysis.get('health_risk', 'none')
    
    important_event = (
        is_extreme or
        intervention_reason != '' or
        health_risk != 'none'
    )
    
    # Update if significant change or important event
    if media_changed or activity_changed or important_event:
        last_media_title = current_media
        last_activity = current_activity
        last_vision_update = current_time
        
        # Create concise context (under 15 words)
        if important_event:
            if is_extreme and intervention_reason:
                context = f"[EXTREME: {intervention_reason}]"
            elif health_risk != 'none':
                context = f"[ALERT: {health_risk.replace('_', ' ').title()}]"
            else:
                context = f"Activity: {current_activity}, Screen: {current_media}"
        else:
            if current_media:
                context = f"[STATUS: {current_activity.title()} ({current_media})]"
            else:
                context = f"[STATUS: {current_activity.title()}]"
        
        logger.info(f"Vision State Changed: {context}")
        return True, context
    
    return False, None

# ANDROID PHONE CAMERA CONFIGURATION
PHONE_CAMERA_URL = "http://192.168.1.42:8080/video"
PC_CAMERA_INDEX = 0

# MASTER CAMERA - Using CameraManager singleton
# Camera is managed by camera_manager.camera singleton
def init_camera():
    """Initialize camera - tries Phone IP Webcam first, falls back to PC webcam"""
    try:
        # Check if camera is allowed to run via API
        try:
            res = requests.get(os.getenv("BRAIN_SERVICE_URL", "http://127.0.0.1:5000") + "/api/vision/camera", timeout=2)
            camera_active = res.json().get("camera_active", False)
        except:
            camera_active = False # Agar brain offline hai toh camera OFF rakho
            
        if not camera_active:
            logger.info("Camera initialization skipped - Camera is disabled")
            return False
            
        # Try Android Phone IP Camera First
        logger.info(f"Connecting to Phone Camera at {PHONE_CAMERA_URL}...")
        if camera.activate(PHONE_CAMERA_URL):
            logger.info("Android Phone Camera Connected Successfully! Maeve is watching through your phone.")
            return True
        else:
            logger.warning("Phone camera not responding. Falling back to PC webcam...")
            camera.deactivate()
            
    except Exception as e:
        logger.warning(f"Phone camera connection failed: {e}. Trying PC webcam...")
    
    # Fallback to PC Webcam with MSMF backend
    try:
        logger.info(f"Connecting to PC Webcam (index {PC_CAMERA_INDEX}) with MSMF backend...")
        if camera.activate(PC_CAMERA_INDEX, CAP_MSMF):
            logger.info("PC Webcam (MSMF) Initialized Successfully! Maeve is watching through your computer.")
            return True
        else:
            logger.error("Failed to initialize PC camera")
            return False
            
    except Exception as e:
        logger.error(f"PC camera init failed: {e}")
        return False

# Initialize camera on startup
# init_camera()  <-- Ise hata de warna yeh PC Agent se ladne lagega!

def get_screen_context():
    """Fallback screen context for Vision Server"""
    return "User is sitting at the desk"

# ── FACE DETECTION SETUP ──────────────────────────────────────────────────────
_BASE = cv2.data.haarcascades
_FACE_CASCADES = []
for _xml, _sf, _mn in [
    ("haarcascade_frontalface_alt2.xml",    1.05, 2),
    ("haarcascade_frontalface_alt.xml",     1.05, 3),
    ("haarcascade_frontalface_default.xml", 1.10, 4),
    ("haarcascade_profileface.xml",         1.05, 3),
]:
    _cc = cv2.CascadeClassifier(_BASE + _xml)
    if not _cc.empty():
        _FACE_CASCADES.append((_cc, _sf, _mn))

_EYE_CASCADE = cv2.CascadeClassifier(_BASE + "haarcascade_eye.xml")
logger.info(f"{len(_FACE_CASCADES)} face cascades loaded (beard+headphone mode)")

def _nms(rects, thresh=0.4):
    if not rects: return []
    rects = sorted(rects, key=lambda r: r[2]*r[3], reverse=True)
    kept = []
    for r in rects:
        if all(
            max(0, min(r[0]+r[2], k[0]+k[2]) - max(r[0],k[0])) *
            max(0, min(r[1]+r[3], k[1]+k[3]) - max(r[1],k[1])) <= thresh * r[2]*r[3]
            for k in kept
        ):
            kept.append(r)
    return kept

def detect_faces_robust(frame):
    """Multi-cascade + eye-anchor. Works with beard AND headphones."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    eq   = cv2.equalizeHist(gray)   # critical for bearded faces
    fh, fw = gray.shape
    all_rects = []

    for cc, sf, mn in _FACE_CASCADES:
        for src in (eq, gray):
            try:
                rects = cc.detectMultiScale(src, sf, mn, minSize=(40,40))
                if len(rects) > 0:
                    all_rects.extend(rects.tolist())
            except Exception:
                pass

    # Eye-anchor fallback: eyes visible even with full beard + headphones
    if not all_rects:
        eyes = _EYE_CASCADE.detectMultiScale(
            gray[:int(fh*0.65), :], 1.05, 3, minSize=(15,15)
        )
        if len(eyes) >= 2:
            eyes = sorted(eyes, key=lambda e: e[0])
            for i in range(len(eyes)):
                for j in range(i+1, len(eyes)):
                    e1, e2 = eyes[i], eyes[j]
                    cx1 = e1[0]+e1[2]//2; cy1 = e1[1]+e1[3]//2
                    cx2 = e2[0]+e2[2]//2; cy2 = e2[1]+e2[3]//2
                    ipd = abs(cx2-cx1)
                    if 30 < ipd < 350 and abs(cy2-cy1) < 40:
                        fw2 = int(ipd*2.4); fh2 = int(fw2*1.25)
                        fx2 = ((cx1+cx2)//2)-fw2//2
                        fy2 = ((cy1+cy2)//2)-int(fh2*0.33)
                        all_rects.append([max(0,fx2), max(0,fy2), fw2, fh2])
                        logger.info("👁️ Eye-anchor face reconstruction used")
                        break
                if all_rects: break

    return _nms(all_rects)

def init_cascades():
    pass  # kept for compatibility — real init done above at module level

def analyze_user_appearance_from_base64(image_data: str):
    """
    Helper function to analyze base64 image data
    """
    try:
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, IMREAD_COLOR)
        
        if frame is None:
            return {"description": "Could not decode image", "error": "Invalid image data"}
        
        # Use existing analysis function
        return analyze_user_appearance(frame)
        
    except Exception as e:
        logger.error(f"Base64 analysis error: {e}")
        return {"description": "Image analysis failed", "error": str(e)}

def analyze_user_appearance(frame, screen_frame=None):
    """
    ENHANCED: Deep behavioral mapping + facial analysis + health monitoring
    """
    global last_api_call_time, cached_ai_profile, facial_map_cache
    
    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        frame_h, frame_w = gray.shape

        # --- 1. LOCAL: ENVIRONMENT & LIGHTING ---
        brightness = np.mean(gray)
        if brightness < 40: room = "Pitch Black Room"
        elif brightness < 90: room = "Dimly Lit Room"
        elif brightness > 200: room = "Very Bright Room"
        else: room = "Normal Lighting"
        
        # --- 2. LOCAL: SKIN EXPOSURE & NSFW ---
        lower_skin = np.array([0, 20, 70], dtype=np.uint8)
        upper_skin = np.array([20, 255, 255], dtype=np.uint8)
        skin_mask = cv2.inRange(hsv, lower_skin, upper_skin)
        skin_ratio = cv2.countNonZero(skin_mask) / (frame_w * frame_h)

        activity_status = "sitting normally"
        if skin_ratio > 0.40:
            activity_status = "highly exposed (possible NSFW/intimate activity)"

        # --- 3. LOCAL: FACE PRESENCE & DISTANCE ---
        faces = []
        proximity = "sitting at a normal distance"
        
        faces = detect_faces_robust(frame)

        try:
            spatial = analyze_spatial(frame)
            dist_cm   = spatial.get('distance_cm')
            yaw_deg   = spatial.get('yaw_deg', 0)
            pitch_deg = spatial.get('pitch_deg', 0)
            eye_contact = spatial.get('eye_contact', False)
            gaze      = spatial.get('gaze_direction', 'unknown')
        except Exception:
            dist_cm = yaw_deg = pitch_deg = 0
            eye_contact = False
            gaze = 'unknown'

        if not faces:
            if skin_ratio > 0.30:
                return {"appearance": f"No face detected, high skin exposure. {room}.",
                        "faces": 0, "facial_map": "no_face_detected",
                        "behavioral_analysis": "high_exposure_warning"}
            return {"appearance": f"Nobody in frame. {room}.",
                    "faces": 0, "facial_map": "no_face_detected",
                    "behavioral_analysis": "no_user_present"}

        spatial_context = (
            f"yaw={yaw_deg}° pitch={pitch_deg}° "
            f"distance={dist_cm}cm eye_contact={eye_contact} gaze={gaze}"
        )

        # Process faces (we already know faces exist from earlier check)
        faces = sorted(faces, key=lambda x: x[2]*x[3], reverse=True)
        x, y, w, h = faces[0]
        
        # Distance Tracking (Local & Fast)
        face_area_ratio = (w * h) / (frame_w * frame_h)
        if face_area_ratio > 0.15: proximity = "leaning very close to the screen"
        elif face_area_ratio < 0.05: proximity = "sitting far back, relaxed"

        # --- 4. CLOUD: ADVANCED GEMINI ANALYSIS ---
        current_time = time.time()
        time_since_last = current_time - last_api_call_time
        
        logger.info(f"Gemini check: client={gemini_client is not None}, time_since_last={time_since_last:.1f}s")
        
        if gemini_client and (time_since_last > 15):
            try:
                img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(img_rgb)

                # ENHANCED PROMPT for beard/headphone support
                prompt = f"""
IMPORTANT: Subject may have beard (focus on eyes/brows) or headphones (ignore sides).
{spatial_context}

Respond ONLY with JSON:
{{ "activity": "...", "emotion": "focused/tired/frustrated/happy/sad/crying/neutral/angry",
   "emotion_confidence": 0.0,
   "facial_signals": {{"brow": "raised/neutral/furrowed", "eyes": "wide/normal/squinting/drooping"}},
   "appearance": "note beard/glasses/headphones if present",
   "facial_map": "one sentence exact expression",
   "environment": "bedroom/office/cafe/street/nature/unknown",
   "landmark_detected": "name or none",
   "vision_description": "brief room description",
   "unhealthy_habits": ["none"],
   "phone_addiction": "focused/using_phone_while_working",
   "is_extreme_case": false,
   "intervention_reason": "",
   "screen_context": "app or content visible" }}
"""
                # Build content list using new google.genai types
                content_parts = [prompt, pil_img]
                if screen_frame is not None:
                    content_parts.append(screen_frame)

                response = gemini_client.generate_content(content_parts)

                if response.text:
                    # Parse JSON response
                    try:
                        import json
                        analysis = json.loads(response.text.strip())
                        
                        # Cache facial map once per session
                        if 'facial_map' in analysis and not facial_map_cache:
                            facial_map_cache = analysis['facial_map']
                            logger.info(f"Facial Map Cached: {facial_map_cache}")
                        
                        # Filter low-confidence emotions
                        if analysis.get('confidence_score', 0) < 0.8:
                            analysis['emotion'] = 'neutral'
                        
                        cached_ai_profile = response.text.strip().replace('\n', ' ')
                        last_api_call_time = current_time
                        logger.info(f"Advanced Analysis: {cached_ai_profile}")
                        
                        # Return Gemini analysis as behavioral_analysis
                        return {
                            "appearance": f"User is {proximity} and {activity_status}. AI Profile: {cached_ai_profile}. Environment: {room}.", 
                            "faces": len(faces),
                            "facial_map": facial_map_cache or "gemini_analyzed",
                            "behavioral_analysis": analysis  # Return parsed Gemini JSON
                        }
                        
                    except json.JSONDecodeError:
                      
                        cached_ai_profile = response.text.strip().replace('\n', ' ')
                        last_api_call_time = current_time
                        logger.info(f"☁️ Fallback Analysis: {cached_ai_profile}")
                        
                        # Return fallback as behavioral_analysis
                        return {
                            "appearance": f"User is {proximity} and {activity_status}. AI Profile: {cached_ai_profile}. Environment: {room}.", 
                            "faces": len(faces),
                            "facial_map": facial_map_cache or "gemini_fallback",
                            "behavioral_analysis": cached_ai_profile  # Return fallback text
                        }
                        
            except Exception as e:
                logger.warning(f"Cloud API Failed, using last known profile. Error: {e}")
        else:
            if not gemini_client:
                logger.warning("Gemini client is None - API not configured")
            else:
                logger.warning(f"Gemini cache active - {time_since_last:.1f}s since last call (need 15s)")

        
        description = f"User is {proximity} and {activity_status}. AI Profile: {cached_ai_profile}. Environment: {room}."
        
        result = {
            "appearance": description, 
            "faces": len(faces),
            "facial_map": facial_map_cache or "not_analyzed_yet",
            "behavioral_analysis": cached_ai_profile
        }
        
        return result

    except Exception as e:
        logger.error(f"Analysis error: {e}")
        return {
            "appearance": "Vision blocked.", 
            "faces": 0,
            "facial_map": "analysis_error",
            "behavioral_analysis": "vision_blocked"
        }

# --- FastAPI Setup ---
vision_app = FastAPI()


# 📸 Capture current webcam frame
def capture_current_frame():
    """Capture frame from CameraManager singleton"""
    try:
        # Check if camera is allowed to run via API
        try:
            res = requests.get(os.getenv("BRAIN_SERVICE_URL", "http://127.0.0.1:5000") + "/api/vision/camera", timeout=2)
            camera_active = res.json().get("camera_active", False)
        except:
            camera_active = False 
            
        if not camera_active:
            return None  
            
        if not camera.is_active:
            if not init_camera():
                return None
                
        ret, frame = camera.read_frame()
        if ret:
            # Convert to base64
            _, buffer = cv2.imencode('.jpg', frame)
            img_str = base64.b64encode(buffer).decode()
            return img_str
        else:
            logger.warning("Failed to capture frame")
            return None
    except Exception as e:
        logger.error(f"Capture error: {e}")
        return None

@vision_app.get("/capture")
async def capture_webcam():
    """Return current webcam frame as base64"""
    frame_data = capture_current_frame()
    if frame_data:
        return {"status": "success", "image": frame_data}
    else:
        return {"status": "error", "message": "Failed to capture frame"}

@vision_app.get("/concise")
async def get_concise_vision():
    """
    LAZY INJECTION: Return concise vision update only if state has changed
    This prevents token bloat and hallucinations
    """
    try:
        # Capture current frame
        frame_data = capture_current_frame()
        if not frame_data:
            return {"status": "no_change", "message": "No frame available"}
        
        # Decode and analyze
        image_bytes = base64.b64decode(frame_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, IMREAD_COLOR)
        
      
        analysis_result = analyze_user_appearance(frame)
        
       
        analysis_dict = {}
        if isinstance(analysis_result, dict):
            if "behavioral_analysis" in analysis_result:
                try:
                    # Parse inner JSON string returned by Gemini
                    if isinstance(analysis_result["behavioral_analysis"], str):
                        analysis_dict = json.loads(analysis_result["behavioral_analysis"])
                    else:
                        analysis_dict = analysis_result["behavioral_analysis"]
                except Exception as e:
                    logger.error(f"Failed to parse inner JSON: {e}")
                    analysis_dict = {"activity": "unknown", "emotion": "unknown"}
            else:
                analysis_dict = analysis_result
        
       
        if "screen_context" not in analysis_dict:
            analysis_dict["screen_context"] = get_screen_context()

        # Check if state has changed using cleaned dict
        should_update, context = should_update_vision(analysis_dict)
        
        if should_update and context:
          
            return {
                "status": "changed",
                "context": context,
                "timestamp": time.time(),
                "behavioral_analysis": analysis_dict 
            }
        else:
            return {"status": "no_change", "message": "No significant change"}
            
    except Exception as e:
        logger.error(f"Concise vision error: {e}")
        return {"status": "error", "message": str(e)}

@vision_app.post("/activate")
async def activate_vision():
    """
    Activate vision processing when frontend button is pressed
    """
    global vision_active
    vision_active = True
    logger.info("👁️ Vision processing ACTIVATED by frontend")
    return {
        "status": "success", 
        "message": "Vision processing activated",
        "active": True
    }

@vision_app.post("/deactivate")
async def deactivate_vision():
    """
    Deactivate vision processing when frontend button is pressed
    """
    global vision_active
    vision_active = False
    logger.info("👁️ Vision processing DEACTIVATED by frontend")
    return {
        "status": "success", 
        "message": "Vision processing deactivated",
        "active": False
    }

@vision_app.get("/status")
async def vision_status():
    """Check vision service status and active state"""
    return {
        "status": "online", 
        "mode": "Smart Hybrid (Local Tracking + Gemini Profiling)",
        "active": vision_active,
        "message": "Standby mode - waiting for activation" if not vision_active else "Active mode - processing vision"
    }

@vision_app.post("/capture")
async def capture_vision_endpoint(request: dict):
    """
    Frontend Vision Capture Endpoint
    Receives image from frontend, analyzes it, and returns context for chat
    """
    try:
        # Check if vision is activated
        if not vision_active:
            return {
                "status": "error", 
                "message": "Vision processing is not active. Please activate vision first."
            }
        
        user_id = request.get("userId", "user_pro_01")
        image_data = request.get("image", "")
        
        if not image_data:
            return {"status": "error", "message": "No image provided"}
        
       
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        logger.info(f"📸 Frontend capture from {user_id}")
        
        # Use existing analysis function
        analysis = analyze_user_appearance_from_base64(image_data)
        
        # Store for chat integration
        global latest_vision_context
        latest_vision_context = {
            "user_id": user_id,
            "context": analysis.get("description", "User is visible"),
            "timestamp": time.time(),
            "analysis": analysis
        }
        
        return {
            "status": "success",
            "context": analysis.get("description", "User is visible"),
            "user_id": user_id,
            "timestamp": datetime.now().isoformat(),
            "analysis": analysis
        }
        
    except Exception as e:
        logger.error(f" Frontend capture error: {e}")
        return {"status": "error", "message": str(e)}

@vision_app.get("/chat_context/{user_id}")
async def get_chat_context(user_id: str):
    """
    Get latest vision context for chat integration
    """
    global latest_vision_context
    if latest_vision_context and latest_vision_context.get("user_id") == user_id:
        return {
            "status": "success",
            "context": latest_vision_context["context"],
            "analysis": latest_vision_context["analysis"]
        }
    return {"status": "no_context", "message": "No vision context available"}

@vision_app.post("/analyze")
async def analyze_image(request: dict):
    """
    MASTER VISION SERVICE: Can analyze provided images OR capture from its own camera
    Supports both 'image' and 'webcam_image' keys for backward compatibility
    """
    try:
        # Support multiple key names for backward compatibility
        image_data = (request.get("image") or 
                     request.get("webcam_image") or 
                     "")
        screen_data = request.get("screen_image", "")

        # If no image provided, capture from master camera
        if not image_data:
            logger.info("No image provided - capturing from master camera")
            image_data = capture_current_frame()
            if not image_data:
                return {"status": "error", "message": "Failed to capture from camera"}

        # Decode webcam frame
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, IMREAD_COLOR)

        # Decode screen image into PIL if present
        screen_pil = None
        if screen_data:
            try:
                screen_bytes = base64.b64decode(screen_data)
                screen_pil = Image.open(io.BytesIO(screen_bytes)).convert("RGB")
            except Exception as e:
                logger.warning(f"Screen image decode failed: {e}")
                screen_pil = None

        # Run analysis — pass screen PIL to Gemini when available
        analysis = analyze_user_appearance(frame, screen_frame=screen_pil)
        return {"status": "success", "data": analysis}

    except Exception as e:
        return {"status": "error", "message": str(e)}

@vision_app.get("/latest_state")
def get_latest_state():
    """Return the most recent vision analysis for chat integration with enhanced data"""
    return {
        "status": "success",
        "vision_description": cached_ai_profile,
        "screen_context": "User is sitting at the desk",
        "facial_map": facial_map_cache or "not_analyzed_yet",
        "behavioral_analysis": cached_ai_profile
    }

# ── BACKWARD COMPATIBILITY: GHOST API CALLS ─────────────────────────────────────
@vision_app.get("/analyze_user_appearance")
async def ghost_get_analyze_user_appearance():
    """Ghost API call handler - forwards to latest_state"""
    logger.info("Ghost API Call Detected: GET /analyze_user_appearance")
    return get_latest_state()

@vision_app.get("/analyze_user_appearance_from_base64")
async def ghost_get_analyze_user_appearance_from_base64():
    """Ghost API call handler - forwards to latest_state"""
    logger.info("Ghost API Call Detected: GET /analyze_user_appearance_from_base64")
    return get_latest_state()

@vision_app.post("/analyze_user_appearance")
async def ghost_post_analyze_user_appearance(request: dict):
    """Ghost API call handler - forwards to analyze_image"""
    logger.info("Ghost API Call Detected: POST /analyze_user_appearance")
    return await analyze_image(request)

@vision_app.post("/analyze_user_appearance_from_base64")
async def ghost_post_analyze_user_appearance_from_base64(request: dict):
    """Ghost API call handler - forwards to capture_vision_endpoint"""
    logger.info("Ghost API Call Detected: POST /analyze_user_appearance_from_base64")
    return await capture_vision_endpoint(request)

if __name__ == "__main__":
    import uvicorn
    print("Maeve's SMART HYBRID Eyes are Ready!")
    print("Local OpenCV tracking Proximity & Lighting (0% Lag)")
    print("Gemini API tracking Emotions, Headphones & Beard")
    print("Screen context now forwarded to Gemini alongside webcam")
    print("VISION SERVER IN STANDBY MODE - Waiting for frontend activation...")
    print("   -> Frontend must call /activate to start vision processing")
    uvicorn.run(vision_app, host="0.0.0.0", port=5003)
