"""
Background Services Module
Proactive engines and background processing
"""

from .nagging_engine import offline_nagging_engine
from .relationship_evolver import evolve_relationship_dynamic

__all__ = [
    'offline_nagging_engine',
    'evolve_relationship_dynamic'
]
