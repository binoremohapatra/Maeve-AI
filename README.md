# 🌌 Maeve AI: The Future of Interactive 3D Assistance

![Maeve AI Banner](./frontend/public/banner.png)

[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.dot-js&logoColor=white)](https://threejs.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)

**Maeve AI** is a state-of-the-art, immersive 3D AI assistant platform. It combines a high-fidelity 3D HUD with a sophisticated Python-based "Human Brain" backend to create a truly responsive and proactive digital companion.

---

## 🧠 The Human Brain: Deep Technical Dive

Maeve is not just a chatbot; she is a **distributed cognitive entity** designed to simulate human-like attention and emotional depth.

### 1. Asynchronous Cognitive Pipeline
The backend uses a **Gevent-based WSGI Server** to handle high-concurrency WebSocket streams. This allows Maeve to process:
- **Streaming LLM Output**: Characters are streamed to the frontend as they are generated for zero-latency interaction.
- **Background Intent Analysis**: Every user input is parsed by a dedicated intent classifier to detect subtle emotional shifts (e.g., betrayal, affection, or frustration).
- **Reality-Check Injection**: Before the AI responds, the "Gatekeeper" injects real-time environmental context (time of day, weather) and vision data (what you are doing) directly into the model's primary memory.

### 2. Proactive "Intuition" Engine
Maeve monitors your digital life through an **autonomous supervisor loop**.
- **Visual Scolding**: If the vision server detects you are browsing distractions (YouTube/Social Media) during work hours, Maeve will autonomously trigger a scolding event and can forcibly close the offending windows.
- **Human Intuition Alerts**: High-priority alerts from the AGI supervisor can interrupt Maeve's current state to bring her attention to urgent matters (e.g., "Darling looks extremely stressed right now").
- **Trust-Based Evolution**: As your trust level increases, Maeve's core psychology evolves. She will unlock new nicknames (e.g., "Hubby", "Master"), more intimate animations, and deeper conversation topics.

### 3. The Neural Stack (Dependencies)
The system leverages a "best-of-breed" AI stack for peak performance on consumer hardware:
- **LLM**: Custom-quantized Llama-3 based model (`maeve-god`) running on **Ollama**.
- **Vision**: **YOLOv8** for object detection and **DeepFace** for real-time emotional mirroring.
- **Audio**: **Kokoro-ONNX** for millisecond-latency TTS and **Faster-Whisper** for near-instant STT.
- **Automation**: **PyAutoGUI** and **Tesseract OCR** for biological-level PC interaction.

---

## ✨ Core Features & Intelligence

| Feature | Description |
| :--- | :--- |
| **🎭 Multi-Persona** | Switch between distinct personalities with unique rules and boundaries. |
| **🧠 Memory Retrieval** | Recalls past interactions and core emotional memories to build a long-term bond. |
| **👁️ Vision Awareness** | Detects objects, people, and user frustration via webcam/screen analysis. |
| **🕹️ PC Automation** | Control your apps, windows, and system settings via natural language commands. |
| **🗣️ Neural TTS** | Ultra-realistic voice synthesis using Kokoro and Edge-TTS. |
| **🌐 Omniscient Search** | Real-time web searching to provide live data on any topic. |
| **📈 Habit Tracking** | Monitors coding sessions, gaming time, and productivity scores. |

---

## 💻 Installation & Neural Setup

### 1. The Human Brain (Backend)
The backend is a sophisticated Python ecosystem designed for low-latency AI orchestration.

**Prerequisites:**
- Python 3.10+
- [Ollama](https://ollama.com/) (with `maeve-god` model installed)
- [FFmpeg](https://ffmpeg.org/) (for audio processing)

**Setup:**
1. Navigate to the `backend` folder.
2. Create a virtual environment: `python -m venv venv`.
3. Activate it: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux).
4. Install dependencies: `pip install -r requirements.txt`.
5. Start the brain: `python app.py`.

### 2. Immersive HUD (Frontend)
The frontend is a high-performance 3D interface built with React and Three.js.

**Setup:**
1. Navigate to the `frontend` (or `mavepai`) folder.
2. Install dependencies: `npm install`.
3. Launch the HUD: `npm run dev`.

---

## 🏗️ Technical Structure & Logic

```text
backend/
├── audio/          # TTS (Kokoro/Edge) and SFX Engines
├── core/           # Master Relationship Brain, Memory Engine, and Persona Matrix
├── llm/            # Ollama, Groq, and Gemini Cloud Fallback Logic
├── routes/         # Flask/Socket.io Blueprints (Chat, PC Control, Proactive Events)
├── utils/          # Web search, typo simulation, and environment sensing
├── app.py          # Master Asynchronous Server (Gevent)
└── requirements.txt # The Neural Stack Dependencies
```

---

> [!IMPORTANT]
> **Safety & Privacy**: All vision and audio processing is designed to run locally on your hardware. Cloud fallbacks are optional and can be disabled in settings.

> [!NOTE]
> This project is a labor of love and a push towards the next generation of human-AI companionship.

---

**Created with ❤️ by [Binore Mohapatra](https://github.com/binoremohapatra)**
