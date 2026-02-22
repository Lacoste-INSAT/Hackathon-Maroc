"use client"

import { useEffect, useState } from "react"
import { CheckCircle, WifiOff } from "lucide-react"

interface OfflineSnapToastProps {
  show: boolean
  onDone: () => void
}

/**
 * Case A: Offline snap - shows a brief toast "Saved locally. Will sync when online."
 * then auto-dismisses after 2.5 seconds and returns to dashboard.
 */
export function OfflineSnapToast({ show, onDone }: OfflineSnapToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(onDone, 300) // let exit animation finish
      }, 2500)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [show, onDone])

  if (!show && !visible) return null

  return (
    <div
      className={`absolute right-4 bottom-20 left-4 z-50 flex items-center gap-3 rounded-xl border border-primary/20 bg-card px-4 py-3 shadow-xl transition-all duration-300 ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0"
      }`}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15">
        <CheckCircle className="size-5 text-success" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">
          Saved locally
        </p>
        <p className="text-xs text-muted-foreground">
          Will sync when online
        </p>
      </div>
      <WifiOff className="size-4 shrink-0 text-muted-foreground" />
    </div>
  )
}
