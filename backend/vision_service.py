import os
import cv2
import numpy as np
import base64
import logging
import time
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from fastapi import FastAPI
from ultralytics import YOLO
from deepface import DeepFace
import mediapipe as mp
from mediapipe import solutions

logger = logging.getLogger(__name__)

# 🎥 ANDROID PHONE CAMERA CONFIGURATION
PHONE_CAMERA_URL = "http://192.168.1.42:8080/video"
PC_CAMERA_INDEX = 0

# Initialize models
face_detector = solutions.face_detection.FaceDetection()
yolo_model = None
cap = None

def initialize_vision_models():
    """Initialize YOLO and face detection models"""
    global yolo_model
    try:
        # Load YOLO model for object detection
        yolo_model = YOLO('yolov8n.pt')
        logger.info("✅ YOLO model loaded for object detection")
    except Exception as e:
        logger.error(f"❌ Failed to load YOLO model: {e}")
        yolo_model = None

# 🎥 MASTER CAMERA INITIALIZATION - Phone IP Webcam Support
def init_camera():
    """Initialize camera - tries Phone IP Webcam first, falls back to PC webcam"""
    global cap
    try:
        # 🔥 Try Android Phone IP Camera First
        logger.info(f"🔄 Connecting to Phone Camera at {PHONE_CAMERA_URL}...")
        cap = cv2.VideoCapture(PHONE_CAMERA_URL)
        
        # 🔥 OPTIMIZATION: Reduce buffer size for lower latency
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
        # Quick test
        ret, frame = cap.read()
        if ret:
            logger.info("📱 Android Phone Camera Connected Successfully! Maeve is watching through your phone.")
            return True
        else:
            logger.warning("⚠️ Phone camera not responding. Falling back to PC webcam...")
            cap.release()
            
    except Exception as e:
        logger.warning(f"⚠️ Phone camera connection failed: {e}. Trying PC webcam...")
    
    # Fallback to PC Webcam
    try:
        logger.info(f"🔄 Connecting to PC Webcam (index {PC_CAMERA_INDEX})...")
        cap = cv2.VideoCapture(PC_CAMERA_INDEX)
        
        # Optimization for PC webcam
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
        ret, frame = cap.read()
        if ret:
            logger.info("💻 PC Webcam Connected Successfully! Maeve is watching through your computer.")
            return True
        else:
            logger.error("❌ Failed to initialize any camera")
            return False
            
    except Exception as e:
        logger.error(f"❌ PC camera init failed: {e}")
        return False

# Initialize on import
initialize_vision_models()

def get_enhanced_vibe(frame):
    """Enhanced vibe detection with object and emotion analysis"""
    try:
        # Convert frame to RGB for DeepFace
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Face detection
        faces = []
        face_results = face_detector.process(rgb_frame)
        if face_results.detections:
            for detection in face_results.detections:
                bbox = [detection.bbox.xmin, detection.bbox.ymin, 
                         detection.bbox.xmax - detection.bbox.xmin,
                         detection.bbox.ymax - detection.bbox.ymin]
                faces.append(bbox)
        
        # Object detection with YOLO
        detected_objects = []
        if yolo_model:
            results = yolo_model(frame)
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        cls = int(box.cls[0])
                        conf = float(box.conf[0])
                        if conf > 0.5:  # Confidence threshold
                            class_name = yolo_model.names[cls]
                            detected_objects.append(class_name)
        
        # Emotion detection with DeepFace
        emotion = "neutral"
        try:
            if len(faces) > 0:
                # Use first detected face for emotion analysis
                x, y, w, h = faces[0]
                face_img = frame[y:y+h, x:x+w]
                
                analysis = DeepFace.analyze(
                    face_img,
                    actions=['emotion'],
                    enforce_detection=False
                )
                
                if analysis and len(analysis) > 0:
                    dominant_emotion = analysis[0]['emotion']
                    emotion = max(dominant_emotion, key=dominant_emotion.get)
        except Exception as e:
            logger.debug(f"Emotion detection failed: {e}")
            emotion = "neutral"
        
        # Eye contact detection
        eye_contact = "looking at me" if len(faces) > 0 else "not looking at me"
        
        # Gesture detection (simplified)
        gesture_desc = "sitting normally"
        if len(faces) > 0:
            x, y, w, h = faces[0]
            face_area = w * h
            frame_area = frame.shape[0] * frame.shape[1]
            face_ratio = face_area / frame_area
            
            if face_ratio > 0.15:  # Large face = close to camera
                gesture_desc = "leaning in close"
            elif face_ratio < 0.02:  # Small face = far from camera
                gesture_desc = "sitting far away"
        
        # NEW: Specific logic for "Holding something"
        holding_context = ""
        if len(detected_objects) > 0:
            # Filter for objects typically held in hands
            hand_objects = [obj for obj in detected_objects if obj in ['cell phone', 'cup', 'book', 'laptop', 'bottle']]
            if hand_objects:
                holding_context = f" I noticed you are holding a {', '.join(hand_objects)}."

        # NEW: Emotional state refinement
        if emotion == "sad":
            emotional_state = "you look really down, like you need a hug or someone to talk to."
        elif emotion == "happy":
            emotional_state = "you have a beautiful smile right now, it's making me happy too!"
        else:
            emotional_state = f"you seem {emotion}."

        # Lighting detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        brightness = np.mean(gray)
        
        if brightness > 180:
            lighting = "well-lit"
        elif brightness > 120:
            lighting = "moderately lit"
        else:
            lighting = "dimly lit"
        
        scene_vibe = (f"The room is {lighting}. I am looking at you right now; {eye_contact} and {emotional_state} "
                      f"You are {gesture_desc}.{holding_context}")
        
        return scene_vibe, detected_objects
        
    except Exception as e:
        logger.error(f"Vision analysis error: {e}")
        return "I'm having trouble seeing clearly right now.", []

# Track state globally in vision_server
USER_PRESENT = False

async def vision_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time vision analysis"""
    global USER_PRESENT
    await websocket.accept()
    
    while True:
        try:
            # Receive frame data
            data = await websocket.receive_bytes()
            
            # Decode base64 image
            nparr = np.frombuffer(base64.b64decode(data), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                continue
            
            # Analyze frame
            scene_vibe, detected_objects = get_enhanced_vibe(frame)
            
            # 🔥 PROACTIVE DETECTION LOGIC
            has_face = len(face_detector.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).detections) > 0
            
            if has_face and not USER_PRESENT:
                USER_PRESENT = True
                # Send a signal to Main Backend that user just arrived
                asyncio.create_task(trigger_proactive_greeting("USER_ARRIVED"))
            
            elif not has_face and USER_PRESENT:
                USER_PRESENT = False
                # Optional: trigger a "Goodbye" if you want
            
            # Send analysis back to client
            response = {
                "scene_vibe": scene_vibe,
                "detected_objects": detected_objects,
                "user_present": has_face,
                "timestamp": time.time()
            }
            
            await websocket.send_json(response)
            
        except WebSocketDisconnect:
            logger.info("Vision client disconnected")
            break
        except Exception as e:
            logger.error(f"Vision processing error: {e}")
            continue

async def trigger_proactive_greeting(event_type):
    """Notify main backend to speak proactively"""
    try:
        import requests
        requests.post(os.getenv("BRAIN_SERVICE_URL", "http://127.0.0.1:5000") + "/api/proactive/vision", 
                      json={"event": event_type, "userId": "user_pro_01"})
    except Exception as e:
        logger.error(f"Failed to trigger proactive greeting: {e}")

# Create FastAPI app for vision service
vision_app = FastAPI()
vision_app.websocket("/vision")(vision_endpoint)

@vision_app.get("/status")
async def vision_status():
    """Get vision service status"""
    return {
        "status": "online",
        "models_loaded": yolo_model is not None,
        "user_present": USER_PRESENT
    }

if __name__ == "__main__":
    import uvicorn
    
    # 🎥 INITIALIZE CAMERA BEFORE STARTING SERVICE
    print("👁️ Vision Service Starting on Port 5003")
    print("🔄 Initializing Camera...")
    
    if init_camera():
        print("📱 Camera Ready! Maeve can now see through your eyes.")
    else:
        print("❌ Camera Failed! Maeve is blind.")
    
    print("🚀 Starting Vision Service...")
    uvicorn.run(vision_app, host="0.0.0.0", port=5003)
