import json
with open('d:/maveai/backend/profiles.json', 'r') as f:
    profiles = json.load(f)
    user_profile = profiles.get('user_pro_01', {})
    core_memories = user_profile.get('core_memories', [])
    print('Core memories in profiles.json:', len(core_memories))
    for i, memory in enumerate(core_memories[:5], 1):
        print(f'  {i}. [{memory["type"]}] {memory["content"]}')
