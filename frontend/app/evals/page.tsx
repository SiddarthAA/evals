"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { EVAL_PARAMS, EVAL_PARAM_LABELS, type EvalResult, type EvalParam } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import {
  Play,
  StopCircle,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BarChart3,
  Upload,
} from "lucide-react"

// ── Score Colours ────────────────────────────────────────────────────────────
function scoreColour(score: number | null): string {
  if (score === null) return "text-muted-foreground"
  if (score >= 8) return "text-emerald-400"
  if (score >= 5) return "text-amber-400"
  return "text-destructive"
}

function scoreBarColour(score: number | null): string {
  if (score === null) return "bg-muted"
  if (score >= 8) return "bg-emerald-500"
  if (score >= 5) return "bg-amber-400"
  return "bg-destructive"
}

// ── ScoreCard ─────────────────────────────────────────────────────────────────
function ScoreCard({
  sessionId,
  result,
}: {
  sessionId: string
  result: EvalResult
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="font-mono text-xs text-muted-foreground">{sessionId.slice(0, 8)}…</p>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                result.outcome_status === "success"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                  : "bg-destructive/15 text-destructive border-destructive/20"
              )}
            >
              {result.outcome_status}
            </Badge>
            {result.failure_subtype && (
              <Badge variant="outline" className="text-[10px]">
                {result.failure_subtype}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">
            <span className={scoreColour(result.overall_score)}>
              {result.overall_score !== null ? result.overall_score.toFixed(1) : "—"}
            </span>
            <span className="text-sm text-muted-foreground">/10</span>
          </p>
          <p className="text-[10px] text-muted-foreground">overall</p>
        </div>
      </div>

      {/* Per-param scores */}
      <div className="space-y-2">
        {EVAL_PARAMS.map((param) => {
          const score = result.scores?.[param] ?? null
          return (
            <div key={param} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{EVAL_PARAM_LABELS[param]}</span>
                <span className={cn("font-semibold tabular-nums", scoreColour(score))}>
                  {score !== null ? score : "—"}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", scoreBarColour(score))}
                  style={{ width: score !== null ? `${score * 10}%` : "0%" }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Flagged issues */}
      {Object.values(result.flagged_issues ?? {}).some((arr) => arr?.length > 0) && (
        <Accordion type="single" collapsible>
          <AccordionItem value="issues" className="border-none">
            <AccordionTrigger className="py-0 text-xs text-amber-400 hover:no-underline">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="size-3" />
                Flagged issues
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-2">
              {EVAL_PARAMS.map((param) => {
                const issues = result.flagged_issues?.[param]
                if (!issues?.length) return null
                return (
                  <div key={param} className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {EVAL_PARAM_LABELS[param]}
                    </p>
                    {issues.map((issue, i) => (
                      <p key={i} className="text-xs text-amber-400 pl-2 border-l border-amber-500/30">
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

      {/* Reasoning accordion */}
      <Accordion type="single" collapsible>
        <AccordionItem value="reasoning" className="border-none">
          <AccordionTrigger className="py-0 text-xs text-muted-foreground hover:text-foreground hover:no-underline">
            Detailed reasoning
          </AccordionTrigger>
          <AccordionContent className="pt-2 space-y-3">
            {EVAL_PARAMS.map((param) => {
              const reasoning = result.reasoning?.[param]
              if (!reasoning) return null
              return (
                <div key={param} className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {EVAL_PARAM_LABELS[param]}
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{reasoning}</p>
                </div>
              )
            })}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

// ── RadarView ─────────────────────────────────────────────────────────────────
function RadarView({ results }: { results: EvalResult[] }) {
  if (results.length === 0) return null

  // Average scores across all results
  const avgScores = EVAL_PARAMS.map((param) => {
    const values = results
      .map((r) => r.scores?.[param])
      .filter((v): v is number => typeof v === "number")
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
    return { param: EVAL_PARAM_LABELS[param].replace(" ", "\n"), score: avg }
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={avgScores}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey="param"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <Radar
          dataKey="score"
          fill="hsl(var(--primary))"
          fillOpacity={0.25}
          stroke="hsl(var(--primary))"
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ── BarView ───────────────────────────────────────────────────────────────────
function BarView({ results }: { results: EvalResult[] }) {
  if (results.length === 0) return null

  const data = results.map((r) => ({
    id: r.session_id.slice(0, 6),
    overall: r.overall_score ?? 0,
    ...Object.fromEntries(EVAL_PARAMS.map((p) => [p, r.scores?.[p] ?? 0])),
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="id" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
            fontSize: 12,
          }}
        />
        <Bar dataKey="overall" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EvalsPage() {
  const router = useRouter()
  const {
    sessions,
    selectedSessionIds,
    toggleSession,
    selectAllSessions,
    clearSelection,
    activeMetrics,
    toggleMetric,
    setAllMetrics,
    evalResults,
    isRunning,
    runningSessionId,
    addEvalResult,
    setIsRunning,
    clearEvalResults,
  } = useAppStore()

  const [error, setError] = useState<string | null>(null)

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground text-sm">No sessions loaded yet.</p>
        <Button variant="outline" onClick={() => router.push("/")} className="gap-2">
          <Upload className="size-4" /> Upload dataset
        </Button>
      </div>
    )
  }

  const selectedSessions = sessions.filter((s) => selectedSessionIds.has(s.session_id))
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
        if (!res.ok) {
          setError(data.error ?? "Unknown error")
          break
        }
        addEvalResult(data as EvalResult)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed")
        break
      }
    }
    setIsRunning(false)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Panel — Config */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <h1 className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" /> Eval Runner
          </h1>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 py-4 space-y-5">
            {/* Metrics */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Metrics
                </h3>
                <button
                  className="text-[10px] text-primary hover:underline"
                  onClick={() => setAllMetrics(activeMetrics.size < EVAL_PARAMS.length)}
                >
                  {activeMetrics.size < EVAL_PARAMS.length ? "Select all" : "Clear all"}
                </button>
              </div>
              {EVAL_PARAMS.map((param) => (
                <label
                  key={param}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <Checkbox
                    checked={activeMetrics.has(param)}
                    onCheckedChange={() => toggleMetric(param)}
                  />
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    {EVAL_PARAM_LABELS[param]}
                  </span>
                </label>
              ))}
            </div>

            {/* Sessions selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Sessions
                </h3>
                <button
                  className="text-[10px] text-primary hover:underline"
                  onClick={() =>
                    selectedSessionIds.size === sessions.length
                      ? clearSelection()
                      : selectAllSessions()
                  }
                >
                  {selectedSessionIds.size === sessions.length ? "Clear all" : "Select all"}
                </button>
              </div>
              <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                {sessions.map((s) => (
                  <label
                    key={s.session_id}
                    className="flex items-center gap-2 cursor-pointer group rounded px-1.5 py-1 hover:bg-accent/20 transition-colors"
                  >
                    <Checkbox
                      checked={selectedSessionIds.has(s.session_id)}
                      onCheckedChange={() => toggleSession(s.session_id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[11px] text-muted-foreground truncate group-hover:text-foreground">
                        {s.session_id.slice(0, 12)}…
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[9px] px-1 py-0 h-3.5",
                            s.outcome?.status === "success"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-destructive/15 text-destructive"
                          )}
                        >
                          {s.outcome?.status}
                        </Badge>
                        {evalResults.has(s.session_id) && (
                          <CheckCircle2 className="size-2.5 text-primary" />
                        )}
                        {runningSessionId === s.session_id && (
                          <Loader2 className="size-2.5 text-primary animate-spin" />
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
        <div className="px-4 py-4 border-t border-border space-y-2">
          {error && (
            <p className="text-xs text-destructive flex items-start gap-1.5">
              <AlertCircle className="size-3 mt-0.5 shrink-0" />
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              className="flex-1 gap-2"
              disabled={isRunning || selectedSessions.length === 0 || activeMetrics.size === 0}
              onClick={runEvals}
            >
              {isRunning ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  Run {selectedSessions.length > 0 ? `(${selectedSessions.length})` : ""}
                </>
              )}
            </Button>
            {resultsArray.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                title="Clear results"
                onClick={clearEvalResults}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel — Results */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {resultsArray.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <BarChart3 className="size-12 opacity-20" />
            <p className="text-sm">Select sessions and run evals to see results here.</p>
          </div>
        ) : (
          <Tabs defaultValue="cards" className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-border px-6 py-3 flex items-center justify-between">
              <TabsList className="bg-secondary">
                <TabsTrigger value="cards" className="text-xs">Score Cards</TabsTrigger>
                <TabsTrigger value="radar" className="text-xs">Radar</TabsTrigger>
                <TabsTrigger value="bar" className="text-xs">Bar Chart</TabsTrigger>
              </TabsList>
              <p className="text-xs text-muted-foreground">
                {resultsArray.length} result{resultsArray.length !== 1 ? "s" : ""}
                {isRunning && (
                  <span className="ml-2 text-primary flex items-center gap-1 inline-flex">
                    <Loader2 className="size-3 animate-spin" /> Running…
                  </span>
                )}
              </p>
            </div>

            <TabsContent value="cards" className="flex-1 overflow-auto m-0">
              <div className="p-6 grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                {resultsArray.map((result) => (
                  <ScoreCard
                    key={result.session_id}
                    sessionId={result.session_id}
                    result={result}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="radar" className="flex-1 overflow-auto m-0">
              <div className="p-6 space-y-4">
                <div className="rounded-xl border border-border bg-card p-6">
                  <h3 className="text-sm font-semibold mb-1">Avg Scores — Radar</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Averaged across {resultsArray.length} evaluated session{resultsArray.length !== 1 ? "s" : ""}
                  </p>
                  <RadarView results={resultsArray} />
                </div>
                {/* Summary table */}
                <div className="rounded-xl border border-border bg-card p-4 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Session</th>
                        <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Overall</th>
                        {EVAL_PARAMS.map((p) => (
                          <th key={p} className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">
                            {EVAL_PARAM_LABELS[p].split(" ")[0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultsArray.map((r) => (
                        <tr key={r.session_id} className="border-b border-border/50">
                          <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                            {r.session_id.slice(0, 8)}…
                          </td>
                          <td className={cn("py-2 px-3 text-right text-xs font-bold tabular-nums", scoreColour(r.overall_score))}>
                            {r.overall_score?.toFixed(1) ?? "—"}
                          </td>
                          {EVAL_PARAMS.map((p) => (
                            <td
                              key={p}
                              className={cn("py-2 px-3 text-right text-xs tabular-nums", scoreColour(r.scores?.[p] ?? null))}
                            >
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

            <TabsContent value="bar" className="flex-1 overflow-auto m-0">
              <div className="p-6">
                <div className="rounded-xl border border-border bg-card p-6">
                  <h3 className="text-sm font-semibold mb-1">Overall Score per Session</h3>
                  <p className="text-xs text-muted-foreground mb-4">Score out of 10</p>
                  <BarView results={resultsArray} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
