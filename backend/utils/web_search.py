from ddgs import DDGS
import logging

logger = logging.getLogger(__name__)

def search_web(query: str, max_results=2) -> str:
    """Bina kisi API key ke live internet se data nikalta hai."""
    try:
        logger.info(f"🌐 Searching the Internet for: '{query}'...")
        # Safe initialization
        ddgs = DDGS()
        results = list(ddgs.text(query, max_results=max_results))
        
        if not results:
            return ""
        
        # Search results ko ek string me combine karo taaki LLM padh sake
        context = ""
        for i, res in enumerate(results):
            context += f"Result {i+1}: {res['body']}\n"
            
        logger.info("✅ Live Data fetched successfully!")
        return context
    except Exception as e:
        logger.error(f"❌ Web Search Error: {e}")
        return ""
