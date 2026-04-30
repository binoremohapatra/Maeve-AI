#!/usr/bin/env python3
"""
Environmental Awareness Utility
Provides real-time context about time and weather for Delhi, India
"""

import time
import requests
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class EnvironmentAwareness:
    """Handles real-time environmental context for AI companion"""
    
    def __init__(self):
        self.weather_cache = {}
        self.weather_cache_duration = 3600  # 1 hour cache
        self.location = "Delhi, India"
        
    def get_current_time_context(self) -> str:
        """Get current time context string"""
        try:
            # Get current time in Delhi timezone (UTC+5:30)
            now = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=5, minutes=30)))
            time_str = now.strftime("%I:%M %p")
            hour = now.hour
            
            # Determine time of day for more natural context
            if 5 <= hour < 12:
                time_context = f"morning ({time_str})"
            elif 12 <= hour < 17:
                time_context = f"afternoon ({time_str})"
            elif 17 <= hour < 21:
                time_context = f"evening ({time_str})"
            elif 21 <= hour < 24 or 0 <= hour < 2:
                time_context = f"night ({time_str})"
            else:
                time_context = f"late night ({time_str})"
                
            return time_context
            
        except Exception as e:
            logger.error(f"Error getting time context: {e}")
            return "unknown time"
    
    def get_weather_context(self) -> str:
        """Get current weather context with caching"""
        try:
            current_time = time.time()
            
            # Check cache
            if self.weather_cache and current_time - self.weather_cache.get("timestamp", 0) < self.weather_cache_duration:
                return self.weather_cache.get("context", "unknown weather")
            
            # Fetch fresh weather data from wttr.in (free, no API key needed)
            url = f"https://wttr.in/Delhi?format=j1"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Extract relevant weather information
            current = data.get("current_condition", [{}])[0]
            temp_c = current.get("temp_C", "unknown")
            weather_desc = current.get("weatherDesc", [{}])[0].get("value", "unknown").lower()
            humidity = current.get("humidity", "unknown")
            
            # Create natural weather context
            if "rain" in weather_desc or "shower" in weather_desc:
                weather_context = f"raining ({temp_c}°C)"
            elif "clear" in weather_desc or "sunny" in weather_desc:
                weather_context = f"clear and sunny ({temp_c}°C)"
            elif "cloud" in weather_desc or "overcast" in weather_desc:
                weather_context = f"cloudy ({temp_c}°C)"
            elif "snow" in weather_desc:
                weather_context = f"snowing ({temp_c}°C)"
            elif "fog" in weather_desc or "mist" in weather_desc:
                weather_context = f"foggy ({temp_c}°C)"
            else:
                weather_context = f"{weather_desc} ({temp_c}°C)"
            
            # Cache the result
            self.weather_cache = {
                "context": weather_context,
                "timestamp": current_time,
                "full_data": data
            }
            
            logger.info(f"Weather updated: {weather_context}")
            return weather_context
            
        except Exception as e:
            logger.error(f"Error fetching weather: {e}")
            # Return cached data if available, otherwise unknown
            return self.weather_cache.get("context", "unknown weather")
    
    def get_environmental_context(self) -> str:
        """Get complete environmental context string"""
        time_context = self.get_current_time_context()
        weather_context = self.get_weather_context()
        
        return f"[REAL WORLD CONTEXT: It is currently {time_context}. The weather in {self.location} is {weather_context}.]"

# Global instance
env_awareness = EnvironmentAwareness()

def get_environmental_context() -> str:
    """Convenience function to get environmental context"""
    return env_awareness.get_environmental_context()

if __name__ == "__main__":
    # Test the environment awareness
    print("Testing Environment Awareness...")
    print(get_environmental_context())
