import os
# Suppress heavy TensorFlow logging and force CPU for emotion extraction (faster for real-time)
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
# CRITICAL: Tell TensorFlow to leave GPU alone - prevent VRAM artifacting
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'  # Use CPU only, don't touch GPU

import cv2
import numpy as np
import base64
import logging
import time
from fastapi import FastAPI
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Initialize models
yolo_model = None

def initialize_vision_models():
    """Initialize YOLO model for object detection"""
    global yolo_model
    try:
        # Load YOLO model for object detection
        from ultralytics import YOLO
        yolo_model = YOLO('yolov8n.pt')
        logger.info("✅ YOLO model loaded for object detection")
    except Exception as e:
        logger.error(f"❌ Failed to load YOLO model: {e}")
        yolo_model = None

# Initialize on import
initialize_vision_models()

def get_enhanced_vibe(frame):
    """Analyze frame for emotional content"""
    try:
        # Simple emotion detection based on image analysis
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces (simplified)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        # Analyze face regions for basic emotions
        emotions_detected = []
        for (x, y, w, h) in faces:
            face_roi = gray[y:y+h, x:x+w]
            
            # Simple emotion heuristics
            brightness = np.mean(face_roi)
            if brightness > 150:
                emotions_detected.append("happy")
            elif brightness < 100:
                emotions_detected.append("sad")
            else:
                emotions_detected.append("neutral")
        
        # Detect objects/gestures
        objects_detected = []
        if yolo_model:
            results = yolo_model(frame)
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        cls = int(box.cls[0])
                        if cls == 0:  # person
                            objects_detected.append("person_detected")
                        elif cls == 67:  # cell phone
                            objects_detected.append("phone_usage")
        
        return {
            "emotions": emotions_detected if emotions_detected else ["neutral"],
            "objects": objects_detected if objects_detected else ["no_objects"],
            "faces_detected": len(faces),
            "analysis_timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"Error in vibe analysis: {e}")
        return {
            "emotions": ["error"],
            "objects": ["analysis_failed"],
            "faces_detected": 0,
            "error": str(e)
        }

# Create FastAPI app for vision service
vision_app = FastAPI()

@vision_app.get("/status")
async def vision_status():
    """Get vision service status"""
    return {
        "status": "online",
        "models_loaded": yolo_model is not None,
        "capabilities": [
            "face_detection",
            "emotion_detection", 
            "object_detection",
            "gesture_analysis"
        ],
        "service": "vision_processing"
    }

@vision_app.post("/analyze")
async def analyze_image(request: dict):
    """Analyze image for emotions and objects"""
    try:
        image_data = request.get("image", "")
        analyze_emotions = request.get("analyze_emotions", True)
        detect_gestures = request.get("detect_gestures", True)
        analyze_faces = request.get("analyze_faces", True)
        
        if not image_data:
            return {"status": "error", "message": "No image data provided"}
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return {"status": "error", "message": "Invalid image data"}
        
        # Perform analysis
        analysis = get_enhanced_vibe(frame)
        
        # Filter results based on request
        result = {"status": "success"}
        if analyze_emotions:
            result["emotions"] = analysis.get("emotions", [])
        if detect_gestures:
            result["objects"] = analysis.get("objects", [])
        if analyze_faces:
            result["faces_detected"] = analysis.get("faces_detected", 0)
        
        return result
        
    except Exception as e:
        logger.error(f"Image analysis error: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    print("👁️ God-Mode Emotional Eyes are active!")
    print("✅ Minimal dependencies - Maximum compatibility")
    print("✅ Face detection + Emotion analysis ready")
    uvicorn.run(vision_app, host="0.0.0.0", port=5003)
