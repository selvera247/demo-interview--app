"""Smoke coverage for verify_mcp.py."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def test_verify_mcp_main_exits_zero():
    from verify_mcp import main

    assert main() == 0
