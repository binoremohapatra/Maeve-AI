import subprocess
import time
import sys
import os

# Background processes tracking
hidden_processes = []

def start_hidden_service(command, cwd_path):
    """This keeps services completely hidden (Ghost Mode)"""
    CREATE_NO_WINDOW = 0x08000000
    
    try:
        p = subprocess.Popen(
            command,
            cwd=cwd_path,
            creationflags=CREATE_NO_WINDOW,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        hidden_processes.append(p)
    except Exception as e:
        pass

def kill_existing_services():
    """Kill existing services on all required ports"""
    ports = [5000, 5001, 5002, 5003, 5005, 8080, 3001]
    for port in ports:
        try:
            subprocess.run(
                f'for /f "tokens=5" %a in (\'netstat -aon ^| findstr :{port}\') do taskkill /f /pid %a 2>nul',
                shell=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except:
            pass

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "backend")
    venv_python = os.path.join(backend_dir, "venv", "Scripts", "python.exe")
    
    # Clean up any existing services
    kill_existing_services()
    time.sleep(2)
    
    # 1. Start background services (no taskbar icons) - only if files exist
    if os.path.exists(os.path.join(backend_dir, "app.py")):
        start_hidden_service([venv_python, "app.py"], backend_dir)  # Brain (Port 5000)
        time.sleep(2)
    
    if os.path.exists(os.path.join(backend_dir, "services", "stealth_mic.py")):
        start_hidden_service([venv_python, "services/stealth_mic.py"], backend_dir)  # Stealth Mic
        time.sleep(2)
    
    if os.path.exists(os.path.join(backend_dir, "services", "pc_agent_v4.py")):
        start_hidden_service([venv_python, "services/pc_agent_v4.py"], backend_dir)  # PC Agent (Port 5001)
        time.sleep(2)
    
    if os.path.exists(os.path.join(backend_dir, "services", "vision_server.py")):
        start_hidden_service([venv_python, "services/vision_server.py"], backend_dir)  # Vision Service (Port 5003)
        time.sleep(2)
    
    if os.path.exists(os.path.join(backend_dir, "services", "agi_supervisor_v3.py")):
        start_hidden_service([venv_python, "services/agi_supervisor_v3.py"], backend_dir)  # AGI Supervisor (Port 5005)
        time.sleep(2)
    
    if os.path.exists(os.path.join(backend_dir, "audio", "tts_server.py")):
        start_hidden_service([venv_python, "audio/tts_server.py"], backend_dir)  # Audio Engine (Port 5002)
        time.sleep(2)
    
    # Check for Java JAR file
    jar_files = []
    if os.path.exists(os.path.join(backend_dir, "target")):
        for file in os.listdir(os.path.join(backend_dir, "target")):
            if file.endswith(".jar"):
                jar_files.append(file)
    
    if jar_files:
        start_hidden_service(["javaw", "-jar", f"target/{jar_files[0]}"], backend_dir)  # Java Backend (Port 8080)
        time.sleep(5)  # Java needs time to start
    
    # 2. Start main frontend (this will show on screen and taskbar)
    # Check if React dev server needs to be started
    frontend_dir = os.path.join(base_dir, "src")
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    
    if os.path.exists(frontend_dir) and os.path.exists(os.path.join(frontend_dir, "package.json")):
        try:
            # Try to start React dev server first
            subprocess.Popen(
                ["npm", "run", "dev", "--", "--host"],
                cwd=frontend_dir,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            time.sleep(8)  # Wait for React to start
        except:
            pass
    
    # Open frontend in Chrome app mode
    if os.path.exists(chrome_path):
        frontend_command = [chrome_path, "--app=http://localhost:3001"]
    else:
        # Fallback to default browser
        frontend_command = ["start", "http://localhost:3001"]
    
    ui_process = subprocess.Popen(frontend_command)
    
    # 3. Keep launcher alive until frontend is closed
    ui_process.wait()
    
    # 4. When user closes frontend (game), kill all background processes
    for p in hidden_processes:
        try:
            p.terminate()
        except:
            pass
    
    # Final cleanup
    kill_existing_services()

if __name__ == "__main__":
    main()
