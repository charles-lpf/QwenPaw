# -*- coding: utf-8 -*-
"""AIPersonalAssistant agents module.

This module provides the main agent implementation and supporting utilities
for building AI agents with tools, skills, and memory management.

Public API:
- PersonalAssistantAgent: Main agent class
- create_model_and_formatter: Factory for creating models and formatters

Example:
    >>> from ai_personal_assistant.agents import PersonalAssistantAgent, create_model_and_formatter
    >>> agent = PersonalAssistantAgent()
    >>> # Or with custom model
    >>> model, formatter = create_model_and_formatter()
"""

# PersonalAssistantAgent is lazy-loaded so that importing agents.skill_system (e.g.
# from CLI init_cmd/skills_cmd) does not pull react_agent, agentscope, tools.
# pylint: disable=undefined-all-variable
__all__ = ["PersonalAssistantAgent", "create_model_and_formatter"]


def __getattr__(name: str):
    """Lazy load heavy imports."""
    if name == "PersonalAssistantAgent":
        from .react_agent import PersonalAssistantAgent

        return PersonalAssistantAgent
    if name == "create_model_and_formatter":
        from .model_factory import create_model_and_formatter

        return create_model_and_formatter
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
