from flask import Blueprint, request, jsonify

pc_bp = Blueprint('pc_bp', __name__)

@pc_bp.route('/api/pc/control', methods=['POST'])
def pc_control():
    """Remote PC control via Cloudflare Tunnel"""
    data = request.json
    command = data.get('command')
    
    if command == 'shutdown':
        # Graceful shutdown command
        print("🔥 Remote shutdown command received")
        # Add actual shutdown logic here
        return jsonify({"status": "success", "message": "PC shutdown initiated"})
    elif command == 'restart':
        print("🔄 Remote restart command received")
        # Add restart logic here
        return jsonify({"status": "success", "message": "PC restart initiated"})
    elif command == 'status':
        # Get PC status
        return jsonify({
            "status": "online",
            "uptime": "System running",
            "memory": "Available"
        })
    else:
        return jsonify({"status": "error", "message": "Unknown command"})

@pc_bp.route('/api/pc/apps', methods=['GET'])
def get_installed_apps():
    """Get list of safe applications that can be opened"""
    safe_apps = {
        "browsers": ["chrome", "firefox", "edge", "opera"],
        "development": ["vs code", "intellij", "windsurf", "github desktop"],
        "media": ["spotify", "vlc", "netflix", "youtube"],
        "communication": ["whatsapp", "discord", "slack", "telegram"],
        "productivity": ["notion", "obsidian", "todoist", "trello"]
    }
    
    return jsonify({
        "status": "success",
        "categories": safe_apps,
        "total_apps": sum(len(apps) for apps in safe_apps.values())
    })

@pc_bp.route('/api/pc/system_info', methods=['GET'])
def get_system_info():
    """Get basic system information"""
    import platform
    import psutil
    
    try:
        system_info = {
            "os": platform.system(),
            "os_version": platform.version(),
            "architecture": platform.architecture()[0],
            "processor": platform.processor(),
            "memory": {
                "total": f"{psutil.virtual_memory().total / (1024**3):.1f} GB",
                "available": f"{psutil.virtual_memory().available / (1024**3):.1f} GB",
                "percent_used": f"{psutil.virtual_memory().percent:.1f}%"
            },
            "disk": {
                "total": f"{psutil.disk_usage('/').total / (1024**3):.1f} GB",
                "used": f"{psutil.disk_usage('/').used / (1024**3):.1f} GB",
                "free": f"{psutil.disk_usage('/').free / (1024**3):.1f} GB"
            }
        }
        
        return jsonify({"status": "success", "system_info": system_info})
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
