#!/usr/bin/env python3
"""
Startup Script for Proactive Initiative Engine
Start the background monitoring for user inactivity
"""

import logging
import time
from proactive_initiative_engine import start_proactive_monitoring

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger("STARTUP")

def main():
    """Start the proactive initiative engine"""
    logger.info("Starting Maeve Proactive Initiative Engine...")
    logger.info("Current idle threshold: 60 seconds (testing mode)")
    logger.info("To change to production mode, set idle_threshold_seconds to 14400 (4 hours)")
    
    try:
        # Start the background monitoring
        start_proactive_monitoring()
        
        logger.info("Proactive engine started successfully!")
        logger.info("The AI will now initiate conversations when you're idle")
        logger.info("Press Ctrl+C to stop the engine")
        
        # Keep the main thread alive
        while True:
            time.sleep(10)
            
    except KeyboardInterrupt:
        logger.info("Stopping proactive engine...")
        from proactive_initiative_engine import stop_proactive_monitoring
        stop_proactive_monitoring()
        logger.info("Proactive engine stopped")
        
    except Exception as e:
        logger.error(f"Error starting proactive engine: {e}")

if __name__ == "__main__":
    main()
