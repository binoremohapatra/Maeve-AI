import requests

#  1. PYTHON TO GEMINI CLOUD
def call_cloud_gemini(user_msg, system_prompt, api_key):
    if not api_key: 
        raise Exception("Gemini Key Missing in Backend!")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [{"parts": [{"text": system_prompt + "\n\nUser: " + user_msg}]}],
        "generationConfig": {"temperature": 0.8, "maxOutputTokens": 150}
    }
    res = requests.post(url, json=payload).json()
    try:
        return res['candidates'][0]['content']['parts'][0]['text']
    except:
        raise Exception(f"Gemini Error: {res}")
