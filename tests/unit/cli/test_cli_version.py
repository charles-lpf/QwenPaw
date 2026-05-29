# -*- coding: utf-8 -*-
from click.testing import CliRunner

from ai_personal_assistant.__version__ import __version__
from ai_personal_assistant.cli.main import cli


def test_cli_version_option_outputs_current_version() -> None:
    result = CliRunner().invoke(cli, ["--version"])

    assert result.exit_code == 0
    assert __version__ in result.output
