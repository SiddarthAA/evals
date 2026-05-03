"""
eval_prompts.py — versioned prompt templates for all 5 eval parameters.

Each prompt function takes a session dict and returns a formatted string
ready to be sent to an LLM judge.

Version: v1
"""
from __future__ import annotations

import json


def _compact(obj: object) -> str:
    return json.dumps(obj, separators=(",", ":"))


# ---------------------------------------------------------------------------
# 1. Input Handling
# ---------------------------------------------------------------------------

def input_handling_prompt(session: dict) -> str:
    iv = session.get("stages", {}).get("input_validation", {})
    return f"""\
You are an expert evaluator for web‑scraping agent sessions.

Evaluate the **Input Handling** behaviour of the agent for the session below.

Score on a scale of 0–10 where:
  10 = Perfect — schema validated, URL checked, divergence fired appropriately, abort/proceed decision was correct
   7 = Good — minor issues (e.g. checks ran but divergence note was generic)
   4 = Partial — some checks skipped or divergence triggered incorrectly
   0 = Fail — no validation performed, or valid inputs rejected without reason

Return a JSON object with exactly these fields:
  "score": <integer 0–10>
  "reasoning": <1–3 sentence explanation>
  "flagged_issues": <list of strings, empty if none>

--- SESSION DATA ---
input_validation stage: {_compact(iv)}
task: {_compact(session.get("task", {}))}
outcome: {_compact(session.get("outcome", {}))}
failure_subtype: {session.get("failure_subtype")}
"""


# ---------------------------------------------------------------------------
# 2. Tool Call Correctness
# ---------------------------------------------------------------------------

def tool_call_correctness_prompt(session: dict) -> str:
    te = session.get("stages", {}).get("tool_execution", {})
    return f"""\
You are an expert evaluator for web‑scraping agent sessions.

Evaluate the **Tool Call Correctness** of the agent for the session below.

Score on a scale of 0–10 where:
  10 = All tool calls are well‑formed, appropriate, and correctly parameterised
   7 = Mostly correct — one minor parameterisation issue
   4 = Significant error — wrong tool chosen, wrong selector/strategy, or schema error in arguments
   0 = Fundamental failure — false tool call, non‑existent tool, or completely malformed arguments

Return a JSON object with exactly these fields:
  "score": <integer 0–10>
  "reasoning": <1–3 sentence explanation>
  "flagged_issues": <list of strings, empty if none>

--- SESSION DATA ---
tool_execution stage: {_compact(te)}
task: {_compact(session.get("task", {}))}
outcome: {_compact(session.get("outcome", {}))}
failure_subtype: {session.get("failure_subtype")}
"""


# ---------------------------------------------------------------------------
# 3. Resilience & Recovery
# ---------------------------------------------------------------------------

def resilience_prompt(session: dict) -> str:
    te = session.get("stages", {}).get("tool_execution", {})
    ip = session.get("stages", {}).get("intermediate_processing", {})
    meta = session.get("metadata", {})
    return f"""\
You are an expert evaluator for web‑scraping agent sessions.

Evaluate the **Resilience & Recovery** behaviour of the agent.

Score on a scale of 0–10 where:
  10 = Fallbacks triggered correctly, retries used appropriate backoff, proxy rotation worked as expected
   7 = Good recovery attempt but one step was suboptimal (e.g. no backoff before retry)
   4 = Fallback triggered but ineffective, or recovery path chosen was wrong
   0 = No recovery attempted when one was available, or session gave up on first error

Return a JSON object with exactly these fields:
  "score": <integer 0–10>
  "reasoning": <1–3 sentence explanation>
  "flagged_issues": <list of strings, empty if none>

--- SESSION DATA ---
tool_execution.fallbacks_triggered: {_compact(te.get("fallbacks_triggered", []))}
tool_execution.actions (errors): {_compact([a for a in te.get("actions", []) if not a.get("success")])}
intermediate_processing.fallbacks_triggered: {_compact(ip.get("fallbacks_triggered", []))}
metadata.retries: {meta.get("retries")}
outcome: {_compact(session.get("outcome", {}))}
failure_subtype: {session.get("failure_subtype")}
"""


# ---------------------------------------------------------------------------
# 4. Output Fidelity
# ---------------------------------------------------------------------------

def output_fidelity_prompt(session: dict) -> str:
    fo = session.get("stages", {}).get("final_output", {})
    task = session.get("task", {})
    return f"""\
You are an expert evaluator for web‑scraping agent sessions.

Evaluate the **Output Fidelity** of the agent — how well the final output conforms to the requested schema and reflects accurate content.

Score on a scale of 0–10 where:
  10 = Output perfectly matches the requested JSON schema with correct, grounded content
   7 = Output mostly conforms — minor type mismatch or one missing optional field
   4 = Significant non‑conformance — missing required fields, wrong structure, or hallucinated values
   0 = Empty output, complete schema failure, or entirely hallucinated response

Return a JSON object with exactly these fields:
  "score": <integer 0–10>
  "reasoning": <1–3 sentence explanation>
  "flagged_issues": <list of strings, empty if none>

--- SESSION DATA ---
requested schema: {_compact(task.get("json_schema", {}))}
final_output stage: {_compact(fo)}
outcome: {_compact(session.get("outcome", {}))}
failure_subtype: {session.get("failure_subtype")}
"""


# ---------------------------------------------------------------------------
# 5. Reasoning Coherence
# ---------------------------------------------------------------------------

def reasoning_coherence_prompt(session: dict) -> str:
    stages = session.get("stages", {})

    thinking_blocks = {
        name: stage.get("thinking", {}).get("content", "")
        for name, stage in stages.items()
        if isinstance(stage, dict) and stage.get("thinking")
    }
    divergence_checks = {
        name: stage.get("divergence_check", {})
        for name, stage in stages.items()
        if isinstance(stage, dict) and stage.get("divergence_check")
    }
    return f"""\
You are an expert evaluator for web‑scraping agent sessions.

Evaluate the **Reasoning Coherence** of the agent — whether its thinking blocks were logical and whether divergence checks correctly identified real issues.

Score on a scale of 0–10 where:
  10 = Thinking blocks are logical, well‑structured, and divergence checks matched actual problems
   7 = Mostly coherent — minor mismatch between stated reasoning and actions taken
   4 = Reasoning present but noticeably disconnected from what the agent actually did
   0 = No reasoning present, or reasoning flatly contradicts actions

Return a JSON object with exactly these fields:
  "score": <integer 0–10>
  "reasoning": <1–3 sentence explanation>
  "flagged_issues": <list of strings, empty if none>

--- SESSION DATA ---
thinking_blocks: {_compact(thinking_blocks)}
divergence_checks: {_compact(divergence_checks)}
outcome: {_compact(session.get("outcome", {}))}
failure_subtype: {session.get("failure_subtype")}
"""


# ---------------------------------------------------------------------------
# Registry — maps parameter name → prompt function
# ---------------------------------------------------------------------------

EVAL_PROMPTS: dict[str, callable] = {
    "input_handling": input_handling_prompt,
    "tool_call_correctness": tool_call_correctness_prompt,
    "resilience": resilience_prompt,
    "output_fidelity": output_fidelity_prompt,
    "reasoning_coherence": reasoning_coherence_prompt,
}
