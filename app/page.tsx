"use client"

import { useCallback } from "react"
import { StatusBar } from "@/components/status-bar"
import { ActiveSession } from "@/components/active-session"
import { OfflineSnapToast } from "@/components/offline-snap-toast"
import { ReviewQueue } from "@/components/review-queue"
import { History } from "@/components/history"
import { BottomNav } from "@/components/bottom-nav"
import { useSessionStore } from "@/stores/useSessionStore"
import { queuedRecords } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { useState } from "react"

type Tab = "home" | "queue" | "history"

export default function Page() {
  const [activeTab, setActiveTab] = useState<Tab>("home")
  const [showOfflineToast, setShowOfflineToast] = useState(false)

  // Derive everything from the Zustand store
  const store = useSessionStore()

  // Queue count: mock queued records + store's live counts
  const needsReviewCount = store.records.filter(
    (r) => r.status === "needs_review"
  ).length
  const totalQueueCount =
    queuedRecords.length + store.offlineQueueCount + needsReviewCount

  const handleOfflineToastDone = useCallback(() => {
    setShowOfflineToast(false)
  }, [])

  // Show offline toast when a new offline capture happens
  // (the store handles the actual save, we just show the toast)
  useSessionStore.subscribe((state, prevState) => {
    if (
      state.offlineQueueCount > prevState.offlineQueueCount &&
      !state.isOnline
    ) {
      setShowOfflineToast(true)
    }
  })

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted p-4">
      {/* Phone Frame */}
      <div className="relative flex h-[812px] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
        {/* Status Bar - clickable to toggle online/offline for demo */}
        <button
          onClick={() => store.toggleOnline()}
          className="cursor-pointer border-none bg-transparent p-0"
          title="Toggle online/offline status (demo)"
        >
          <StatusBar isOnline={store.isOnline} />
        </button>

        {/* Content Area - all tabs stay mounted so state is preserved */}
        <div className="relative min-h-0 flex-1">
          <div
            className={cn(
              "absolute inset-0 overflow-y-auto",
              activeTab !== "home" && "pointer-events-none invisible"
            )}
          >
            <ActiveSession />
          </div>
          <div
            className={cn(
              "absolute inset-0 overflow-y-auto",
              activeTab !== "queue" && "pointer-events-none invisible"
            )}
          >
            <ReviewQueue onBack={() => setActiveTab("home")} />
          </div>
          <div
            className={cn(
              "absolute inset-0 overflow-y-auto",
              activeTab !== "history" && "pointer-events-none invisible"
            )}
          >
            <History
              entries={store.history}
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
