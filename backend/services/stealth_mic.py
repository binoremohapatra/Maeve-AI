"""
MAEVE HYBRID MIC ENGINE v2.3
============================
Full brain integration — mic now reads the brain's JSON response,
plays TTS audio, and emits a voice_event so React can update
animation + replyText in real time.

Changes from v2.2
──────────────────
1. _post_to_brain() now reads the full JSON response instead of
   just checking status_code.

2. TTS PLAYBACK: audioBase64 from brain is decoded and played
   immediately via pygame (pip install pygame). Falls back to
   playsound if pygame is not installed.

3. REACT EVENT: after brain responds, a POST is fired to
   http://127.0.0.1:5004/voice_event  (new endpoint on this server)
   carrying replyText, emotion, animation, toolExecuted.
   The React frontend listens to this via SSE or polling.

4. voice_user PROFILE: the first POST to brain now includes
   a userId that maps to a real saved profile so Maeve remembers
   the user across voice sessions. Set VOICE_USER_ID below.

5. /voice_event  SSE endpoint added so React can subscribe with:
       const es = new EventSource('http://127.0.0.1:5004/events')
       es.onmessage = e => handleVoiceEvent(JSON.parse(e.data))
"""

from flask import Flask, jsonify, Response
from flask_cors import CORS
import speech_recognition as sr
import threading
import requests
import time
import logging
import base64
import io
import json
import queue

try:
    import winsound
    _HAS_WINSOUND = True
except ImportError:
    _HAS_WINSOUND = False

# Audio playback — try pygame first, fall back to playsound
try:
    import pygame
    pygame.mixer.init()
    _AUDIO_BACKEND = "pygame"
except Exception:
    try:
        import playsound as _playsound_mod
        _AUDIO_BACKEND = "playsound"
    except Exception:
        _AUDIO_BACKEND = "none"

logging.getLogger("werkzeug").setLevel(logging.ERROR)
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
log = logging.getLogger("maeve.mic")

app = Flask(__name__)
CORS(app)

# ── Config ────────────────────────────────────────────────────────────────────
BRAIN_URL      = "http://127.0.0.1:5000/process"
COOLDOWN_SECS  = 4       # seconds to ignore audio after a command (stops TTS echo)
VOICE_USER_ID  = "user_pro_01"   # must match a real profile in your profiles JSON

WAKE_WORDS = [
    "maeve", "mave", "mayv", "wave", "leave",
    "made", "mac", "hey babe", "name","ma","may",
]

# ── Threading primitives ──────────────────────────────────────────────────────
_manual_trigger   = threading.Event()
_result_ready     = threading.Event()
_pause_background = threading.Event()
_result_lock      = threading.Lock()

_result_text   = ""
_result_status = "idle"

# SSE event queue — React subscribes to /events, we push JSON here
_sse_queue: queue.Queue = queue.Queue(maxsize=50)


def _store_result(status: str, text: str):
    global _result_text, _result_status
    with _result_lock:
        _result_text   = text
        _result_status = status
    _result_ready.set()


def _beep():
    if _HAS_WINSOUND:
        try:
            winsound.Beep(800, 200)
        except Exception:
            pass


# ── Recogniser ────────────────────────────────────────────────────────────────
_r = sr.Recognizer()
_r.dynamic_energy_threshold = True
_r.energy_threshold         = 300
_r.pause_threshold          = 2.5        # 🔥 AI अब तेरे रुकने के बाद 2.5 सेकंड इंतज़ार करेगा!
_r.non_speaking_duration = 1.5          # थोड़ा और बफर


# ══════════════════════════════════════════════════════════════════════════════
# AUDIO PLAYBACK
# ══════════════════════════════════════════════════════════════════════════════

def _play_audio_b64(audio_b64: str):
    """
    Decode base64 audio from brain and play it.
    Runs on a daemon thread so it never blocks the mic loop.
    """
    if not audio_b64:
        return
    try:
        audio_bytes = base64.b64decode(audio_b64)

        if _AUDIO_BACKEND == "pygame":
            buf = io.BytesIO(audio_bytes)
            pygame.mixer.music.load(buf)
            pygame.mixer.music.play()
            # Wait for playback to finish (so cooldown starts after TTS ends)
            while pygame.mixer.music.get_busy():
                time.sleep(0.05)

        elif _AUDIO_BACKEND == "playsound":
            import tempfile, os
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                f.write(audio_bytes)
                tmp_path = f.name
            _playsound_mod.playsound(tmp_path)
            os.unlink(tmp_path)

        else:
            log.warning("No audio backend available — install pygame: pip install pygame")

    except Exception as e:
        log.error(f"Audio playback error: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# BRAIN COMMUNICATION
# ══════════════════════════════════════════════════════════════════════════════

def _post_to_brain(command: str, retries: int = 3):
    """
    POST to brain, read full JSON response, play TTS, emit SSE event to React.
    Runs on its own daemon thread — never blocks the mic stream.
    """
    payload = {
        "user_input": command,
        "userId":     VOICE_USER_ID,
        "source":     "voice",          # lets brain know this came from mic
    }

    for attempt in range(1, retries + 1):
        try:
            resp = requests.post(BRAIN_URL, json=payload, timeout=60)
            resp.raise_for_status()
            data = resp.json()

            log.info(f"🧠 Brain OK | emotion={data.get('emotion')} "
                     f"| tool={data.get('toolExecuted')} "
                     f"| reply={str(data.get('replyText',''))[:60]}")

            # 1. Play TTS audio if present
            audio_b64 = data.get("audioBase64")
            if audio_b64:
                log.info("🔊 Playing TTS response…")
                threading.Thread(
                    target=_play_audio_b64,
                    args=(audio_b64,),
                    daemon=True,
                    name="TTSPlayer"
                ).start()

            # 2. Push event to React via SSE
            event = {
                "type":         "voice_response",
                "replyText":    data.get("replyText", ""),
                "emotion":      data.get("emotion", "NEUTRAL"),
                "animation":    data.get("animation", "FEMINEIDLE"),
                "mascotAction": data.get("mascotAction", "FEMINEIDLE"),
                "toolExecuted": data.get("toolExecuted", "NONE"),
                "persona":      data.get("persona_active", "amadere"),
                "source":       "voice",
            }
            try:
                _sse_queue.put_nowait(event)
            except queue.Full:
                pass  # drop oldest if queue full — non-critical

            return  # success

        except requests.exceptions.Timeout:
            log.warning(f"⏱  Brain timed out (attempt {attempt}/{retries})")
        except requests.exceptions.ConnectionError:
            log.warning(f"🔌 Brain unreachable (attempt {attempt}/{retries}) — is port 5000 running?")
        except Exception as exc:
            log.error(f"❌ Brain POST error (attempt {attempt}/{retries}): {exc}")

        if attempt < retries:
            time.sleep(2)

    log.error("❌ Brain POST failed after all retries — command dropped")


# ══════════════════════════════════════════════════════════════════════════════
# MIC WORKER
# ══════════════════════════════════════════════════════════════════════════════

def _drain_buffer(source):
    """Discard audio that piled up during cooldown / TTS playback."""
    try:
        _r.listen(source, timeout=0.1, phrase_time_limit=0.1)
    except Exception:
        pass


def _mic_worker():
    log.info("🎧 Mic worker starting — opening audio stream…")
    mic = sr.Microphone()

    with mic as source:
        log.info("🔊 Adjusting for ambient noise (1.5 s)…")
        _r.adjust_for_ambient_noise(source, duration=1.5)
        log.info(f"✅ Mic open. Energy threshold: {_r.energy_threshold:.0f}")
        log.info("👂 Listening for wake word 'Maeve'...")

        while True:

            # ── PRIORITY 1: MANUAL MODE (UI button) ──────────────────────
            if _manual_trigger.is_set():
                _pause_background.set()
                log.info("🔴 Manual mode — listening up to 30 s…")
                try:
                    audio = _r.listen(source, timeout=10, phrase_time_limit=30)
                    text  = _r.recognize_google(audio)
                    log.info(f"✅ Manual result: '{text}'")
                    _store_result("success", text)

                    # Also send manual input to brain (non-blocking)
                    threading.Thread(
                        target=_post_to_brain,
                        args=(text,),
                        daemon=True,
                    ).start()

                except sr.WaitTimeoutError:
                    log.warning("⏱  Manual timed out")
                    _store_result("timeout", "")
                except sr.UnknownValueError:
                    log.warning("🤷 Manual speech not recognised")
                    _store_result("unrecognized", "")
                except Exception as exc:
                    log.error(f"❌ Manual capture error: {exc}")
                    _store_result("error", str(exc))
                finally:
                    _manual_trigger.clear()
                    _pause_background.clear()
                    log.info("👂 Resuming wake word listening…")
                continue

            # ── PRIORITY 2: BACKGROUND WAKE WORD ─────────────────────────
            try:
                # timeout=None blocks until energy threshold detects speech
                # phrase_time_limit=6 fits "maeve play snooze on spotify"
                audio = _r.listen(source, timeout=None, phrase_time_limit=6)

                if _manual_trigger.is_set():
                    continue

                text = _r.recognize_google(audio).lower().strip()
                log.info(f"👂 Background heard: '{text}'")

                if any(w in text for w in WAKE_WORDS):
                    log.info("🔔 WAKE WORD DETECTED!")
                    _beep()

                    if _manual_trigger.is_set():
                        continue

                    log.info("🗣  Listening for your command…")
                    try:
                        cmd_audio = _r.listen(source, timeout=5, phrase_time_limit=15)
                        command   = _r.recognize_google(cmd_audio)
                        log.info(f"🎯 Command: '{command}'")

                        threading.Thread(
                            target=_post_to_brain,
                            args=(command,),
                            daemon=True,
                        ).start()

                        # Cooldown — wait while brain processes + TTS plays
                        # so mic doesn't pick up speaker audio as new input
                        log.info(f"😴 Cooldown {COOLDOWN_SECS} s — muting mic while brain speaks…")
                        time.sleep(COOLDOWN_SECS)
                        _drain_buffer(source)
                        log.info("👂 Wake word active again")

                    except sr.WaitTimeoutError:
                        log.warning("⏱  No command heard after wake word")
                    except sr.UnknownValueError:
                        log.warning("🤷 Command not recognised after wake word")
                    except Exception as exc:
                        log.error(f"❌ Command capture error: {exc}")

            except sr.WaitTimeoutError:
                pass
            except sr.UnknownValueError:
                pass
            except Exception as exc:
                log.error(f"⚠️  Unexpected error: {exc}")
                time.sleep(0.3)


# ══════════════════════════════════════════════════════════════════════════════
# FLASK ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/listen", methods=["GET"])
def listen_once():
    """React UI button — triggers manual capture, returns transcription."""
    _result_ready.clear()
    _manual_trigger.clear()

    log.info("🖱  Browser button clicked — requesting manual capture…")
    _manual_trigger.set()

    got_result = _result_ready.wait(timeout=38)

    if not got_result:
        _manual_trigger.clear()
        return jsonify({"status": "error", "text": "Mic engine timed out"})

    with _result_lock:
        status = _result_status
        text   = _result_text

    return jsonify({"status": status, "text": text})


@app.route("/events", methods=["GET"])
def sse_events():
    """
    Server-Sent Events endpoint for React.
    React subscribes once:
        const es = new EventSource('http://127.0.0.1:5004/events')
        es.onmessage = e => handleVoiceEvent(JSON.parse(e.data))

    Every time Maeve responds to a voice command, an event is pushed here
    containing replyText, emotion, animation, toolExecuted.
    """
    def generate():
        yield "retry: 3000\n\n"   # tell browser to reconnect after 3 s on drop
        while True:
            try:
                event = _sse_queue.get(timeout=25)
                yield f"data: {json.dumps(event)}\n\n"
            except queue.Empty:
                yield ": keepalive\n\n"   # prevent proxy timeouts

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        }
    )


@app.route("/status", methods=["GET"])
def get_status():
    return jsonify({
        "status":            "hybrid_online",
        "port":              5004,
        "audio_backend":     _AUDIO_BACKEND,
        "manual_pending":    _manual_trigger.is_set(),
        "background_paused": _pause_background.is_set(),
        "energy_threshold":  round(_r.energy_threshold, 1),
        "cooldown_secs":     COOLDOWN_SECS,
        "voice_user_id":     VOICE_USER_ID,
    })


# ══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    threading.Thread(target=_mic_worker, daemon=True, name="MicWorker").start()

    print("=" * 54)
    print("🎭 HYBRID MIC API  —  PORT 5004")
    print(f"🔊 Audio backend  : {_AUDIO_BACKEND}")
    print(f"👤 Voice user ID  : {VOICE_USER_ID}")
    print("🗣  Say 'Maeve'  OR  click the button in the UI")
    print("📡 React SSE      : GET http://127.0.0.1:5004/events")
    print("=" * 54)

    app.run(host="127.0.0.1", port=5004, use_reloader=False)