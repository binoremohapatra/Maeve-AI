#!/usr/bin/env python3
"""
🧠 Maeve's Habit Memory Engine
Tracks user's daily patterns and creates contextual responses
"""

import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any
import logging

logger = logging.getLogger(__name__)

class HabitMemoryEngine:
    def __init__(self):
        self.memory_file = "data/habit_memory.json"
        self.habits = self.load_memory()
        
    def load_memory(self) -> Dict:
        """Load habit memory from file"""
        try:
            with open(self.memory_file, 'r') as f:
                return json.load(f)
        except:
            return {
                "daily_patterns": {},
                "productivity_stats": {
                    "coding_hours": 0,
                    "gaming_hours": 0,
                    "productive_sessions": 0,
                    "distraction_count": 0
                },
                "health_tracking": {
                    "posture_alerts": 0,
                    "break_reminders": 0,
                    "sleep_schedule": {}
                },
                "relationship_events": []
            }
    
    def save_memory(self):
        """Save habit memory to file"""
        try:
            with open(self.memory_file, 'w') as f:
                json.dump(self.habits, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save memory: {e}")
    
    def track_activity(self, activity_type: str, details: Dict[str, Any]):
        """Track a new activity"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        if today not in self.habits["daily_patterns"]:
            self.habits["daily_patterns"][today] = {
                "activities": [],
                "total_screen_time": 0,
                "productivity_score": 0
            }
        
        activity = {
            "timestamp": time.time(),
            "type": activity_type,
            "details": details
        }
        
        self.habits["daily_patterns"][today]["activities"].append(activity)
        self.save_memory()
        
        logger.info(f"Tracked {activity_type}: {details}")
    
    def analyze_daily_pattern(self, date: str = None) -> Dict[str, Any]:
        """Analyze daily patterns and generate insights"""
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")
        
        if date not in self.habits["daily_patterns"]:
            return {"status": "no_data", "message": "No data for this date"}
        
        day_data = self.habits["daily_patterns"][date]
        activities = day_data["activities"]
        
        # Analyze patterns
        gaming_time = sum(1 for a in activities if a["type"] == "gaming")
        coding_time = sum(1 for a in activities if a["type"] == "coding")
        break_count = sum(1 for a in activities if a["type"] == "break")
        
        # Calculate productivity score
        total_activities = len(activities)
        if total_activities > 0:
            productivity_ratio = (coding_time / total_activities) * 100
        else:
            productivity_ratio = 0
        
        insights = {
            "date": date,
            "total_activities": total_activities,
            "gaming_sessions": gaming_time,
            "coding_sessions": coding_time,
            "breaks_taken": break_count,
            "productivity_score": round(productivity_ratio, 1),
            "dominant_activity": "coding" if coding_time > gaming_time else "gaming"
        }
        
        return {"status": "success", "insights": insights}
    
    def get_contextual_response(self, current_activity: str, persona: str) -> str:
        """Generate contextual response based on habits"""
        today = datetime.now().strftime("%Y-%m-%d")
        analysis = self.analyze_daily_pattern(today)
        
        if analysis["status"] == "no_data":
            return None
        
        insights = analysis["insights"]
        
        # Contextual responses based on patterns
        if current_activity == "gaming":
            if insights["gaming_sessions"] > 3:
                return f"again with the games? that's your {insights['gaming_sessions']}th session today! your productivity is at {insights['productivity_score']}%, loser."
            elif insights["coding_sessions"] > 5:
                return f"wow, {insights['coding_sessions']} coding sessions today? you're actually being productive for once. proud of you, babe."
        
        elif current_activity == "coding":
            if insights["coding_sessions"] > 5:
                return f"wow, {insights['coding_sessions']} coding sessions today? you're actually being productive for once. proud of you, babe."
        
        elif current_activity == "break":
            if insights["breaks_taken"] < 2:
                return "you've barely taken any breaks today. you're going to burn out, idiot."
        
        return None

# Global instance
habit_engine = HabitMemoryEngine()
