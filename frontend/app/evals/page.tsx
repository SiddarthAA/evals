"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { EVAL_PARAMS, EVAL_PARAM_LABELS, type EvalResult, type EvalParam } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell,
} from "recharts"
import {
  Play, Trash2, CheckCircle2, AlertCircle, Loader2,
  BarChart3, Upload, TrendingUp, TrendingDown, Minus,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// GRADE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getGrade(score: number | null): string {
  if (score === null) return "—"
  if (score >= 9) return "A"
  if (score >= 7) return "B"
  if (score >= 5) return "C"
  if (score >= 3) return "D"
  return "F"
}

function getGradeLabel(score: number | null): string {
  if (score === null) return "N/A"
  if (score >= 9) return "Excellent"
  if (score >= 7) return "Good"
  if (score >= 5) return "Adequate"
  if (score >= 3) return "Poor"
  return "Critical"
}

function gradeAccentClass(score: number | null): string {
  if (score === null) return "from-muted to-muted/50"
  if (score >= 9) return "from-emerald-500 to-emerald-400"
  if (score >= 7) return "from-blue-500 to-blue-400"
  if (score >= 5) return "from-amber-500 to-amber-400"
  if (score >= 3) return "from-orange-500 to-orange-400"
  return "from-red-600 to-red-500"
}

function gradeTextClass(score: number | null): string {
  if (score === null) return "text-muted-foreground"
  if (score >= 9) return "text-emerald-400"
  if (score >= 7) return "text-blue-400"
  if (score >= 5) return "text-amber-400"
  if (score >= 3) return "text-orange-400"
  return "text-red-400"
}

function gradeBgBorderClass(score: number | null): string {
  if (score === null) return "bg-muted/20 border-muted/20"
  if (score >= 9) return "bg-emerald-500/8 border-emerald-500/20"
  if (score >= 7) return "bg-blue-500/8 border-blue-500/20"
  if (score >= 5) return "bg-amber-500/8 border-amber-500/20"
  if (score >= 3) return "bg-orange-500/8 border-orange-500/20"
  return "bg-red-500/8 border-red-500/20"
}

function gradeRechartsColor(score: number | null): string {
  if (score === null) return "oklch(0.4 0 0)"
  if (score >= 9) return "oklch(0.62 0.18 162)"
  if (score >= 7) return "oklch(0.65 0.18 264)"
  if (score >= 5) return "oklch(0.72 0.18 84)"
  if (score >= 3) return "oklch(0.68 0.22 32)"
  return "oklch(0.62 0.22 25)"
}

// ─────────────────────────────────────────────────────────────────────────────
// METRIC HINTS — one-liner interpretation per score range
// ─────────────────────────────────────────────────────────────────────────────

const METRIC_HINTS: Record<EvalParam, [string, string, string, string, string]> = {
  input_handling: [
    "Consistently validated all task inputs without errors",
    "Handled most inputs correctly with only minor gaps",
    "Some input validation issues were detected",
    "Notable failures in input processing occurred",
    "Systematic input validation breakdowns throughout",
  ],
  tool_call_correctness: [
    "All tool selections were accurate and well-parameterised",
    "Mostly correct tool calls with minor imprecision",
    "Some incorrect or misparameterised tool calls observed",
    "Frequent tool call errors or hallucinated tools",
    "Systematic tool call failures throughout execution",
  ],
  resilience: [
    "Recovered gracefully from all encountered errors",
    "Good error recovery with appropriate fallback usage",
    "Partial recovery — some failures left unhandled",
    "Poor error recovery, cascading failures observed",
    "No meaningful error recovery was demonstrated",
  ],
  output_fidelity: [
    "Output precisely matched the requested JSON schema",
    "Output closely followed the expected structure",
    "Partial schema conformance with notable gaps",
    "Significant schema violations or missing fields",
    "Output did not conform to the requested format",
  ],
  reasoning_coherence: [
    "Reasoning was logical, complete and goal-focused",
    "Mostly coherent thinking with minor diversions",
    "Some gaps or unclear steps in the reasoning chain",
    "Frequent inconsistencies in the thinking process",
    "Incoherent or contradictory reasoning detected",
  ],
}

function getHint(param: EvalParam, score: number | null): string {
  if (score === null) return "Not evaluated"
  const hints = METRIC_HINTS[param]
  if (score >= 9) return hints[0]
  if (score >= 7) return hints[1]
  if (score >= 5) return hints[2]
  if (score >= 3) return hints[3]
  return hints[4]
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT
// ─────────────────────────────────────────────────────────────────────────────

function getVerdict(avg: number): { label: string; sub: string; trend: "up" | "neutral" | "down" } {
  if (avg >= 9) return { label: "Exceptional Agent", sub: "Performed at the highest standard across all evaluation criteria.", trend: "up" }
  if (avg >= 7.5) return { label: "Strong Performance", sub: "Agent is reliable and consistent with only minor gaps in a few areas.", trend: "up" }
  if (avg >= 6) return { label: "Moderate Performance", sub: "Competent on core tasks but with notable weaknesses that should be addressed.", trend: "neutral" }
  if (avg >= 4.5) return { label: "Below Average", sub: "Multiple evaluation criteria show significant failure patterns requiring attention.", trend: "down" }
  return { label: "Poor Performance", sub: "Agent failed to meet minimum standards across most evaluation criteria.", trend: "down" }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY PANEL
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  input_validation: "Input Validation",
  tool_execution: "Tool Execution",
  intermediate_processing: "Intermediate Processing",
  final_output: "Final Output",
}

function SummaryPanel({ results }: { results: EvalResult[] }) {
  const n = results.length
  const overallScores = results.map(r => r.overall_score).filter((s): s is number => s !== null)
  const avgOverall = overallScores.length > 0 ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length : 0
  const passRate = Math.round((results.filter(r => (r.overall_score ?? 0) >= 7).length / n) * 100)

  const perMetricAvgs = EVAL_PARAMS.map(param => {
    const vals = results.map(r => r.scores?.[param]).filter((v): v is number => typeof v === "number")
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    return { param, avg }
  })

  const totalFlagged = results.reduce((sum, r) =>
    sum + Object.values(r.flagged_issues ?? {}).reduce((s, arr) => s + (arr?.length ?? 0), 0), 0)

  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 }
  results.forEach(r => {
    const g = getGrade(r.overall_score) as keyof typeof gradeCounts
    if (g in gradeCounts) gradeCounts[g]++
  })

  const stageCounts: Record<string, number> = {}
  const subtypeCounts: Record<string, number> = {}
  results.forEach(r => {
    if (r.failure_stage) stageCounts[r.failure_stage] = (stageCounts[r.failure_stage] ?? 0) + 1
    if (r.failure_subtype) subtypeCounts[r.failure_subtype] = (subtypeCounts[r.failure_subtype] ?? 0) + 1
  })
  const topStage = Object.entries(stageCounts).sort((a, b) => b[1] - a[1])[0]
  const topSubtype = Object.entries(subtypeCounts).sort((a, b) => b[1] - a[1])[0]

  const allIssues: Array<{ param: EvalParam; issue: string; sessionId: string }> = []
  results.forEach(r => {
    EVAL_PARAMS.forEach(param => {
      ;(r.flagged_issues?.[param] ?? []).forEach(issue => {
        allIssues.push({ param, issue, sessionId: r.session_id })
      })
    })
  })

  const verdict = getVerdict(avgOverall)
  const TrendIcon = verdict.trend === "up" ? TrendingUp : verdict.trend === "down" ? TrendingDown : Minus
  const bestMetric = [...perMetricAvgs].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0]
  const worstMetric = [...perMetricAvgs].sort((a, b) => (a.avg ?? 10) - (b.avg ?? 10))[0]

  return (
    <div className="space-y-5">
      {/* Verdict hero */}
      <div className={cn("relative rounded-xl border overflow-hidden px-6 py-5", gradeBgBorderClass(avgOverall))}>
        <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", gradeAccentClass(avgOverall))} />
        <div className="absolute inset-0 bg-gradient-to-br from-current/3 via-transparent to-transparent opacity-30 pointer-events-none" />
        <div className="relative flex items-start justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <TrendIcon className={cn("size-4 shrink-0", gradeTextClass(avgOverall))} />
              <h2 className={cn("text-lg font-light tracking-tight", gradeTextClass(avgOverall))}>
                {verdict.label}
              </h2>
            </div>
            <p className="text-sm font-light text-muted-foreground/80 max-w-md leading-relaxed">{verdict.sub}</p>
            <div className="flex items-center gap-3 pt-1">
              <span className="text-[11px] font-light text-muted-foreground/50">
                Best: <span className={cn("font-medium", gradeTextClass(bestMetric.avg))}>{EVAL_PARAM_LABELS[bestMetric.param]}</span>
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[11px] font-light text-muted-foreground/50">
                Needs work: <span className="text-orange-400/80 font-medium">{EVAL_PARAM_LABELS[worstMetric.param]}</span>
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={cn("text-5xl font-thin tabular-nums leading-none", gradeTextClass(avgOverall))}>
              {avgOverall.toFixed(1)}
            </p>
            <p className="text-xs font-light text-muted-foreground/50 mt-1">avg score / 10</p>
            <p className={cn("text-base font-light mt-1.5", gradeTextClass(avgOverall))}>
              {getGrade(avgOverall)} — {getGradeLabel(avgOverall)}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Sessions evaluated", value: String(n), sub: "total in batch" },
          { label: "Pass rate", value: `${passRate}%`, sub: "score ≥ 7.0", highlight: passRate >= 70 },
          { label: "Flagged issues", value: String(totalFlagged), sub: "across all sessions", warn: totalFlagged > 0 },
          { label: "Top grade", value: getGrade(avgOverall), sub: getGradeLabel(avgOverall), graded: true },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card/40 px-4 py-3.5 space-y-2">
            <p className="text-[10px] font-light text-muted-foreground/50 uppercase tracking-widest">{stat.label}</p>
            <p className={cn(
              "text-3xl font-thin tabular-nums leading-none",
              stat.graded ? gradeTextClass(avgOverall) :
              stat.warn && totalFlagged > 0 ? "text-amber-400" :
              stat.highlight && passRate >= 70 ? "text-emerald-400" : "text-foreground"
            )}>
              {stat.value}
            </p>
            <p className="text-[10px] font-light text-muted-foreground/40">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Metric averages */}
      <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
            Metric Averages
          </h3>
          <p className="text-[10px] font-light text-muted-foreground/40">across {n} sessions</p>
        </div>
        <div className="divide-y divide-border/30">
          {perMetricAvgs.map(({ param, avg }) => (
            <div key={param} className="px-5 py-3.5 flex items-center gap-5">
              <div className="w-44 shrink-0">
                <p className="text-sm font-light text-foreground">{EVAL_PARAM_LABELS[param]}</p>
                <p className="text-[10px] font-light text-muted-foreground/50 mt-0.5 leading-tight">{getHint(param, avg)}</p>
              </div>
              <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={cn("h-full rounded-full bg-gradient-to-r transition-all", gradeAccentClass(avg))}
                  style={{ width: avg !== null ? `${(avg / 10) * 100}%` : "0%" }}
                />
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className={cn("text-sm font-light tabular-nums w-8 text-right", gradeTextClass(avg))}>
                  {avg !== null ? avg.toFixed(1) : "—"}
                </span>
                <span className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded border w-14 text-center",
                  gradeBgBorderClass(avg), gradeTextClass(avg)
                )}>
                  {getGrade(avg)} · {getGradeLabel(avg).slice(0, 4)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grade distribution + Failure analysis */}
      <div className="grid grid-cols-2 gap-4">
        {/* Grade distribution */}
        <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50">
            <h3 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
              Grade Distribution
            </h3>
          </div>
          <div className="px-5 py-4 space-y-3">
            {(["A", "B", "C", "D", "F"] as const).map(grade => {
              const scoreForGrade = { A: 9.5, B: 8.0, C: 6.0, D: 4.0, F: 2.0 }[grade]
              const count = gradeCounts[grade]
              const pct = n > 0 ? (count / n) * 100 : 0
              const ranges = { A: "9–10", B: "7–8.9", C: "5–6.9", D: "3–4.9", F: "0–2.9" }
              return (
                <div key={grade} className="flex items-center gap-3">
                  <span className={cn("text-xs font-medium w-4 text-center tabular-nums", gradeTextClass(scoreForGrade))}>{grade}</span>
                  <span className="text-[10px] font-light text-muted-foreground/40 w-12">{ranges[grade]}</span>
                  <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full bg-gradient-to-r", gradeAccentClass(scoreForGrade))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-light text-muted-foreground tabular-nums w-6 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Failure analysis */}
        <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50">
            <h3 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
              Failure Analysis
            </h3>
          </div>
          <div className="px-5 py-4 space-y-3.5">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1.5">Primary failure stage</p>
              {topStage ? (
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-light text-foreground">
                    {STAGE_LABELS[topStage[0]] ?? topStage[0]}
                  </p>
                  <p className="text-[10px] font-light text-muted-foreground/50">
                    {topStage[1]} / {n} sessions
                  </p>
                </div>
              ) : (
                <p className="text-sm font-light text-emerald-400/60">No failures recorded</p>
              )}
            </div>
            <Separator className="bg-border/40" />
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1.5">Most common failure type</p>
              {topSubtype ? (
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-light text-foreground font-mono">{topSubtype[0].replace(/_/g, " ")}</p>
                  <p className="text-[10px] font-light text-muted-foreground/50 font-sans">×{topSubtype[1]}</p>
                </div>
              ) : (
                <p className="text-sm font-light text-muted-foreground/40">None</p>
              )}
            </div>
            <Separator className="bg-border/40" />
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1.5">Success rate</p>
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-light text-foreground">
                  {results.filter(r => r.outcome_status === "success").length} / {n}
                </p>
                <p className="text-[10px] font-light text-muted-foreground/50">sessions completed successfully</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flagged issues */}
      {allIssues.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/3 overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-500/15 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-3.5 text-amber-400/70" />
              <h3 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                Flagged Issues
              </h3>
            </div>
            <Badge variant="outline" className="text-[10px] font-light text-amber-400 border-amber-500/30 bg-amber-500/5">
              {allIssues.length} total
            </Badge>
          </div>
          <Accordion type="multiple" className="divide-y divide-amber-500/10">
            {EVAL_PARAMS.map(param => {
              const issues = allIssues.filter(i => i.param === param)
              if (issues.length === 0) return null
              return (
                <AccordionItem key={param} value={param} className="border-none">
                  <AccordionTrigger className="px-5 py-3 text-xs font-light text-muted-foreground hover:text-foreground hover:no-underline hover:bg-amber-500/5">
                    <span className="flex items-center gap-2">
                      {EVAL_PARAM_LABELS[param]}
                      <span className="text-[9px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">
                        {issues.length}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-3 pt-0 space-y-2">
                    {issues.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs">
                        <span className="font-mono text-[10px] text-muted-foreground/40 mt-0.5 shrink-0 w-14">
                          {item.sessionId.slice(0, 6)}…
                        </span>
                        <p className="font-light text-foreground/60 leading-relaxed">{item.issue}</p>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE CARD
// ─────────────────────────────────────────────────────────────────────────────

function ScoreCard({ sessionId, result }: { sessionId: string; result: EvalResult }) {
  const grade = getGrade(result.overall_score)
  const gradeLabel = getGradeLabel(result.overall_score)

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Top gradient accent */}
      <div className={cn("h-px w-full bg-gradient-to-r", gradeAccentClass(result.overall_score))} />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1 min-w-0">
            <p className="font-mono text-[11px] text-muted-foreground/60 tracking-wider">
              {sessionId.slice(0, 14)}…
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] font-light border",
                  result.outcome_status === "success"
                    ? "bg-emerald-500/8 text-emerald-400 border-emerald-500/20"
                    : "bg-red-500/8 text-red-400 border-red-500/20"
                )}
              >
                {result.outcome_status}
              </Badge>
              {result.failure_stage && (
                <Badge variant="outline" className="text-[10px] font-light text-muted-foreground/50 border-border/40">
                  {result.failure_stage.replace(/_/g, " ")}
                </Badge>
              )}
              {result.failure_subtype && (
                <Badge variant="outline" className="text-[10px] font-light text-muted-foreground/40 border-border/30">
                  {result.failure_subtype.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
          </div>

          {/* Grade box */}
          <div className={cn(
            "flex flex-col items-center justify-center rounded-lg border px-3.5 py-2.5 shrink-0 min-w-[68px]",
            gradeBgBorderClass(result.overall_score)
          )}>
            <span className={cn("text-2xl font-thin leading-none", gradeTextClass(result.overall_score))}>
              {grade}
            </span>
            <span className={cn("text-[9px] font-light mt-0.5 opacity-70", gradeTextClass(result.overall_score))}>
              {gradeLabel}
            </span>
            <div className="w-full h-px bg-current opacity-10 my-1.5" />
            <span className={cn("text-lg font-thin tabular-nums leading-none", gradeTextClass(result.overall_score))}>
              {result.overall_score !== null ? result.overall_score.toFixed(1) : "—"}
            </span>
            <span className="text-[9px] font-light text-muted-foreground/40 mt-0.5">/ 10</span>
          </div>
        </div>

        {/* Metric rows */}
        <div className="space-y-3">
          {EVAL_PARAMS.map(param => {
            const score = result.scores?.[param] ?? null
            return (
              <div key={param} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-light text-muted-foreground/70">{EVAL_PARAM_LABELS[param]}</span>
                  <span className={cn("text-xs font-light tabular-nums shrink-0", gradeTextClass(score))}>
                    {score !== null ? `${score} · ${getGrade(score)}` : "—"}
                  </span>
                </div>
                <div className="h-0.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", gradeAccentClass(score))}
                    style={{ width: score !== null ? `${score * 10}%` : "0%" }}
                  />
                </div>
                <p className="text-[10px] font-light text-muted-foreground/40 leading-tight">{getHint(param, score)}</p>
              </div>
            )
          })}
        </div>

        {/* Flagged issues */}
        {Object.values(result.flagged_issues ?? {}).some(arr => arr?.length > 0) && (
          <Accordion type="single" collapsible>
            <AccordionItem value="issues" className="border border-amber-500/20 rounded-lg bg-amber-500/4">
              <AccordionTrigger className="px-3.5 py-2.5 text-[11px] font-light text-amber-400/80 hover:no-underline hover:text-amber-400">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="size-3" />
                  Flagged issues
                  <span className="text-[9px] bg-amber-500/15 border border-amber-500/20 px-1.5 py-0 rounded ml-0.5">
                    {Object.values(result.flagged_issues ?? {}).reduce((s, a) => s + (a?.length ?? 0), 0)}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3.5 pb-3 pt-0 space-y-2.5">
                {EVAL_PARAMS.map(param => {
                  const issues = result.flagged_issues?.[param]
                  if (!issues?.length) return null
                  return (
                    <div key={param}>
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1 font-medium">
                        {EVAL_PARAM_LABELS[param]}
                      </p>
                      {issues.map((issue, i) => (
                        <p key={i} className="text-[11px] font-light text-amber-300/70 pl-2.5 border-l border-amber-500/25 leading-relaxed mb-1">
                          {issue}
                        </p>
                      ))}
                    </div>
                  )
                })}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Reasoning */}
        <Accordion type="single" collapsible>
          <AccordionItem value="reasoning" className="border-none">
            <AccordionTrigger className="py-0 px-0 text-[11px] font-light text-muted-foreground/40 hover:text-muted-foreground hover:no-underline">
              Evaluator reasoning
            </AccordionTrigger>
            <AccordionContent className="pt-3 space-y-3">
              {EVAL_PARAMS.map(param => {
                const reasoning = result.reasoning?.[param]
                if (!reasoning) return null
                return (
                  <div key={param}>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1 font-medium">
                      {EVAL_PARAM_LABELS[param]}
                    </p>
                    <p className="text-xs font-light text-foreground/60 leading-relaxed">{reasoning}</p>
                  </div>
                )
              })}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RADAR VIEW
// ─────────────────────────────────────────────────────────────────────────────

function RadarView({ results }: { results: EvalResult[] }) {
  const avgScores = EVAL_PARAMS.map(param => {
    const vals = results.map(r => r.scores?.[param]).filter((v): v is number => typeof v === "number")
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    return { param: EVAL_PARAM_LABELS[param], score: Math.round(avg * 10) / 10 }
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={avgScores} outerRadius="75%">
        <PolarGrid stroke="oklch(0.22 0 0)" strokeDasharray="2 4" />
        <PolarAngleAxis dataKey="param" tick={{ fontSize: 11, fontWeight: 300, fill: "oklch(0.55 0 0)" }} />
        <Radar
          dataKey="score"
          fill="oklch(0.65 0.18 264)"
          fillOpacity={0.12}
          stroke="oklch(0.65 0.18 264)"
          strokeWidth={1.5}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DISTRIBUTION VIEW
// ─────────────────────────────────────────────────────────────────────────────

function DistributionView({ results }: { results: EvalResult[] }) {
  const data = results
    .map(r => ({ id: r.session_id.slice(0, 6), score: r.overall_score ?? 0, rawScore: r.overall_score }))
    .sort((a, b) => b.score - a.score)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.18 0 0)" vertical={false} />
        <XAxis
          dataKey="id"
          tick={{ fontSize: 10, fontWeight: 300, fill: "oklch(0.5 0 0)" }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          domain={[0, 10]}
          tick={{ fontSize: 10, fontWeight: 300, fill: "oklch(0.5 0 0)" }}
          axisLine={false} tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "oklch(0.13 0 0)",
            border: "1px solid oklch(0.22 0 0)",
            borderRadius: "0.5rem",
            fontSize: 12,
            fontWeight: 300,
          }}
          formatter={(val) => [`${val} / 10 · ${getGrade(Number(val))} (${getGradeLabel(Number(val))})`, "Score"]}
        />
        <Bar dataKey="score" radius={[3, 3, 0, 0]} maxBarSize={40}>
          {data.map((entry, i) => (
            <Cell key={i} fill={gradeRechartsColor(entry.rawScore)} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function EvalsPage() {
  const router = useRouter()
  const {
    sessions, selectedSessionIds, toggleSession, selectAllSessions, clearSelection,
    activeMetrics, toggleMetric, setAllMetrics,
    evalResults, isRunning, runningSessionId, addEvalResult, setIsRunning, clearEvalResults,
  } = useAppStore()

  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("summary")

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <BarChart3 className="size-10 text-muted-foreground/10" />
        <p className="text-sm font-light text-muted-foreground/50">No sessions loaded yet.</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/")} className="gap-2 font-light text-xs">
          <Upload className="size-3.5" /> Upload dataset
        </Button>
      </div>
    )
  }

  const selectedSessions = sessions.filter(s => selectedSessionIds.has(s.session_id))
  const resultsArray = Array.from(evalResults.values())

  async function runEvals() {
    if (isRunning || selectedSessions.length === 0) return
    setError(null)
    setIsRunning(true)

    for (const session of selectedSessions) {
      setIsRunning(true, session.session_id)
      try {
        const res = await fetch("/api/eval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? "Unknown error"); break }
        addEvalResult(data as EvalResult)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed")
        break
      }
    }
    setIsRunning(false)
    setActiveTab("summary")
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left panel ── */}
      <div className="w-60 shrink-0 border-r border-border/50 flex flex-col bg-sidebar/20">
        <div className="px-5 py-4 border-b border-border/50">
          <h1 className="text-xs font-light tracking-widest uppercase text-muted-foreground/60 flex items-center gap-2">
            <BarChart3 className="size-3.5 text-primary/60" />
            Eval Runner
          </h1>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 py-5 space-y-6">
            {/* Metrics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40">
                  Metrics
                </h3>
                <button
                  className="text-[10px] font-light text-primary/60 hover:text-primary transition-colors"
                  onClick={() => setAllMetrics(activeMetrics.size < EVAL_PARAMS.length)}
                >
                  {activeMetrics.size < EVAL_PARAMS.length ? "select all" : "clear"}
                </button>
              </div>
              <div className="space-y-2">
                {EVAL_PARAMS.map(param => (
                  <label key={param} className="flex items-center gap-2.5 cursor-pointer group">
                    <Checkbox
                      checked={activeMetrics.has(param)}
                      onCheckedChange={() => toggleMetric(param)}
                      className="border-border/50 size-3.5"
                    />
                    <span className="text-[11px] font-light text-muted-foreground/60 group-hover:text-muted-foreground transition-colors leading-tight">
                      {EVAL_PARAM_LABELS[param]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <Separator className="bg-border/30" />

            {/* Sessions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40">
                  Sessions{" "}
                  <span className="normal-case font-light text-muted-foreground/30">
                    ({selectedSessionIds.size}/{sessions.length})
                  </span>
                </h3>
                <button
                  className="text-[10px] font-light text-primary/60 hover:text-primary transition-colors"
                  onClick={() => selectedSessionIds.size === sessions.length ? clearSelection() : selectAllSessions()}
                >
                  {selectedSessionIds.size === sessions.length ? "clear" : "all"}
                </button>
              </div>
              <div className="space-y-0.5 max-h-60 overflow-y-auto -mr-1 pr-1">
                {sessions.map(s => (
                  <label
                    key={s.session_id}
                    className="flex items-center gap-2 cursor-pointer group rounded-lg px-2 py-1.5 hover:bg-accent/10 transition-colors"
                  >
                    <Checkbox
                      checked={selectedSessionIds.has(s.session_id)}
                      onCheckedChange={() => toggleSession(s.session_id)}
                      className="border-border/50 size-3.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[10px] text-muted-foreground/50 truncate group-hover:text-muted-foreground/80">
                        {s.session_id.slice(0, 14)}…
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn(
                          "text-[9px] font-light",
                          s.outcome?.status === "success" ? "text-emerald-400/50" : "text-red-400/50"
                        )}>
                          {s.outcome?.status}
                        </span>
                        {evalResults.has(s.session_id) && (
                          <CheckCircle2 className="size-2.5 text-primary/50" />
                        )}
                        {runningSessionId === s.session_id && (
                          <Loader2 className="size-2.5 text-primary/70 animate-spin" />
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Run button */}
        <div className="px-4 py-4 border-t border-border/40 space-y-2.5">
          {error && (
            <p className="text-[11px] font-light text-destructive/80 flex items-start gap-1.5 leading-relaxed">
              <AlertCircle className="size-3 mt-0.5 shrink-0" />
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              className="flex-1 gap-2 font-light text-xs h-8"
              disabled={isRunning || selectedSessions.length === 0 || activeMetrics.size === 0}
              onClick={runEvals}
            >
              {isRunning ? (
                <><Loader2 className="size-3.5 animate-spin" /> Evaluating…</>
              ) : (
                <><Play className="size-3.5" /> Run{selectedSessions.length > 0 ? ` (${selectedSessions.length})` : ""}</>
              )}
            </Button>
            {resultsArray.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                className="size-8 border-border/50 shrink-0"
                title="Clear results"
                onClick={clearEvalResults}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {resultsArray.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <BarChart3 className="size-12 text-muted-foreground/8" />
            <p className="text-sm font-light text-muted-foreground/30">
              Select sessions and run evals to see results.
            </p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-border/50 px-6 py-2.5 flex items-center justify-between shrink-0">
              <TabsList className="bg-transparent h-7 p-0 gap-1">
                {[
                  { value: "summary", label: "Summary" },
                  { value: "cards", label: "Score Cards" },
                  { value: "radar", label: "Radar" },
                  { value: "distribution", label: "Distribution" },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-6 px-3 text-[11px] font-light rounded-md border border-transparent data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:border-primary/20 text-muted-foreground/50 hover:text-muted-foreground"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="flex items-center gap-2 text-[11px] font-light text-muted-foreground/40">
                {isRunning && <Loader2 className="size-3 animate-spin text-primary/60" />}
                {resultsArray.length} session{resultsArray.length !== 1 ? "s" : ""} evaluated
              </div>
            </div>

            <TabsContent value="summary" className="flex-1 overflow-auto m-0">
              <div className="max-w-3xl mx-auto px-6 py-6">
                <SummaryPanel results={resultsArray} />
              </div>
            </TabsContent>

            <TabsContent value="cards" className="flex-1 overflow-auto m-0">
              <div className="p-6 grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                {resultsArray.map(result => (
                  <ScoreCard key={result.session_id} sessionId={result.session_id} result={result} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="radar" className="flex-1 overflow-auto m-0">
              <div className="max-w-2xl mx-auto p-6 space-y-4">
                <div className="rounded-xl border border-border/60 bg-card/30 p-6">
                  <h3 className="text-sm font-light text-foreground">Capability Radar</h3>
                  <p className="text-xs font-light text-muted-foreground/50 mb-5 mt-0.5">
                    Average score per metric · {resultsArray.length} sessions
                  </p>
                  <RadarView results={resultsArray} />
                </div>
                {/* Score table */}
                <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50 bg-secondary/10">
                        <th className="py-2.5 px-4 text-left text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40">Session</th>
                        <th className="py-2.5 px-4 text-center text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40">Grade</th>
                        <th className="py-2.5 px-4 text-right text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40">Overall</th>
                        {EVAL_PARAMS.map(p => (
                          <th key={p} className="py-2.5 px-3 text-right text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40">
                            {EVAL_PARAM_LABELS[p].split(" ")[0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultsArray.map(r => (
                        <tr key={r.session_id} className="border-b border-border/30 hover:bg-accent/8 transition-colors">
                          <td className="py-2 px-4 font-mono text-[10px] text-muted-foreground/50">{r.session_id.slice(0, 10)}…</td>
                          <td className={cn("py-2 px-4 text-center text-xs font-medium tabular-nums", gradeTextClass(r.overall_score))}>
                            {getGrade(r.overall_score)}
                          </td>
                          <td className={cn("py-2 px-4 text-right text-sm font-thin tabular-nums", gradeTextClass(r.overall_score))}>
                            {r.overall_score?.toFixed(1) ?? "—"}
                          </td>
                          {EVAL_PARAMS.map(p => (
                            <td key={p} className={cn("py-2 px-3 text-right text-xs font-light tabular-nums", gradeTextClass(r.scores?.[p] ?? null))}>
                              {r.scores?.[p] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="distribution" className="flex-1 overflow-auto m-0">
              <div className="max-w-3xl mx-auto p-6">
                <div className="rounded-xl border border-border/60 bg-card/30 p-6">
                  <h3 className="text-sm font-light text-foreground">Score Distribution</h3>
                  <p className="text-xs font-light text-muted-foreground/50 mt-0.5 mb-5">
                    Overall score per session, sorted descending · bar colour = grade (A green → F red)
                  </p>
                  <DistributionView results={resultsArray} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
