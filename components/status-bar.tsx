"use client"

import { Wifi, WifiOff } from "lucide-react"

interface StatusBarProps {
  isOnline: boolean
}

export function StatusBar({ isOnline }: StatusBarProps) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-2 text-xs font-medium ${
        isOnline
          ? "bg-success/10 text-success"
          : "bg-warning/10 text-warning-foreground"
      }`}
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          <Wifi className="size-3.5" />
        ) : (
          <WifiOff className="size-3.5" />
        )}
        <span>
          {isOnline ? "Status: Online" : "Status: Offline (Saving locally)"}
        </span>
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">
        Snap & Sync v1.0
      </span>
    </div>
  )
}
