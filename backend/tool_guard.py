# 🛡️ TOOL GUARD (The Circuit Breaker)
import logging

logger = logging.getLogger(__name__)

# खतरनाक टूल्स जिन्हें बिना पूछे नहीं चलाना है
DANGEROUS_TOOLS = ["SHUTDOWN_PC", "RESTART_PC", "SEND_EMAIL", "SEND_WHATSAPP"]
# सेफ टूल्स जिन्हें तुरंत चल सकते हैं
SAFE_TOOLS = ["OPEN_APP", "PLAY_MUSIC", "VSCODE_HELP", "STOP_DISTRACTION"]

def validate_tool_execution(tool_call, user_input):
    """
    यह मेव के दिमाग और तुम्हारे पीसी के बीच का सुरक्षा चक्र है।
    """
    if tool_call == "NONE" or not tool_call:
        return False, "No tool requested."

    user_text = user_input.lower()

    if tool_call in DANGEROUS_TOOLS:
        # 🛡️ THE SAFETY LOCK: कन्फर्मेशन चेक
        confirmation_words = ["yes", "confirm", "do it", "send it", "authorize"]
        
        if not any(word in user_text for word in confirmation_words):
            logger.warning(f"🚫 BLOCKED: {tool_call} requires explicit user confirmation.")
            # यह मेव को वापस बोलेगा कि "यूजर से पूछो"
            return False, f"ACTION BLOCKED: You must ask for confirmation before executing {tool_call}."
        
        logger.info(f"✅ AUTHORIZED: {tool_call} execution granted.")
        return True, "Authorized"
        
    elif tool_call in SAFE_TOOLS:
        return True, "Safe to execute"
        
    return False, f"Unknown tool: {tool_call}"
