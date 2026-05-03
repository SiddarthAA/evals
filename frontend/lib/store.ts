import { create } from "zustand"
import type { Session, EvalResult, EvalParam } from "./types"
import { EVAL_PARAMS } from "./types"

interface AppState {
  // Dataset
  sessions: Session[]
  fileName: string | null
  setSessions: (sessions: Session[], fileName: string) => void
  clearSessions: () => void

  // Selection
  selectedSessionIds: Set<string>
  toggleSession: (id: string) => void
  selectAllSessions: () => void
  clearSelection: () => void

  // Active metrics
  activeMetrics: Set<EvalParam>
  toggleMetric: (metric: EvalParam) => void
  setAllMetrics: (all: boolean) => void

  // Eval results
  evalResults: Map<string, EvalResult>
  isRunning: boolean
  runningSessionId: string | null
  addEvalResult: (result: EvalResult) => void
  setIsRunning: (val: boolean, sessionId?: string) => void
  clearEvalResults: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  sessions: [],
  fileName: null,
  setSessions: (sessions, fileName) => set({ sessions, fileName }),
  clearSessions: () => set({ sessions: [], fileName: null, selectedSessionIds: new Set(), evalResults: new Map() }),

  selectedSessionIds: new Set(),
  toggleSession: (id) =>
    set((s) => {
      const next = new Set(s.selectedSessionIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedSessionIds: next }
    }),
  selectAllSessions: () =>
    set((s) => ({ selectedSessionIds: new Set(s.sessions.map((s) => s.session_id)) })),
  clearSelection: () => set({ selectedSessionIds: new Set() }),

  activeMetrics: new Set(EVAL_PARAMS),
  toggleMetric: (metric) =>
    set((s) => {
      const next = new Set(s.activeMetrics)
      if (next.has(metric)) next.delete(metric)
      else next.add(metric)
      return { activeMetrics: next }
    }),
  setAllMetrics: (all) =>
    set({ activeMetrics: all ? new Set(EVAL_PARAMS) : new Set() }),

  evalResults: new Map(),
  isRunning: false,
  runningSessionId: null,
  addEvalResult: (result) =>
    set((s) => {
      const next = new Map(s.evalResults)
      next.set(result.session_id, result)
      return { evalResults: next }
    }),
  setIsRunning: (val, sessionId) =>
    set({ isRunning: val, runningSessionId: sessionId ?? null }),
  clearEvalResults: () => set({ evalResults: new Map() }),
}))
