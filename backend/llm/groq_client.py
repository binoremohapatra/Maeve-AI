import requests

# ⚡ 2. PYTHON TO GROQ CLOUD
def call_cloud_groq(user_msg, system_prompt, api_key):
    if not api_key: 
        raise Exception("Groq Key Missing in Backend!")
    url = "https://api.groq.com/openai/v1/chat/completions"
    
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_msg}],
        "temperature": 0.8, "max_tokens": 150
    }
    res = requests.post(url, json=payload, headers=headers).json()
    try:
        return res['choices'][0]['message']['content']
    except:
        raise Exception(f"Groq Error: {res}")
