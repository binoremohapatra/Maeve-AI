from datetime import datetime
from flask import Blueprint, jsonify

health_bp = Blueprint('health_bp', __name__)

@health_bp.route('/ping', methods=['GET', 'POST'])
def ping():
   
    return jsonify({"status": "online", "message": "Neural Link Active"}), 200

@health_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "success", 
        "brain": "hybrid",
        "message": "All systems nominal",
        "timestamp": datetime.now().isoformat()
    }), 200

@health_bp.route('/health/detailed', methods=['GET'])
def detailed_health():
    """Comprehensive health check of all services"""
    import requests
    
    services = {
        "main_app": {"status": "unknown", "port": 5000},
        "stt_service": {"status": "unknown", "port": 5002},
        "pc_agent": {"status": "unknown", "port": 5001},
        "vision_service": {"status": "unknown", "port": 5003}
    }
    
    # Check each service
    service_urls = {
        "main_app": "http://localhost:5000/ping",
        "stt_service": "http://localhost:5002/status",
        "pc_agent": "http://localhost:5001/status",
        "vision_service": "http://localhost:5003/status"
    }
    
    for service_name, url in service_urls.items():
        try:
            response = requests.get(url, timeout=2)
            if response.status_code == 200:
                services[service_name]["status"] = "online"
            else:
                services[service_name]["status"] = "error"
        except:
            services[service_name]["status"] = "offline"
    
    online_count = sum(1 for s in services.values() if s["status"] == "online")
    total_services = len(services)
    
    return jsonify({
        "status": "success",
        "services": services,
        "summary": {
            "total_services": total_services,
            "online_services": online_count,
            "offline_services": total_services - online_count,
            "overall_health": "healthy" if online_count == total_services else "degraded"
        },
        "timestamp": datetime.now().isoformat()
    })
