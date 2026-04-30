import json
with open('d:/maveai/backend/chat_history.json', 'r') as f:
    data = json.load(f)
    print(f'Messages: {len(data.get("user_pro_01", []))}')
