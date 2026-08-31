import os
import cv2
import numpy as np
import base64
import logging
import time
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from ultralytics import YOLO
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Initialize models
yolo_model = None

def initialize_vision_models():
    """Initialize YOLO model for object detection"""
    global yolo_model
    try:
        # Load YOLO model for object detection
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

async def vision_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time vision processing"""
    logger.info("👁️ Vision WebSocket connected")
    try:
        while True:
            # Receive image data from WebSocket
            data = await websocket.receive_bytes()
            
            # Decode base64 image
            try:
                # Convert bytes to numpy array
                nparr = np.frombuffer(data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if frame is not None:
                    # Analyze frame
                    analysis = get_enhanced_vibe(frame)
                    
                    # Send analysis back
                    await websocket.send_json({
                        "type": "vision_analysis",
                        "data": analysis
                    })
                    
            except Exception as e:
                logger.error(f"Frame processing error: {e}")
                await websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })
                
    except WebSocketDisconnect:
        logger.info("👁️ Vision WebSocket disconnected")
    except Exception as e:
        logger.error(f"Vision WebSocket error: {e}")

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

vision_app.websocket("/vision")(vision_endpoint)

if __name__ == "__main__":
    import uvicorn
    print("👁️ Simple Vision Service Starting on Port 5003")
    print("✅ Compatible with existing dependencies")
    uvicorn.run(vision_app, host="0.0.0.0", port=5003)
