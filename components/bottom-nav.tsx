"use client"

import { Home, ListChecks, ClockArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

type Tab = "home" | "queue" | "history"

interface BottomNavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  queueCount: number
}

const tabs = [
  { id: "home" as Tab, label: "Home", icon: Home },
  { id: "queue" as Tab, label: "Queue", icon: ListChecks },
  { id: "history" as Tab, label: "History", icon: ClockArrowUp },
]

export function BottomNav({
  activeTab,
  onTabChange,
  queueCount,
}: BottomNavProps) {
  return (
    <nav
      className="flex items-center justify-around border-t border-border bg-card px-2 pb-5 pt-2"
      aria-label="Main navigation"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative flex flex-col items-center gap-0.5 rounded-lg px-6 py-2 text-xs font-medium transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <div className="relative">
              <tab.icon
                className={cn("size-5", isActive && "stroke-[2.5]")}
              />
              {tab.id === "queue" && queueCount > 0 && (
                <span className="absolute -top-1.5 -right-2 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-card">
                  {queueCount}
                </span>
              )}
            </div>
            <span>{tab.label}</span>
            {isActive && (
              <span className="absolute -bottom-2 h-0.5 w-8 rounded-full bg-primary" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
