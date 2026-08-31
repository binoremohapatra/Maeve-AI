import os
import time
import requests
import cv2
import base64
import logging
import pygetwindow as gw
import pyautogui
import pytesseract
from PIL import Image
import io
from datetime import datetime

# --- CONFIG ---
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

VISION_URL = os.getenv("VISION_SERVICE_URL", "http://127.0.0.1:5003") + "/analyze"
PROACTIVE_URL = os.getenv("BRAIN_SERVICE_URL", "http://127.0.0.1:5000") + "/api/proactive/visual_event"
CHECK_INTERVAL = 90 # हर 90 सेकंड में एक कमेंट 
LAST_WINDOW_TITLE = ""
LAST_PROFILE = ""

logging.basicConfig(level=logging.INFO, format='%(name)s - %(message)s')
logger = logging.getLogger("AGI_CORE")

def get_screen_context():
    try:
        window = gw.getActiveWindow()
        return window.title if window else "Desktop"
    except:
        return "Unknown"

def capture_screen_base64():
    """स्क्रीन की फोटो खींचकर सीधा Base64 बनाता है (No Tesseract Lag!)"""
    try:
        screenshot = pyautogui.screenshot()
        
        screenshot = screenshot.resize((854, 480), Image.Resampling.LANCZOS)
        
        buffer = io.BytesIO()
        
        screenshot.save(buffer, format="JPEG", quality=50) 
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        logger.error(f"Screen Capture Error: {e}")
        return ""

def run_loop():
    global LAST_WINDOW_TITLE, LAST_PROFILE
    logger.info("Master AGI Supervisor Active (ALWAYS-ON EYES MODE)")
    
 
    cap = cv2.VideoCapture(0)  
    if not cap.isOpened():
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW) 
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    if not cap.isOpened():
        logger.error("Camera failed to open!")
        return

    logger.info("Letting camera adjust to room light (3 seconds)...")
    for _ in range(50): 
        cap.read() 
        time.sleep(0.05)
        
    logger.info("Camera is now perfectly exposed and tracking!")
    
    last_check_time = time.time()
    
    try:
        while True:
         
            ret, frame = cap.read()
            if not ret:
                continue
                
            current_time = time.time()
            
            if current_time - last_check_time >= CHECK_INTERVAL:
                last_check_time = current_time
                
                
                try:
                    clean_frame = cv2.fastNlMeansDenoisingColored(frame, None, 5, 5, 7, 21)
                    process_frame = clean_frame
                except Exception:
                    process_frame = frame
                
                _, buffer = cv2.imencode('.jpg', process_frame)
                img_b64 = base64.b64encode(buffer).decode('utf-8')

                
                current_window = get_screen_context()
                screen_b64 = ""
                
          
                if current_window != LAST_WINDOW_TITLE:
                    logger.info(f"Snapping screen: {current_window}")
                    screen_b64 = capture_screen_base64()
                    LAST_WINDOW_TITLE = current_window

                
                try:
                    payload = {
                        "image": img_b64,          
                        "screen_image": screen_b64, 
                        "window_title": current_window
                    }
                    v_res = requests.post(VISION_URL, json=payload, timeout=20)
                    if v_res.status_code == 200:
                        vision_data = v_res.json()["data"]["appearance"]
                        current_profile = vision_data.split("AI Profile:")[1].split(".")[0].strip() if "AI Profile:" in vision_data else ""

                       
                        if current_profile != LAST_PROFILE or current_window != LAST_WINDOW_TITLE:
                            LAST_PROFILE = current_profile
                            
                     
                            payload = {
                                "vision_description": vision_data,
                                "screen_context": current_window,
                                "user_id": "user_pro_01"
                            }
                            
                            logger.info(f"Sending to Brain -> VISION: {vision_data} | SCREEN: {current_window}")
                            try:
                                requests.post(PROACTIVE_URL, json=payload, timeout=20)
                            except requests.exceptions.Timeout:
                                logger.warning("Brain timeout - skipping this cycle")
                            except Exception as e:
                                logger.error(f"Brain API Error: {e}")
                            
                except Exception as e:
                    logger.error(f"API Sync Error: {e}")
                    
    except KeyboardInterrupt:
        logger.info("Shutting down supervisor...")
    finally:
       
        cap.release()
        logger.info("Camera released safely.")

if __name__ == "__main__":
    run_loop()
