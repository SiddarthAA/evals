"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { Stage, Action } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  AlertTriangle,
  Terminal,
  BarChart3,
} from "lucide-react"

const STAGE_ORDER = [
  "input_validation",
  "tool_execution",
  "intermediate_processing",
  "final_output",
] as const

const STAGE_LABELS: Record<string, string> = {
  input_validation: "Input Validation",
  tool_execution: "Tool Execution",
  intermediate_processing: "Intermediate Processing",
  final_output: "Final Output",
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="size-4 text-emerald-400" />
  if (status === "failure") return <XCircle className="size-4 text-destructive" />
  return <SkipForward className="size-4 text-muted-foreground" />
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs",
        status === "success"
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
          : status === "failure"
          ? "bg-destructive/15 text-destructive border-destructive/20"
          : "bg-muted text-muted-foreground"
      )}
    >
      {status}
    </Badge>
  )
}

function PipelineBar({ stages }: { stages: Record<string, Stage> }) {
  return (
    <div className="flex items-center gap-2">
      {STAGE_ORDER.map((key) => {
        const stage = stages?.[key]
        const status = stage?.status ?? "skipped"
        return (
          <div key={key} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "w-full h-2 rounded-full",
                status === "success"
                  ? "bg-emerald-500"
                  : status === "failure"
                  ? "bg-destructive"
                  : "bg-muted"
              )}
            />
            <span className="text-[10px] text-muted-foreground">{STAGE_LABELS[key]}</span>
          </div>
        )
      })}
    </div>
  )
}

function ActionCard({ action }: { action: Action }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2 text-xs font-mono",
        action.success
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-destructive/20 bg-destructive/5"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="size-3 text-muted-foreground" />
          <span className="font-semibold text-foreground">{action.tool_name}</span>
        </div>
        <div className="flex items-center gap-2">
          {action.http_status && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                action.http_status >= 200 && action.http_status < 300
                  ? "border-emerald-500/30 text-emerald-400"
                  : "border-destructive/30 text-destructive"
              )}
            >
              {action.http_status}
            </Badge>
          )}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3" />
            {action.latency_ms}ms
          </div>
        </div>
      </div>

      {action.error && (
        <div className="flex items-start gap-2 rounded p-2 bg-destructive/10 text-destructive">
          <AlertTriangle className="size-3 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">{action.error.type}: </span>
            {action.error.message}
            {!action.error.recoverable && (
              <span className="ml-2 text-[10px] opacity-70">(non-recoverable)</span>
            )}
          </div>
        </div>
      )}

      <Accordion type="single" collapsible>
        <AccordionItem value="io" className="border-none">
          <AccordionTrigger className="py-0 text-muted-foreground hover:text-foreground hover:no-underline text-xs">
            Input / Output
          </AccordionTrigger>
          <AccordionContent className="pt-2 space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Input</p>
              <pre className="bg-muted rounded p-2 text-[11px] overflow-auto max-h-32">
                {JSON.stringify(action.input, null, 2)}
              </pre>
            </div>
            {action.output !== undefined && action.output !== null && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Output</p>
                <pre className="bg-muted rounded p-2 text-[11px] overflow-auto max-h-32">
                  {JSON.stringify(action.output, null, 2)}
                </pre>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

function StagePanel({ stageKey, stage }: { stageKey: string; stage: Stage }) {
  return (
    <div className="space-y-4">
      {/* Stage header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon status={stage.status} />
          <span className="font-medium">{STAGE_LABELS[stageKey]}</span>
          <StatusBadge status={stage.status} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3" />
          {stage.duration_ms}ms
        </div>
      </div>

      {/* Thinking block */}
      {stage.thinking?.content && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            Agent Thinking
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed">{stage.thinking.content}</p>
          {stage.thinking.include_in_training && (
            <Badge variant="outline" className="text-[10px] mt-1">training-included</Badge>
          )}
        </div>
      )}

      {/* Divergence check */}
      {stage.divergence_check?.triggered && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="size-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-amber-400">Divergence detected: </span>
            <span className="text-foreground/80">{stage.divergence_check.reason}</span>
            <span className="ml-2 text-xs text-muted-foreground">→ {stage.divergence_check.action}</span>
          </div>
        </div>
      )}

      {/* Fallbacks */}
      {stage.fallbacks_triggered?.length > 0 && (
        <div className="text-xs text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="size-3" />
          Fallbacks: {stage.fallbacks_triggered.join(", ")}
        </div>
      )}

      {/* Actions */}
      {stage.actions?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tool Calls ({stage.actions.length})
          </p>
          {stage.actions.map((action) => (
            <ActionCard key={action.call_id} action={action} />
          ))}
        </div>
      )}

      {/* Stage output */}
      {stage.output && (
        <Accordion type="single" collapsible>
          <AccordionItem value="out" className="border border-border rounded-lg">
            <AccordionTrigger className="px-4 py-2.5 text-sm hover:no-underline">
              Stage Output
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-48 font-mono">
                {JSON.stringify(stage.output, null, 2)}
              </pre>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  )
}

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { sessions, toggleSession, selectedSessionIds } = useAppStore()
  const session = sessions.find((s) => s.session_id === id)

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground text-sm">Session not found.</p>
        <Button variant="outline" onClick={() => router.push("/sessions")}>
          Back to sessions
        </Button>
      </div>
    )
  }

  const isSelected = selectedSessionIds.has(session.session_id)

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => router.back()}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <span className="font-mono text-xs text-muted-foreground">{session.session_id}</span>
          <StatusBadge status={session.outcome?.status ?? "unknown"} />
          {session.failure_subtype && (
            <Badge variant="outline" className="text-xs">
              {session.failure_subtype}
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant={isSelected ? "secondary" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => toggleSession(session.session_id)}
            >
              {isSelected ? "Deselect" : "Select for eval"}
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                if (!isSelected) toggleSession(session.session_id)
                router.push("/evals")
              }}
            >
              <BarChart3 className="size-3" /> Eval this session
            </Button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>
            <span className="text-foreground font-medium">URL: </span>
            <span className="font-mono">{session.task?.url}</span>
          </span>
          <span>
            <span className="text-foreground font-medium">Duration: </span>
            {(Number(session.duration_ms) / 1000).toFixed(1)}s
          </span>
          <span>
            <span className="text-foreground font-medium">Tool calls: </span>
            {session.metadata?.total_tool_calls}
          </span>
          <span>
            <span className="text-foreground font-medium">Retries: </span>
            {session.metadata?.retries}
          </span>
          <span>
            <span className="text-foreground font-medium">Tokens: </span>
            {session.metadata?.tokens_used}
          </span>
        </div>

        {/* Task prompt */}
        <p className="text-sm text-foreground/80 bg-secondary/30 rounded-lg px-3 py-2">
          <span className="font-semibold text-foreground">Task: </span>
          {session.task?.prompt}
        </p>

        {/* Pipeline bar */}
        <PipelineBar stages={session.stages as unknown as Record<string, Stage>} />
      </div>

      {/* Stage tabs */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-5">
          <Tabs defaultValue={STAGE_ORDER[0]}>
            <TabsList className="mb-5 bg-secondary">
              {STAGE_ORDER.map((key) => {
                const stage = session.stages?.[key]
                const status = stage?.status ?? "skipped"
                return (
                  <TabsTrigger key={key} value={key} className="gap-1.5 text-xs">
                    <StatusIcon status={status} />
                    {STAGE_LABELS[key]}
                  </TabsTrigger>
                )
              })}
            </TabsList>
            {STAGE_ORDER.map((key) => {
              const stage = session.stages?.[key]
              if (!stage) return null
              return (
                <TabsContent key={key} value={key}>
                  <StagePanel stageKey={key} stage={stage} />
                </TabsContent>
              )
            })}
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  )
}
