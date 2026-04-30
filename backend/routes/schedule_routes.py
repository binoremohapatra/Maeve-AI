import uuid
import json
import requests
from flask import Blueprint, request, jsonify
from core.scheduler_engine import generate_behavioral_schedule
from core.persona_engine import get_user_profile
from audio.tts_engine import generate_audio
from utils.helpers import OLLAMA_CHAT_URL, MODEL_NAME

schedule_bp = Blueprint('schedule_bp', __name__)

@schedule_bp.route('/api/schedule/generate', methods=['POST'])
def generate_day():
    data = request.json
    tasks, energy = data.get('tasks', 'General'), data.get('energy', 80)
    user_id = data.get('userId', 'user_pro_01')
    profile = get_user_profile(user_id)
    
    plan = generate_behavioral_schedule(tasks, energy, {"name": profile.get('name', 'Darling')})
    audio_result = generate_audio(plan.get('summary', "Plan ready."), "FOCUS")

    return jsonify({
        "status": "success",
        "summary": plan.get('summary'),
        "schedule": plan.get('schedule', []),
        "audioBase64": audio_result.get('audioBase64') if audio_result else None,
        "duration": audio_result.get('duration') if audio_result else 0
    })

@schedule_bp.route('/api/schedule/recalculate', methods=['POST'])
def recalculate_schedule():
    data = request.json
    user_id = data.get('userId', 'user_pro_01')
    current_schedule = data.get('schedule', [])
    missed_task = data.get('missed_task', 'Unknown Task')
    user_context = data.get('context', 'Busy at College') # User ka current status

    profile = get_user_profile(user_id)
    user_name = profile.get('name', 'Darling')  # Safe fallback
    
    system_prompt = f"""
    You are Maeve, a strict but caring AI girlfriend managing {user_name}'s life.
    
    SITUATION:
    The user just missed their task: "{missed_task}".
    Reason: Their current status is "{user_context}".
    
    Here is their remaining schedule for today:
    {json.dumps(current_schedule)}
    
    YOUR MISSION:
    Since he is currently {user_context}, he cannot do his tasks right now. 
    Intelligently SHIFT and RECALCULATE time slots for remaining tasks to a realistic later time (e.g., if he is at college, shift personal tasks to evening after 6 PM).
    
    RULES:
    1. Respond ONLY in valid JSON. No markdown.
    2. Format exactly like this:
    {{
      "summary": "Darling, I saw you missed your workout because you're at college. I've shifted your routine to evening. Do not disappoint me later.",
      "schedule": [
        {{ "id": "uuid-here", "title": "...", "category": "...", "timeSlot": "06:30 PM", "instruction": "...", "priorityScore": 90, "status": "pending" }}
      ]
    }}
    """
    
    try:
        # Use CHAT URL for consistency
        res = requests.post(OLLAMA_CHAT_URL, json={
            "model": MODEL_NAME, 
            "messages": [{"role": "system", "content": system_prompt}], 
            "stream": False,
            "options": {"temperature": 0.3}
        })
        
        # Correct parsing for /api/chat
        reply = res.json().get('message', {}).get('content', '')
        reply = reply.replace("```json", "").replace("```", "").strip()
        
        start, end = reply.find('{'), reply.rfind('}') + 1
        new_plan = json.loads(reply[start:end]) if start != -1 else {"summary": "Schedule generation failed", "schedule": []}
        
        # Add UUIDs
        for task in new_plan.get('schedule', []):
            if 'id' not in task or not task['id']:
                task['id'] = str(uuid.uuid4())
                
        return jsonify({"status": "success", "summary": new_plan['summary'], "schedule": new_plan['schedule']})
        
    except Exception as e:
        print(f"Recalculation Error: {e}")
        return jsonify({"status": "error", "message": "Failed to recalculate"}), 500

@schedule_bp.route('/api/schedule/insights', methods=['POST'])
def get_schedule_insights():
    data = request.json
    user_id = data.get('userId', 'user_pro_01')
    completed_tasks = data.get('completedTasks', [])
    
    # Generate insights based on completion rate
    total_tasks = len(completed_tasks)
    completed_count = len([task for task in completed_tasks if task.get('status') == 'completed'])
    completion_rate = (completed_count / total_tasks * 100) if total_tasks > 0 else 0
    
    insights = {
        "completionRate": completion_rate,
        "totalTasks": total_tasks,
        "completedTasks": completed_count,
        "message": f"You completed {completion_rate:.1f}% of your tasks today." if completion_rate >= 80 else f"You only completed {completion_rate:.1f}% of your tasks. Try harder tomorrow."
    }
    
    return jsonify({"status": "success", "insights": insights})

@schedule_bp.route('/api/schedule/preferences', methods=['POST'])
def update_schedule_preferences():
    data = request.json
    user_id = data.get('userId', 'user_pro_01')
    preferences = data.get('preferences', {})
    
    # Save schedule preferences to user profile
    from utils.json_storage import load_json, save_json
    from utils.helpers import PROFILE_FILE
    
    profiles = load_json(PROFILE_FILE)
    if user_id not in profiles:
        profiles[user_id] = {"name": "Darling", "settings": {}}
    
    if "schedule_preferences" not in profiles[user_id]:
        profiles[user_id]["schedule_preferences"] = {}
    
    profiles[user_id]["schedule_preferences"].update(preferences)
    save_json(PROFILE_FILE, profiles)
    
    return jsonify({"status": "success", "message": "Schedule preferences updated"})
