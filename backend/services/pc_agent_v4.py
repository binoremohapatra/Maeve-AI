

import sys, os, time, json, logging, threading, warnings, urllib.parse, shutil
import subprocess, glob, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from difflib import get_close_matches

import requests
import psutil
import pyperclip
import pygetwindow as gw
import pytesseract
import pyautogui
import winsound
import ctypes
from PIL import Image, ImageGrab
from flask import Flask, request, jsonify

warnings.filterwarnings("ignore")

# ── OpenCV bypass (keep — some imports may pull cv2 transitively) ─────────────
class _MockCV2:
    __version__ = "4.0.0"
sys.modules['cv2'] = _MockCV2()

try:
    import pyautogui
    pyautogui.FAILSAFE = False
    print(" pyautogui ready")
except Exception as e:
    print(f" pyautogui failed: {e}")
    sys.exit(1)

# ── win32gui for reliable window restore (handles minimized apps) ──────────────
try:
    import win32gui
    import win32con
    HAS_WIN32 = True
    print(" win32gui ready")
except ImportError:
    HAS_WIN32 = False
    print(" win32gui not found. Run: pip install pywin32")
    print("   Spotify restore from minimized state will be less reliable.")

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

logging.basicConfig(level=logging.INFO, format='%(asctime)s - MAEVE - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# ── File paths ────────────────────────────────────────────────────────────────
CONTACTS_FILE    = "contacts.json"
EMAIL_CREDS_FILE = "email_creds.json"

SCREEN_W, SCREEN_H = pyautogui.size()

# Common directories to search for files
_HOME = os.path.expanduser("~")
FILE_SEARCH_ROOTS = [
    _HOME,
    os.path.join(_HOME, "Desktop"),
    os.path.join(_HOME, "Documents"),
    os.path.join(_HOME, "Downloads"),
    os.path.join(_HOME, "Pictures"),
    "D:\\",
]


# ══════════════════════════════════════════════════════════════════════════════
# UTILITY HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _similarity(a: str, b: str) -> float:
    """Fuzzy string similarity — used by VisionEngine and contact lookup."""
    if not a or not b:
        return 0.0
    a, b = a.lower(), b.lower()
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.85
    matches = get_close_matches(a, [b], n=1, cutoff=0.0)
    if matches:
        shorter, longer = sorted([a, b], key=len)
        common = sum(c in longer for c in shorter)
        return common / max(len(a), len(b))
    return 0.0


def safe_click(x: int, y: int, double: bool = False):
    x = max(0, min(x, SCREEN_W - 1))
    y = max(0, min(y, SCREEN_H - 1))
    pyautogui.moveTo(x, y, duration=0.2)
    if double:
        pyautogui.doubleClick()
    else:
        pyautogui.click()
    time.sleep(0.2)


def paste_text(text: str, press_enter: bool = False):
    pyperclip.copy(text)
    time.sleep(0.15)
    pyautogui.hotkey('ctrl', 'v')
    time.sleep(0.15)
    if press_enter:
        time.sleep(0.1)
        pyautogui.press('enter')


def clear_and_type(text: str):
    time.sleep(0.2)
    pyautogui.hotkey('ctrl', 'a')
    time.sleep(0.15)
    pyautogui.press('backspace')
    time.sleep(0.15)
    paste_text(text)


def open_url(url: str):
    os.startfile(url)
    time.sleep(3.0)


def _maximize_active_browser():
    time.sleep(1.0)
    try:
        win = gw.getActiveWindow()
        if win and not win.isMaximized:
            win.maximize()
        time.sleep(0.5)
    except Exception:
        pass


# ══════════════════════════════════════════════════════════════════════════════
# VISION ENGINE
# ══════════════════════════════════════════════════════════════════════════════

class VisionEngine:
    """OCR-based screen element detector. Never assumes fixed coordinates."""

    @staticmethod
    def find_text_on_screen(search_text: str, region=None) -> dict | None:
        try:
            screenshot = ImageGrab.grab(bbox=region) if region else ImageGrab.grab()
            data = pytesseract.image_to_data(screenshot, output_type=pytesseract.Output.DICT)
            best_match, best_score = None, 0
            for i, word in enumerate(data['text']):
                if not word.strip():
                    continue
                score = _similarity(word, search_text)
                if score > best_score and score > 0.6:
                    best_score = score
                    x = data['left'][i] + data['width'][i] // 2
                    y = data['top'][i] + data['height'][i] // 2
                    if region:
                        x += region[0]; y += region[1]
                    best_match = {"text": word, "x": x, "y": y, "score": score,
                                  "width": data['width'][i], "height": data['height'][i]}
            return best_match
        except Exception as e:
            logger.error(f"Vision scan error: {e}")
            return None

    @staticmethod
    def find_best_list_match(target: str, region=None) -> dict | None:
        try:
            screenshot = ImageGrab.grab(bbox=region) if region else ImageGrab.grab()
            data = pytesseract.image_to_data(screenshot, output_type=pytesseract.Output.DICT)
            lines: dict = {}
            for i, word in enumerate(data['text']):
                if not word.strip() or data['conf'][i] < 30:
                    continue
                ln = data['line_num'][i]
                if ln not in lines:
                    lines[ln] = {'words': [], 'top': data['top'][i],
                                 'left': data['left'][i], 'height': data['height'][i]}
                lines[ln]['words'].append(word)
            best_match, best_score = None, 0
            for ln, ld in lines.items():
                line_text = ' '.join(ld['words'])
                score = _similarity(line_text, target)
                if score > best_score:
                    best_score = score
                    best_match = {"text": line_text,
                                  "x": ld['left'] + 200,
                                  "y": ld['top'] + ld['height'] // 2,
                                  "score": score}
                    if region:
                        best_match['x'] += region[0]; best_match['y'] += region[1]
            return best_match if best_score > 0.4 else None
        except Exception as e:
            logger.error(f"List scan error: {e}")
            return None

    @staticmethod
    def wait_for_element(search_text: str, timeout: float = 8.0, region=None) -> dict | None:
        start = time.time()
        while time.time() - start < timeout:
            result = VisionEngine.find_text_on_screen(search_text, region)
            if result:
                return result
            time.sleep(0.5)
        return None

    @staticmethod
    def click_element(search_text: str, timeout: float = 8.0, region=None) -> bool:
        element = VisionEngine.wait_for_element(search_text, timeout, region)
        if element:
            safe_click(element['x'], element['y'])
            return True
        logger.warning(f"Element not found: '{search_text}'")
        return False


vision = VisionEngine()


# ══════════════════════════════════════════════════════════════════════════════
# SCREEN RECORDER  (PIL-based, no OpenCV required)
# ══════════════════════════════════════════════════════════════════════════════

class ScreenRecorder:
    def __init__(self):
        self._recording = False
        self._frames: list[Image.Image] = []
        self._thread: threading.Thread | None = None
        self._fps = 5

    def start(self, fps: int = 5) -> dict:
        if self._recording:
            return {"status": "already_recording"}
        self._recording = True
        self._frames = []
        self._fps = fps
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        return {"status": "recording_started", "fps": fps}

    def _capture_loop(self):
        interval = 1.0 / self._fps
        while self._recording:
            try:
                self._frames.append(ImageGrab.grab().copy())
            except Exception as e:
                logger.warning(f"Frame capture error: {e}")
            time.sleep(interval)

    def stop(self, save_dir: str | None = None) -> dict:
        if not self._recording:
            return {"status": "not_recording"}
        self._recording = False
        if self._thread:
            self._thread.join(timeout=3.0)
        if not self._frames:
            return {"status": "error", "error": "No frames captured"}
        save_dir = save_dir or os.path.join(_HOME, "Desktop")
        os.makedirs(save_dir, exist_ok=True)
        ts = time.strftime("%Y%m%d-%H%M%S")
        gif_path = os.path.join(save_dir, f"recording_{ts}.gif")
        try:
            duration_ms = int(1000 / self._fps)
            self._frames[0].save(
                gif_path, save_all=True,
                append_images=self._frames[1:],
                loop=0, duration=duration_ms
            )
            return {"status": "saved", "file": gif_path,
                    "frames": len(self._frames), "fps": self._fps}
        except Exception as e:
            return {"status": "error", "error": str(e)}


_recorder = ScreenRecorder()


# ══════════════════════════════════════════════════════════════════════════════
# SYSTEM OPTIMIZER  (OS & Hardware management)
# ══════════════════════════════════════════════════════════════════════════════

class SystemOptimizer:
    SAFE_PROCS  = {"explorer.exe", "svchost.exe", "system", "idle", "csrss.exe",
                   "winlogon.exe", "python.exe", "code.exe",}
    JUNK_PROCS  = ["discord.exe", "spotify.exe", "steam.exe"]
    DISTRACT_PROCS = ["discord", "steam", "whatsapp"]
    BROWSER_PROCS = ["msedge.exe", "chrome.exe", "firefox.exe", "brave.exe", "opera.exe"]

    # ── vitals ──
    def get_vitals(self) -> dict:
        cpu  = psutil.cpu_percent(interval=0.5)
        ram  = psutil.virtual_memory()
        disk = psutil.disk_usage('C:\\')
        battery = psutil.sensors_battery()
        batt_info = {}
        if battery:
            batt_info = {
                "battery_percent": battery.percent,
                "battery_plugged": battery.power_plugged,
                "battery_mins_left": battery.secsleft // 60 if battery.secsleft and battery.secsleft > 0 else None
            }
        uptime_h = round((time.time() - psutil.boot_time()) / 3600, 1)
        status = "Stressed" if cpu > 85 or ram.percent > 90 else "Healthy"
        return {
            "status": status,
            "cpu_percent": cpu,
            "cpu_cores": psutil.cpu_count(logical=True),
            "ram_used_gb": round(ram.used / 1e9, 2),
            "ram_total_gb": round(ram.total / 1e9, 2),
            "ram_percent": ram.percent,
            "disk_free_gb": round(disk.free / 1e9, 2),
            "disk_percent": disk.percent,
            "uptime_hours": uptime_h,
            **batt_info
        }

    # ──# smart tab closing functions 
    def close_browser_tabs(self, max_tabs: int = 3) -> dict:
        """Hybrid tab closing: Visual logo detection + Title-based protection."""
        tabs_closed = 0
        browsers_closed = []
        
        try:
            import pygetwindow as gw
            import pyautogui
            try:
                from PIL import Image
                import cv2
                import numpy as np
                visual_detection_available = True
            except ImportError as e:
                logger.warning(f"Visual logo detection not available: {e}")
                visual_detection_available = False
            
            browser_keywords = ["chrome", "edge", "firefox", "brave", "opera"]
            
            # Visual logo patterns (comprehensive color/shape detection)
            LOGO_PATTERNS = {
                # AI App Logos
                "chatgpt": {
                    "colors": [[10, 132, 255], [0, 102, 204]],  # Green shades
                    "position": "top_left",
                    "size_range": (20, 40)
                },
                "gemini": {
                    "colors": [[66, 133, 244], [52, 168, 83]],  # Blue/Green Google colors
                    "position": "top_left", 
                    "size_range": (25, 45)
                },
                "claude": {
                    "colors": [[255, 109, 0], [230, 80, 0]],  # Orange shades
                    "position": "top_left",
                    "size_range": (20, 40)
                },
                "openai": {
                    "colors": [[10, 132, 255], [0, 102, 204]],  # Same as ChatGPT
                    "position": "top_left",
                    "size_range": (25, 45)
                },
                
                # Development Tools
                "windsurf": {
                    "colors": [[0, 119, 204], [0, 100, 180]],  # Blue shades (Windsurf logo)
                    "position": "top_left",
                    "size_range": (20, 35)
                },
                "vscode": {
                    "colors": [[0, 122, 204], [0, 100, 180]],  # VS Code blue
                    "position": "top_left",
                    "size_range": (25, 40)
                },
                "cursor": {
                    "colors": [[255, 255, 255], [240, 240, 240]],  # White/light (Cursor logo)
                    "position": "top_left",
                    "size_range": (20, 35)
                },
                "github": {
                    "colors": [[33, 31, 31], [51, 51, 51]],  # Dark gray/black
                    "position": "top_left",
                    "size_range": (25, 40)
                },
                
                # Communication Apps
                "discord": {
                    "colors": [[88, 101, 242], [114, 137, 218]],  # Discord blue/purple
                    "position": "top_left",
                    "size_range": (25, 40)
                },
                "slack": {
                    "colors": [[238, 63, 68], [220, 50, 55]],  # Slack purple/pink
                    "position": "top_left",
                    "size_range": (25, 40)
                },
                "telegram": {
                    "colors": [[0, 136, 204], [0, 120, 180]],  # Telegram blue
                    "position": "top_left",
                    "size_range": (25, 40)
                },
                
                # Music/Media
                "spotify": {
                    "colors": [[30, 215, 96], [25, 195, 85]],  # Spotify green
                    "position": "top_left",
                    "size_range": (25, 40)
                },
                
                # Productivity Tools
                "notion": {
                    "colors": [[0, 0, 0], [51, 51, 51]],  # Notion black
                    "position": "top_left",
                    "size_range": (25, 40)
                },
                "figma": {
                    "colors": [[255, 87, 51], [240, 70, 35]],  # Figma orange
                    "position": "top_left",
                    "size_range": (25, 40)
                },
                
                # Safe Entertainment/Educational
                "antigravity": {
                    "colors": [[100, 100, 255], [80, 80, 235]],  # Blue/purple (space theme)
                    "position": "top_left",
                    "size_range": (30, 50)
                },
                "cool math": {
                    "colors": [[255, 200, 0], [235, 180, 0]],  # Yellow/gold
                    "position": "top_left",
                    "size_range": (25, 40)
                }
            }
            
            # All lowercase — matches against current_title which is also .lower()
            # Enhanced with logo recognition patterns and common app identifiers
            safe_tab_keywords = [
                # AI/Chat Apps
                "chatgpt", "openai", "gpt-4", "gpt-3", "claude", "anthropic", 
                "google gemini", "gemini", "bard", "google ai", "maeve ai",
                "perplexity", "poe", "character.ai", "replika",
                
                # Development Tools
                "localhost", "127.0.0.1", "0.0.0.0", "3000", "5000", "8000", "8080",
                "vite", "react", "next.js", "node.js", "npm", "yarn",
                "github", "gitlab", "bitbucket", "stack overflow", "stackoverflow",
                "cursor", "windsurf", "vscode", "visual studio code",
                
                # Communication Apps
                "whatsapp", "telegram", "discord", "slack", "teams", "zoom",
                
                # Music/Media
                "spotify", "youtube music", "apple music", "soundcloud",
                
                # Browser/System Pages
                "new tab", "speed dial", "home page", "about:blank", "settings",
                "chrome://", "edge://", "firefox://", "extensions",
                
                # Work/Productivity
                "notion", "obsidian", "evernote", "todoist", "trello",
                "figma", "canva", "adobe", "photoshop", "illustrator",
                
                # Safe Entertainment
                "antigravity", "cool math games", "educational", "learning",
                
                # Common Safe Patterns
                "dashboard", "admin", "console", "developer tools", "inspect"
            ]
            
            def detect_visual_logo():
                """Advanced visual logo detection with multiple fallback methods."""
                if not visual_detection_available:
                    return None
                    
                try:
                    # Capture browser window area (top-left corner where logos usually are)
                    browser_win = gw.getActiveWindow()
                    if not browser_win:
                        return None
                    
                    # Get window position and capture top-left area
                    x, y = browser_win.left, browser_win.top
                    
                    # Try multiple logo regions (different browsers position logos differently)
                    logo_regions = [
                        (x + 10, y + 40, 150, 80),   # Standard logo area
                        (x + 5, y + 35, 160, 90),     # Slightly larger
                        (x + 15, y + 45, 140, 70),    # Centered
                        (x + 8, y + 60, 180, 60)      # Bottom of title bar
                    ]
                    
                    for logo_region in logo_regions:
                        try:
                            # Screenshot the logo area
                            screenshot = pyautogui.screenshot(region=logo_region)
                            img_array = np.array(screenshot)
                            img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                            
                            # Check for known logo patterns
                            for app_name, pattern in LOGO_PATTERNS.items():
                                if detect_logo_colors(img_bgr, pattern):
                                    logger.debug(f"Visual logo detected: {app_name} in region {logo_region}")
                                    return app_name
                                    
                        except Exception as region_error:
                            logger.debug(f"Logo region {logo_region} failed: {region_error}")
                            continue
                    
                    return None
                    
                except Exception as e:
                    logger.debug(f"Visual logo detection failed: {e}")
                    return None
            
            def detect_logo_colors(img, pattern):
                """Detect specific color patterns for logos."""
                try:
                    # Convert to HSV for better color detection
                    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
                    
                    # Check for pattern colors
                    for rgb_color in pattern["colors"]:
                        # Convert RGB to HSV
                        bgr_color = [[rgb_color[2], rgb_color[1], rgb_color[0]]]
                        hsv_color = cv2.cvtColor(np.array(bgr_color), cv2.COLOR_BGR2HSV)[0]
                        
                        # Create color mask
                        lower = np.array([max(0, hsv_color[0][0] - 10), 50, 50])
                        upper = np.array([min(179, hsv_color[0][0] + 10), 255, 255])
                        mask = cv2.inRange(hsv, lower, upper)
                        
                        # If significant color area found
                        if cv2.countNonZero(mask) > 100:
                            return True
                    
                    return False
                    
                except Exception:
                    return False
            
            target_window = None
            for w in gw.getAllWindows():
                title_lower = w.title.lower()
                if w.title and any(bk in title_lower for bk in browser_keywords):
                    target_window = w
                    break
            
            if not target_window:
                return {"status": "no_action", "message": "No active browser found."}

            try:
                if not target_window.isActive:
                    target_window.activate()
                    time.sleep(0.5)
            except Exception:
                pass

            browsers_closed.append(target_window.title)

            # THE HYBRID SNIPER CYCLE (Visual + Title detection)
            for _ in range(15):
                if tabs_closed >= max_tabs:
                    break 

                active_win = gw.getActiveWindow()
                if not active_win:
                    break
             
                if not any(bk in active_win.title.lower() for bk in browser_keywords):
                    time.sleep(0.6)
                    active_win = gw.getActiveWindow()  # re-read after wait
                    if not active_win or not any(bk in active_win.title.lower() for bk in browser_keywords):
                        break

                current_title = active_win.title.lower()
                is_safe = False
                
                # HYBRID APPROACH: 1st check visual, then title
                
                # Step 1: Visual Logo Detection (fast)
                detected_logo = detect_visual_logo()
                if detected_logo and detected_logo in safe_tab_keywords:
                    logger.info(f"Visual Logo Protected: '{active_win.title}' -> Detected {detected_logo}")
                    is_safe = True
                
                # Step 2: Title-based Detection (fallback)
                if not is_safe:
                    is_safe = any(safe_word.lower() in current_title for safe_word in safe_tab_keywords)
                    if is_safe:
                        logger.info(f"Title Protected: '{active_win.title}' -> Pattern matched")
                
                if is_safe:
                    logger.info(f"Shield Protected: '{active_win.title}' -> Skipping to next tab.")
                    # Tab is safe! Do NOT kill. Press Ctrl+Tab to move to the next one.
                    pyautogui.hotkey('ctrl', 'tab')
                    time.sleep(0.8)  # longer wait — browser needs time to render new tab title
                else:
                    logger.info(f"Sniper Killed: '{active_win.title}'")
                    # Tab is unsafe (e.g., YouTube, Netflix). Kill it!
                    pyautogui.hotkey('ctrl', 'w')
                    tabs_closed += 1
                    time.sleep(0.6) # Wait for browser to naturally drop to the next tab

            return {
                "status": "success",
                "tabs_closed": tabs_closed,
                "browsers_targeted": browsers_closed,
                "message": f"Hybrid sniper eliminated {tabs_closed} distracting tabs."
            }
            
        except Exception as e:
            logger.error(f"Tab close error: {e}")
            return {"status": "error", "error": str(e)}
    
    def close_high_ram_tabs(self) -> dict:
        """Close browser tabs when RAM is critically high (>95%)."""
        vitals = self.get_vitals()
        if vitals["ram_percent"] > 95:
            return self.close_browser_tabs(max_tabs=8)  # More aggressive for high RAM
        return {"status": "no_action", "message": "RAM usage normal"}

    # ── emergency RAM clear ──
    def emergency_ram_clear(self) -> dict:
        """Forcefully terminate tasks and clear system resources."""
        killed, freed_mb = [], 0.0
        
        try:
            import psutil
            import os
            import signal
            
            logger.info("🔥 EMERGENCY RAM CLEAR: Forcefully terminating tasks...")
            
            # Priority 1: Kill known junk processes first
            junk_processes = [
                "chrome.exe", "firefox.exe", "msedge.exe",  # Browsers
                "spotify.exe", "discord.exe", "telegram.exe",  # Entertainment
                "steam.exe", "epicgameslauncher.exe", "robloxplayer.exe",  # Gaming
                "node.exe", "npm.exe", "yarn.exe",  # Development tools
                "python.exe", "code.exe", "vscode.exe",  # IDEs (if not in use)
                "explorer.exe",  # Windows explorer (will restart)
            ]
            
            # Priority 2: High memory usage processes
            for proc in psutil.process_iter(['pid', 'name', 'memory_info', 'cpu_percent']):
                try:
                    proc_info = proc.info
                    name = proc_info['name'].lower()
                    memory_mb = proc_info['memory_info'].rss / 1_048_576
                    cpu_percent = proc_info.get('cpu_percent', 0)
                    
                    # Kill if it's a junk process OR high memory usage (>500MB)
                    should_kill = False
                    kill_reason = ""
                    
                    if any(junk in name for junk in [j.lower() for j in junk_processes]):
                        should_kill = True
                        kill_reason = "junk_process"
                    elif memory_mb > 500:  # High memory usage
                        should_kill = True
                        kill_reason = "high_memory"
                    elif cpu_percent > 80:  # High CPU usage
                        should_kill = True
                        kill_reason = "high_cpu"
                    
                    if should_kill and proc.pid != os.getpid():  # Don't kill ourselves
                        try:
                            # Try graceful termination first
                            proc.terminate()
                            proc.wait(timeout=3)
                            
                            freed_mb += memory_mb
                            killed.append(f"{proc_info['name']} (PID:{proc.pid}) - {kill_reason}")
                            logger.info(f"✅ Terminated: {proc_info['name']} - Freed {memory_mb:.1f}MB ({kill_reason})")
                            
                        except psutil.NoSuchProcess:
                            continue
                        except psutil.TimeoutExpired:
                            # Force kill if graceful termination fails
                            try:
                                proc.kill()
                                freed_mb += memory_mb
                                killed.append(f"{proc_info['name']} (PID:{proc.pid}) - force_killed")
                                logger.warning(f"💥 Force killed: {proc_info['name']} - Freed {memory_mb:.1f}MB")
                            except psutil.NoSuchProcess:
                                continue
                        except (psutil.AccessDenied, psutil.ZombieProcess):
                            logger.debug(f"⚠️ Cannot kill {proc_info['name']}: Access denied")
                            continue
                            
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
                    
            # Priority 3: Clear system caches and temp files
            try:
                import tempfile
                import shutil
                
                # Clear temp files
                temp_dir = tempfile.gettempdir()
                if os.path.exists(temp_dir):
                    temp_freed = 0
                    for item in os.listdir(temp_dir):
                        item_path = os.path.join(temp_dir, item)
                        try:
                            if os.path.isfile(item_path):
                                file_size = os.path.getsize(item_path) / 1_048_576
                                os.remove(item_path)
                                temp_freed += file_size
                            elif os.path.isdir(item_path):
                                shutil.rmtree(item_path, ignore_errors=True)
                        except (PermissionError, OSError):
                            continue
                    
                    if temp_freed > 0:
                        freed_mb += temp_freed
                        killed.append(f"Temp files - {temp_freed:.1f}MB")
                        logger.info(f"🗑️ Cleared temp files: {temp_freed:.1f}MB")
                        
            except Exception as e:
                logger.warning(f"⚠️ Failed to clear temp files: {e}")
            
            # Priority 4: Windows memory cleanup
            try:
                import ctypes
                from ctypes import wintypes
                
                # Force Windows memory cleanup
                ctypes.windll.psapi.EmptyWorkingSet(ctypes.windll.kernel32.GetCurrentProcess(), -1, -1)
                logger.info("🪄 Forced Windows memory cleanup")
                
            except Exception as e:
                logger.debug(f"Windows memory cleanup failed: {e}")
            
            # Priority 5: Garbage collection
            import gc
            gc.collect()
            logger.info("🧹 Python garbage collection completed")
            
            # Summary
            logger.info(f"🎯 EMERGENCY RAM CLEAR COMPLETE:")
            logger.info(f"   Processes killed: {len([k for k in killed if 'PID' in k])}")
            logger.info(f"   Memory freed: {freed_mb:.1f}MB")
            logger.info(f"   Files cleaned: {len([k for k in killed if 'Temp files' in k])}")
            
            return {
                "status": "success",
                "processes_killed": len([k for k in killed if 'PID' in k]),
                "memory_freed_mb": round(freed_mb, 2),
                "files_cleaned": len([k for k in killed if 'Temp files' in k]),
                "killed_processes": killed,
                "message": f"Emergency clear completed: freed {freed_mb:.1f}MB, killed {len([k for k in killed if 'PID' in k])} processes"
            }
            
        except Exception as e:
            logger.error(f"❌ Emergency RAM clear failed: {e}")
            return {"status": "error", "error": str(e)}

    # ── workflow modes ──
    def setup_workflow(self, mode: str) -> dict:
        mode = mode.lower()
        if mode == "deep_work":
            for proc in psutil.process_iter(['name']):
                try:
                    if proc.info['name'] and any(d in proc.info['name'].lower() for d in self.DISTRACT_PROCS):
                        proc.kill()
                except Exception:
                    pass
            os.system("start code")
            os.system("start https://chatgpt.com")
            return {"status": "success", "message": "Deep work mode activated. Distractions killed. VS Code + ChatGPT ready."}
        elif mode == "chill":
            os.system("start spotify:")
            os.system("start https://aniwatchtv.to")
            return {"status": "success", "message": "Chill mode activated. Anime and Music ready."}
        return {"status": "error", "message": f"Unknown workflow mode: {mode}"}


os_manager = SystemOptimizer()


# ══════════════════════════════════════════════════════════════════════════════
# EMAIL ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def _load_email_creds() -> dict:
    if os.path.exists(EMAIL_CREDS_FILE):
        try:
            with open(EMAIL_CREDS_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def send_email_smtp(to: str, subject: str, body: str) -> dict:
    creds = _load_email_creds()
    if not creds:
        return {"status": "error",
                "error": f"No email credentials. Create '{EMAIL_CREDS_FILE}' with keys: address, app_password, smtp_host, smtp_port"}
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = creds["address"]
        msg["To"]      = to
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP(creds.get("smtp_host", "smtp.gmail.com"),
                          int(creds.get("smtp_port", 587))) as server:
            server.ehlo(); server.starttls()
            server.login(creds["address"], creds["app_password"])
            server.sendmail(creds["address"], to, msg.as_string())
        return {"status": "success", "to": to, "subject": subject}
    except smtplib.SMTPAuthenticationError:
        return {"status": "error", "error": "SMTP auth failed — check app_password in email_creds.json"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def open_gmail_compose(to: str, subject: str, body: str) -> dict:
    params = urllib.parse.urlencode({"to": to, "su": subject, "body": body})
    url = f"https://mail.google.com/mail/?view=cm&fs=1&{params}"
    open_url(url)
    _maximize_active_browser()
    return {"status": "success", "method": "gmail_browser", "url": url}


# ══════════════════════════════════════════════════════════════════════════════
# FILE SEARCH ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def search_file(filename: str, max_results: int = 10) -> list[str]:
    results = []
    patterns = [f"**/{filename}", f"**/*{filename}*"]
    for root in FILE_SEARCH_ROOTS:
        if not os.path.exists(root):
            continue
        for pattern in patterns:
            try:
                for m in glob.glob(os.path.join(root, pattern), recursive=True):
                    if m not in results:
                        results.append(m)
                    if len(results) >= max_results:
                        return results
            except Exception:
                pass
    return results


# ══════════════════════════════════════════════════════════════════════════════
# CONTACT DATABASE
# ══════════════════════════════════════════════════════════════════════════════

def load_contacts() -> dict:
    if not os.path.exists(CONTACTS_FILE):
        defaults = {"Papa": "FAMILY", "Mummy": "FAMILY",
                    "Police": "EMERGENCY", "Ambulance": "EMERGENCY"}
        with open(CONTACTS_FILE, 'w') as f:
            json.dump(defaults, f, indent=2)
        return defaults
    try:
        with open(CONTACTS_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def save_contact(name: str, role: str = "FRIEND") -> str:
    contacts = load_contacts()
    contacts[name.capitalize()] = role.upper()
    with open(CONTACTS_FILE, 'w') as f:
        json.dump(contacts, f, indent=2)
    return f"Saved {name} as {role}"


def get_closest_contact(name: str) -> str:
    contacts = load_contacts()
    matches = get_close_matches(name, list(contacts.keys()), n=1, cutoff=0.6)
    return matches[0] if matches else name


# ══════════════════════════════════════════════════════════════════════════════
# WIN32 WINDOW RESTORE  (the real fix for minimized Spotify)
# ══════════════════════════════════════════════════════════════════════════════

def _restore_and_focus_window(win) -> bool:
    if HAS_WIN32:
        try:
            hwnd = win._hWnd
            if win32gui.IsIconic(hwnd):
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                time.sleep(0.6)
            win32gui.ShowWindow(hwnd, win32con.SW_SHOW)
            time.sleep(0.2)
            ctypes.windll.user32.SwitchToThisWindow(hwnd, True)
            time.sleep(0.4)
            win32gui.SetForegroundWindow(hwnd)
            time.sleep(0.5)
            return win32gui.GetForegroundWindow() == hwnd
        except Exception as e:
            logger.warning(f"win32gui failed: {e} — using ctypes fallback")

    # ── ctypes-only fallback (no pywin32 needed) ───────────────────────────
    try:
        hwnd     = win._hWnd
        user32   = ctypes.windll.user32

        # Restore if minimized
        if user32.IsIconic(hwnd):
            logger.info(f"🔄 Restoring minimized window: '{win.title}'")
            user32.ShowWindow(hwnd, 9)   # SW_RESTORE = 9
            time.sleep(0.7)
        else:
            user32.ShowWindow(hwnd, 5)   # SW_SHOW = 5
            time.sleep(0.2)

        # AttachThreadInput trick — prevents Windows from blocking SetForegroundWindow
        fg_hwnd   = user32.GetForegroundWindow()
        fg_thread = user32.GetWindowThreadProcessId(fg_hwnd, None)
        my_thread = ctypes.windll.kernel32.GetCurrentThreadId()
        if fg_thread != my_thread:
            user32.AttachThreadInput(fg_thread, my_thread, True)
            user32.BringWindowToTop(hwnd)
            user32.SetForegroundWindow(hwnd)
            user32.AttachThreadInput(fg_thread, my_thread, False)
        else:
            user32.SetForegroundWindow(hwnd)

        time.sleep(0.4)
        user32.SwitchToThisWindow(hwnd, True)
        time.sleep(0.3)

        success = (user32.GetForegroundWindow() == hwnd)
        logger.info(f"{'✅' if success else '⚠️'} ctypes focus: '{win.title}'")
        return success

    except Exception as e:
        logger.error(f"❌ All focus methods failed: {e}")
        return False


def _confirm_window_has_focus(title_keyword: str, timeout: float = 3.0) -> bool:
    """Poll until the target window is the active foreground window."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            active = gw.getActiveWindow()
            if active and title_keyword.lower() in active.title.lower():
                return True
        except Exception:
            pass
        time.sleep(0.15)
    return False


# ══════════════════════════════════════════════════════════════════════════════
# SPOTIFY HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _clean_song_query(raw: str) -> str:
    """
    Multi-pass removal of spoken filler words.
    'play name you go on spotify please' → 'name you go'
    """
    clean = raw.strip().lower()

    # Pass 1: Remove leading action words (loop so "play play song" also works)
    changed = True
    while changed:
        changed = False
        for prefix in ["play", "search for", "search", "find", "put on",
                        "start", "open", "queue", "add"]:
            if clean.startswith(prefix + " "):
                clean = clean[len(prefix):].strip()
                changed = True
            elif clean == prefix:
                clean = ""
                changed = True

    # Pass 2: Remove trailing platform / politeness words
    changed = True
    while changed:
        changed = False
        for suffix in ["on spotify", "in spotify", "spotify", "please",
                        "for me", "right now", "now", "asap"]:
            if clean.endswith(" " + suffix):
                clean = clean[:-len(suffix)].strip()
                changed = True

    # Pass 3: Remove leading article/filler nouns
    for filler in ["the song", "a song", "some music", "some", "the track",
                    "a track", "track", "the", "a"]:
        if clean.startswith(filler + " "):
            clean = clean[len(filler):].strip()

    result = clean.strip() if clean.strip() else "lofi chill"
    logger.info(f"🧹 Query cleaned: '{raw}' → '{result}'")
    return result


def _spotify_focus_or_launch() -> bool:
    # ── Stage 1: Find existing window ──────────────────────────────────────
    spotify_wins = [w for w in gw.getAllWindows()
                    if "spotify" in w.title.lower() and w.title.strip()]

    if spotify_wins:
        win = spotify_wins[0]
        logger.info(f"🎵 Found: '{win.title}' (minimized={win.isMinimized})")
        _restore_and_focus_window(win)

        if _confirm_window_has_focus("spotify", timeout=2.0):
            logger.info("✅ Spotify focused")
            return True

        # ── Stage 1b: Physical click — ALWAYS transfers focus ───────────────
        logger.warning("⚠️ API focus failed — using physical click")
        try:
            spotify_wins = [w for w in gw.getAllWindows()
                            if "spotify" in w.title.lower() and w.title.strip()]
            if spotify_wins:
                w  = spotify_wins[0]
                cx = max(10, min(w.left + w.width  // 2, SCREEN_W - 10))
                cy = max(10, min(w.top  + w.height // 2, SCREEN_H - 10))
                pyautogui.moveTo(cx, cy, duration=0.15)
                pyautogui.click()
                time.sleep(0.5)
                logger.info(f"🖱️ Clicked ({cx}, {cy})")
                # Even if focus check fails, window is visible — proceed
                return True
        except Exception as e:
            logger.error(f"Physical click failed: {e}")

    # ── Stage 2: Launch Spotify ─────────────────────────────────────────────
    logger.info("🚀 Launching Spotify...")
    os.startfile("spotify:")
    time.sleep(7.0)

    # ── Stage 3: Find and focus newly launched window ───────────────────────
    for attempt in range(5):
        spotify_wins = [w for w in gw.getAllWindows()
                        if "spotify" in w.title.lower() and w.title.strip()]
        if spotify_wins:
            _restore_and_focus_window(spotify_wins[0])
            if _confirm_window_has_focus("spotify", timeout=2.0):
                logger.info(f"✅ Spotify launched and focused (attempt {attempt + 1})")
                return True
        time.sleep(1.5)

    logger.error("Could not focus Spotify after launch")
    return False


def _find_song_rows_below_header(header_y: int, screen_w: int, screen_h: int,
                                  vision_engine, clean_query: str) -> dict | None:
    """
    Vision-confirmed song row detection.
    Scans 3 progressively deeper regions below the 'Songs' header.
    Never uses a single fixed pixel offset.

    Spotify layout (resolution-independent):
      header_y +  0–50px  → filter chips (All / Songs / Artists / Albums)
      header_y + 55–90px  → column labels (Title / Album / Date Added / Duration)
      header_y + 90–170px → FIRST actual song row
    """
    SCAN_PASSES = [
        (90,  80, "primary"),     # Most common on 1080p+
        (60,  60, "compact"),     # Compact / small window
        (130, 80, "expanded"),    # Large monitor / expanded window
    ]

    # UI elements to skip — these are NOT song titles
    UI_LABELS = {
        "all", "songs", "artists", "albums", "playlists", "podcasts",
        "episodes", "profiles", "genre", "title", "album", "date added",
        "duration", "#", "more", "see all", "filters"
    }

    for y_off, h, label in SCAN_PASSES:
        scan_top    = header_y + y_off
        scan_bottom = scan_top + h
        if scan_bottom > screen_h:
            continue

        # Song title column: left ~300px, right edge ~300px from right
        # (avoids album art on left and duration/controls on right)
        region = (300, scan_top, screen_w - 300, scan_bottom)

        # ── Try 1: Direct OCR match on query ────────────────────────────────
        match = vision_engine.find_text_on_screen(clean_query, region=region)
        if match and match.get("score", 0) > 0.30:
            logger.info(f"🎯 [{label}] Song matched by query at y={match['y']}: "
                        f"'{match['text']}' (score={match['score']:.2f})")
            return match

        # ── Try 2: First non-UI line in region ───────────────────────────────
        try:
            screenshot = ImageGrab.grab(bbox=region)
            data = pytesseract.image_to_data(
                screenshot, output_type=pytesseract.Output.DICT
            )
            lines: dict = {}
            for i, word in enumerate(data["text"]):
                if not word.strip() or data["conf"][i] < 20:
                    continue
                ln = data["line_num"][i]
                if ln not in lines:
                    lines[ln] = {
                        "words": [],
                        "top":    data["top"][i]    + scan_top,
                        "left":   data["left"][i]   + region[0],
                        "height": data["height"][i],
                    }
                lines[ln]["words"].append(word)

            for ln in sorted(lines.keys()):
                ld        = lines[ln]
                line_text = " ".join(ld["words"]).strip()
                if len(line_text) < 3:
                    continue
                if line_text.lower() in UI_LABELS:
                    continue
                # Skip pure number strings (track numbers like "1", "2")
                if line_text.strip().isdigit():
                    continue
                cx = ld["left"] + 180
                cy = ld["top"]  + ld["height"] // 2
                logger.info(f"🔤 [{label}] First content row: '{line_text}' at ({cx}, {cy})")
                return {"text": line_text, "x": cx, "y": cy, "score": 0.5}

        except Exception as e:
            logger.debug(f"Line scan error [{label}]: {e}")

    return None


# ══════════════════════════════════════════════════════════════════════════════
# EXECUTION ENGINE  — all platform actions
# ══════════════════════════════════════════════════════════════════════════════

class ExecutionEngine:

    # ── open any website ──────────────────────────────────────────────────────
    @staticmethod
    def open_website(url: str) -> dict:
        plan = {"intent": "open_website", "url": url, "status": "pending"}
        try:
            normalized = url.strip()
            if not normalized.startswith(("http://", "https://")):
                if "." in normalized and " " not in normalized:
                    normalized = "https://" + normalized
                else:
                    normalized = f"https://www.google.com/search?q={urllib.parse.quote(normalized)}"
            open_url(normalized)
            _maximize_active_browser()
            plan.update({"status": "success", "opened": normalized})
        except Exception as e:
            plan.update({"status": "error", "error": str(e)})
        return plan

    # ── anime / AniWatch ─────────────────────────────────────────────────────
    @staticmethod
    def search_anime(anime_name: str, site: str = "nawatch") -> dict:
        plan = {"intent": "search_anime", "app": site,
                "anime_name": anime_name, "status": "pending"}
        try:
            open_url(f"https://aniwatchtv.to/search?keyword={urllib.parse.quote(anime_name)}")
            _maximize_active_browser(); time.sleep(2.0)
            match = vision.find_best_list_match(anime_name,
                                                region=(0, SCREEN_H // 3, SCREEN_W, SCREEN_H))
            if match and match["score"] > 0.4:
                safe_click(match["x"], match["y"]); time.sleep(2.0)
                if not vision.click_element("Watch Now") and not vision.click_element("EP 1"):
                    vision.click_element("EP-1") or pyautogui.press('enter')
                plan.update({"status": "success", "matched": match["text"]})
            else:
                plan.update({"status": "no_match",
                             "error": f"No result matching '{anime_name}' found"})
        except Exception as e:
            plan.update({"status": "error", "error": str(e)})
        return plan

    # ── YouTube ───────────────────────────────────────────────────────────────
    @staticmethod
    def youtube_learn(query: str) -> dict:
        plan = {"intent": "youtube_learn", "query": query, "status": "pending"}
        try:
            open_url(f"https://www.youtube.com/results?search_query={urllib.parse.quote(query)}")
            _maximize_active_browser(); time.sleep(3.0)
            vision.click_element("Accept all", timeout=2.0); time.sleep(0.5)
            region = (0, SCREEN_H // 4, SCREEN_W // 2, SCREEN_H)
            match = vision.find_best_list_match(query, region=region)
            if match and match["score"] > 0.3:
                safe_click(match["x"], match["y"])
                plan.update({"status": "success", "matched": match["text"]})
            else:
                pyautogui.scroll(-300); time.sleep(1.0)
                match = vision.find_best_list_match(query, region=region)
                if match:
                    safe_click(match["x"], match["y"])
                    plan.update({"status": "success", "matched": match["text"]})
                else:
                    plan.update({"status": "no_match",
                                 "error": f"No video matching '{query}' found."})
        except Exception as e:
            plan.update({"status": "error", "error": str(e)})
        return plan

    # ── Netflix ───────────────────────────────────────────────────────────────
    @staticmethod
    def watch_netflix(query: str) -> dict:
        plan = {"intent": "watch_netflix", "query": query, "status": "pending"}
        try:
            open_url(f"https://www.netflix.com/search?q={urllib.parse.quote(query)}")
            _maximize_active_browser(); time.sleep(3.0)
            match = vision.find_best_list_match(query,
                                                region=(0, SCREEN_H // 4, SCREEN_W, SCREEN_H))
            if match and match["score"] > 0.4:
                safe_click(match["x"], match["y"]); time.sleep(2.0)
                plan.update({"status": "success", "matched": match["text"]})
            else:
                plan.update({"status": "no_match",
                             "error": f"No Netflix content matching '{query}' found"})
        except Exception as e:
            plan.update({"status": "error", "error": str(e)})
        return plan

    # ── WhatsApp internals ────────────────────────────────────────────────────
    @staticmethod
    def _open_whatsapp_chat(contact: str) -> dict:
        plan = {"intent": "open_whatsapp_chat", "contact": contact, "status": "pending"}
        try:
            os.system('start whatsapp:'); time.sleep(2.0)
            pyautogui.click(SCREEN_W // 2, 10); time.sleep(0.3)
            pyautogui.hotkey('ctrl', 'n'); time.sleep(1.0)
            paste_text(contact); time.sleep(1.5)
            pyautogui.press('down'); time.sleep(0.3)
            pyautogui.press('enter')
            plan["status"] = "success"
        except Exception as e:
            plan.update({"status": "error", "error": str(e)})
        return plan

    # ── send WhatsApp message ─────────────────────────────────────────────────
    @staticmethod
    def send_whatsapp(contact: str, message: str) -> dict:
        AI_SIG = "\n\n[This is an AI generated message.]"
        
        # ── Guard: message empty hai toh bhi AI_SIG hi bhejna hai ──────────
        if not message or not message.strip():
            message = "Hey!"
        
        # ── AI signature sirf ek baar attach karo ──────────────────────────
        if AI_SIG not in message:
            full_message = message + AI_SIG
        else:
            full_message = message

        plan = {"intent": "send_whatsapp", "contact": contact,
                "message": full_message, "status": "pending"}
        
        try:
            # Step 1: WhatsApp open karo aur chat dhundho
            result = ExecutionEngine._open_whatsapp_chat(contact)
            if result["status"] != "success":
                raise Exception(result.get("error", "Chat open failed"))

            # Step 2: Thoda wait karo — WhatsApp ko chat load karne do
            time.sleep(1.5)

            # Step 3: Message box pe click karo — Vision se dhundho, fallback coords se
            # WhatsApp Desktop pe message box usually screen ke bottom center mein hota hai
            # Search bar ke liye "Type a message" avoid karo - bottom region mein search karo
            wa_wins = [w for w in gw.getAllWindows() 
                       if "whatsapp" in w.title.lower()]
            
            msg_box = None
            if wa_wins:
                win = wa_wins[0]
                # Bottom third of WhatsApp window mein message box hota hai
                search_region = (win.left, win.top + (win.height * 2 // 3), 
                                win.right, win.bottom)
                msg_box = vision.wait_for_element("Type a message", timeout=5.0, region=search_region)
            
            if msg_box:
                # Vision ne box dhundha — wahan click karo
                safe_click(msg_box['x'], msg_box['y'])
                logger.info(f"✅ Message box found via vision at ({msg_box['x']}, {msg_box['y']})")
            else:
                # Fallback: WhatsApp window ke bottom center mein click karo
                if wa_wins:
                    win = wa_wins[0]
                    # Message bar window ke bottom se thoda upar hota hai
                    fallback_x = win.left + (win.width // 2)
                    fallback_y = win.bottom - 60
                    safe_click(fallback_x, fallback_y)
                    logger.warning(
                        f"⚠️ Vision fallback: clicking ({fallback_x}, {fallback_y})"
                    )
                else:
                    # Last resort: fixed coords
                    safe_click(SCREEN_W // 2, SCREEN_H - 80)
                    logger.warning("⚠️ Hard fallback: clicking screen bottom center")

            # Step 4: Ek aur short wait — click process hone do
            time.sleep(0.4)

            # Step 5: Existing text clear karo (agar kuch already typed tha)
            pyautogui.hotkey('ctrl', 'a')
            time.sleep(0.15)
            pyautogui.press('backspace')
            time.sleep(0.15)

            # Step 6: Message clipboard mein daalo aur paste karo
            # NOTE: paste_text(press_enter=False) use karo — Enter alag step mein
            pyperclip.copy(full_message)
            time.sleep(0.2)
            pyautogui.hotkey('ctrl', 'v')
            time.sleep(0.3)  # Paste complete hone do

            # Step 7: Verify karo ki text field mein kuch hai
            # (Optional debug — remove karo agar slow lagta hai)
            logger.info(f" Pasted message ({len(full_message)} chars): "
                        f"'{full_message[:50]}...'")

            # Step 8: Enter dabao — message send
            time.sleep(0.2)
            pyautogui.press('enter')
            time.sleep(0.3)

            plan.update({
                "status":           "success",
                "message_length":   len(full_message),
                "contact_resolved": contact
            })
            logger.info(f"✅ WhatsApp message sent to {contact}")

        except Exception as e:
            plan.update({"status": "error", "error": str(e)})
            logger.error(f" WhatsApp send failed: {e}")

        return plan

    # ── WhatsApp call ─────────────────────────────────────────────────────────
    @staticmethod
    def make_call(contact: str, call_type: str = "voice") -> dict:
        plan = {"intent": "make_call", "contact": contact,
                "call_type": call_type, "status": "pending"}
        try:
            result = ExecutionEngine._open_whatsapp_chat(contact)
            if result["status"] != "success":
                raise Exception(result.get("error", "Chat open failed"))
            time.sleep(1.0)
            wa_wins = [w for w in gw.getAllWindows() if "whatsapp" in w.title.lower()]
            if not wa_wins:
                raise Exception("WhatsApp window not found")
            win = wa_wins[0]
            call_x = win.right - 220
            call_y = win.top + 70
            safe_click(call_x, call_y); time.sleep(1.0)
            if call_type == "video":
                safe_click(call_x + 60, call_y + 125)
            else:
                safe_click(call_x - 140, call_y + 125)
            time.sleep(0.5)
            pyautogui.press('enter')
            plan["status"] = "success"
        except Exception as e:
            plan.update({"status": "error", "error": str(e)})
        return plan

    # ── disconnect ongoing call ───────────────────────────────────────────────
    @staticmethod
    def disconnect_call() -> dict:
        """
        End an active WhatsApp call.
        1. Focus WhatsApp and try Ctrl+Shift+E (desktop end-call shortcut).
        2. Vision fallback — click any visible "End" button on screen.
        """
        plan = {"intent": "disconnect_call", "status": "pending"}
        try:
            wa_wins = [w for w in gw.getAllWindows() if "whatsapp" in w.title.lower()]
            if wa_wins:
                try:
                    wa_wins[0].activate(); time.sleep(0.5)
                except Exception:
                    pass
            pyautogui.hotkey('ctrl', 'shift', 'e'); time.sleep(0.8)
            # Vision fallback for any on-screen "End" button
            end_btn = vision.find_text_on_screen("End")
            if end_btn:
                safe_click(end_btn['x'], end_btn['y'])
            plan["status"] = "success"
        except Exception as e:
            plan.update({"status": "error", "error": str(e)})
        return plan

    # ── voice note ────────────────────────────────────────────────────────────
    @staticmethod
    def send_voice_note(contact: str, duration: int = 5) -> dict:
        plan = {"intent": "send_voice_note", "contact": contact,
                "duration": duration, "status": "pending"}
        try:
            result = ExecutionEngine._open_whatsapp_chat(contact)
            if result["status"] != "success":
                raise Exception(result.get("error", "Chat open failed"))
            time.sleep(1.0)
            bar = vision.find_text_on_screen("Type a message")
            mic_x = SCREEN_W - 80
            mic_y = bar["y"] if bar else SCREEN_H - 80
            safe_click(mic_x, mic_y)
            pyautogui.mouseDown(); time.sleep(duration); pyautogui.mouseUp()
            plan["status"] = "success"
        except Exception as e:
            plan.update({"status": "error", "error": str(e)})
        return plan


    @staticmethod
    def play_spotify(song: str) -> dict:
        plan = {
            "intent": "play_music",
            "app":     "spotify",
            "query":   song,
            "status":  "pending",
            "method":  None,
        }

        # ── Step 0: Clean query ───────────────────────────────────────────────
        clean = _clean_song_query(song)
        logger.info(f" Spotify request: raw='{song}' → clean='{clean}'")

        try:
            # ── Step 1: Restore + focus Spotify (handles minimized state) ────
            #   _spotify_focus_or_launch() uses win32gui SW_RESTORE + 
            #   SwitchToThisWindow — the only reliable way on Windows
            focus_success = _spotify_focus_or_launch()
            if not focus_success:
                logger.warning(" Focus confirmation failed, but Spotify may still be opening - proceeding with search")
                # Don't return error - Spotify might still be loading/visible

            # ── Step 2: CONFIRM focus before sending any keystrokes ───────────
            #   This is what v4 was missing — Ctrl+L fired before Spotify
            #   had actual keyboard focus, so it went to the taskbar / OS.
            if not _confirm_window_has_focus("spotify", timeout=3.0):
                # Last resort: click in the center of the Spotify window
                spotify_wins = [w for w in gw.getAllWindows()
                                if "spotify" in w.title.lower()]
                if spotify_wins:
                    w = spotify_wins[0]
                    safe_click(w.left + w.width // 2, w.top + w.height // 2)
                    time.sleep(0.5)

            # ── Step 3: Open search — use Ctrl+L (Spotify's search shortcut) ─
            #   Small extra delay after focus confirmation for UI to settle
            time.sleep(0.3)
            pyautogui.hotkey("ctrl", "l")
            time.sleep(1.0)  # Wait for search box to open and be ready

            # Clear any existing search text
            pyautogui.hotkey("ctrl", "a")
            time.sleep(0.2)

            # Paste song name (clipboard paste is faster + avoids key-rate issues)
            pyperclip.copy(clean)
            time.sleep(0.1)
            pyautogui.hotkey("ctrl", "v")
            time.sleep(0.4)
            pyautogui.press("enter")

            # Wait for results to render — Spotify's search page is React-driven
            time.sleep(4.0)

            # ── Step 4: Locate the "Songs" section header ─────────────────────
            # Search in top half of screen where the Songs heading always appears
            songs_header = vision.find_text_on_screen(
                "Songs",
                region=(0, 0, SCREEN_W, SCREEN_H // 2)
            )

            if songs_header:
                header_y = songs_header["y"]
                logger.info(f"✅ 'Songs' header at y={header_y}")

                # ── Step 5: Find actual song row (vision-confirmed, no blind offset)
                song_row = _find_song_rows_below_header(
                    header_y, SCREEN_W, SCREEN_H, vision, clean
                )

                if song_row:
                    # Double-click to confirmed song row
                    pyautogui.moveTo(song_row["x"], song_row["y"], duration=0.25)
                    pyautogui.doubleClick()
                    time.sleep(0.8)
                    plan.update({
                        "status": "success",
                        "matched": song_row["text"],
                        "method": "vision_row_confirmed",
                    })
                    logger.info(f"▶️ Clicked song row: '{song_row['text']}'")
                else:
                    logger.warning("⚠️ No song row found by vision — falling back to Tab navigation")
                    plan["method"] = "tab_nav_fallback"

            else:
                # ── Step 5B: No "Songs" header found ─────────────────────────
                # Could be artist page ("Popular"), playlist page, or slow load
                logger.warning("⚠️ 'Songs' header not found. Checking for artist page...")

                popular = vision.find_text_on_screen(
                    "Popular",
                    region=(0, 0, SCREEN_W // 2, SCREEN_H // 2)
                )
                if popular:
                    logger.info(f"🎤 Artist page: 'Popular' at y={popular['y']}")
                    # First Popular track is reliably ~55-80px below the heading
                    # But we validate with a line scan first
                    song_row = _find_song_rows_below_header(
                        popular["y"], SCREEN_W, SCREEN_H, vision, clean
                    )
                    if song_row:
                        pyautogui.moveTo(song_row["x"], song_row["y"], duration=0.25)
                        pyautogui.doubleClick()
                        time.sleep(0.8)
                        plan.update({
                            "status": "success",
                            "matched": song_row["text"],
                            "method": "artist_page_vision_row",
                        })
                    else:
                        plan["method"] = "tab_nav_fallback"
                else:
                    plan["method"] = "tab_nav_fallback"

            # ── Step 6: Tab fallback (if all vision paths failed) ─────────────
            if plan["method"] == "tab_nav_fallback":
                logger.info(" Tab navigation: skipping past filter chips to song rows")
                # Press Tab enough times to skip the filter bar and land on songs
                # Spotify's tab order: search box → All chip → Songs chip →
                #   Artists chip → Albums chip → Playlists chip → first song card
                # 5–7 tabs reliably lands on the first song result
                for i in range(7):
                    pyautogui.press("tab")
                    time.sleep(0.12)
                pyautogui.press("enter")
                time.sleep(1.0)
                plan.update({
                    "status": "success",
                    "matched": f"Tab fallback for '{clean}'",
                    "method": "tab_nav_fallback",
                })
                logger.info("Tab navigation executed")

            # ── Step 7: Verify playback via Now Playing bar ───────────────────
            time.sleep(1.8)
            # The Now Playing bar is at the very bottom of Spotify — 80px strip
            now_playing_region = (0, SCREEN_H - 90, SCREEN_W // 2, SCREEN_H)

            # Try first 8 chars of clean query (truncate to avoid OCR mismatch)
            probe = clean[:8] if len(clean) > 4 else clean
            confirmed = vision.find_text_on_screen(probe, region=now_playing_region)

            if confirmed:
                plan["playback_confirmed"] = True
                logger.info(f" CONFIRMED: '{clean}' is now playing")
            else:
                # Check if ANY text changed in the bar (something is playing,
                # just might not match our probe string perfectly)
                bar_text = vision.find_text_on_screen(
                    clean[:4], region=now_playing_region
                )
                plan["playback_confirmed"] = bar_text is not None
                if bar_text:
                    logger.info(f"▶ Playback likely started (partial match: '{bar_text['text']}')")
                else:
                    logger.warning(f"⚠️ Could not confirm playback for '{clean}'")

            logger.info(f" Spotify play attempt done: '{clean}' via {plan.get('method')}")

        except Exception as e:
            plan.update({"status": "error", "error": str(e)})
            logger.error(f" Spotify error: {e}", exc_info=True)

        return plan


    # ── toggle_spotify ────────────────────────────────────────────────────────
    @staticmethod
    def toggle_spotify() -> dict:
        try:
            pyautogui.press('playpause')
            return {"intent": "toggle_music", "status": "success"}
        except Exception as e:
            return {"intent": "toggle_music", "status": "error", "error": str(e)}

    # ── AI assistant ──────────────────────────────────────────────────────────
    @staticmethod
    def ask_ai(prompt: str, ai: str = "chatgpt") -> dict:
        plan = {"intent": "ask_ai", "ai": ai, "status": "pending"}
        urls = {"chatgpt": "https://chatgpt.com",
                "gemini":  "https://gemini.google.com",
                "claude":  "https://claude.ai"}
        try:
            open_url(urls.get(ai, urls["chatgpt"]))
            time.sleep(6.0)
            paste_text(prompt, press_enter=True)
            plan["status"] = "success"
        except Exception as e:
            plan.update({"status": "error", "error": str(e)})
        return plan


# ══════════════════════════════════════════════════════════════════════════════
# BRAIN PING  (alerts Main Brain on Port 5000)
# ══════════════════════════════════════════════════════════════════════════════

def alert_brain(vision_desc: str, screen_context: str):
    """Fire-and-forget — never blocks the main thread. Now uses the main process endpoint to generate audio!"""
    try:
        # We format the alert as a direct user input so the brain treats it like a chat message and generates audio.
        proactive_msg = f"*I just noticed you are wasting time on {screen_context}. Scold me heavily for this and tell me you closed the tab!*"
        
        # 🔥 FIX 1: Timeout badha diya hai taaki TTS ko generate hone ka time mile
        response = requests.post(
            "http://127.0.0.1:5000/process", 
            json={
                "user_input": proactive_msg,
                "userId": "user_pro_01",
                "source": "proactive"
            },
            timeout=45 
        )
        
        if response.status_code == 200:
            logger.info("🧠 Brain alerted successfully, audio generated.")
            resp_data = response.json()
            audio_b64 = resp_data.get("audioBase64")
            reply_text = resp_data.get("replyText", "...")
            
            logger.info(f"💬 Maeve says: {reply_text}")
            
            if audio_b64:
                import base64
                import tempfile
                import os
                import winsound
                try:
                    # 🔥 FIX 2: React wala prefix safely remove karo
                    if "," in audio_b64:
                        audio_b64 = audio_b64.split(",")[1]
                        
                    # Base64 padding fix (Kabhi kabhi padding ki wajah se decode fail hota hai)
                    audio_b64 += "=" * ((4 - len(audio_b64) % 4) % 4)
                        
                    audio_bytes = base64.b64decode(audio_b64)
                    
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                        tmp.write(audio_bytes)
                        tmp_path = tmp.name
                        
                    # Play the actual TTS audio
                    logger.info("🔊 Playing audio directly through speakers...")
                    winsound.PlaySound(tmp_path, winsound.SND_FILENAME | winsound.SND_NODEFAULT)
                    os.remove(tmp_path)
                    
                except Exception as audio_err:
                    logger.error(f"❌ Audio error: {audio_err}")
            else:
                logger.warning("⚠️ Brain did not send any audioBase64!")
        else:
             logger.warning(f"⚠️ Brain returned status code: {response.status_code}")
             
    except Exception as e:
        logger.debug(f"Brain ping failed (brain may be offline): {e}")


# ══════════════════════════════════════════════════════════════════════════════
# BACKGROUND MONITORS  (threaded)
# ══════════════════════════════════════════════════════════════════════════════

class MonitorThreads:
    # 🚨 THE ULTIMATE DISTRACTION DATABASE (Precise targeting only)
    ENTERTAINMENT_APPS = [
        # Video Streaming (exclude safe content)
        "youtube.com/watch", "youtube.com/shorts", "youtube.com/feed", "youtube.com/trending",
        "netflix.com/watch", "prime video", "hotstar", "jiocinema", 
        "sonyliv", "zee5", "disney+", "hulu", "hbo max", "apple tv+", "dailymotion",
        
        # Social Media (exclude safe messaging)
        "instagram.com", "facebook.com", "twitter.com", "x.com", "reddit.com/r/",
        "tiktok.com", "snapchat.com", "pinterest.com", "twitch.tv", 
        "instagram.com/reels", "facebook.com/reels", "tiktok.com/@",
        
        # Anime/Manga Sites
        "crunchyroll.com", "aniwatch", "hianime", "9anime", "gogoanime", 
        "kissanime", "zoro", "animixplay", "bilibili", "aniwave", "muse asia",
        
        # Movie Streaming
        "fmovies", "123movies", "soap2day", "putlocker", "flixhq", 
        "m4uhd", "yesmovies", "watchseries", "moviesjoy", "hurawatch", "myflixer",
        
        # Manga/Webtoon
        "webtoon", "mangadex", "asurascans", "flamescans", "mangareader", "kunmanga",
        
        # Gaming (exclude educational games)
        "steam store", "epic games store", "roblox.com", "poki.com", "crazygames.com", "miniclip.com",
        
        # Time-wasting patterns
        "youtube.com/results", "reddit.com/r/all", "twitter.com/explore", "instagram.com/explore"
    ]
    
    EDU_KEYWORDS = [
        "tutorial", "course", "learn", "study", "lecture", "class", 
        "react", "spring boot", "java", "dsa", "exam", "coding", "code"
    ]

    def __init__(self, interval: int = 5): # Check every 5 seconds
        self.interval = interval
        self.running  = True
        self.distraction_start_time = None
        self.is_currently_distracted = False
        
        # 🔥 THE REAL TIMER: 3 Hours (10800 Seconds)
        self.distraction_limit = 10800 

    def is_educational(self, title: str) -> bool:
        return any(keyword in title.lower() for keyword in self.EDU_KEYWORDS)

    def start_discipline_monitor(self):
        """Watches active window with a Patience Timer. Only pings brain after limits."""
        def loop():
            logger.info("🧠 Smart Discipline Monitor started with Patience Timer...")
            while self.running:
                try:
                    window = gw.getActiveWindow()
                    if window and window.title:
                        title = window.title.lower()
                        
                        is_entertainment = any(app in title for app in self.ENTERTAINMENT_APPS)
                        
                        if is_entertainment:
                            if self.is_educational(title):
                                # User is studying on an entertainment platform (e.g. YouTube Tutorial)
                                if self.is_currently_distracted:
                                    logger.info("✅ User switched to Educational Content. Timer CANCELLED.")
                                    self.is_currently_distracted = False
                                    self.distraction_start_time = None
                            else:
                                # User is wasting time
                                if not self.is_currently_distracted:
                                    self.is_currently_distracted = True
                                    self.distraction_start_time = time.time()
                                    logger.warning(f"⚠️ Distraction detected ('{title}'). Timer STARTED!")
                                    
                                time_spent = time.time() - self.distraction_start_time
                                
                                # Check if patience ran out!
                                if time_spent > self.distraction_limit:
                                    logger.error(f"🚫 DISTRACTION LIMIT REACHED ({self.distraction_limit}s)! Punishing!")
                                    
                                    # Reset timer so she doesn't spam every 5 seconds after limit is hit
                                    self.distraction_start_time = time.time() 
                                    
                                    # Force execution of STOP_DISTRACTION and ping brain for audio
                                    threading.Thread(
                                        target=alert_brain,
                                        args=(
                                            "User has been wasting time on entertainment for way too long.",
                                            f"Active Window: {title}. Scold them heavily and say you are closing the tab."
                                        ),
                                        daemon=True
                                    ).start()
                                    
                                    # 🔥 SMART CLOSE (Failsafe for 3-Hour Limit)
                                    try:
                                        # Use pygetwindow to check before killing
                                        active_win = gw.getActiveWindow()
                                        safe_keywords = ['maeve', 'localhost', '127.0.0.1', 'vite']
                                        
                                        if active_win and not any(k in active_win.title.lower() for k in safe_keywords):
                                            print(f"💥 3-Hour Limit Hit! Killing: {active_win.title}")
                                            pyautogui.hotkey('ctrl', 'w')
                                        else:
                                            print("🛡️ 3-Hour Limit Hit! But skipped Ctrl+W because Maeve is active.")
                                            
                                        # Minimize everything as an extra punishment
                                        pyautogui.hotkey('win', 'd')
                                    except:
                                        pass

                        else:
                            # User is doing something else entirely (VS Code, etc.)
                            if self.is_currently_distracted:
                                logger.info("✅ Distraction ended (moved to safe app). Timer STOPPED.")
                                self.is_currently_distracted = False
                                self.distraction_start_time = None
                                
                except Exception as e:
                    pass
                    
                time.sleep(self.interval)
                
        threading.Thread(target=loop, daemon=True, name="DisciplineMonitor").start()

    def start_hardware_monitor(self):
        """Watches RAM/CPU. Pings brain and auto-clears RAM if critically high."""
        def loop():
            while self.running:
                try:
                    vitals = os_manager.get_vitals()
                    if vitals["ram_percent"] > 95:
                        logger.warning(f"RAM critical: {vitals['ram_percent']}% - Closing browser tabs")
                        # Smart tab closing for high RAM
                        result = os_manager.close_high_ram_tabs()
                        if result['status'] == 'success':
                            threading.Thread(
                                target=alert_brain,
                                args=(f"RAM was critical ({vitals['ram_percent']}%). I closed {result['tabs_closed']} browser tabs to free memory.",
                                      "Hardware monitor - High RAM tab cleanup"),
                                daemon=True
                            ).start()
                    elif vitals["ram_percent"] > 90:
                        logger.warning(f"RAM warning: {vitals['ram_percent']}%")
                        threading.Thread(
                            target=alert_brain,
                            args=(f"PC RAM is getting high ({vitals['ram_percent']}%). Monitor closely.",
                                  "Hardware monitor - RAM warning"),
                            daemon=True
                        ).start()
                    if vitals["cpu_percent"] > 90:
                        logger.warning(f"CPU critical: {vitals['cpu_percent']}%")
                        threading.Thread(
                            target=alert_brain,
                            args=(f"PC CPU usage is very high ({vitals['cpu_percent']}%).",
                                  "Hardware monitor flagged high CPU."),
                            daemon=True
                        ).start()
                except Exception:
                    pass
                time.sleep(self.interval)
        threading.Thread(target=loop, daemon=True, name="HardwareMonitor").start()
        logger.info("Hardware monitor started (Thread: HardwareMonitor)")

    def stop_all(self):
        self.running = False


# ══════════════════════════════════════════════════════════════════════════════
@app.route('/emergency_ram_clear', methods=['POST'])
def emergency_ram_clear():
    """Emergency RAM clear endpoint - force terminate tasks and free memory."""
    try:
        result = SystemOptimizer.emergency_ram_clear()
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route('/close_browser_tabs', methods=['POST'])
def close_browser_tabs():
    """Close distracting browser tabs endpoint."""
    try:
        data = request.get_json() or {}
        max_tabs = data.get('max_tabs', 3)
        result = SystemOptimizer.close_browser_tabs(max_tabs=max_tabs)
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route('/system_vitals', methods=['GET'])
def system_vitals():
    """Get current system vitals endpoint."""
    try:
        vitals = SystemOptimizer.get_vitals()
        return jsonify(vitals)
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

# FLASK ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "online",
                    "message": "💻 Maeve PC Agent v4.0 ready",
                    "monitors": ["DisciplineMonitor", "HardwareMonitor"]})


@app.route('/execute', methods=['POST'])
def execute_command():
    data      = request.json or {}
    tool_call = data.get('tool_call', 'NONE')
    params    = data.get('tool_params', {})
    logger.info(f"▶ {tool_call} | {params}")

    try:

        # ── SYSTEM & HARDWARE ───────────────────────────────────────────────
        if tool_call == "CHECK_VITALS":
            return jsonify(os_manager.get_vitals())

        elif tool_call == "SYSTEM_STATS":          # alias
            return jsonify(os_manager.get_vitals())

        elif tool_call == "OPTIMIZE_PC":
            return jsonify(os_manager.emergency_ram_clear())
        
        elif tool_call == "CLOSE_BROWSER_TABS":
            max_tabs = params.get("max_tabs", 3)
            return jsonify(os_manager.close_browser_tabs(max_tabs=max_tabs))
        
        elif tool_call == "CLOSE_HIGH_RAM_TABS":
            return jsonify(os_manager.close_high_ram_tabs())

        elif tool_call == "SET_WORKFLOW":
            return jsonify(os_manager.setup_workflow(params.get("mode", "deep_work")))

        elif tool_call == "INTERVENE_STRESS":
            pyautogui.hotkey('win', 'd'); time.sleep(0.5)
            os.system('start spotify:search:lofi chill calm beats')
            time.sleep(2); pyautogui.press('enter')
            return jsonify({"status": "success",
                            "message": "Cleared screen and started calming music."})

        # ── SCREEN RECORDING ────────────────────────────────────────────────
        elif tool_call == "START_RECORDING":
            return jsonify(_recorder.start(fps=int(params.get("fps", 5))))

        elif tool_call == "STOP_RECORDING":
            return jsonify(_recorder.stop(save_dir=params.get("save_dir")))

        # ── MEDIA ───────────────────────────────────────────────────────────
        elif tool_call == "PLAY_MUSIC":
            song = (params.get("song_name") or params.get("search_query") or
                    params.get("query") or params.get("song") or "lofi")
            return jsonify(ExecutionEngine.play_spotify(song))

        elif tool_call == "TOGGLE_MUSIC":
            return jsonify(ExecutionEngine.toggle_spotify())

        elif tool_call == "PLAY_YOUTUBE":
            query = params.get("search_query") or params.get("query") or ""
            return jsonify(ExecutionEngine.youtube_learn(query))

        elif tool_call == "WATCH_CONTENT":
            platform  = params.get("platform", "nawatch").lower()
            show_name = params.get("show_name", "")
            if platform == "netflix":
                return jsonify(ExecutionEngine.watch_netflix(show_name))
            elif platform in ["amazon", "prime"]:
                url = f"https://www.amazon.com/s?k={urllib.parse.quote(show_name)}&i=instant-video"
                open_url(url)
                return jsonify({"status": "success", "platform": "amazon_prime", "url": url})
            else:
                return jsonify(ExecutionEngine.search_anime(show_name, platform))

        elif tool_call == "MEDIA_CONTROL":
            action = params.get("action", "playpause").lower()
            keys = {"up": "volumeup", "down": "volumedown", "mute": "volumemute",
                    "play": "playpause", "pause": "playpause",
                    "next": "nexttrack", "prev": "prevtrack"}
            if action in keys:
                pyautogui.press(keys[action])
                return jsonify({"status": "success", "action": action})
            return jsonify({"status": "error", "error": f"Unknown media action: {action}"}), 400

        # ── SYSTEM MAINTENANCE ────────────────────────────────────────────────
        elif tool_call == "EMERGENCY_RAM_CLEAR":
            return jsonify(SystemOptimizer.emergency_ram_clear())

        elif tool_call == "CLOSE_BROWSER_TABS":
            max_tabs = params.get("max_tabs", 3)
            return jsonify(SystemOptimizer.close_browser_tabs(max_tabs=max_tabs))

        elif tool_call == "GET_SYSTEM_VITALS":
            return jsonify(SystemOptimizer.get_vitals())

        # ── WHATSAPP / COMMUNICATION ────────────────────────────────────────
        elif tool_call == "SEND_WHATSAPP":
            contact = get_closest_contact(params.get("contact", ""))
            return jsonify(ExecutionEngine.send_whatsapp(contact, params.get("message", "")))

        elif tool_call == "MAKE_CALL":
            contact = get_closest_contact(params.get("contact", ""))
            return jsonify(ExecutionEngine.make_call(contact, params.get("type", "voice")))

        elif tool_call == "DISCONNECT_CALL":
            return jsonify(ExecutionEngine.disconnect_call())

        elif tool_call == "PICK_CALL":
            try: os.startfile("whatsapp:")
            except Exception: pass
            time.sleep(1.0)
            pyautogui.hotkey('ctrl', 'shift', 'a')
            return jsonify({"status": "success", "action": "call_accepted"})

        elif tool_call == "REJECT_CALL":
            try: os.startfile("whatsapp:")
            except Exception: pass
            time.sleep(1.0)
            pyautogui.hotkey('ctrl', 'shift', 'd')
            return jsonify({"status": "success", "action": "call_rejected"})

        elif tool_call == "SEND_VOICE_NOTE":
            contact = params.get("contact", "")
            if not contact:
                return jsonify({"status": "error", "error": "contact required"}), 400
            return jsonify(ExecutionEngine.send_voice_note(contact, int(params.get("duration", 5))))

        # ── EMAIL ───────────────────────────────────────────────────────────
        elif tool_call == "SEND_EMAIL":
            to      = params.get("to", "")
            subject = params.get("subject", "(no subject)")
            body    = params.get("body", "")
            method  = params.get("method", "smtp").lower()
            if not to:
                return jsonify({"status": "error", "error": "'to' is required"}), 400
            if method == "browser":
                return jsonify(open_gmail_compose(to, subject, body))
            return jsonify(send_email_smtp(to, subject, body))

        # ── FILE OPERATIONS ─────────────────────────────────────────────────
        elif tool_call == "SEARCH_FILE":
            filename    = params.get("filename") or params.get("query") or ""
            max_results = int(params.get("max_results", 10))
            auto_open   = params.get("auto_open", False)
            if not filename:
                return jsonify({"status": "error", "error": "filename required"}), 400
            results = search_file(filename, max_results)
            if not results:
                return jsonify({"status": "not_found", "query": filename, "results": []})
            resp = {"status": "success", "query": filename, "results": results}
            if auto_open and results:
                try:
                    os.startfile(results[0]); resp["opened"] = results[0]
                except Exception as e:
                    resp["open_error"] = str(e)
            return jsonify(resp)

        elif tool_call == "OPEN_FILE":
            filepath = params.get("filepath") or params.get("path") or ""
            if not filepath:
                return jsonify({"status": "error", "error": "filepath required"}), 400
            if not os.path.exists(filepath):
                results = search_file(filepath, max_results=1)
                if results:
                    filepath = results[0]
                else:
                    return jsonify({"status": "error",
                                    "error": f"File not found: {filepath}"}), 404
            try:
                os.startfile(filepath)
                return jsonify({"status": "success", "opened": filepath})
            except Exception as e:
                return jsonify({"status": "error", "error": str(e)}), 500

        # ── APPS ────────────────────────────────────────────────────────────
        elif tool_call == "OPEN_APP":
            app_name = params.get("app_name", "").lower()
            websites = {"aniwatch": "https://aniwatchtv.to",
                        "chatgpt": "https://chatgpt.com",
                        "gemini": "https://gemini.google.com",
                        "claude": "https://claude.ai",
                        "youtube": "https://youtube.com",
                        "github": "https://github.com"}
            direct   = {"spotify": "start spotify:", "whatsapp": "start whatsapp:",
                        "vscode": "code", "vs code": "code",
                        "windsurf": "start windsurf",
                        "notepad": "start notepad", "discord": "start discord",
                        "steam": "start steam://open/main"}
            if app_name in websites:
                open_url(websites[app_name])
            elif app_name in direct:
                os.system(direct[app_name])
            else:
                pyautogui.hotkey('win', 's'); time.sleep(0.8)
                clear_and_type(app_name); time.sleep(0.8)
                pyautogui.press('enter')
            return jsonify({"status": "success", "opened": app_name})

        elif tool_call == "OPEN_WEBSITE":
            url = params.get("url") or params.get("site") or params.get("query") or ""
            return jsonify(ExecutionEngine.open_website(url))

        elif tool_call == "ASK_AI":
            return jsonify(ExecutionEngine.ask_ai(
                params.get("prompt", "Hello"),
                ai=params.get("ai_name", "chatgpt").lower()
            ))

        elif tool_call == "VSCODE_HELP":
            return jsonify(ExecutionEngine.ask_ai(
                params.get("prompt") or params.get("code", ""), ai="chatgpt"))

        elif tool_call == "WINDSURF_HELP":
            return jsonify(ExecutionEngine.ask_ai(
                params.get("prompt") or params.get("code", ""), ai="claude"))

        # ── WINDOW CONTROL ──────────────────────────────────────────────────
        elif tool_call == "WINDOW_CONTROL":
            action = params.get("action", "minimize_all").lower()
            if action == "minimize_all":
                pyautogui.hotkey('win', 'd'); msg = "Minimized all windows"
            elif action == "close_current":
                pyautogui.hotkey('alt', 'f4'); msg = "Closed active window"
            elif action == "maximize":
                pyautogui.hotkey('win', 'up'); msg = "Maximized window"
            else:
                msg = f"Unknown action: {action}"
            return jsonify({"status": "success", "action": action, "message": msg})

        # ── MISC SYSTEM ─────────────────────────────────────────────────────
        elif tool_call == "TAKE_SCREENSHOT":
            save_dir = os.path.join(os.getcwd(), "maeve_memory")
            os.makedirs(save_dir, exist_ok=True)
            ts = time.strftime("%Y%m%d-%H%M%S")
            fp = os.path.join(save_dir, f"screenshot_{ts}.png")
            pyautogui.screenshot(fp)
            return jsonify({"status": "success", "saved": fp})

        elif tool_call == "OPEN_FOLDER":
            folder = params.get("folder", "downloads").lower()
            paths  = {"downloads": os.path.join(_HOME, "Downloads"),
                      "documents": os.path.join(_HOME, "Documents"),
                      "pictures":  os.path.join(_HOME, "Pictures"),
                      "desktop":   os.path.join(_HOME, "Desktop"),
                      "c_drive": "C:\\", "d_drive": "D:\\"}
            target = paths.get(folder, paths["downloads"])
            if os.path.exists(target):
                os.startfile(target)
                return jsonify({"status": "success", "folder": target})
            return jsonify({"status": "error", "error": f"Folder not found: {folder}"}), 404

        elif tool_call == "TYPE_TEXT":
            paste_text(params.get("text", ""),
                       press_enter=params.get("press_enter", False))
            return jsonify({"status": "success"})

        elif tool_call == "ADD_CONTACT":
            name = params.get("name", "").strip()
            if not name:
                return jsonify({"status": "error", "error": "name required"}), 400
            return jsonify({"status": "success",
                            "message": save_contact(name, params.get("role", "FRIEND"))})

        elif tool_call == "CREATE_EXCEL":
            filename    = params.get("filename", "Report").replace(" ", "_") + ".csv"
            data_string = params.get("data", "")
            filepath    = os.path.join(_HOME, "Desktop", filename)
            import csv
            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                for row in data_string.split(';'):
                    if row.strip():
                        writer.writerow(row.split(','))
            os.startfile(filepath)
            return jsonify({"status": "success", "file": filepath})

        elif tool_call == "STOP_DISTRACTION":
            print("Maeve is taking control: Punishing for distraction!")
            
            # 1. Pehle ek Warning Beep bajao
            try:
                winsound.Beep(1000, 500) 
            except:
                pass
                
            # 2. Smart tab closing - close multiple distracting tabs
            result = os_manager.close_browser_tabs(max_tabs=3)
            
            # 3. Agar user bohot ziddi hai, toh sab kuch minimize kar do (Win + D)
            pyautogui.hotkey('win', 'd')
            
            return jsonify({
                "status": "success", 
                "message": f"Closed {result['tabs_closed']} distracting tabs and minimized windows.",
                "tabs_closed": result['tabs_closed'],
                "browsers_targeted": result['browsers_targeted']
            })

        elif tool_call == "SHUTDOWN_PC":
            subprocess.run(["shutdown", "/s", "/t", "30"])
            return jsonify({"status": "success", "message": "Shutdown in 30 seconds"})

        elif tool_call == "CANCEL_SHUTDOWN":
            subprocess.run(["shutdown", "/a"])
            return jsonify({"status": "success", "message": "Shutdown cancelled"})

        elif tool_call == "RESTART_PC":
            subprocess.run(["shutdown", "/r", "/t", "15"])
            return jsonify({"status": "success", "message": "Restart in 15 seconds"})

        elif tool_call == "OPEN_NOTEPAD":
            os.system("start notepad")
            return jsonify({"status": "success", "message": "Notepad opened"})

        else:
            return jsonify({"status": "error",
                            "error": f"Unknown tool_call: '{tool_call}'"}), 400

    except Exception as e:
        logger.error(f"Execution error [{tool_call}]: {e}", exc_info=True)
        return jsonify({"status": "error", "tool_call": tool_call,
                        "error": str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("=" * 60)
    print("💻 MAEVE PC Agent v4.0 — Unified Execution Engine")
    print("=" * 60)

    monitors = MonitorThreads(interval=60)
    monitors.start_discipline_monitor()
    monitors.start_hardware_monitor()
    print("✅ All monitors active (zero PC lag — threaded)")

    app.run(host='127.0.0.1', port=5001, debug=False)
