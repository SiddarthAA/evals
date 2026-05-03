// ── Action ──────────────────────────────────────────────────────────────────
export interface ActionError {
  type: string
  message: string
  recoverable: boolean
}

export interface Action {
  call_id: string
  tool_name: string
  input: unknown
  output: unknown
  http_status: number | null
  latency_ms: string | number
  success: boolean
  error: ActionError | null
}

// ── Stage ────────────────────────────────────────────────────────────────────
export interface Thinking {
  content: string
  include_in_training: boolean
}

export interface DivergenceCheck {
  triggered: boolean
  reason: string | null
  action: string
}

export interface StageOutput {
  raw: unknown
  validated: unknown
  errors: string[]
}

export interface Stage {
  stage_name: string
  status: "success" | "failure" | "skipped"
  thinking: Thinking
  divergence_check: DivergenceCheck
  actions: Action[]
  output: StageOutput | null
  fallbacks_triggered: string[]
  duration_ms: string | number
}

// ── Session ──────────────────────────────────────────────────────────────────
export interface Task {
  prompt: string
  url: string
  json_schema: string
}

export interface Outcome {
  status: "success" | "failure"
  failure_stage: string | null
  failure_reason: string | null
}

export interface Metadata {
  total_tool_calls: number | string
  retries: number | string
  tokens_used: number | string
  pages_crawled: number | string
}

export interface Session {
  session_id: string
  agent_version: string
  timestamp: string
  duration_ms: string | number
  task: Task
  outcome: Outcome
  stages: {
    input_validation: Stage
    tool_execution: Stage
    intermediate_processing: Stage
    final_output: Stage
  }
  metadata: Metadata
  failure_stage: string | null
  failure_subtype: string | null
  completion_rate: number | string
}

// ── Eval Results ─────────────────────────────────────────────────────────────
export const EVAL_PARAMS = [
  "input_handling",
  "tool_call_correctness",
  "resilience",
  "output_fidelity",
  "reasoning_coherence",
] as const

export type EvalParam = (typeof EVAL_PARAMS)[number]

export const EVAL_PARAM_LABELS: Record<EvalParam, string> = {
  input_handling: "Input Handling",
  tool_call_correctness: "Tool Call Correctness",
  resilience: "Resilience",
  output_fidelity: "Output Fidelity",
  reasoning_coherence: "Reasoning Coherence",
}

export interface EvalResult {
  session_id: string
  failure_stage: string | null
  failure_subtype: string | null
  outcome_status: string
  scores: Record<EvalParam, number | null>
  overall_score: number | null
  reasoning: Record<EvalParam, string | null>
  flagged_issues: Record<EvalParam, string[]>
}
