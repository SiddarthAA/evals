"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/lib/store"
import { Upload, Table2, BarChart3, BrainCircuit } from "lucide-react"

const links = [
  { href: "/", label: "Upload", icon: Upload },
  { href: "/sessions", label: "Sessions", icon: Table2 },
  { href: "/evals", label: "Evals", icon: BarChart3 },
]

export function NavSidebar() {
  const pathname = usePathname()
  const sessions = useAppStore((s) => s.sessions)
  const evalResults = useAppStore((s) => s.evalResults)

  return (
    <aside className="flex flex-col w-52 shrink-0 border-r border-border/60 bg-sidebar min-h-screen">
      {/* Logo */}
      <div className="relative px-5 py-5 border-b border-sidebar-border/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-center gap-2.5">
          <div className="size-6 rounded-md bg-gradient-to-br from-primary/60 to-primary/20 flex items-center justify-center">
            <BrainCircuit className="size-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium tracking-tight text-sidebar-foreground leading-none">
              Agent Eval
            </p>
            <p className="text-[10px] font-light text-muted-foreground/60 mt-0.5">Studio</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-0.5 px-2 py-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-light transition-all",
                active
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/40 border border-transparent"
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Stats footer */}
      <div className="mt-auto px-4 py-4 border-t border-sidebar-border/60">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-light text-muted-foreground/50">Sessions</span>
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
              {sessions.length.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-light text-muted-foreground/50">Evals run</span>
            <span className="text-[10px] font-medium text-primary/70 tabular-nums">
              {evalResults.size}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
