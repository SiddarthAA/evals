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
    <aside className="flex flex-col w-56 shrink-0 border-r border-border bg-sidebar min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <BrainCircuit className="size-5 text-primary" />
        <span className="font-semibold text-sm tracking-tight text-sidebar-foreground">
          Agent Eval Studio
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1 px-2 py-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Stats footer */}
      <div className="mt-auto px-4 py-4 border-t border-sidebar-border text-xs text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>Sessions loaded</span>
          <span className="text-foreground font-medium">{sessions.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Evals run</span>
          <span className="text-foreground font-medium">{evalResults.size}</span>
        </div>
      </div>
    </aside>
  )
}
