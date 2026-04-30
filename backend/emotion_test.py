"""
emotion_test.py — Perfect per-face emotion analysis test
=========================================================
Run:  python emotion_test.py
      python emotion_test.py --source 0          (webcam index)
      python emotion_test.py --source image.jpg  (static image)
      python emotion_test.py --source http://192.168.1.42:8080/video  (IP cam)

Output:
  • Live OpenCV window with bounding boxes, emotion bars, and pose lines drawn on each face
  • Console JSON output with full spatial + emotion data per face
  • Press 'q' to quit, 's' to save a snapshot, 'r' to reset baseline
"""

import cv2
import numpy as np
import math
import json
import time
import argparse
import sys
import base64
import os
from datetime import datetime

# ── SAFETY GUARD: reject MockCV2 ─────────────────────────────────────────────
def _ensure_real_cv2():
    if not hasattr(cv2, 'imdecode') or not hasattr(cv2, 'VideoCapture'):
        raise RuntimeError(
            "MockCV2 detected! Real OpenCV is not loaded.\n"
            "Check for a fake cv2.py in your project folder.\n"
            f"Current cv2 file: {getattr(cv2, '__file__', 'unknown')}"
        )
    print(f"[OK] Real cv2 loaded from: {cv2.__file__}")

_ensure_real_cv2()

# ── MEDIAPIPE (optional but greatly improves spatial accuracy) ────────────────
MEDIAPIPE_OK = False
_face_mesh = None

try:
    import mediapipe as mp
    # MediaPipe 0.10+ uses the Tasks API — no mp.solutions
    from mediapipe.tasks import python as _mp_python
    from mediapipe.tasks.python import vision as _mp_vision

    _MODEL_PATH = os.path.join(os.path.dirname(__file__), "face_landmarker.task")
    if os.path.exists(_MODEL_PATH):
        _opts = _mp_vision.FaceLandmarkerOptions(
            base_options=_mp_python.BaseOptions(model_asset_path=_MODEL_PATH),
            running_mode=_mp_vision.RunningMode.IMAGE,
            output_face_blendshapes=True,
            num_faces=4,
            min_face_detection_confidence=0.5,
        )
        _face_mesh = _mp_vision.FaceLandmarker.create_from_options(_opts)
        MEDIAPIPE_OK = True
        print("[OK] MediaPipe FaceLandmarker loaded (blendshapes enabled)")
    else:
        print(f"[INFO] MediaPipe model not found at {_MODEL_PATH}")
        print("       Download: https://storage.googleapis.com/mediapipe-models/"
              "face_landmarker/face_landmarker/float16/latest/face_landmarker.task")
        print("       Falling back to cascade + geometry emotion detection")
except ImportError:
    print("[INFO] mediapipe not installed — using cascade + geometry detection")
except Exception as e:
    print(f"[INFO] MediaPipe init failed: {e} — using cascade fallback")

# ── CASCADES ──────────────────────────────────────────────────────────────────
_cascade_base = cv2.data.haarcascades
_face_cascade  = cv2.CascadeClassifier(_cascade_base + "haarcascade_frontalface_default.xml")
_face_alt      = cv2.CascadeClassifier(_cascade_base + "haarcascade_frontalface_alt2.xml")
_eye_cascade   = cv2.CascadeClassifier(_cascade_base + "haarcascade_eye.xml")
_smile_cascade = cv2.CascadeClassifier(_cascade_base + "haarcascade_smile.xml")

# ── 3D HEAD POSE REFERENCE POINTS ────────────────────────────────────────────
# Canonical face model for solvePnP (in mm, nose = origin)
_MODEL_3D = np.array([
    (   0.0,    0.0,   0.0),   # nose tip        → landmark  4
    (   0.0, -330.0, -65.0),   # chin            → landmark 152
    (-225.0,  170.0,-135.0),   # left eye outer  → landmark  33
    ( 225.0,  170.0,-135.0),   # right eye outer → landmark 263
    (-150.0, -150.0,-125.0),   # left mouth      → landmark  78
    ( 150.0, -150.0,-125.0),   # right mouth     → landmark 308
], dtype=np.float64)
_LM_IDX = [4, 152, 33, 263, 78, 308]

# ── BLENDSHAPE → EMOTION MAPPING (MediaPipe face_landmarker) ─────────────────
# blendshape names that matter for each emotion
_EMOTION_BLENDSHAPES = {
    "happy":     ["mouthSmileLeft", "mouthSmileRight", "cheekSquintLeft", "cheekSquintRight"],
    "sad":       ["mouthFrownLeft", "mouthFrownRight", "browInnerUp", "browDownLeft", "browDownRight"],
    "angry":     ["browDownLeft", "browDownRight", "noseSneerLeft", "noseSneerRight", "jawForward"],
    "surprised": ["eyeWideLeft", "eyeWideRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight", "jawOpen"],
    "disgusted": ["noseSneerLeft", "noseSneerRight", "mouthLeft", "mouthRight"],
    "fearful":   ["eyeWideLeft", "eyeWideRight", "browInnerUp", "jawOpen"],
    "neutral":   [],   # fallback
}

# ── COLOUR PALETTE ────────────────────────────────────────────────────────────
EMOTION_COLORS = {
    "happy":     (50,  220, 50),
    "sad":       (220, 100, 50),
    "angry":     (40,  40,  220),
    "surprised": (50,  220, 220),
    "disgusted": (150, 50,  200),
    "fearful":   (200, 180, 50),
    "neutral":   (180, 180, 180),
    "focused":   (50,  200, 220),
}


# ─────────────────────────────────────────────────────────────────────────────
# CORE ANALYSIS FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def _head_pose(landmarks_2d, frame_w, frame_h):
    """
    Returns (yaw_deg, pitch_deg, roll_deg) using solvePnP.
    landmarks_2d: list of (x,y) pixel coords in same order as _LM_IDX.
    """
    img_pts = np.array(landmarks_2d, dtype=np.float64)
    focal   = frame_w
    cam_mat = np.array([
        [focal, 0,     frame_w / 2],
        [0,     focal, frame_h / 2],
        [0,     0,     1],
    ], dtype=np.float64)
    ok, rvec, _ = cv2.solvePnP(
        _MODEL_3D, img_pts, cam_mat,
        np.zeros((4, 1)), flags=cv2.SOLVEPNP_ITERATIVE
    )
    if not ok:
        return 0.0, 0.0, 0.0
    rmat, _  = cv2.Rodrigues(rvec)
    angles, *_ = cv2.RQDecomp3x3(rmat)
    pitch, yaw, roll = angles
    return round(yaw, 1), round(pitch, 1), round(roll, 1)


def _gaze_label(yaw, pitch):
    if abs(yaw) < 12 and abs(pitch) < 12:
        return "center (eye contact)"
    parts = []
    if pitch < -12: parts.append("up")
    if pitch >  12: parts.append("down")
    if yaw   < -12: parts.append("left")
    if yaw   >  12: parts.append("right")
    return " + ".join(parts)


def _distance_cm(landmarks_2d, frame_w):
    """
    Estimate distance from camera using inter-eye distance.
    landmarks_2d must contain LEFT_EYE (idx 2) and RIGHT_EYE (idx 3).
    """
    lx, ly = landmarks_2d[2]
    rx, ry = landmarks_2d[3]
    ipd_px = math.hypot(rx - lx, ry - ly)
    if ipd_px < 1:
        return None
    focal  = 0.78 * frame_w
    dist_cm = (63.0 * focal) / (ipd_px * 10)
    return round(dist_cm, 1)


def _proximity_label(dist_cm):
    if dist_cm is None: return "unknown"
    if dist_cm < 35:    return "very close (< 35 cm)"
    if dist_cm < 65:    return "normal (35-65 cm)"
    if dist_cm < 100:   return "leaning back (65-100 cm)"
    return "far (> 100 cm)"


def _cascade_geometry_emotion(face_roi_gray, face_roi_bgr):
    """
    FIXED Geometry-based emotion from cascades + pixel statistics.
    Much more accurate emotion detection.
    Works without any ML model.
    Returns dict with emotion scores (0-1) and dominant emotion label.
    """
    h, w = face_roi_gray.shape

    # -- smile detection (FIXED: more sensitive parameters) --
    smiles = _smile_cascade.detectMultiScale(
        face_roi_gray[h//2:],          # only check lower half
        scaleFactor=1.7, minNeighbors=15, minSize=(20, 8)  # More sensitive!
    )
    smile_score = min(1.0, len(smiles) * 0.7)  # Increased weight

    # -- eye openness (FIXED: more sensitive) --
    eyes = _eye_cascade.detectMultiScale(
        face_roi_gray[:h//2],
        scaleFactor=1.1, minNeighbors=3, minSize=(15, 15)  # More sensitive!
    )
    eye_count = len(eyes)

    # -- brow region brightness (raised brows = surprise/fear) --
    brow_region = face_roi_gray[int(h*0.1):int(h*0.3), int(w*0.2):int(w*0.8)]
    brow_brightness = np.mean(brow_region) / 255.0

    # -- mouth region darkness (open mouth = surprise) --
    mouth_region = face_roi_gray[int(h*0.6):int(h*0.85), int(w*0.25):int(w*0.75)]
    mouth_darkness = 1.0 - (np.mean(mouth_region) / 255.0)

    # -- overall face brightness (lighting affects apparent emotion) --
    face_brightness = np.mean(face_roi_gray) / 255.0

    # -- skin hue variance (high variance = more expression) --
    face_hsv = cv2.cvtColor(face_roi_bgr, cv2.COLOR_BGR2HSV)
    hue_std = np.std(face_hsv[:, :, 0]) / 90.0  # normalise to ~1

    # -- FIXED: Much better emotion scoring logic --
    scores = {}
    
    # HAPPY - Clear smile detection with high weight
    if smile_score > 0.3:
        scores["happy"] = smile_score * 0.8 + (eye_count >= 2) * 0.2
    else:
        scores["happy"] = 0.1
    
    # SURPRISED - Wide eyes + open mouth + raised brows
    surprised_score = 0
    if eye_count >= 2:
        surprised_score += 0.3
    if mouth_darkness > 0.3:
        surprised_score += 0.4
    if brow_brightness > 0.6:
        surprised_score += 0.3
    scores["surprised"] = surprised_score
    
    # SAD - No smile + dark face + downturned features
    sad_score = 0
    if smile_score < 0.2:
        sad_score += 0.4
    if face_brightness < 0.35:  # Dark face
        sad_score += 0.4
    if eye_count < 2:
        sad_score += 0.2
    scores["sad"] = sad_score
    
    # ANGRY - No smile + bright face + tension
    angry_score = 0
    if smile_score < 0.2:
        angry_score += 0.3
    if face_brightness > 0.45:  # Bright/tense face
        angry_score += 0.4
    if brow_brightness < 0.4:  # Furrowed brows
        angry_score += 0.3
    scores["angry"] = angry_score
    
    # FEARFUL - Wide eyes + open mouth (similar to surprised but different balance)
    fearful_score = 0
    if eye_count >= 2:
        fearful_score += 0.4
    if mouth_darkness > 0.2:
        fearful_score += 0.3
    if brow_brightness > 0.5:
        fearful_score += 0.3
    scores["fearful"] = fearful_score
    
    # DISGUSTED - No smile + some expression
    disgusted_score = 0
    if smile_score < 0.3:
        disgusted_score += 0.5
    if hue_std > 0.2:  # Expression variance
        disgusted_score += 0.3
    scores["disgusted"] = disgusted_score
    
    # NEUTRAL - Baseline when no strong emotion
    neutral_score = 0.2  # Always some baseline
    if 0.1 < smile_score < 0.3 and 0.35 < face_brightness < 0.5 and eye_count >= 2:
        neutral_score += 0.6  # Strong neutral indicators
    scores["neutral"] = neutral_score

    # Clamp and normalise
    scores = {k: max(0.0, min(1.0, v)) for k, v in scores.items()}
    total  = sum(scores.values()) or 1.0
    scores = {k: round(v / total, 3) for k, v in scores.items()}

    dominant = max(scores, key=scores.get)
    confidence = scores[dominant]

    return {
        "dominant_emotion":   dominant,
        "confidence":         confidence,
        "scores":             scores,
        "method":             "cascade_geometry",
        "eye_count":          eye_count,
        "smile_detected":     len(smiles) > 0,
        "mouth_open":         mouth_darkness > 0.5,
        "brow_raised":        brow_brightness > 0.6,
    }


def _blendshape_emotion(blendshapes):
    """
    Map MediaPipe blendshape scores to emotion labels.
    blendshapes: list of category objects with .category_name and .score
    """
    bs_map = {b.category_name: b.score for b in blendshapes}

    scores = {}
    for emotion, bs_names in _EMOTION_BLENDSHAPES.items():
        if not bs_names:
            scores[emotion] = 0.2   # neutral baseline
            continue
        relevant = [bs_map.get(name, 0.0) for name in bs_names]
        scores[emotion] = round(float(np.mean(relevant)), 3)

    total = sum(scores.values()) or 1.0
    scores = {k: round(v / total, 3) for k, v in scores.items()}

    # Pull key blendshapes for diagnostics
    key_bs = {
        "jawOpen":        round(bs_map.get("jawOpen", 0), 3),
        "mouthSmile":     round((bs_map.get("mouthSmileLeft", 0) + bs_map.get("mouthSmileRight", 0)) / 2, 3),
        "browDown":       round((bs_map.get("browDownLeft", 0) + bs_map.get("browDownRight", 0)) / 2, 3),
        "eyeWide":        round((bs_map.get("eyeWideLeft", 0) + bs_map.get("eyeWideRight", 0)) / 2, 3),
        "browInnerUp":    round(bs_map.get("browInnerUp", 0), 3),
        "noseSneer":      round((bs_map.get("noseSneerLeft", 0) + bs_map.get("noseSneerRight", 0)) / 2, 3),
        "mouthFrown":     round((bs_map.get("mouthFrownLeft", 0) + bs_map.get("mouthFrownRight", 0)) / 2, 3),
    }

    dominant   = max(scores, key=scores.get)
    confidence = scores[dominant]

    return {
        "dominant_emotion": dominant,
        "confidence":       confidence,
        "scores":           scores,
        "method":           "mediapipe_blendshapes",
        "key_blendshapes":  key_bs,
    }


def analyze_faces(frame):
    """
    Main analysis function. Returns list of per-face dicts.
    Uses MediaPipe blendshapes if model available, else cascade geometry.
    """
    h, w = frame.shape[:2]
    gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    results = []

    # ── PATH A: MediaPipe Tasks API ───────────────────────────────────────────
    if MEDIAPIPE_OK and _face_mesh:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        try:
            detection = _face_mesh.detect(mp_img)
        except Exception as e:
            print(f"[WARN] MediaPipe detect failed: {e}")
            detection = None

        if detection and detection.face_landmarks:
            for face_idx, lm_list in enumerate(detection.face_landmarks):
                # Pixel coordinates for our 6 pose landmarks
                pose_pts = [
                    (lm_list[i].x * w, lm_list[i].y * h)
                    for i in _LM_IDX
                ]
                yaw, pitch, roll = _head_pose(pose_pts, w, h)
                dist  = _distance_cm(pose_pts, w)
                gaze  = _gaze_label(yaw, pitch)

                # Bounding box from all landmarks
                xs = [lm.x * w for lm in lm_list]
                ys = [lm.y * h for lm in lm_list]
                x1, y1 = int(max(0, min(xs))), int(max(0, min(ys)))
                x2, y2 = int(min(w, max(xs))), int(min(h, max(ys)))

                # Emotion from blendshapes
                emotion_data = {"dominant_emotion": "neutral", "confidence": 0.5,
                                "scores": {}, "method": "mediapipe_no_blendshapes"}
                if detection.face_blendshapes and face_idx < len(detection.face_blendshapes):
                    emotion_data = _blendshape_emotion(detection.face_blendshapes[face_idx])

                results.append({
                    "face_id":        face_idx,
                    "bbox":           (x1, y1, x2, y2),
                    "emotion":        emotion_data,
                    "pose": {
                        "yaw_deg":    yaw,
                        "pitch_deg":  pitch,
                        "roll_deg":   roll,
                        "gaze":       gaze,
                    },
                    "distance_cm":    dist,
                    "proximity":      _proximity_label(dist),
                    "eye_contact":    abs(yaw) < 15 and abs(pitch) < 15,
                })
            return results

    # ── PATH B: Cascade + Geometry (no MediaPipe model) ──────────────────────
    # Use both cascades and take the union of detections
    faces1 = _face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
    )
    faces2 = _face_alt.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
    )
    faces = list(faces1) + list(faces2) if len(faces1) > 0 or len(faces2) > 0 else []

    # De-duplicate overlapping detections
    seen = []
    for (fx, fy, fw, fh) in faces:
        overlap = False
        for (sx, sy, sw, sh) in seen:
            ix = max(0, min(fx+fw, sx+sw) - max(fx, sx))
            iy = max(0, min(fy+fh, sy+sh) - max(fy, sy))
            if ix * iy > 0.4 * fw * fh:
                overlap = True
                break
        if not overlap:
            seen.append((fx, fy, fw, fh))

    for face_idx, (fx, fy, fw, fh) in enumerate(seen):
        roi_gray = gray[fy:fy+fh, fx:fx+fw]
        roi_bgr  = frame[fy:fy+fh, fx:fx+fw]

        # Pose: use eye positions as minimal landmark proxy
        eyes = _eye_cascade.detectMultiScale(
            roi_gray[:fh//2], scaleFactor=1.1, minNeighbors=5, minSize=(20, 20)
        )

        # Build pose landmarks from eye centres + face geometry
        if len(eyes) >= 2:
            eyes_sorted = sorted(eyes, key=lambda e: e[0])
            lx_c = fx + eyes_sorted[0][0] + eyes_sorted[0][2]//2
            ly_c = fy + eyes_sorted[0][1] + eyes_sorted[0][3]//2
            rx_c = fx + eyes_sorted[1][0] + eyes_sorted[1][2]//2
            ry_c = fy + eyes_sorted[1][1] + eyes_sorted[1][3]//2

            # Approximate 6 landmark positions from face box + eyes
            pose_pts = [
                (fx + fw//2,     fy + int(fh*0.52)),   # nose tip
                (fx + fw//2,     fy + int(fh*0.88)),   # chin
                (float(lx_c),    float(ly_c)),           # left eye
                (float(rx_c),    float(ry_c)),           # right eye
                (fx + int(fw*0.3), fy + int(fh*0.72)),  # left mouth
                (fx + int(fw*0.7), fy + int(fh*0.72)),  # right mouth
            ]
            yaw, pitch, roll = _head_pose(pose_pts, w, h)
            dist  = _distance_cm(pose_pts, w)
        else:
            # No eye detection — use face-area ratio for distance only
            face_area_ratio = (fw * fh) / (w * h)
            yaw, pitch, roll = 0.0, 0.0, 0.0
            if face_area_ratio > 0.15:
                dist = 30.0
            elif face_area_ratio < 0.04:
                dist = 120.0
            else:
                dist = round(70.0 * (0.10 / face_area_ratio) ** 0.5, 1)

        gaze = _gaze_label(yaw, pitch)
        emotion_data = _cascade_geometry_emotion(roi_gray, roi_bgr)

        results.append({
            "face_id":        face_idx,
            "bbox":           (fx, fy, fx + fw, fy + fh),
            "emotion":        emotion_data,
            "pose": {
                "yaw_deg":    yaw,
                "pitch_deg":  pitch,
                "roll_deg":   roll,
                "gaze":       gaze,
            },
            "distance_cm":    dist,
            "proximity":      _proximity_label(dist),
            "eye_contact":    abs(yaw) < 15 and abs(pitch) < 15,
        })

    return results


# ─────────────────────────────────────────────────────────────────────────────
# DRAWING FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def _emotion_bar(img, x, y, label, score, color, bar_w=120):
    """Draw a single labelled emotion score bar."""
    filled = int(bar_w * score)
    cv2.rectangle(img, (x, y), (x + bar_w, y + 12), (60, 60, 60), -1)
    cv2.rectangle(img, (x, y), (x + filled, y + 12), color, -1)
    cv2.putText(img, f"{label}: {score:.2f}",
                (x + bar_w + 6, y + 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, (220, 220, 220), 1, cv2.LINE_AA)


def draw_results(frame, faces):
    """Overlay all per-face analysis onto the frame."""
    overlay = frame.copy()

    for fd in faces:
        x1, y1, x2, y2 = fd["bbox"]
        em     = fd["emotion"]
        dom    = em["dominant_emotion"]
        conf   = em["confidence"]
        color  = EMOTION_COLORS.get(dom, (200, 200, 200))
        pose   = fd["pose"]
        dist   = fd["distance_cm"]

        # -- face box --
        cv2.rectangle(overlay, (x1, y1), (x2, y2), color, 2)

        # -- emotion label on top of box --
        label = f"#{fd['face_id']} {dom.upper()} {conf:.0%}"
        lw, lh = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)[0]
        cv2.rectangle(overlay, (x1, y1 - lh - 8), (x1 + lw + 8, y1), color, -1)
        cv2.putText(overlay, label, (x1 + 4, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (20, 20, 20), 2, cv2.LINE_AA)

        # -- pose line (yaw indicator drawn as arrow from face centre) --
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        arrow_len = (x2 - x1) // 3
        yaw_rad   = math.radians(pose["yaw_deg"])
        pitch_rad = math.radians(pose["pitch_deg"])
        ax = int(cx + arrow_len * math.sin(yaw_rad))
        ay = int(cy - arrow_len * math.sin(pitch_rad))
        cv2.arrowedLine(overlay, (cx, cy), (ax, ay), (50, 255, 255), 2, tipLength=0.3)

        # -- info block: distance + gaze --
        info_y = y2 + 18
        dist_str = f"{dist:.0f} cm" if dist else "?"
        eye_str  = "EYE CONTACT" if fd["eye_contact"] else pose["gaze"]
        cv2.putText(overlay, f"Dist: {dist_str}  |  {eye_str}",
                    (x1, info_y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200, 200, 80), 1, cv2.LINE_AA)
        cv2.putText(overlay, f"Yaw:{pose['yaw_deg']:+.0f}  Pitch:{pose['pitch_deg']:+.0f}  Roll:{pose['roll_deg']:+.0f}",
                    (x1, info_y + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (160, 160, 160), 1, cv2.LINE_AA)

        # -- emotion score bars (right side panel) --
        bar_x = x2 + 12
        bar_y = y1
        scores_sorted = sorted(em["scores"].items(), key=lambda kv: -kv[1])
        for (emo, sc) in scores_sorted:
            if bar_y > frame.shape[0] - 20:
                break
            bar_color = EMOTION_COLORS.get(emo, (180, 180, 180))
            _emotion_bar(overlay, bar_x, bar_y, emo, sc, bar_color)
            bar_y += 18

        # -- method badge --
        method_short = "MP-Blend" if "blendshape" in em.get("method", "") else "Cascade-Geo"
        cv2.putText(overlay, method_short,
                    (x1, y1 - lh - 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (150, 220, 255), 1, cv2.LINE_AA)

    # -- global HUD --
    ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    n  = len(faces)
    cv2.putText(overlay, f"Faces: {n}  |  {ts}",
                (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 100), 1, cv2.LINE_AA)
    mode = "MediaPipe" if MEDIAPIPE_OK else "Cascade+Geometry"
    cv2.putText(overlay, f"Mode: {mode}  |  [q]uit  [s]ave  [r]eset",
                (10, frame.shape[0] - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.40, (180, 180, 180), 1, cv2.LINE_AA)

    # Blend overlay with original for semi-transparent boxes
    cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)
    return frame


# ─────────────────────────────────────────────────────────────────────────────
# STATIC IMAGE MODE
# ─────────────────────────────────────────────────────────────────────────────

def run_on_image(path):
    """Analyze a static image and show results."""
    frame = cv2.imread(path)
    if frame is None:
        print(f"[ERROR] Cannot read image: {path}")
        sys.exit(1)

    print(f"\n[INFO] Analyzing image: {path}  ({frame.shape[1]}x{frame.shape[0]})")
    t0    = time.time()
    faces = analyze_faces(frame)
    elapsed = (time.time() - t0) * 1000

    print(f"[RESULT] {len(faces)} face(s) detected in {elapsed:.1f}ms\n")
    for fd in faces:
        print(json.dumps(fd, indent=2, default=str))
        print()

    out = draw_results(frame, faces)
    cv2.imshow("Emotion Test — Static Image (any key to close)", out)

    # Save result
    out_path = path.rsplit(".", 1)[0] + "_emotion.jpg"
    cv2.imwrite(out_path, out)
    print(f"[SAVED] {out_path}")

    cv2.waitKey(0)
    cv2.destroyAllWindows()


# ─────────────────────────────────────────────────────────────────────────────
# LIVE CAMERA MODE
# ─────────────────────────────────────────────────────────────────────────────

def run_on_camera(source):
    """Live camera loop with real-time per-face emotion analysis."""
    # Parse source
    try:
        src = int(source)
    except (ValueError, TypeError):
        src = source  # URL or path string

    print(f"\n[INFO] Opening camera source: {src}")

    # Try DSHOW on Windows for faster USB webcam init
    backends = []
    if isinstance(src, int):
        try:
            backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
        except AttributeError:
            backends = [0]  # MockCV2 fallback (shouldn't happen after guard)
    else:
        backends = [cv2.CAP_FFMPEG, cv2.CAP_ANY]

    cap = None
    for be in backends:
        c = cv2.VideoCapture(src, be)
        c.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
        c.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        c.set(cv2.CAP_PROP_BUFFERSIZE,   1)
        # Warm up
        for _ in range(5):
            c.read()
        if c.isOpened():
            ret, _ = c.read()
            if ret:
                cap = c
                print(f"[OK] Camera opened with backend {be}")
                break
            c.release()

    if cap is None:
        print("[ERROR] Could not open camera. Try a different source or check permissions.")
        sys.exit(1)

    print("[INFO] Running — press 'q' to quit, 's' to save snapshot, 'r' to reset cache\n")

    frame_count = 0
    fps_timer   = time.time()
    fps_display = 0.0
    snapshot_n  = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[WARN] Bad frame — retrying")
            time.sleep(0.05)
            continue

        frame_count += 1

        # Analyse every frame for real-time feel (cascade is fast enough)
        # Throttle MediaPipe to every 2nd frame to avoid lag
        should_analyse = True
        if MEDIAPIPE_OK and frame_count % 2 != 0:
            should_analyse = False

        if should_analyse:
            faces = analyze_faces(frame)
        else:
            faces = getattr(run_on_camera, "_last_faces", [])

        run_on_camera._last_faces = faces

        # FPS counter
        now = time.time()
        if now - fps_timer >= 1.0:
            fps_display = frame_count / (now - fps_timer + 1e-6)
            frame_count = 0
            fps_timer   = now

        # Draw
        out = draw_results(frame, faces)
        cv2.putText(out, f"FPS: {fps_display:.1f}",
                    (out.shape[1] - 90, 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.50, (100, 255, 100), 1, cv2.LINE_AA)

        cv2.imshow("Emotion Test — Live Camera", out)

        # Console print (throttled to every 2 seconds)
        if int(now) % 2 == 0 and getattr(run_on_camera, "_last_print", 0) != int(now):
            run_on_camera._last_print = int(now)
            if faces:
                summary = [
                    {
                        "face": f["face_id"],
                        "emotion": f["emotion"]["dominant_emotion"],
                        "confidence": f"{f['emotion']['confidence']:.0%}",
                        "distance_cm": f["distance_cm"],
                        "eye_contact": f["eye_contact"],
                        "gaze": f["pose"]["gaze"],
                    }
                    for f in faces
                ]
                print(json.dumps({"ts": datetime.now().isoformat(), "faces": summary}))

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('s'):
            snapshot_n += 1
            fname = f"snapshot_{snapshot_n:03d}.jpg"
            cv2.imwrite(fname, out)
            print(f"[SAVED] {fname}")
        elif key == ord('r'):
            # Reset caches
            run_on_camera._last_faces = []
            print("[RESET] Cache cleared")

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Camera released. Done.")


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Per-face emotion + spatial analysis test"
    )
    parser.add_argument(
        "--source", default="0",
        help="Camera index (0,1,2), image path, or RTSP/HTTP URL"
    )
    args = parser.parse_args()
    src = args.source

    # Static image?
    if src.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".webp")):
        run_on_image(src)
    else:
        run_on_camera(src)


if __name__ == "__main__":
    main()
