# 🌌 Maeve AI: The Future of Interactive 3D Assistance

![Maeve AI Banner](./frontend/public/banner.png)

[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.dot-js&logoColor=white)](https://threejs.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)

**Maeve AI** is a state-of-the-art, immersive 3D AI assistant platform. It combines a high-fidelity 3D HUD with a sophisticated Python-based "Human Brain" backend to create a truly responsive and proactive digital companion.

---

## 🛠️ How the System Works

Maeve AI is built on a distributed architecture where the **3D HUD** (Frontend) and the **Intelligence Engine** (Backend) communicate in real-time via high-speed WebSockets.

### 1. The Human Brain (Backend)
The backend is a sophisticated Python ecosystem designed for low-latency AI orchestration.
- **AGI Kernel**: Powered by a custom-tuned **Ollama** model (`maeve-god`) with cloud fallbacks to **Gemini 2.5 Flash** and **Groq (Llama-3.3-70b)**.
- **Personality Engine**: Features 18+ dynamic personas (Yandere, Tsundere, Goth Mommy, Dominant, etc.) that adapt their speech, emotions, and animations in real-time.
- **Relationship Brain**: A complex state machine that tracks user trust, intimacy, and psychological profiles to influence interaction depth.
- **Memory Engine**: Utilizes "Core Memories" triggered by emotional keywords and long-term chat history storage.

### 2. Proactive Initiative & Vision
Unlike standard assistants, Maeve is **proactive**.
- **Omniscient Vision**: Integrated vision server using **YOLOv8** and **Mediapipe** to detect user activity, exhaustion, or distractions (e.g., gaming instead of working).
- **Proactive Alerts**: Maeve can initiate conversations based on visual triggers (e.g., scolding you for working too late) or idle timeouts.
- **Nagging Engine**: A background service that periodically checks in on your wellness and productivity.

### 3. System Integration & Tool Dispatch
Maeve has direct control over your environment via a 3-tier tool system:
- **Autonomous Tools**: Real-time media control, music playback, and screen analysis.
- **System Commands**: Control PC power states, window management, system volume, and hardware monitoring.
- **Platform Tools**: Send WhatsApp messages, emails, or search the web for real-time news.

### 4. High-Fidelity 3D HUD (Frontend)
- **VRM Controller**: Uses `@pixiv/three-vrm` for character physics, gaze tracking, and blend-shape expressions.
- **Audio-Visual Sync**: Real-time lip-syncing powered by the backend's **Kokoro ONNX** TTS engine and **SFX** generation.

---

## ✨ Core Features

| Feature | Description |
| :--- | :--- |
| **🎭 Multi-Persona** | Switch between 18+ distinct personalities with unique rules and boundaries. |
| **🧠 Memory Retrieval** | Recalls past interactions and core emotional memories to build a long-term bond. |
| **👁️ Vision Awareness** | Detects objects, people, and user frustration via webcam/screen analysis. |
| **🕹️ PC Automation** | Control your apps, windows, and system settings via natural language commands. |
| **🗣️ Neural TTS** | Ultra-realistic voice synthesis using Kokoro and Edge-TTS. |
| **🌐 Omniscient Search** | Real-time web searching to provide live data on any topic. |
| **📈 Habit Tracking** | Monitors coding sessions, gaming time, and productivity scores. |

---

## 💻 Installation & Setup

### Backend Prerequisites
- Python 3.10+
- [Ollama](https://ollama.com/) (with `maeve-god` model installed)
- [FFmpeg](https://ffmpeg.org/) (for audio processing)

### Backend Installation

1. **Navigate to the backend folder:**
   ```bash
   cd backend
   ```

2. **Create a Virtual Environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configuration:**
   - Copy `.env.example` to `.env`.
   - Add your `GEMINI_API_KEY` or `GROQ_API_KEY` for cloud fallbacks.

5. **Start the Brain:**
   ```bash
   python app.py
   ```

### Frontend Installation
Refer to the [Frontend README](./frontend/README.md) for detailed UI setup.

---

## 🏗️ Backend Structure

```text
backend/
├── audio/          # TTS (Kokoro/Edge) and SFX Engines
├── core/           # Relationship Brain, Memory, and Persona Logic
├── llm/            # Ollama and Cloud API Clients (Gemini/Groq)
├── routes/         # Flask/Socket.io Blueprints (Chat, PC, Proactive)
├── utils/          # Web search, typo engine, and environment utils
├── app.py          # Main entry point (Asynchronous Gevent Server)
└── requirements.txt # Python dependencies
```

---

## 📦 Key Dependencies

- **AI**: `google-genai`, `requests` (Ollama), `faster-whisper`.
- **Vision**: `deepface`, `ultralytics` (YOLOv8), `mediapipe`, `opencv-python`.
- **Audio**: `kokoro-onnx`, `edge-tts`, `pydub`, `sounddevice`.
- **System**: `pyautogui`, `psutil`, `pygetwindow`, `pytesseract`.
- **Web**: `flask-socketio`, `fastapi`, `uvicorn`, `beautifulsoup4`.

---

> [!IMPORTANT]
> **Privacy Note**: Maeve utilizes local camera and screen data for proactive features. All visual processing is done locally unless specifically configured for cloud analysis.

> [!TIP]
> Use the **Settings Screen** in the HUD to toggle between different AI providers (Local Ollama vs Cloud Gemini) for optimal performance.

---

*Built with ❤️ by the Maeve AI Team.*
