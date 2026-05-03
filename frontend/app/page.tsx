"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import type { Session } from "@/lib/types"
import { cn } from "@/lib/utils"
import { UploadCloud, FileJson, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

function parseJsonl(text: string): Session[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Session)
}

export default function UploadPage() {
  const router = useRouter()
  const { setSessions, sessions, fileName } = useAppStore()
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ count: number; success: number; failure: number } | null>(null)

  const onDrop = useCallback(
    (accepted: File[]) => {
      setError(null)
      const file = accepted[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const parsed = parseJsonl(text)
          if (parsed.length === 0) throw new Error("No sessions found in file")
          const success = parsed.filter((s) => s.outcome?.status === "success").length
          const failure = parsed.length - success
          setPreview({ count: parsed.length, success, failure })
          setSessions(parsed, file.name)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to parse file")
        }
      }
      reader.readAsText(file)
    },
    [setSessions]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/json": [".jsonl", ".json"], "text/plain": [".jsonl"] },
    maxFiles: 1,
  })

  const alreadyLoaded = sessions.length > 0

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
      <div className="w-full max-w-xl space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Upload Dataset</h1>
          <p className="text-muted-foreground text-sm">
            Drop a <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">sessions.jsonl</code> file to start exploring and evaluating your agent sessions.
          </p>
        </div>

        {alreadyLoaded && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
            <CheckCircle2 className="size-4 text-primary shrink-0" />
            <div className="flex-1 text-sm">
              <span className="font-medium text-foreground">{fileName}</span>
              <span className="text-muted-foreground ml-2">— {sessions.length} sessions loaded</span>
            </div>
            <Button size="sm" variant="secondary" onClick={() => router.push("/sessions")} className="gap-1.5">
              Browse <ArrowRight className="size-3.5" />
            </Button>
          </div>
        )}

        <div
          {...getRootProps()}
          className={cn(
            "relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-8 py-12 text-center cursor-pointer transition-colors",
            isDragActive
              ? "border-primary bg-primary/5 text-primary"
              : "border-border hover:border-primary/50 hover:bg-accent/30"
          )}
        >
          <input {...getInputProps()} />
          <UploadCloud className={cn("size-10", isDragActive ? "text-primary" : "text-muted-foreground")} />
          {isDragActive ? (
            <p className="text-sm font-medium text-primary">Drop the file here…</p>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Drag & drop your <span className="text-primary">.jsonl</span> file here
              </p>
              <p className="text-xs text-muted-foreground">or click to browse</p>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {preview && !error && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileJson className="size-4 text-primary" />
              <span className="text-sm font-medium">{fileName} — {preview.count} sessions parsed</span>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="gap-1.5 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                <CheckCircle2 className="size-3" /> {preview.success} success
              </Badge>
              <Badge variant="secondary" className="gap-1.5 bg-destructive/15 text-destructive border-destructive/20">
                <AlertCircle className="size-3" /> {preview.failure} failure
              </Badge>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={() => router.push("/sessions")} className="gap-1.5">
                Browse Sessions <ArrowRight className="size-3.5" />
              </Button>
              <Button variant="outline" onClick={() => router.push("/evals")}>
                Run Evals
              </Button>
            </div>
          </div>
        )}

        {!alreadyLoaded && !preview && (
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { label: "Upload", desc: "Drop your sessions.jsonl file" },
              { label: "Browse", desc: "Filter & inspect each session" },
              { label: "Evaluate", desc: "Run LLM-judge evals on any session" },
            ].map((item, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="size-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                    {i + 1}
                  </span>
                  <span className="text-xs font-semibold text-foreground">{item.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
