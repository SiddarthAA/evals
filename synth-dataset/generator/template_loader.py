"""
template_loader.py — loads templates from disk and selects them by type/subtype.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

# Maps (outcome, subtype) → relative path under templates/
_TEMPLATE_MAP: dict[tuple[str, str], Path] = {
    ("success", "clean_run"):                TEMPLATES_DIR / "success" / "clean_run.json",
    ("success", "paginated_success"):        TEMPLATES_DIR / "success" / "paginated_success.json",
    ("success", "retry_then_succeed"):       TEMPLATES_DIR / "success" / "retry_then_succeed.json",
    ("success", "proxy_rotation_success"):   TEMPLATES_DIR / "success" / "proxy_rotation_success.json",
    ("success", "schema_coercion_success"):  TEMPLATES_DIR / "success" / "schema_coercion_success.json",

    ("input_validation", "malformed_schema"): TEMPLATES_DIR / "failures" / "input" / "malformed_schema.json",
    ("input_validation", "url_sanity_fail"):  TEMPLATES_DIR / "failures" / "input" / "url_sanity_fail.json",
    ("input_validation", "auth_missing"):     TEMPLATES_DIR / "failures" / "input" / "auth_missing.json",
    ("input_validation", "prompt_ambiguity"): TEMPLATES_DIR / "failures" / "input" / "prompt_ambiguity.json",

    ("tool_execution", "tool_schema_error"):      TEMPLATES_DIR / "failures" / "tool" / "tool_schema_error.json",
    ("tool_execution", "false_tool_call"):         TEMPLATES_DIR / "failures" / "tool" / "false_tool_call.json",
    ("tool_execution", "rate_limit_exhausted"):    TEMPLATES_DIR / "failures" / "tool" / "rate_limit_exhausted.json",
    ("tool_execution", "ip_ban"):                  TEMPLATES_DIR / "failures" / "tool" / "ip_ban.json",
    ("tool_execution", "pagination_failure"):      TEMPLATES_DIR / "failures" / "tool" / "pagination_failure.json",

    ("intermediate_processing", "sub_agent_schema_fail"): TEMPLATES_DIR / "failures" / "intermediate" / "sub_agent_schema_fail.json",
    ("intermediate_processing", "partial_content"):       TEMPLATES_DIR / "failures" / "intermediate" / "partial_content.json",
    ("intermediate_processing", "encoding_error"):        TEMPLATES_DIR / "failures" / "intermediate" / "encoding_error.json",
    ("intermediate_processing", "sub_agent_timeout"):     TEMPLATES_DIR / "failures" / "intermediate" / "sub_agent_timeout.json",

    ("final_output", "empty_output"):          TEMPLATES_DIR / "failures" / "output" / "empty_output.json",
    ("final_output", "schema_nonconformance"): TEMPLATES_DIR / "failures" / "output" / "schema_nonconformance.json",
    ("final_output", "hallucinated_fields"):   TEMPLATES_DIR / "failures" / "output" / "hallucinated_fields.json",
    ("final_output", "truncated_output"):      TEMPLATES_DIR / "failures" / "output" / "truncated_output.json",
}

# Distribution weights: (outcome, subtype) → target count across 450 sessions
_DISTRIBUTION: dict[tuple[str, str], int] = {
    ("success", "clean_run"):                32,
    ("success", "paginated_success"):        32,
    ("success", "retry_then_succeed"):       32,
    ("success", "proxy_rotation_success"):   31,
    ("success", "schema_coercion_success"):  31,

    ("input_validation", "malformed_schema"): 12,
    ("input_validation", "url_sanity_fail"):  11,
    ("input_validation", "auth_missing"):     11,
    ("input_validation", "prompt_ambiguity"): 11,

    ("tool_execution", "tool_schema_error"):      23,
    ("tool_execution", "false_tool_call"):         22,
    ("tool_execution", "rate_limit_exhausted"):    23,
    ("tool_execution", "ip_ban"):                  22,
    ("tool_execution", "pagination_failure"):      22,

    ("intermediate_processing", "sub_agent_schema_fail"): 23,
    ("intermediate_processing", "partial_content"):       22,
    ("intermediate_processing", "encoding_error"):        23,
    ("intermediate_processing", "sub_agent_timeout"):     22,

    ("final_output", "empty_output"):          12,
    ("final_output", "schema_nonconformance"): 11,
    ("final_output", "hallucinated_fields"):   11,
    ("final_output", "truncated_output"):      11,
}


def load_template(outcome: str, subtype: str) -> dict:
    """Load and return a template as a dict."""
    key = (outcome, subtype)
    path = _TEMPLATE_MAP.get(key)
    if path is None:
        raise ValueError(f"No template registered for outcome={outcome!r}, subtype={subtype!r}")
    if not path.exists():
        raise FileNotFoundError(f"Template file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def sample_plan(total: int = 450) -> list[tuple[str, str]]:
    """
    Return an ordered list of (outcome, subtype) pairs totalling `total`.
    Fills from the distribution table, then shuffles.
    """
    plan: list[tuple[str, str]] = []
    for key, count in _DISTRIBUTION.items():
        plan.extend([key] * count)

    # If total differs from sum, adjust by sampling
    current = len(plan)
    if current < total:
        extras = random.choices(list(_DISTRIBUTION.keys()), k=total - current)
        plan.extend(extras)
    elif current > total:
        plan = plan[:total]

    random.shuffle(plan)
    return plan


def all_subtypes() -> list[tuple[str, str]]:
    """Return all registered (outcome, subtype) pairs."""
    return list(_TEMPLATE_MAP.keys())
