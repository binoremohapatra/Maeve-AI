"""
LLM Integration Module
Supports multiple LLM providers (Ollama, Gemini, Groq)
"""

from .ollama_client import ask_ollama_chat, ask_maeve
from .gemini_client import call_cloud_gemini

__all__ = [
    'ask_ollama_chat',
    'ask_maeve', 
    'call_cloud_gemini'
]
