# -*- coding: utf-8 -*-
"""Allow running AI Personal Assistant via ``python -m ai_personal_assistant``."""
from .cli.main import cli

if __name__ == "__main__":
    cli()  # pylint: disable=no-value-for-parameter
