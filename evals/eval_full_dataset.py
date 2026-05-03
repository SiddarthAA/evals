"""
eval_full_dataset.py — batch-score every session in sessions.jsonl.

Usage:
    python eval_full_dataset.py [--jsonl path] [--output-dir path] [--model name]

Outputs (written to results/):
    results.json          — full reasoning per session
    scores.csv            — flat: session_id + 5 scores + overall
    reports/by_outcome.csv
    reports/by_failure_stage.csv
    reports/summary_stats.json
"""
from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from eval_per_session import score_session

_DEFAULT_JSONL = Path(__file__).parent.parent / "synth-dataset" / "dataset" / "sessions.jsonl"
_DEFAULT_RESULTS_DIR = Path(__file__).parent / "results"

_SCORE_PARAMS = ["input_handling", "tool_call_correctness", "resilience", "output_fidelity", "reasoning_coherence"]
_SCORES_CSV_FIELDS = ["session_id", "outcome_status", "failure_stage", "failure_subtype"] + _SCORE_PARAMS + ["overall_score"]


# ---------------------------------------------------------------------------
# Aggregation helpers
# ---------------------------------------------------------------------------

def _group_scores(
    all_results: list[dict],
    group_key: str,
) -> dict[str, dict[str, list[float]]]:
    """Group results by a field and collect per-parameter score lists."""
    groups: dict[str, dict[str, list[float]]] = {}
    for r in all_results:
        key = r.get(group_key) or "null"
        if key not in groups:
            groups[key] = {p: [] for p in _SCORE_PARAMS + ["overall_score"]}
        for p in _SCORE_PARAMS:
            s = r["scores"].get(p)
            if isinstance(s, (int, float)):
                groups[key][p].append(float(s))
        ov = r.get("overall_score")
        if isinstance(ov, (int, float)):
            groups[key]["overall_score"].append(float(ov))
    return groups


def _agg_row(group_name: str, score_lists: dict[str, list[float]]) -> dict:
    row: dict = {"group": group_name}
    for param, vals in score_lists.items():
        if vals:
            row[f"{param}_mean"] = round(statistics.mean(vals), 3)
            row[f"{param}_median"] = round(statistics.median(vals), 3)
            row[f"{param}_std"] = round(statistics.stdev(vals) if len(vals) > 1 else 0.0, 3)
            row[f"{param}_n"] = len(vals)
        else:
            row[f"{param}_mean"] = None
            row[f"{param}_median"] = None
            row[f"{param}_std"] = None
            row[f"{param}_n"] = 0
    return row


def _write_group_csv(path: Path, groups: dict[str, dict[str, list[float]]]) -> None:
    params_cols = _SCORE_PARAMS + ["overall_score"]
    fieldnames = ["group"] + [f"{p}_{s}" for p in params_cols for s in ("mean", "median", "std", "n")]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for group_name, score_lists in sorted(groups.items()):
            writer.writerow(_agg_row(group_name, score_lists))


def _compute_summary_stats(all_results: list[dict]) -> dict:
    stats: dict = {}
    for param in _SCORE_PARAMS + ["overall_score"]:
        if param == "overall_score":
            vals = [r["overall_score"] for r in all_results if isinstance(r.get("overall_score"), (int, float))]
        else:
            vals = [r["scores"].get(param) for r in all_results if isinstance(r["scores"].get(param), (int, float))]
        if vals:
            stats[param] = {
                "mean": round(statistics.mean(vals), 3),
                "median": round(statistics.median(vals), 3),
                "std": round(statistics.stdev(vals) if len(vals) > 1 else 0.0, 3),
                "min": min(vals),
                "max": max(vals),
                "n": len(vals),
            }
        else:
            stats[param] = {"n": 0}
    return stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run_eval(jsonl_path: Path, results_dir: Path, model: str) -> None:
    results_dir.mkdir(parents=True, exist_ok=True)
    reports_dir = results_dir / "reports"
    reports_dir.mkdir(exist_ok=True)

    results_path = results_dir / "results.json"
    scores_path = results_dir / "scores.csv"

    all_results: list[dict] = []

    with jsonl_path.open(encoding="utf-8") as jf, \
         scores_path.open("w", newline="", encoding="utf-8") as csf:

        score_writer = csv.DictWriter(csf, fieldnames=_SCORES_CSV_FIELDS)
        score_writer.writeheader()

        sessions = [json.loads(line) for line in jf if line.strip()]
        total = len(sessions)
        print(f"Scoring {total} sessions → {results_dir}")

        for i, session in enumerate(sessions, 1):
            sid = session.get("session_id", f"unknown_{i}")
            print(f"  [{i:>4}/{total}] {sid[:8]}...", end=" ", flush=True)
            try:
                result = score_session(session, model=model)
                all_results.append(result)

                csv_row = {
                    "session_id": result["session_id"],
                    "outcome_status": result["outcome_status"],
                    "failure_stage": result["failure_stage"] or "",
                    "failure_subtype": result["failure_subtype"] or "",
                    **{p: result["scores"].get(p, "") for p in _SCORE_PARAMS},
                    "overall_score": result["overall_score"] or "",
                }
                score_writer.writerow(csv_row)
                csf.flush()
                print(f"overall={result['overall_score']}")
            except Exception as exc:  # noqa: BLE001
                print(f"ERROR: {exc}", file=sys.stderr)

            time.sleep(0.2)

    # Write full results JSON
    results_path.write_text(json.dumps(all_results, indent=2, ensure_ascii=False), encoding="utf-8")

    # Reports
    by_outcome = _group_scores(all_results, "outcome_status")
    _write_group_csv(reports_dir / "by_outcome.csv", by_outcome)

    by_stage = _group_scores(all_results, "failure_stage")
    _write_group_csv(reports_dir / "by_failure_stage.csv", by_stage)

    summary = _compute_summary_stats(all_results)
    (reports_dir / "summary_stats.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )

    print(f"\nResults written:")
    print(f"  {results_path}")
    print(f"  {scores_path}")
    print(f"  {reports_dir}/")


def main() -> None:
    parser = argparse.ArgumentParser(description="Score the full dataset")
    parser.add_argument("--jsonl", type=Path, default=_DEFAULT_JSONL)
    parser.add_argument("--output-dir", type=Path, default=_DEFAULT_RESULTS_DIR)
    parser.add_argument("--model", default="llama-3.3-70b-versatile")
    args = parser.parse_args()

    if not args.jsonl.exists():
        print(f"Error: JSONL file not found: {args.jsonl}", file=sys.stderr)
        sys.exit(1)

    run_eval(args.jsonl, args.output_dir, args.model)


if __name__ == "__main__":
    main()
