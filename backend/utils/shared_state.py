# Shared state to avoid circular imports between app.py and routes/chat_routes.py

# Current vision context from Gemini Vision (Hybrid Phone Tools)
maeve_current_context = "User is at an unknown location."

def get_vision_context():
    global maeve_current_context
    return f"[LIVE HYBRID SENSORS]: {maeve_current_context}"

def update_vision_context(new_context):
    global maeve_current_context
    maeve_current_context = new_context
