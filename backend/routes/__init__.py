"""
Routes Module
All API endpoints and controllers
"""

from .chat_routes import chat_bp
from .schedule_routes import schedule_bp
from .sync_routes import sync_bp
from .pc_routes import pc_bp
from .proactive_routes import proactive_bp
from .health_routes import health_bp

__all__ = [
    'chat_bp',
    'schedule_bp',
    'sync_bp', 
    'pc_bp',
    'proactive_bp',
    'health_bp'
]
