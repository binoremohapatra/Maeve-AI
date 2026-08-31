import os
#!/usr/bin/env python3
"""
Proactive Initiative Engine
Feature 3: The AI companion initiates conversations when user is idle
"""

import time
import threading
import requests
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

class ProactiveInitiativeEngine:
    """Handles proactive conversation initiation based on user inactivity"""
    
    def __init__(self):
        self.last_interaction_time = time.time()
        self.idle_threshold_seconds = 60  # TESTING: Set to 60 seconds for easy testing
        # PRODUCTION: Change to 14400 (4 hours) after testing
        self.is_running = False
        self.initiative_thread = None
        
    def update_interaction_time(self):
        """Call this whenever user interacts with the system"""
        self.last_interaction_time = time.time()
        logger.debug(f"Updated last interaction time: {datetime.now().strftime('%H:%M:%S')}")
    
    def check_user_activity(self) -> bool:
        """Check if user is currently active (PC is being used)"""
        try:
            import pygetwindow as gw
            window = gw.getActiveWindow()
            if window and window.title:
                # If there's an active window, user is likely active
                return True
        except Exception as e:
            logger.debug(f"Could not check user activity: {e}")
        
        # Fallback: Assume user is active if we can't detect
        return True
    
    def trigger_proactive_conversation(self):
        """Trigger a proactive conversation via backend API"""
        try:
            # Use the existing proactive endpoint
            url = os.getenv("BRAIN_SERVICE_URL", "http://127.0.0.1:5000") + "/api/proactive/idle_check"
            
            payload = {
                "trigger_type": "idle_timeout",
                "idle_duration": int(time.time() - self.last_interaction_time),
                "timestamp": datetime.now().isoformat()
            }
            
            logger.info(f"Triggering proactive conversation after {payload['idle_duration']} seconds of inactivity")
            
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            logger.info(f"Proactive conversation triggered: {result.get('status', 'unknown')}")
            
            return True
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to trigger proactive conversation: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error in proactive trigger: {e}")
            return False
    
    def idle_monitor_loop(self):
        """Background thread that monitors user inactivity"""
        logger.info("Starting idle monitor loop...")
        
        while self.is_running:
            try:
                current_time = time.time()
                idle_duration = current_time - self.last_interaction_time
                
                # Check if user has been idle for longer than threshold
                if idle_duration > self.idle_threshold_seconds:
                    # Check if user is currently active (PC is being used)
                    if self.check_user_activity():
                        logger.info(f"User has been idle for {idle_duration:.0f} seconds and PC is active")
                        
                        # Trigger proactive conversation
                        if self.trigger_proactive_conversation():
                            # Update interaction time to prevent immediate re-trigger
                            self.update_interaction_time()
                    else:
                        logger.debug("PC appears inactive, skipping proactive trigger")
                
                # Sleep for a reasonable interval before checking again
                time.sleep(300)  # Check every 5 minutes
                
            except Exception as e:
                logger.error(f"Error in idle monitor loop: {e}")
                time.sleep(60)  # Wait 1 minute before retrying
        
        logger.info("Idle monitor loop stopped")
    
    def start_monitoring(self):
        """Start the idle monitoring background thread"""
        if self.is_running:
            logger.warning("Idle monitoring is already running")
            return
        
        self.is_running = True
        self.initiative_thread = threading.Thread(target=self.idle_monitor_loop, daemon=True)
        self.initiative_thread.start()
        logger.info(f"Started proactive initiative engine (idle threshold: {self.idle_threshold_seconds}s)")
    
    def stop_monitoring(self):
        """Stop the idle monitoring background thread"""
        if not self.is_running:
            logger.warning("Idle monitoring is not running")
            return
        
        self.is_running = False
        if self.initiative_thread and self.initiative_thread.is_alive():
            self.initiative_thread.join(timeout=5)
        
        logger.info("Stopped proactive initiative engine")
    
    def set_idle_threshold(self, seconds: int):
        """Update the idle threshold (for testing)"""
        self.idle_threshold_seconds = seconds
        logger.info(f"Updated idle threshold to {seconds} seconds")

# Global instance
initiative_engine = ProactiveInitiativeEngine()

def update_user_interaction():
    """Convenience function to update user interaction time"""
    initiative_engine.update_interaction_time()

def start_proactive_monitoring():
    """Convenience function to start proactive monitoring"""
    initiative_engine.start_monitoring()

def stop_proactive_monitoring():
    """Convenience function to stop proactive monitoring"""
    initiative_engine.stop_monitoring()

if __name__ == "__main__":
    # Test the proactive initiative engine
    print("Testing Proactive Initiative Engine...")
    
    # Start monitoring
    start_proactive_monitoring()
    
    # Simulate user interaction
    update_user_interaction()
    
    print("Proactive monitoring started. Press Ctrl+C to stop...")
    
    try:
        while True:
            time.sleep(10)
            print(f"Monitoring... Last interaction: {datetime.fromtimestamp(initiative_engine.last_interaction_time).strftime('%H:%M:%S')}")
    except KeyboardInterrupt:
        print("\nStopping monitoring...")
        stop_proactive_monitoring()
