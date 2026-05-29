# -*- coding: utf-8 -*-
"""Tests for agent identity in system prompt."""
import tempfile
from pathlib import Path
import pytest
from ai_personal_assistant.agents.prompt import build_system_prompt_from_working_dir

FORBIDDEN_IDENTITY_TERMS = (
    "QwenPaw",
    "Qwen/Qwen",
    "我是 Qwen",
    "I am Qwen",
)


@pytest.fixture
def temp_workspace():
    """Create a temporary workspace directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        workspace = Path(tmpdir)
        yield workspace


def test_prompt_without_agent_id(temp_workspace):  # pylint: disable=W0621
    """Test system prompt without agent_id."""
    # Create a simple AGENTS.md
    agents_md = temp_workspace / "AGENTS.md"
    agents_md.write_text("You are a helpful assistant.", encoding="utf-8")

    prompt = build_system_prompt_from_working_dir(
        working_dir=temp_workspace,
        agent_id=None,
    )

    assert "You are a helpful assistant" in prompt
    assert "Agent Identity" not in prompt
    assert "You are agent" not in prompt


def test_prompt_with_default_agent_id(
    temp_workspace,
):  # pylint: disable=W0621
    """Test system prompt with 'default' agent_id."""
    agents_md = temp_workspace / "AGENTS.md"
    agents_md.write_text("You are a helpful assistant.", encoding="utf-8")

    prompt = build_system_prompt_from_working_dir(
        working_dir=temp_workspace,
        agent_id="default",
    )

    # 'default' agent should also have identity header
    # so it knows its own agent_id
    assert "You are a helpful assistant" in prompt
    assert "Agent Identity" in prompt
    assert "Internal operational metadata" in prompt
    assert "Your agent id is `default`" in prompt


def test_prompt_with_custom_agent_id(
    temp_workspace,
):  # pylint: disable=W0621
    """Test system prompt with custom agent_id."""
    agents_md = temp_workspace / "AGENTS.md"
    agents_md.write_text("You are a helpful assistant.", encoding="utf-8")

    prompt = build_system_prompt_from_working_dir(
        working_dir=temp_workspace,
        agent_id="abc123",
    )

    # Custom agent should have identity header
    assert "Agent Identity" in prompt
    assert "Your agent id is `abc123`" in prompt
    assert "You are a helpful assistant" in prompt
    # Identity should be at the beginning
    assert prompt.index("Agent Identity") < prompt.index("helpful assistant")


def test_prompt_with_empty_workspace(
    temp_workspace,
):  # pylint: disable=W0621
    """Test system prompt with empty workspace."""
    prompt = build_system_prompt_from_working_dir(
        working_dir=temp_workspace,
        agent_id="xyz789",
    )

    # Should still add identity header even with no markdown files
    assert "Agent Identity" in prompt
    assert "Your agent id is `xyz789`" in prompt


def test_prompt_identity_format(temp_workspace):  # pylint: disable=W0621
    """Test the exact format of identity header."""
    prompt = build_system_prompt_from_working_dir(
        working_dir=temp_workspace,
        agent_id="test99",
    )

    expected_header = (
        "# Agent Identity\n\n"
        "Internal operational metadata: Your agent id is `test99`. "
        "Use it only for tool routing, scheduled tasks, workspace scoping, "
        "and diagnostics. Do not include this id in ordinary greetings or "
        "self-introductions unless the user explicitly asks for technical "
        "or session details.\n\n"
    )
    assert expected_header in prompt


def test_default_prompt_uses_neutral_assistant_identity(
    temp_workspace,
):  # pylint: disable=W0621
    """Fallback system prompt should not seed product/model identity."""
    prompt = build_system_prompt_from_working_dir(
        working_dir=temp_workspace,
        agent_id="default",
    )

    assert "You are the user's AI assistant." in prompt
    assert "neutral assistant identity" in prompt
    for term in FORBIDDEN_IDENTITY_TERMS:
        assert term not in prompt


def test_builtin_system_prompt_sources_do_not_seed_brand_identity():
    """Bundled prompt sources should not seed public brand/model identity."""
    repo_root = Path(__file__).resolve().parents[3]
    prompt_sources = [repo_root / "src/ai_personal_assistant/agents/prompt.py"]
    prompt_sources.extend(
        (repo_root / "src/ai_personal_assistant/agents/md_files").rglob("*.md"),
    )

    for path in prompt_sources:
        content = path.read_text(encoding="utf-8")
        for term in FORBIDDEN_IDENTITY_TERMS:
            assert term not in content, f"{term!r} found in {path}"
