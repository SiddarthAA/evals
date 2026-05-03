# Scraping Agent Eval Dataset

I wanted a real eval harness for LLM agents, not toy benchmarks. So I built one from scratch — 450 synthetic web-scraping agent sessions, a structured LLM-judge eval pipeline, and a frontend dashboard to explore and score sessions interactively.

The dataset covers the full failure surface of a scraping agent: bad inputs, broken tool calls, pagination failures, IP bans, sub-agent timeouts, hallucinated output fields, and more. The eval system scores each session across 5 parameters using `llama-3.3-70b-versatile` as the judge. Everything is deterministic and reproducible.

---

## What's in here

```
build/
├── synth-dataset/
│   ├── templates/            # 22 handcrafted session templates (one per subtype)
│   │   ├── success/          # 5 success subtypes
│   │   └── failures/
│   │       ├── input/        # 4 input validation failure subtypes
│   │       ├── tool/         # 5 tool execution failure subtypes
│   │       ├── intermediate/ # 4 intermediate processing failure subtypes
│   │       └── output/       # 4 final output failure subtypes
│   ├── generator/
│   │   ├── template_loader.py   # loads & samples templates
│   │   ├── groq_filler.py       # LLM hydrates variable fields
│   │   ├── validator.py         # post-gen consistency checks
│   │   └── build_dataset.py     # orchestrator — runs the full pipeline
│   └── dataset/
│       ├── sessions.jsonl        # 448 sessions, one per line
│       └── sessions_index.csv    # flat index: id, outcome, stage, subtype
├── evals/
│   ├── eval_prompts.py           # prompts for all 5 eval parameters
│   ├── eval_per_session.py       # score a single session → JSON
│   ├── eval_full_dataset.py      # batch eval → scores.csv + reports
│   └── results/
│       ├── results.json
│       ├── scores.csv
│       └── reports/
│           ├── by_outcome.csv
│           ├── by_failure_stage.csv
│           └── summary_stats.json
├── frontend/                     # Next.js dashboard
├── pyproject.toml
└── uv.lock
```

---

## Setup

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) for Python env management
- Node.js 18+ and npm (for the frontend)
- A [Groq API key](https://console.groq.com/)

### 1. Python environment

```bash
# Clone and enter the repo
git clone https://github.com/SiddarthAA/evals.git
cd evals

# Create the venv and install all dependencies from the lockfile
uv sync
```

### 2. Environment variables

Create a `.env` file in the project root:

```
groq_api=your_groq_api_key_here
```

> Note: the key name is `groq_api`, not `GROQ_API_KEY`.

### 3. Frontend dashboard

```bash
cd frontend
npm install
npm run dev
```

The dashboard runs at `http://localhost:3000` by default.

---

## Generating the dataset

The dataset is already included in `synth-dataset/dataset/`. If you want to regenerate it or create a custom version:

```bash
# Full run — generates 450 sessions (costs ~a few hundred Groq calls)
.venv/bin/python synth-dataset/generator/build_dataset.py --count 450

# Dry run — validates all 22 templates without any LLM calls
.venv/bin/python synth-dataset/generator/build_dataset.py --dry-run --count 22
```

The pipeline is: load template → LLM fills variable fields → validator checks consistency → write to JSONL.

---

## Running evals

### Score a single session

```bash
.venv/bin/python evals/eval_per_session.py --session-id <uuid>
```

You can also pass a raw session JSON file:

```bash
.venv/bin/python evals/eval_per_session.py --session-file path/to/session.json
```

The output is a JSON object with per-parameter scores, reasoning, and any flagged issues:

```json
{
  "session_id": "df6b3254-185a-4e9c-b5e8-26626f7544d9",
  "scores": {
    "input_handling": 8.5,
    "tool_call_correctness": 7.0,
    "resilience": 9.0,
    "output_fidelity": 6.5,
    "reasoning_coherence": 8.0
  },
  "overall_score": 7.8,
  "reasoning": { ... },
  "flagged_issues": [ ... ]
}
```

### Score the full dataset

```bash
.venv/bin/python evals/eval_full_dataset.py
```

Results are written to `evals/results/` — `scores.csv` with per-session scores and `reports/` with aggregated breakdowns by outcome and failure stage.

---

## How the eval system works

The eval is a **deterministic LLM-judge pipeline**, not an agent. For each session, it makes 5 sequential Groq API calls — one per parameter — each with a focused prompt and `temperature=0.1`. Every call is forced to return a JSON object with `score`, `reasoning`, and `flagged_issues`.

The judge sees different parts of the session depending on what it's evaluating:

| Parameter | What the judge sees |
|---|---|
| `input_handling` | Task prompt, URL, JSON schema, input validation stage |
| `tool_call_correctness` | Tool execution stage actions and outputs |
| `resilience` | Fallbacks, retries, error recovery across all stages |
| `output_fidelity` | Final output vs. requested schema and task prompt |
| `reasoning_coherence` | Thinking blocks vs. divergence checks vs. actual actions |

`overall_score` is the arithmetic mean of all 5 parameter scores.

**Grade scale:** A (9–10) · B (7–8.9) · C (5–6.9) · D (3–4.9) · F (0–2.9)

---

## Dataset breakdown (448 sessions)

| Category | Count | Subtypes |
|---|---|---|
| Success | ~158 | `clean_run`, `paginated_success`, `retry_then_succeed`, `proxy_rotation_success`, `schema_coercion_success` |
| Input validation failures | ~45 | `malformed_schema`, `url_sanity_fail`, `auth_missing`, `prompt_ambiguity` |
| Tool execution failures | ~112 | `tool_schema_error`, `false_tool_call`, `rate_limit_exhausted`, `ip_ban`, `pagination_failure` |
| Intermediate processing failures | ~90 | `sub_agent_schema_fail`, `partial_content`, `encoding_error`, `sub_agent_timeout` |
| Final output failures | ~45 | `empty_output`, `schema_nonconformance`, `hallucinated_fields`, `truncated_output` |

---

## Session schema

Each session is a fully nested JSON object:

```
session_id, agent_version, timestamp, duration_ms
task {
  prompt, url, json_schema
}
outcome {
  status, failure_stage, failure_reason
}
stages {
  input_validation, tool_execution,
  intermediate_processing, final_output
}
metadata {
  total_tool_calls, retries, tokens_used, pages_crawled
}
failure_stage, failure_subtype, completion_rate
```

Each stage has the same shape:

```
status:             success | failure | skipped
thinking:           { content, include_in_training: false }
divergence_check:   { triggered, reason, action }
actions:            [ tool calls with args + outputs ]
output:             { raw, validated, errors }
fallbacks_triggered: [ ... ]
duration_ms
```

`thinking` blocks are included for eval judging but tagged `include_in_training: false` — strip them if you're using sessions for fine-tuning.

---

## Generation strategy

1. **22 handcrafted templates** — one per failure subtype, with `{{placeholder}}` tokens for every variable field (URLs, prompts, HTML snippets, error messages, reasoning content, tool args, etc.)
2. **LLM fill** — `groq_filler.py` prompts `llama-3.3-70b-versatile` to generate realistic, contextually appropriate values for each placeholder
3. **Validation** — `validator.py` enforces: required fields present, no unresolved placeholders, `failure_stage` matches `outcome.status`, `completion_rate` consistent with which stages passed, sub-agent counts coherent
4. **Output** — written to `sessions.jsonl` (one session per line) and a flat `sessions_index.csv` for quick filtering

---

## Frontend dashboard

The Next.js dashboard at `frontend/` has four main views:

- **Upload** — drop in a custom `sessions.jsonl` to replace the default dataset
- **Sessions** — browse all sessions with filters by outcome, failure stage, and subtype
- **Session detail** — full session breakdown with stage-by-stage inspection
- **Evals** — run the eval pipeline on any session and see scores, grade, per-parameter reasoning, and a radar chart

Built with Next.js, React 19, Tailwind v4, shadcn/ui, Recharts, and Zustand.

---

## Stack

| Layer | Tech |
|---|---|
| Dataset generation | Python, Groq (`llama-3.3-70b-versatile`) |
| Eval judge | Groq (`llama-3.3-70b-versatile`), `eval_per_session.py` |
| Frontend | Next.js, React 19, Tailwind v4, shadcn/ui, Recharts |
| Package management | uv (Python), npm (frontend) |
