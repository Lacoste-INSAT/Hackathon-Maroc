"use client"

import { useState, useCallback } from "react"
import { StatusBar } from "@/components/status-bar"
import { ActiveSession } from "@/components/active-session"
import { OfflineSnapToast } from "@/components/offline-snap-toast"
import { ReviewQueue } from "@/components/review-queue"
import { History } from "@/components/history"
import { BottomNav } from "@/components/bottom-nav"
import { queuedRecords, initialHistory, type HistoryEntry } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

type Tab = "home" | "queue" | "history"

export default function Page() {
  const [activeTab, setActiveTab] = useState<Tab>("home")
  const [showOfflineToast, setShowOfflineToast] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [offlineQueueCount, setOfflineQueueCount] = useState(0)
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory)

  const totalQueueCount = queuedRecords.length + offlineQueueCount

  function handleStartSession(_patientId: string) {
    setHasActiveSession(true)
  }

  function handleEndSession() {
    setHasActiveSession(false)
  }

  /**
   * Case A (Offline): Photo goes straight to queue + brief toast
   * Session stays alive so doctor can take more photos
   */
  function handleOfflineSnap() {
    setOfflineQueueCount((c) => c + 1)
    setShowOfflineToast(true)
  }

  /**
   * Case B (Online): Real-time AI approved -> add to today's history
   */
  function handleRealtimeApproved(patientId: string) {
    const newEntry: HistoryEntry = {
      id: Date.now(),
      patient: `Patient [${patientId}]`,
      patientId,
      time: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      notesCount: 1,
      status: "ai-realtime",
      confidence: 94,
    }
    setHistory((prev) => [newEntry, ...prev])
  }

  const handleOfflineToastDone = useCallback(() => {
    setShowOfflineToast(false)
  }, [])

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted p-4">
      {/* Phone Frame */}
      <div className="relative flex h-[812px] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
        {/* Status Bar - clickable to toggle online/offline for demo */}
        <button
          onClick={() => setIsOnline(!isOnline)}
          className="cursor-pointer border-none bg-transparent p-0"
          title="Toggle online/offline status (demo)"
        >
          <StatusBar isOnline={isOnline} />
        </button>

        {/* Content Area - all tabs stay mounted so state is preserved */}
        <div className="relative min-h-0 flex-1">
          <div className={cn(
            "absolute inset-0 overflow-y-auto",
            activeTab !== "home" && "pointer-events-none invisible"
          )}>
            <ActiveSession
              isOnline={isOnline}
              hasActiveSession={hasActiveSession}
              onStartSession={handleStartSession}
              onEndSession={handleEndSession}
              onOfflineSnap={handleOfflineSnap}
              onRealtimeApproved={handleRealtimeApproved}
            />
          </div>
          <div className={cn(
            "absolute inset-0 overflow-y-auto",
            activeTab !== "queue" && "pointer-events-none invisible"
          )}>
            <ReviewQueue onBack={() => setActiveTab("home")} />
          </div>
          <div className={cn(
            "absolute inset-0 overflow-y-auto",
            activeTab !== "history" && "pointer-events-none invisible"
          )}>
            <History
              entries={history}
              onBack={() => setActiveTab("home")}
            />
          </div>
        </div>

        {/* Bottom Nav */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          queueCount={totalQueueCount}
        />

        {/* Case A: Offline - Quick Toast */}
        <OfflineSnapToast
          show={showOfflineToast}
          onDone={handleOfflineToastDone}
        />
      </div>
    </main>
  )
}
