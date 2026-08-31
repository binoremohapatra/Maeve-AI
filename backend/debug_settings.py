import os
#!/usr/bin/env python3
"""
Debug Settings Sync
"""
import requests

def debug_settings():
    """Debug settings sync"""
    
    base_url = os.getenv("BRAIN_SERVICE_URL", "http://127.0.0.1:5000") + ""
    user_id = "debug_user"
    
    print("Debug Settings Sync")
    print("=" * 40)
    
    # Test 1: Sync settings
    print("\n1. Sync settings...")
    payload = {
        "userId": user_id,
        "currentMode": "yandere",
        "currentVoice": "af_nicole"
    }
    
    try:
        response = requests.post(f"{base_url}/api/settings/sync", json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 2: Get settings
    print("\n2. Get settings...")
    try:
        response = requests.get(f"{base_url}/api/settings/{user_id}", timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 3: Chat test
    print("\n3. Chat test...")
    chat_payload = {
        "user_input": "hello",
        "userId": user_id,
        "dominant_persona": "DEFAULT",
        "source": "ui",
        "isPremium": True
    }
    
    try:
        response = requests.post(f"{base_url}/process", json=chat_payload, timeout=30)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Persona: {data.get('persona_active', 'N/A')}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_settings()
