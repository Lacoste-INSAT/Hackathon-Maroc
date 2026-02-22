"use client"

import { useEffect, useRef } from "react"
import {
  Camera,
  QrCode,
  User,
  CheckCircle,
  Sparkles,
  FileText,
  Wifi,
  WifiOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useSessionStore } from "@/stores/useSessionStore"
import { QrScanner } from "@/components/QrScanner"
import { DocumentCamera } from "@/components/DocumentCamera"
import { ImagePreview } from "@/components/ImagePreview"
import { NeedsReviewCard } from "@/components/NeedsReviewCard"

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

export function ActiveSession() {
  const store = useSessionStore()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Live session timer
  useEffect(() => {
    if (store.hasActiveSession) {
      timerRef.current = setInterval(() => store.tickTimer(), 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.hasActiveSession])

  // ── QR Scanner handlers ──
  function handleScanSuccess(code: string) {
    store.setCapturePhase("idle")
    store.startSession(code)
  }

  // ── Capture handlers ──
  function handleCapture(imageDataUrl: string) {
    store.setCapturedImage(imageDataUrl)
    store.setCapturePhase("preview")
  }

  function handleConfirm() {
    store.confirmCapture()
  }

  function handleRetake() {
    store.setCapturedImage(null)
    store.setCapturePhase("viewfinder")
  }

  // ── Notification handlers ──
  function handleReviewNow(editedFields: Record<string, string>) {
    if (store.pendingNotification) {
      store.approveRecord(store.pendingNotification.record.id, editedFields)
    }
  }

  function handleReviewLater() {
    store.dismissNotification()
  }

  // ── Dashboard: No Active Session ──
  if (!store.hasActiveSession) {
    const needsReviewCount = store.records.filter(
      (r) => r.status === "needs_review"
    ).length

    return (
      <div className="flex flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance text-foreground">
            Good Morning, Dr. Benali
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CHU Rural Clinic - Tizi Ouzou
          </p>
        </div>

        <Button
          size="lg"
          onClick={() => store.setCapturePhase("qr_scanner")}
          className="h-16 gap-3 rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-lg"
        >
          <QrCode className="size-6" />
          Start New Session
        </Button>

        <div className="grid grid-cols-3 gap-3">
          <Card className="shadow-none">
            <CardContent className="flex flex-col items-center py-3">
              <span className="text-2xl font-bold text-foreground">
                {store.history.length}
              </span>
              <span className="text-[10px] text-muted-foreground">Today</span>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="flex flex-col items-center py-3">
              <span className="text-2xl font-bold text-foreground">
                {store.offlineQueueCount + needsReviewCount}
              </span>
              <span className="text-[10px] text-muted-foreground">Pending</span>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="flex flex-col items-center py-3">
              <span className="text-2xl font-bold text-success">96%</span>
              <span className="text-[10px] text-muted-foreground">
                AI Accuracy
              </span>
            </CardContent>
          </Card>
        </div>

        {!store.isOnline && (
          <Card className="border-warning/30 bg-warning/5 shadow-none">
            <CardContent className="flex items-center gap-3 py-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/15">
                <WifiOff className="size-4 text-warning-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Photos queued for sync
                </p>
                <p className="text-xs text-muted-foreground">
                  Will auto-sync when connected to Wi-Fi
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QR Scanner Dialog */}
        <QrScanner
          open={store.capturePhase === "qr_scanner"}
          onClose={() => store.setCapturePhase("idle")}
          onScanSuccess={handleScanSuccess}
        />
      </div>
    )
  }

  // ── Brief "Saved" flash (Optimistic Success) ──
  if (store.capturePhase === "saved") {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20">
        <div className="flex size-20 items-center justify-center rounded-full bg-success/15">
          <CheckCircle className="size-10 text-success" />
        </div>
        <p className="text-lg font-bold text-foreground">
          Saved!
        </p>
        <div className="flex items-center gap-2">
          {store.isOnline ? (
            <>
              <Sparkles className="size-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                AI is analyzing in the background…
              </p>
            </>
          ) : (
            <>
              <WifiOff className="size-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Saved locally. Will sync when online.
              </p>
            </>
          )}
        </div>

        {/* Notification can appear on top of the saved flash */}
        {store.pendingNotification && (
          <NeedsReviewCard
            patientId={store.pendingNotification.record.patientId}
            result={store.pendingNotification.result}
            onReviewNow={handleReviewNow}
            onReviewLater={handleReviewLater}
          />
        )}
      </div>
    )
  }

  // ── Image Preview ──
  if (store.capturePhase === "preview" && store.capturedImageUrl) {
    return (
      <ImagePreview
        imageUrl={store.capturedImageUrl}
        isOnline={store.isOnline}
        onRetake={handleRetake}
        onConfirm={handleConfirm}
      />
    )
  }

  // ── Document Camera Viewfinder ──
  if (store.capturePhase === "viewfinder") {
    return (
      <DocumentCamera
        isOnline={store.isOnline}
        onCapture={handleCapture}
        onBack={() => store.setCapturePhase("idle")}
      />
    )
  }

  // ── Active Session Screen (default idle) ──
  return (
    <div className="relative flex flex-col gap-5 px-4 py-6">
      {/* Session Banner */}
      <Card className="border-success/30 bg-success/5 shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-success" />
              </span>
              <CardTitle className="text-base text-foreground">
                Active Session
              </CardTitle>
            </div>
            <Badge className="border border-border bg-card font-mono text-sm tabular-nums text-foreground">
              {formatTime(store.sessionTime)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex items-center gap-3 pt-0">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <User className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              Patient [{store.currentPatientId}]
            </p>
          </div>
          <Badge className="border-success/20 bg-success/15 text-xs text-success">
            In Progress
          </Badge>
        </CardContent>
      </Card>

      {/* Captured notes count */}
      {store.capturedCount > 0 && (
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/15">
              <FileText className="size-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {store.capturedCount} note
                {store.capturedCount > 1 ? "s" : ""} captured
              </p>
              <p className="text-xs text-muted-foreground">
                {store.isOnline
                  ? "AI analyzing in background"
                  : "Saved locally, pending sync"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing indicator for background AI */}
      {store.records.some((r) => r.status === "processing") && (
        <div className="flex items-center justify-center gap-2 text-xs text-primary">
          <Sparkles className="size-3.5 animate-pulse" />
          <span>Gemini AI is processing your notes…</span>
        </div>
      )}

      {/* Mode indicator */}
      <p className="text-center text-sm text-muted-foreground">
        {store.isOnline ? (
          <span className="flex items-center justify-center gap-1.5">
            <Wifi className="size-3.5" />
            Online — AI will analyze in the background
          </span>
        ) : (
          <span className="flex items-center justify-center gap-1.5">
            <WifiOff className="size-3.5" />
            Offline — Photos saved to queue for later
          </span>
        )}
      </p>

      {/* Large Capture Shutter Button */}
      <div className="flex flex-col items-center gap-3 py-6">
        <button
          onClick={() => store.setCapturePhase("viewfinder")}
          className="group flex size-28 items-center justify-center rounded-full border-4 border-primary bg-primary shadow-xl transition-transform active:scale-95"
          aria-label="Capture Notes"
        >
          <div className="flex size-24 flex-col items-center justify-center rounded-full border-2 border-primary-foreground/30 bg-primary text-primary-foreground">
            <Camera className="size-8" />
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider">
              Capture
            </span>
          </div>
        </button>
        <p className="text-center text-xs font-medium text-foreground">
          Capture Notes
        </p>
      </div>

      {/* End Session */}
      <button
        onClick={() => store.endSession()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        End Session
      </button>

      {/* Needs Review Notification (floating) */}
      {store.pendingNotification && (
        <NeedsReviewCard
          patientId={store.pendingNotification.record.patientId}
          result={store.pendingNotification.result}
          onReviewNow={handleReviewNow}
          onReviewLater={handleReviewLater}
        />
      )}
    </div>
  )
}
