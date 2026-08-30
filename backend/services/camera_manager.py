# Fixed Camera Manager
import cv2
import threading
import logging
import time
import numpy as np

# Handle MockCV2 issues
try:
    CAP_DSHOW = cv2.CAP_DSHOW
    CAP_MSMF = cv2.CAP_MSMF
except AttributeError:
    CAP_DSHOW = 700
    CAP_MSMF = 1400

logger = logging.getLogger("CameraManager")

class CameraManager:
    def __init__(self):
        self._cap = None
        self._lock = threading.Lock()
        self._active = False
        self._backend = None
        self._camera_index = 0
        
    def find_working_camera(self):
        """Find first working camera with optimal backend"""
        for camera_idx in range(5):
            for backend_name, backend in [("DSHOW", CAP_DSHOW), ("MSMF", CAP_MSMF), ("ANY", cv2.CAP_ANY)]:
                try:
                    test_cap = cv2.VideoCapture(camera_idx, backend)
                    if test_cap.isOpened():
                        ret, frame = test_cap.read()
                        if ret and np.mean(frame) > 10:  # Not black
                            test_cap.release()
                            logger.info(f"Found working camera: {camera_idx} with {backend_name}")
                            return camera_idx, backend
                    test_cap.release()
                except:
                    continue
        return None, None
    
    def activate(self, source=0, backend=None):
        import os
        if os.getenv("VISION_MODE") == "cloud":
            logger.info("Running in cloud mode. Local hardware camera capture disabled.")
            return False

        with self._lock:
            if self._cap and self._cap.isOpened():
                return True
            
            # Find working camera if not specified
            if backend is None:
                self._camera_index, self._backend = self.find_working_camera()
                if self._camera_index is None:
                    logger.error("No working camera found")
                    return False
            else:
                self._camera_index = source
                self._backend = backend
            
            # Open camera
            cap = cv2.VideoCapture(self._camera_index, self._backend or cv2.CAP_ANY)
            if not cap.isOpened():
                logger.error(f"Failed to open camera {self._camera_index}")
                return False
            
            # Apply optimal settings
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(cv2.CAP_PROP_FPS, 30)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 0.25)
            cap.set(cv2.CAP_PROP_EXPOSURE, -6)
            cap.set(cv2.CAP_PROP_BRIGHTNESS, 128)
            
            # Warm up
            for _ in range(30):
                ret, _ = cap.read()
                if not ret:
                    break
                time.sleep(0.03)
            
            # Test final capture
            ret, frame = cap.read()
            if not ret or np.mean(frame) < 10:
                cap.release()
                logger.error("Camera captures black frames")
                return False
            
            self._cap = cap
            self._active = True
            logger.info(f"Camera activated: index={self._camera_index}, backend={self._backend}")
            return True
    
    def deactivate(self):
        with self._lock:
            if self._cap:
                self._cap.release()
                self._cap = None
            self._active = False
            logger.info("Camera deactivated")
    
    def read_frame(self):
        with self._lock:
            if not self._cap or not self._cap.isOpened():
                return False, None
            
            ret, frame = self._cap.read()
            if not ret or frame is None:
                # Try to recover
                logger.warning("Bad frame, attempting recovery...")
                self.deactivate()
                time.sleep(0.1)
                if self.activate(self._camera_index, self._backend):
                    ret, frame = self._cap.read()
                else:
                    return False, None
            
            # Check if frame is black
            if np.mean(frame) < 10:
                logger.warning("Black frame detected, reactivating...")
                self.deactivate()
                time.sleep(0.1)
                if self.activate(self._camera_index, self._backend):
                    ret, frame = self._cap.read()
                else:
                    return False, None
            
            return True, frame
    
    @property
    def is_active(self):
        return self._active

# Create singleton
camera = CameraManager()