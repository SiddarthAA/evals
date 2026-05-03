"""
build_dataset.py — orchestrator for the full dataset generation pipeline.

Usage:
    python build_dataset.py [--count 450] [--batch-size 25] [--output-dir ../dataset]

Steps:
1. Load template plan (template_loader.sample_plan)
2. For each session: load template → fill with Groq → validate → write
3. Write sessions.jsonl and sessions_index.csv on completion

Run with --dry-run to validate templates without calling the LLM.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from pathlib import Path

# Allow running from any working directory
sys.path.insert(0, str(Path(__file__).parent))

from groq_filler import hydrate_template
from template_loader import load_template, sample_plan
from validator import validate_session

_DEFAULT_OUTPUT_DIR = Path(__file__).parent.parent / "dataset"
_INDEX_FIELDS = ["session_id", "outcome", "failure_stage", "failure_subtype", "completion_rate"]


def _generate_session(outcome: str, subtype: str, dry_run: bool) -> dict | None:
    template = load_template(outcome, subtype)
    if dry_run:
        return template
    hydrated = hydrate_template(template, failure_subtype=subtype)
    errors = validate_session(hydrated)
    if errors:
        print(f"  [WARN] Validation failed ({subtype}): {errors[:3]}", file=sys.stderr)
        return None
    return hydrated


def _index_row(session: dict) -> dict:
    return {
        "session_id": session.get("session_id", ""),
        "outcome": session.get("outcome", {}).get("status", ""),
        "failure_stage": session.get("failure_stage") or "",
        "failure_subtype": session.get("failure_subtype") or "",
        "completion_rate": session.get("completion_rate", ""),
    }


def build(count: int, batch_size: int, output_dir: Path, dry_run: bool) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    jsonl_path = output_dir / "sessions.jsonl"
    index_path = output_dir / "sessions_index.csv"

    plan = sample_plan(count)
    total = len(plan)
    print(f"Generating {total} sessions → {output_dir}")

    written = 0
    skipped = 0

    with jsonl_path.open("w", encoding="utf-8") as jsonl_file, \
         index_path.open("w", newline="", encoding="utf-8") as csv_file:

        writer = csv.DictWriter(csv_file, fieldnames=_INDEX_FIELDS)
        writer.writeheader()

        for batch_start in range(0, total, batch_size):
            batch = plan[batch_start: batch_start + batch_size]
            print(f"\nBatch {batch_start // batch_size + 1}: sessions {batch_start + 1}–{batch_start + len(batch)}")

            for i, (outcome, subtype) in enumerate(batch):
                seq = batch_start + i + 1
                print(f"  [{seq:>4}/{total}] {outcome}/{subtype}", end=" ", flush=True)
                try:
                    session = _generate_session(outcome, subtype, dry_run)
                    if session is None:
                        print("SKIPPED")
                        skipped += 1
                        continue
                    jsonl_file.write(json.dumps(session, ensure_ascii=False) + "\n")
                    writer.writerow(_index_row(session))
                    written += 1
                    print("OK")
                except Exception as exc:  # noqa: BLE001
                    print(f"ERROR: {exc}", file=sys.stderr)
                    skipped += 1

                if not dry_run:
                    time.sleep(0.3)  # polite rate limiting against Groq

            jsonl_file.flush()
            csv_file.flush()
            print(f"  Batch complete. Written so far: {written}")

    print(f"\nDone. Written: {written}, Skipped/Errors: {skipped}")
    print(f"  JSONL: {jsonl_path}")
    print(f"  Index: {index_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the scraping agent eval dataset")
    parser.add_argument("--count", type=int, default=450, help="Total sessions to generate (default: 450)")
    parser.add_argument("--batch-size", type=int, default=25, help="Sessions per batch (default: 25)")
    parser.add_argument("--output-dir", type=Path, default=_DEFAULT_OUTPUT_DIR, help="Output directory")
    parser.add_argument("--dry-run", action="store_true", help="Validate templates without LLM calls")
    args = parser.parse_args()

    build(
        count=args.count,
        batch_size=args.batch_size,
        output_dir=args.output_dir,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
