import re

def determine_action_and_emotion(reply_text, user_input):
    # 1. Extract physical actions strictly from asterisks (e.g., *smiles warmly*, *rolls eyes*)
    extracted_actions = re.findall(r'\*(.*?)\*', reply_text)
    action_text = " ".join(extracted_actions).lower()
    
    # 2. IF THE AI WROTE AN ASTERISK ACTION, IT IS THE ABSOLUTE TRUTH
    if action_text:
        # --- NSFW Actions ---
        if any(x in action_text for x in ['blowjob', 'suck', 'head', 'bj']): return "BLOWJOB", "SEXUAL_DESIRE"
        if any(x in action_text for x in ['ride', 'bounce', 'straddle', 'cowgirl']): return "RIDING", "SEXUAL_DESIRE"
        if any(x in action_text for x in ['bend over', 'behind', 'backshot']): return "BACKSHOT", "SEXUAL_DESIRE"
        if any(x in action_text for x in ['masturbat', 'touch myself', 'finger', 'rub']): return "MASTURBATE", "SEXUAL_DESIRE"
        if any(x in action_text for x in ['undress', 'take off', 'strip', 'naked']): return "UNDRESSING", "SEXUAL_DESIRE"
        if any(x in action_text for x in ['handjob', 'stroke']): return "HANDJOB", "SEXUAL_DESIRE"
        if any(x in action_text for x in ['missionary', 'on top']): return "MISSIONARY", "SEXUAL_DESIRE"
        if any(x in action_text for x in ['saddle']): return "SADDLE", "SEXUAL_DESIRE"
        if any(x in action_text for x in ['ahegao', 'cumming', 'orgasm']): return "AHEGAO", "SEXUAL_DESIRE"
        
        # --- Intimate/Romance Actions ---
        if any(x in action_text for x in ['kiss', 'peck', 'lips', 'smooch']): return "NORMALKISS", "ROMANCE"
        if any(x in action_text for x in ['hug', 'embrace', 'wrap arms', 'cuddle']): return "HUGGINGKISS", "ROMANCE"
        if any(x in action_text for x in ['smirk', 'lean in', 'bite lip', 'seductive']): return "CRAVING", "SEXUAL_DESIRE"
        if any(x in action_text for x in ['blow kiss', 'flying kiss']): return "BLOWKISS", "ROMANCE"
        if any(x in action_text for x in ['adore', 'stare lovingly']): return "ADORATION", "ROMANCE"
        
        # --- Everyday Emotion Actions ---
        if any(x in action_text for x in ['type', 'typing', 'code', 'keyboard']): return "TYPING", "FOCUS"
        if any(x in action_text for x in ['blush', 'shy', 'hide', 'nervous', 'turn red']): return "BASHFUL", "SHY"
        if any(x in action_text for x in ['tilt', 'think', 'ponder', 'curious']): return "FEMALETHINKING", "CURIOSITY"
        if any(x in action_text for x in ['roll', 'sigh', 'annoy', 'tap foot']): return "ANNOYED", "FRUSTRATION"
        if any(x in action_text for x in ['glare', 'cross arms', 'stomp', 'hiss', 'sneer']): return "FEMALEANGRY", "ANGER"
        if any(x in action_text for x in ['cry', 'tear', 'sob', 'wipe']): return "SAD", "SADNESS"
        if any(x in action_text for x in ['smile', 'warm', 'giggle', 'beam', 'laugh']): return "HAPPY", "JOY"
        if any(x in action_text for x in ['yawn', 'sleepy', 'stretch']): return "YAWN", "BOREDOM"
        if any(x in action_text for x in ['wave', 'beckon']): return "WAVE", "EXCITEMENT"
        if any(x in action_text for x in ['nod', 'approve']): return "SATISFACTION", "SATISFACTION"
        if any(x in action_text for x in ['clap', 'bravo']): return "CLAPPING", "SATISFACTION"
        if any(x in action_text for x in ['shake head', 'refuse']): return "SHAKINGHEADNO", "ANGER"
    
    # 3. IF NO ASTERISK ACTION, FALLBACK TO SAFE KEYWORD MATCHING (Preventing false NSFW)
    text = reply_text.lower()
    prompt = user_input.lower()
    combined = prompt + " " + text
    words = set(re.findall(r'\b\w+\b', combined))
    
    # Safe fallback logic (Notice: No NSFW triggers here to prevent false positives)
    if any(x in words for x in ['sad', 'cry', 'heartbroken', 'hurt', 'depressed']): return "SAD", "SADNESS"
    if any(x in words for x in ['scared', 'afraid', 'fear', 'terrified']): return "FEAR", "FEAR"
    if any(x in words for x in ['angry', 'hate', 'stupid', 'idiot']): return "FEMALEANGRY", "ANGER"
    if any(x in words for x in ['shy', 'embarrassed']): return "BASHFUL", "SHY"
    if any(x in words for x in ['happy', 'excited', 'yay', 'amazing']): return "HAPPY", "JOY"
    
    # Default fallback
    return "FEMINEIDLE", "NEUTRAL"
