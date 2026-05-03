# Scraping Agent Eval Dataset

Synthetic dataset of 450 web-scraping agent session logs for evaluating LLM agents on 5 parameters: input handling, tool call correctness, resilience, output fidelity, and reasoning coherence.

---

## Structure

```
synth-dataset/
├── templates/
│   ├── success/          # 5 success subtypes
│   └── failures/
│       ├── input/        # 4 input validation failure subtypes
│       ├── tool/         # 5 tool execution failure subtypes
│       ├── intermediate/ # 4 intermediate processing failure subtypes
│       └── output/       # 4 final output failure subtypes
├── generator/
│   ├── template_loader.py   # loads & samples templates
│   ├── groq_filler.py       # LLM hydrates variable fields
│   ├── validator.py         # post-gen consistency checks
│   └── build_dataset.py     # orchestrator — full pipeline
└── dataset/
    ├── sessions.jsonl        # one session per line
    └── sessions_index.csv    # flat index: id, outcome, stage, subtype

evals/
├── eval_prompts.py           # versioned prompts for 5 eval parameters
├── eval_per_session.py       # score one session → JSON
├── eval_full_dataset.py      # batch all → scores.csv + reports
└── results/
    ├── results.json
    ├── scores.csv
    └── reports/
        ├── by_outcome.csv
        ├── by_failure_stage.csv
        └── summary_stats.json
```

---

## Quick Start

**1. Install dependencies**
```bash
uv sync
```

**2. Add Groq API key**
```
# .env
groq_api = <your_key>
```

**3. Generate the dataset**
```bash
# Full 450-session dataset
python synth-dataset/generator/build_dataset.py --count 450

# Dry run (validates templates, no LLM calls)
python synth-dataset/generator/build_dataset.py --dry-run --count 22
```

**4. Run evals**
```bash
# Score a single session
python evals/eval_per_session.py --session-id <uuid>

# Score the full dataset
python evals/eval_full_dataset.py
```

---

## Dataset Schema

Each session is a nested JSON object:

```
session_id, agent_version, timestamp, duration_ms,
task { prompt, url, json_schema },
outcome { status, failure_stage, failure_reason },
stages {
  input_validation, tool_execution,
  intermediate_processing, final_output
},
metadata { total_tool_calls, retries, tokens_used, pages_crawled },
failure_stage, failure_subtype, completion_rate
```

Each stage follows:
```
status: success | failure | skipped
thinking: { content, include_in_training: false }
divergence_check: { triggered, reason, action }
actions: [ tool calls ]
output: { raw, validated, errors }
fallbacks_triggered: [ ... ]
duration_ms
```

---

## Session Distribution (450 total)

| Category | Count | Subtypes |
|---|---|---|
| Success | 158 | clean_run, paginated_success, retry_then_succeed, proxy_rotation_success, schema_coercion_success |
| Input validation failures | 45 | malformed_schema, url_sanity_fail, auth_missing, prompt_ambiguity |
| Tool execution failures | 112 | tool_schema_error, false_tool_call, rate_limit_exhausted, ip_ban, pagination_failure |
| Intermediate processing failures | 90 | sub_agent_schema_fail, partial_content, encoding_error, sub_agent_timeout |
| Final output failures | 45 | empty_output, schema_nonconformance, hallucinated_fields, truncated_output |

---

## Eval Parameters

| Parameter | What it measures |
|---|---|
| Input Handling | Schema + URL validation, divergence checks |
| Tool Call Correctness | Well-formed, appropriate, correctly parameterised tool calls |
| Resilience & Recovery | Fallbacks, retries, proxy rotation |
| Output Fidelity | Schema conformance, groundedness, no hallucinations |
| Reasoning Coherence | Thinking blocks + divergence check logic vs. actual actions |

Scores are 0–10 per parameter; `overall_score` is the mean.

---

## Generation Strategy

1. **Templates** — 22 handcrafted JSON templates (one per subtype), with `{{placeholder}}` tokens for variable fields.
2. **LLM fill** — Groq `llama-3.3-70b-versatile` generates realistic values (prompts, URLs, HTML snippets, reasoning, errors).
3. **Validate** — `validator.py` checks required fields, no leftover placeholders, `failure_stage` consistency, `completion_rate` correctness, sub-agent count consistency.
4. **Output** — written to `sessions.jsonl` + flat `sessions_index.csv`.

`thinking` blocks are stored in the dataset but tagged `"include_in_training": false` — use them for eval judging, strip for model training.
