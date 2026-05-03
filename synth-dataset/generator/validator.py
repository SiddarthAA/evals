"""
validator.py — post-generation consistency checks for a hydrated session.

Each check returns a list of error strings. Empty list = pass.
"""
from __future__ import annotations

import re
from typing import Any

# Fields every session must have at the top level
_REQUIRED_TOP_LEVEL = {
    "session_id", "agent_version", "timestamp", "duration_ms",
    "task", "outcome", "stages", "metadata",
    "failure_stage", "failure_subtype", "completion_rate",
}

_REQUIRED_TASK = {"prompt", "url", "json_schema"}
_REQUIRED_OUTCOME = {"status", "failure_stage", "failure_reason"}
_REQUIRED_METADATA = {"total_tool_calls", "retries", "tokens_used", "pages_crawled"}
_STAGE_NAMES = {"input_validation", "tool_execution", "intermediate_processing", "final_output"}
_VALID_STAGE_STATUSES = {"success", "failure", "skipped"}

_PLACEHOLDER_RE = re.compile(r"\{\{\w+\}\}")

# Maps failure_stage → which stage should be "failure" in stages{}
_FAILURE_STAGE_MAP = {
    None: None,
    "input_validation": "input_validation",
    "tool_execution": "tool_execution",
    "intermediate_processing": "intermediate_processing",
    "final_output": "final_output",
}

# For successful sessions the completion_rate should be 1.0;
# for failures it maps to how many stages passed.
_EXPECTED_COMPLETION = {
    None: 1.0,
    "input_validation": 0.0,
    "tool_execution": 0.25,
    "intermediate_processing": 0.5,
    "final_output": 0.75,
}


def _check_required_fields(session: dict) -> list[str]:
    errors = []
    missing = _REQUIRED_TOP_LEVEL - set(session.keys())
    if missing:
        errors.append(f"Missing top-level fields: {sorted(missing)}")
    for sub, required in [("task", _REQUIRED_TASK), ("outcome", _REQUIRED_OUTCOME), ("metadata", _REQUIRED_METADATA)]:
        if sub in session and isinstance(session[sub], dict):
            sub_missing = required - set(session[sub].keys())
            if sub_missing:
                errors.append(f"Missing fields in '{sub}': {sorted(sub_missing)}")
    return errors


def _check_no_unfilled_placeholders(session: dict) -> list[str]:
    """Walk entire session and flag any remaining {{placeholder}} tokens."""
    errors = []

    def _walk(obj: Any, path: str) -> None:
        if isinstance(obj, str):
            remaining = _PLACEHOLDER_RE.findall(obj)
            if remaining:
                errors.append(f"Unfilled placeholders at '{path}': {remaining}")
        elif isinstance(obj, dict):
            for k, v in obj.items():
                _walk(v, f"{path}.{k}")
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                _walk(item, f"{path}[{i}]")

    _walk(session, "session")
    return errors


def _check_stages_present(session: dict) -> list[str]:
    errors = []
    stages = session.get("stages", {})
    if not isinstance(stages, dict):
        return ["'stages' is not a dict"]
    missing = _STAGE_NAMES - set(stages.keys())
    if missing:
        errors.append(f"Missing stages: {sorted(missing)}")
    for name, stage in stages.items():
        if not isinstance(stage, dict):
            errors.append(f"Stage '{name}' is not a dict")
            continue
        status = stage.get("status")
        if status not in _VALID_STAGE_STATUSES:
            errors.append(f"Stage '{name}' has invalid status: {status!r}")
    return errors


def _check_failure_stage_consistency(session: dict) -> list[str]:
    errors = []
    failure_stage = session.get("failure_stage")
    outcome_status = session.get("outcome", {}).get("status")
    stages = session.get("stages", {})

    if outcome_status == "success":
        if failure_stage is not None:
            errors.append(f"outcome.status=success but failure_stage={failure_stage!r}")
        for name, stage in stages.items():
            if isinstance(stage, dict) and stage.get("status") == "failure":
                errors.append(f"outcome=success but stage '{name}' has status=failure")
    elif outcome_status == "failure":
        if failure_stage is None:
            errors.append("outcome.status=failure but failure_stage is null")
        if failure_stage and failure_stage in stages:
            stage_status = stages[failure_stage].get("status")
            if stage_status != "failure":
                errors.append(
                    f"failure_stage={failure_stage!r} but that stage has status={stage_status!r}"
                )
    return errors


def _check_completion_rate(session: dict) -> list[str]:
    errors = []
    failure_stage = session.get("failure_stage")
    try:
        actual = float(session.get("completion_rate", -1))
    except (TypeError, ValueError):
        return ["completion_rate is not numeric"]
    expected = _EXPECTED_COMPLETION.get(failure_stage, -1)
    if expected == -1:
        errors.append(f"Unknown failure_stage: {failure_stage!r}")
    elif abs(actual - expected) > 0.01:
        errors.append(f"completion_rate={actual} expected={expected} for failure_stage={failure_stage!r}")
    return errors


def _check_pages_crawled_consistency(session: dict) -> list[str]:
    errors = []
    metadata = session.get("metadata", {})
    pages_crawled = metadata.get("pages_crawled")
    stages = session.get("stages", {})
    intermediate = stages.get("intermediate_processing", {})
    sub_agents = intermediate.get("sub_agents", [])

    if not sub_agents:
        return errors  # single-page, no sub-agent check needed

    try:
        pages_int = int(pages_crawled)
    except (TypeError, ValueError):
        return errors  # dynamic placeholder not caught by earlier check

    if len(sub_agents) > pages_int:
        errors.append(
            f"pages_crawled={pages_int} but found {len(sub_agents)} sub_agents"
        )
    return errors


def validate_session(session: dict) -> list[str]:
    """Run all checks and return a flat list of error strings."""
    all_errors: list[str] = []
    all_errors.extend(_check_required_fields(session))
    all_errors.extend(_check_no_unfilled_placeholders(session))
    all_errors.extend(_check_stages_present(session))
    all_errors.extend(_check_failure_stage_consistency(session))
    all_errors.extend(_check_completion_rate(session))
    all_errors.extend(_check_pages_crawled_consistency(session))
    return all_errors


def is_valid(session: dict) -> bool:
    return len(validate_session(session)) == 0
