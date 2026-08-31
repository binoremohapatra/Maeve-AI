import os
import time
import requests
import cv2
import base64
import logging
import threading          # FIX 2: needed for background API calls
import pygetwindow as gw
import pyautogui
import pytesseract
from PIL import Image
import io
from datetime import datetime

# --- CONFIG ---
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

VISION_URL    = os.getenv("VISION_SERVICE_URL", "http://127.0.0.1:5003") + "/analyze"
PROACTIVE_URL = os.getenv("BRAIN_SERVICE_URL", "http://127.0.0.1:5000") + "/api/proactive/visual_event"
CHECK_INTERVAL = 90
LAST_WINDOW_TITLE = ""
LAST_PROFILE      = ""

logging.basicConfig(level=logging.INFO, format='%(name)s - %(message)s')
logger = logging.getLogger("AGI_CORE")


def get_screen_context():
    try:
        window = gw.getActiveWindow()
        return window.title if window else "Desktop"
    except:
        return "Unknown"


def capture_screen_base64():
    """Capture screen and return as base64 JPEG string."""
    try:
        screenshot = pyautogui.screenshot()
        screenshot = screenshot.resize((854, 480), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        screenshot.save(buffer, format="JPEG", quality=50)
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        logger.error(f"Screen Capture Error: {e}")
        return ""


# ─────────────────────────────────────────────────────────────────────────────
# FIX 2: extracted API logic into its own function so we can run it in a thread
# ─────────────────────────────────────────────────────────────────────────────
def _send_to_brain(img_b64: str, screen_b64: str, current_window: str):
    """
    Sends webcam + screen data to the vision service, then forwards the
    result to the proactive brain endpoint.  Runs in a daemon thread so
    the camera read-loop is never blocked.
    """
    global LAST_PROFILE

    try:
        payload = {
            "image":        img_b64,
            "screen_image": screen_b64,
            "window_title": current_window,
        }
        v_res = requests.post(VISION_URL, json=payload, timeout=20)

        if v_res.status_code != 200:
            logger.warning(f"Vision service returned {v_res.status_code}")
            return

        vision_data     = v_res.json()["data"]["appearance"]
        current_profile = ""
        if "AI Profile:" in vision_data:
            current_profile = vision_data.split("AI Profile:")[1].split(".")[0].strip()

        # Only forward to brain when something actually changed
        if current_profile != LAST_PROFILE:
            LAST_PROFILE = current_profile

            brain_payload = {
                "vision_description": vision_data,
                "screen_context":     current_window,
                "user_id":            "user_pro_01",
            }
            logger.info(f"👁️ Sending to Brain -> VISION: {vision_data} | SCREEN: {current_window}")
            try:
                requests.post(PROACTIVE_URL, json=brain_payload, timeout=20)
            except requests.exceptions.Timeout:
                logger.warning("⚠️ Brain timeout - skipping this cycle")
            except Exception as e:
                logger.error(f"⚠️ Brain API Error: {e}")

    except Exception as e:
        logger.error(f"⚠️ _send_to_brain error: {e}")


def run_loop():
    global LAST_WINDOW_TITLE, cap

    logger.info("🧠 Master AGI Supervisor Active (CAMERA ON-DEMAND MODE)")

    cap = None
    last_camera_state = False

    try:
        while True:
            # ─── Check camera state via API (No Imports!) ─────────────────────
            try:
                res = requests.get(os.getenv("BRAIN_SERVICE_URL", "http://127.0.0.1:5000") + "/api/vision/camera", timeout=2)
                CAMERA_ACTIVE = res.json().get("camera_active", False)
            except:
                CAMERA_ACTIVE = False # Agar brain offline hai toh camera OFF rakho
            
            # Camera state changed - reinitialize or release
            if CAMERA_ACTIVE != last_camera_state:
                if CAMERA_ACTIVE:
                    # Camera turned ON - initialize
                    logger.info("📹 Camera Activated - Initializing hardware...")
                    cap = cv2.VideoCapture(0)
                    if not cap.isOpened():
                        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
                    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    
                    if not cap.isOpened():
                        logger.error("❌ Camera failed to open!")
                        cap = None
                    else:
                        logger.info("☀️ Camera adjusting to room light...")
                        for _ in range(50):
                            if cap:
                                cap.read()
                            time.sleep(0.05)
                        logger.info("✅ Camera ready and tracking!")
                else:
                    # Camera turned OFF - release hardware completely
                    if cap:
                        cap.release()
                        cap = None
                        logger.info("📴 Camera Released - Privacy mode activated")
                
                last_camera_state = CAMERA_ACTIVE
            
            # Skip camera operations if not active
            if not CAMERA_ACTIVE or cap is None:
                time.sleep(1)  # Check state every second
                continue
            
            # ─── Camera reads happen every frame — never blocked ──────────────
            ret, frame = cap.read()
            if not ret:
                continue

            current_time = time.time()

            if current_time - last_check_time >= CHECK_INTERVAL:
                last_check_time = current_time

                # Natural denoising
                try:
                    clean_frame   = cv2.fastNlMeansDenoisingColored(frame, None, 5, 5, 7, 21)
                    process_frame = clean_frame
                except Exception:
                    process_frame = frame
                
                # 🔥 YEH LINE SABSE IMPORTANT HAI 🔥
                time.sleep(1) # Har 1 second mein check karega. Server ko saans lene de!

                _, buffer = cv2.imencode('.jpg', process_frame)
                img_b64 = base64.b64encode(buffer).decode('utf-8')

                # Screenshot only when active window changed
                current_window = get_screen_context()
                screen_b64     = ""
                if current_window != LAST_WINDOW_TITLE:
                    logger.info(f"📸 Snapping screen: {current_window}")
                    screen_b64         = capture_screen_base64()
                    LAST_WINDOW_TITLE  = current_window

                # FIX 2: fire API work in a daemon thread — camera loop keeps running
                threading.Thread(
                    target=_send_to_brain,
                    args=(img_b64, screen_b64, current_window),
                    daemon=True,
                ).start()

    except KeyboardInterrupt:
        logger.info("🔒 Shutting down supervisor...")
    finally:
        cap.release()
        logger.info("🔒 Camera released safely.")


if __name__ == "__main__":
    run_loop()
