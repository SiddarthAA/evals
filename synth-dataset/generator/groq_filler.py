"""
groq_filler.py — uses Groq LLM to hydrate variable fields in a template.

For each template (a dict with {{placeholder}} strings), this module:
1. Extracts all unique placeholders.
2. Builds a targeted Groq prompt asking the model to generate realistic values.
3. Parses the model's JSON response.
4. Returns the hydrated session dict.
"""
from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.getenv("groq_api") or os.getenv("GROQ_API_KEY")
        if not api_key:
            raise EnvironmentError("groq_api key not found in environment / .env")
        _client = Groq(api_key=api_key)
    return _client


def _extract_placeholders(obj: object) -> set[str]:
    """Walk any nested dict/list/str and collect all {{placeholder}} names."""
    placeholders: set[str] = set()
    if isinstance(obj, str):
        placeholders.update(re.findall(r"\{\{(\w+)\}\}", obj))
    elif isinstance(obj, dict):
        for v in obj.values():
            placeholders.update(_extract_placeholders(v))
    elif isinstance(obj, list):
        for item in obj:
            placeholders.update(_extract_placeholders(item))
    return placeholders


def _fill_object(obj: object, values: dict[str, str]) -> object:
    """Recursively replace {{key}} tokens with values from the dict."""
    if isinstance(obj, str):
        def _replace(m: re.Match) -> str:
            return str(values.get(m.group(1), m.group(0)))
        return re.sub(r"\{\{(\w+)\}\}", _replace, obj)
    if isinstance(obj, dict):
        return {k: _fill_object(v, values) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_fill_object(item, values) for item in obj]
    return obj


_SYSTEM_PROMPT = """\
You are a dataset generation assistant. Your job is to produce realistic, internally consistent values for a synthetic web scraping agent session log.

You will be given:
- A failure_subtype describing what kind of session this is.
- A list of placeholder names that need values.

Return ONLY a valid JSON object mapping each placeholder name to a realistic value string (or number where appropriate). Do not include any explanation or markdown fences. All values must be strings unless the field obviously needs a number (like latency_ms, tokens_used, content_length).

Guidelines:
- session_id: UUID v4 format
- timestamp: ISO 8601 UTC (e.g. "2025-11-03T14:22:05Z")
- duration_ms: realistic integer 800–45000
- latency_ms_*: realistic integer 80–4000
- stage_duration_ms_*: realistic integer 200–8000
- tokens_used: integer 400–8000
- url: a realistic full https URL to a real-seeming site (no localhost)
- prompt: a natural language scraping task description (1–2 sentences)
- json_schema: a short JSON Schema object string with 3–6 fields relevant to the prompt
- thinking_*: internal agent monologue, 2–4 sentences, relevant to the stage
- raw_html_snippet: a short realistic HTML fragment (under 300 chars)
- parsed_content: a JSON-serialisable string of extracted data relevant to the schema
- final_json_output: a JSON object string conforming to the schema
- error messages, selectors, proxies, sub_agent_ids, call_ids: realistic strings
- For failure sessions: make error messages, HTML snippets, etc. reflect the specific failure type
"""


def _build_user_prompt(failure_subtype: str, placeholders: set[str]) -> str:
    names = sorted(placeholders)
    return (
        f"failure_subtype: {failure_subtype}\n\n"
        f"Generate values for these placeholders:\n"
        + "\n".join(f"- {n}" for n in names)
    )


def hydrate_template(template: dict, failure_subtype: str, model: str = "llama-3.3-70b-versatile") -> dict:
    """
    Fill all {{placeholder}} fields in `template` using the Groq LLM.
    Returns the fully hydrated session dict.
    """
    placeholders = _extract_placeholders(template)

    # Pre-fill deterministic values so the LLM doesn't have to
    deterministic: dict[str, str] = {
        "session_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    remaining = placeholders - set(deterministic.keys())

    llm_values: dict[str, str] = {}
    if remaining:
        client = _get_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(failure_subtype, remaining)},
            ],
            temperature=0.9,
            max_tokens=2048,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        try:
            llm_values = json.loads(raw)
        except json.JSONDecodeError:
            # Best-effort: extract JSON block if wrapped in markdown
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            llm_values = json.loads(match.group()) if match else {}

    all_values = {**deterministic, **{k: str(v) for k, v in llm_values.items()}}
    return _fill_object(template, all_values)  # type: ignore[return-value]
