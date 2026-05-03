"""
eval_per_session.py — score a single session across all 5 eval parameters.

Usage:
    python eval_per_session.py --session-id <id> [--jsonl path/to/sessions.jsonl]
    python eval_per_session.py --session-file path/to/session.json

Output:
    JSON dict with session_id, 5 parameter scores, overall score, and full reasoning.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from groq import Groq

from eval_prompts import EVAL_PROMPTS

load_dotenv()

_DEFAULT_JSONL = Path(__file__).parent.parent / "synth-dataset" / "dataset" / "sessions.jsonl"


def _get_client() -> Groq:
    api_key = os.getenv("groq_api") or os.getenv("GROQ_API_KEY")
    if not api_key:
        raise EnvironmentError("groq_api key not found in .env")
    return Groq(api_key=api_key)


def _load_session_from_jsonl(session_id: str, jsonl_path: Path) -> dict:
    with jsonl_path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            session = json.loads(line)
            if session.get("session_id") == session_id:
                return session
    raise ValueError(f"session_id {session_id!r} not found in {jsonl_path}")


def _call_judge(client: Groq, prompt: str, model: str = "llama-3.3-70b-versatile") -> dict:
    """Call Groq and parse the JSON judge response."""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a strict JSON-only evaluator. "
                    "Return only a valid JSON object with no markdown, no extra text."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
        max_tokens=512,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content or "{}"
    return json.loads(raw)


def score_session(session: dict, model: str = "llama-3.3-70b-versatile") -> dict:
    """Run all 5 eval parameters and return a result dict."""
    client = _get_client()
    results: dict[str, dict] = {}

    for param, prompt_fn in EVAL_PROMPTS.items():
        prompt = prompt_fn(session)
        try:
            judgment = _call_judge(client, prompt, model=model)
        except Exception as exc:  # noqa: BLE001
            judgment = {"score": None, "reasoning": f"Eval error: {exc}", "flagged_issues": []}
        results[param] = judgment

    scores = [r.get("score") for r in results.values() if isinstance(r.get("score"), (int, float))]
    overall = round(sum(scores) / len(scores), 2) if scores else None

    return {
        "session_id": session.get("session_id"),
        "failure_stage": session.get("failure_stage"),
        "failure_subtype": session.get("failure_subtype"),
        "outcome_status": session.get("outcome", {}).get("status"),
        "scores": {param: r.get("score") for param, r in results.items()},
        "overall_score": overall,
        "reasoning": {param: r.get("reasoning") for param, r in results.items()},
        "flagged_issues": {param: r.get("flagged_issues", []) for param, r in results.items()},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Score a single session")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--session-id", help="session_id to look up in sessions.jsonl")
    group.add_argument("--session-file", type=Path, help="Path to a single session JSON file")
    parser.add_argument("--jsonl", type=Path, default=_DEFAULT_JSONL)
    parser.add_argument("--model", default="llama-3.3-70b-versatile")
    args = parser.parse_args()

    if args.session_file:
        session = json.loads(args.session_file.read_text(encoding="utf-8"))
    else:
        session = _load_session_from_jsonl(args.session_id, args.jsonl)

    result = score_session(session, model=args.model)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
