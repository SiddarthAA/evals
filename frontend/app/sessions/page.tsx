"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { Session } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, BarChart3, ExternalLink, Upload } from "lucide-react"

const STAGE_LABELS: Record<string, string> = {
  input_validation: "Input Validation",
  tool_execution: "Tool Execution",
  intermediate_processing: "Intermediate",
  final_output: "Final Output",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs font-medium",
        status === "success"
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
          : "bg-destructive/15 text-destructive border-destructive/20"
      )}
    >
      {status}
    </Badge>
  )
}

function StagePipeline({ session }: { session: Session }) {
  const stages = [
    "input_validation",
    "tool_execution",
    "intermediate_processing",
    "final_output",
  ] as const
  return (
    <div className="flex items-center gap-0.5">
      {stages.map((s, i) => {
        const stage = session.stages?.[s]
        const status = stage?.status ?? "skipped"
        return (
          <div key={s} className="flex items-center">
            <div
              title={STAGE_LABELS[s]}
              className={cn(
                "w-4 h-4 rounded-sm",
                status === "success"
                  ? "bg-emerald-500/70"
                  : status === "failure"
                  ? "bg-destructive/70"
                  : "bg-muted"
              )}
            />
            {i < stages.length - 1 && <div className="w-1 h-0.5 bg-border" />}
          </div>
        )
      })}
    </div>
  )
}

export default function SessionsPage() {
  const router = useRouter()
  const { sessions, selectedSessionIds, toggleSession, selectAllSessions, clearSelection } =
    useAppStore()

  const [search, setSearch] = useState("")
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all")
  const [stageFilter, setStageFilter] = useState<string>("all")

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (outcomeFilter !== "all" && s.outcome?.status !== outcomeFilter) return false
      if (stageFilter !== "all" && s.failure_stage !== stageFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          s.session_id.toLowerCase().includes(q) ||
          s.task?.prompt?.toLowerCase().includes(q) ||
          s.task?.url?.toLowerCase().includes(q) ||
          s.failure_subtype?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [sessions, outcomeFilter, stageFilter, search])

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

  const allVisible = filtered.length > 0 && filtered.every((s) => selectedSessionIds.has(s.session_id))

  const toggleAll = () => {
    if (allVisible) {
      clearSelection()
    } else {
      filtered.forEach((s) => {
        if (!selectedSessionIds.has(s.session_id)) toggleSession(s.session_id)
      })
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-semibold mr-2">Sessions</h1>
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search sessions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-secondary border-border"
          />
        </div>
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="h-8 w-36 text-xs bg-secondary border-border">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="h-8 w-48 text-xs bg-secondary border-border">
            <SelectValue placeholder="Failure stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            <SelectItem value="input_validation">Input Validation</SelectItem>
            <SelectItem value="tool_execution">Tool Execution</SelectItem>
            <SelectItem value="intermediate_processing">Intermediate</SelectItem>
            <SelectItem value="final_output">Final Output</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} / {sessions.length}
          {selectedSessionIds.size > 0 && (
            <span className="ml-2 text-primary">· {selectedSessionIds.size} selected</span>
          )}
        </span>
        {selectedSessionIds.size > 0 && (
          <Button
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => router.push("/evals")}
          >
            <BarChart3 className="size-3.5" /> Run Evals
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b border-border z-10">
            <tr>
              <th className="px-4 py-2.5 text-left">
                <Checkbox
                  checked={allVisible}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Session ID
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Status
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Pipeline
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Failure subtype
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                URL
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Duration
              </th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((session) => (
              <SessionRow
                key={session.session_id}
                session={session}
                selected={selectedSessionIds.has(session.session_id)}
                onToggle={() => toggleSession(session.session_id)}
              />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            No sessions match your filters.
          </div>
        )}
      </div>
    </div>
  )
}

function SessionRow({
  session,
  selected,
  onToggle,
}: {
  session: Session
  selected: boolean
  onToggle: () => void
}) {
  const durationMs = Number(session.duration_ms)
  const durationSec = isNaN(durationMs) ? "—" : `${(durationMs / 1000).toFixed(1)}s`

  return (
    <tr
      className={cn(
        "border-b border-border/50 hover:bg-accent/20 transition-colors",
        selected && "bg-primary/5"
      )}
    >
      <td className="px-4 py-2.5">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label="Select session"
        />
      </td>
      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
        <Link
          href={`/sessions/${session.session_id}`}
          className="hover:text-primary transition-colors"
        >
          {session.session_id.slice(0, 8)}…
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={session.outcome?.status ?? "unknown"} />
      </td>
      <td className="px-3 py-2.5">
        <StagePipeline session={session} />
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        {session.failure_subtype ?? "—"}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-48 truncate" title={session.task?.url}>
        {session.task?.url ?? "—"}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{durationSec}</td>
      <td className="px-3 py-2.5">
        <Link href={`/sessions/${session.session_id}`}>
          <Button variant="ghost" size="icon" className="size-6">
            <ExternalLink className="size-3" />
          </Button>
        </Link>
      </td>
    </tr>
  )
}
