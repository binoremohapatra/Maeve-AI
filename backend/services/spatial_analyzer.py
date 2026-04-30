import cv2
import numpy as np
import math
import logging

logger = logging.getLogger("SpatialAnalyzer")

try:
    import mediapipe as mp
    # Use solutions API (available in 0.10.5)
    mp_face_mesh = mp.solutions.face_mesh
    _face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    MEDIAPIPE_OK = True
    logger.info("✅ MediaPipe FaceMesh loaded (solutions API)")
except ImportError:
    MEDIAPIPE_OK = False
    logger.warning("⚠️ mediapipe not installed — pip install mediapipe")
except Exception as e:
    MEDIAPIPE_OK = False
    logger.warning(f"⚠️ MediaPipe initialization failed: {e} - using fallback")

# 3D reference points for head pose (canonical face model)
_MODEL_POINTS = np.array([
    (0.0, 0.0, 0.0),       # nose tip        lm 1
    (0.0, -330.0, -65.0),  # chin            lm 152
    (-225.0, 170.0, -135.0),# left eye corner lm 33
    (225.0, 170.0, -135.0), # right eye corner lm 263
    (-150.0, -150.0, -125.0),# left mouth     lm 78
    (150.0, -150.0, -125.0), # right mouth    lm 308
], dtype=np.float64)

_LM_IDX = [1, 152, 33, 263, 78, 308]  # indices matching model points

def analyze_spatial(frame):
    """
    Returns a dict with rich spatial info instead of just 'face area ratio'.
    {
      "face_detected": bool,
      "distance_cm": float | None,   # rough estimate
      "yaw_deg": float,              # left/right head turn
      "pitch_deg": float,            # up/down tilt
      "roll_deg": float,             # head tilt
      "eye_contact": bool,           # looking at camera
      "gaze_direction": str,         # "center"/"left"/"right"/"up"/"down"
      "num_faces": int,
      "proximity_label": str,
    }
    """
    result = {
        "face_detected": False, "distance_cm": None,
        "yaw_deg": 0.0, "pitch_deg": 0.0, "roll_deg": 0.0,
        "eye_contact": False, "gaze_direction": "unknown",
        "num_faces": 0, "proximity_label": "no face detected",
    }

    if not MEDIAPIPE_OK:
        return _haar_fallback(frame, result)

    h, w = frame.shape[:2]
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    out = _face_mesh.process(rgb)

    if not out.multi_face_landmarks:
        return result

    lms = out.multi_face_landmarks[0].landmark
    result["face_detected"] = True
    result["num_faces"] = len(out.multi_face_landmarks)

    # ── Distance estimate via inter-pupil distance ──
    # Average inter-pupil distance = 63 mm; focal length ~ 0.78 * frame_width
    LEFT_PUPIL, RIGHT_PUPIL = 468, 473  # refined landmarks
    try:
        lx, ly = lms[LEFT_PUPIL].x * w, lms[LEFT_PUPIL].y * h
        rx, ry = lms[RIGHT_PUPIL].x * w, lms[RIGHT_PUPIL].y * h
        ipd_px = math.hypot(rx - lx, ry - ly)
        focal  = 0.78 * w
        dist_cm = (63.0 * focal) / (ipd_px * 10) if ipd_px > 0 else None
        result["distance_cm"] = round(dist_cm, 1) if dist_cm else None

        if dist_cm:
            if dist_cm < 40:
                result["proximity_label"] = "very close — leaning in"
            elif dist_cm < 70:
                result["proximity_label"] = "normal working distance"
            elif dist_cm < 110:
                result["proximity_label"] = "leaning back"
            else:
                result["proximity_label"] = "far from screen"
    except IndexError:
        pass  # refined landmarks not always available

    # ── Head pose via solvePnP ──
    img_pts = np.array([
        [lms[i].x * w, lms[i].y * h] for i in _LM_IDX
    ], dtype=np.float64)

    focal_len = w
    cam_matrix = np.array([
        [focal_len, 0, w / 2],
        [0, focal_len, h / 2],
        [0, 0, 1],
    ], dtype=np.float64)
    dist_coeffs = np.zeros((4, 1))

    ok, rot_vec, _ = cv2.solvePnP(
        _MODEL_POINTS, img_pts, cam_matrix, dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE
    )
    if ok:
        rot_mat, _ = cv2.Rodrigues(rot_vec)
        angles, *_ = cv2.RQDecomp3x3(rot_mat)
        pitch, yaw, roll = angles
        result["pitch_deg"] = round(pitch, 1)
        result["yaw_deg"]   = round(yaw, 1)
        result["roll_deg"]  = round(roll, 1)

        # Eye contact = looking roughly straight at the camera
        result["eye_contact"] = abs(yaw) < 15 and abs(pitch) < 15

        if abs(yaw) < 15 and abs(pitch) < 15:
            result["gaze_direction"] = "center"
        elif yaw > 15:
            result["gaze_direction"] = "right"
        elif yaw < -15:
            result["gaze_direction"] = "left"
        elif pitch > 15:
            result["gaze_direction"] = "up"
        else:
            result["gaze_direction"] = "down"

    return result


def _haar_fallback(frame, result):
    """Graceful fallback if mediapipe is missing."""
    import os
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    cascade_path = os.path.join(cv2.data.haarcascades,
                                "haarcascade_frontalface_default.xml")
    cc = cv2.CascadeClassifier(cascade_path)
    faces = cc.detectMultiScale(gray, 1.2, 5, minSize=(50, 50))
    if len(faces) > 0:
        h, w = frame.shape[:2]
        x, y, fw, fh = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)[0]
        ratio = (fw * fh) / (w * h)
        result["face_detected"] = True
        result["num_faces"] = len(faces)
        result["proximity_label"] = (
            "very close" if ratio > 0.15 else
            "far back" if ratio < 0.05 else
            "normal distance"
        )
    return result
