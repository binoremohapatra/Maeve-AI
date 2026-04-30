"""
Core Intelligence Module
Maeve's brain: memory, persona, emotion, relationship dynamics
"""

from .memory_engine import get_chat_history, save_chat_history, distill_to_core_memory, archive_core_memory
from .persona_engine import get_persona_rules, get_user_profile, update_user_profile, get_current_settings
from .emotion_engine import determine_action_and_emotion
from .animation_engine import ANIMATION_MATRIX
from .behavior_engine import UserBehaviorProfile, get_maeve_current_activity
from .drift_engine import check_behavioral_drift, evolve_relationship_dynamic
from .scheduler_engine import generate_behavioral_schedule
from .relationship_brain import MasterRelationshipBrain, BrainConfig

__all__ = [
    'get_chat_history',
    'save_chat_history', 
    'distill_to_core_memory',
    'archive_core_memory',
    'get_persona_rules',
    'get_user_profile',
    'update_user_profile',
    'get_current_settings',
    'determine_action_and_emotion',
    'ANIMATION_MATRIX',
    'UserBehaviorProfile',
    'get_maeve_current_activity',
    'check_behavioral_drift',
    'evolve_relationship_dynamic',
    'generate_behavioral_schedule',
    'MasterRelationshipBrain',
    'BrainConfig'
]
