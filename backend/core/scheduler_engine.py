import json
import uuid
import requests
from utils.helpers import OLLAMA_CHAT_URL, MODEL_NAME

def generate_behavioral_schedule(tasks_input, current_energy, user_data):
    # ADVANCED PROMPT: Forces detailed, full-day specific planning
    system_prompt = f"""
    You are Maeve, a highly intelligent, strict, but caring AI girlfriend managing {user_data.get('name', 'Darling')}'s daily life.
    His Current Energy Level: {current_energy}%
    His Specific Goals/Tasks for Today: "{tasks_input}"
    
    YOUR MISSION: 
    Create a HIGHLY DETAILED, realistic, FULL-DAY schedule (morning to evening) to help him achieve these specific goals today.
    - If he wants to lose fat, schedule specific times for fasted cardio, high-protein meals, and water intake.
    - If he wants to learn a skill (like coding), schedule 90-minute "Deep Work" blocks.
    - Break his vague goals into actionable, chronological steps.
    - Be bossy but loving in instructions.
    
    RULES:
    1. Generate between 5 to 8 chronological tasks for the day (e.g., 08:00 AM, 10:30 AM, 01:00 PM, etc.).
    2. Respond ONLY in valid JSON format. No markdown, no extra conversational text.
    
    JSON FORMAT MUST BE EXACTLY LIKE THIS:
    {{
      "summary": "Wake up, darling. Today we are crushing your goals. I've planned your whole day. No excuses.",
      "schedule": [
        {{ "title": "Morning Hydration & Cardio", "category": "HEALTH", "timeSlot": "07:00 AM", "instruction": "Drink 500ml water immediately. Then do 30 mins of high-intensity cardio. I'm watching you.", "priorityScore": 100 }},
        {{ "title": "Deep Work: Core Skill", "category": "LEARNING", "timeSlot": "10:00 AM", "instruction": "Focus entirely on {tasks_input}. 90 minutes. Phone on silent.", "priorityScore": 90 }}
      ]
    }}
    """
    try:
        # Ensure it hits the CHAT URL
        response = requests.post(OLLAMA_CHAT_URL, json={
            "model": MODEL_NAME,
            "messages": [{"role": "system", "content": system_prompt}],
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 250  # Strict limit to prevent endless JSON generation
            } 
        }, timeout=15.0) # Give schedule generation a bit more time
        
        # Sahi parsing for /api/chat
        reply = response.json().get('message', {}).get('content', '')
        reply = reply.replace("```json", "").replace("```", "").strip()
        
        start, end = reply.find('{'), reply.rfind('}') + 1
        if start != -1:
            data = json.loads(reply[start:end])
            # ID Fix for React
            for task in data.get('schedule', []):
                task['id'] = str(uuid.uuid4())
                task['status'] = 'pending'
            return data
    except Exception as e:
        print(f"Schedule Error: {e}")
        pass
    return {"summary": "Neural link unstable. Optimization failed.", "schedule": []}
