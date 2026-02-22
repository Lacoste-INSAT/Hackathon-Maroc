"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import {
  Camera,
  QrCode,
  User,
  Keyboard,
  X,
  Loader2,
  CheckCircle,
  Sparkles,
  Gauge,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  RotateCcw,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { onlineExtractionResult, type ExtractedField } from "@/lib/mock-data"

interface ActiveSessionProps {
  isOnline: boolean
  hasActiveSession: boolean
  onStartSession: (patientId: string) => void
  onEndSession: () => void
  onOfflineSnap: () => void
  onRealtimeApproved: (patientId: string) => void
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

function getConfidenceColor(c: number) {
  if (c >= 90) return "text-success"
  if (c >= 75) return "text-primary"
  return "text-destructive"
}

function getConfidenceBg(c: number) {
  if (c >= 90) return "bg-success/15 text-success border-success/20"
  if (c >= 75) return "bg-primary/15 text-primary border-primary/20"
  return "bg-destructive/15 text-destructive border-destructive/20"
}

function getBarClass(c: number) {
  if (c >= 90) return "[&>[data-slot=progress-indicator]]:bg-success"
  if (c >= 75) return "[&>[data-slot=progress-indicator]]:bg-primary"
  return "[&>[data-slot=progress-indicator]]:bg-destructive"
}

export function ActiveSession({
  isOnline,
  hasActiveSession,
  onStartSession,
  onEndSession,
  onOfflineSnap,
  onRealtimeApproved,
}: ActiveSessionProps) {
  const [showQrScanner, setShowQrScanner] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualCode, setManualCode] = useState("")
  const [scanPhase, setScanPhase] = useState<"scanning" | "failed">("scanning")
  const [sessionTime, setSessionTime] = useState(0)
  const [patientId, setPatientId] = useState("AHM-924")
  const [capturedCount, setCapturedCount] = useState(0)

  // Capture flow states
  const [capturePhase, setCapturePhase] = useState<
    "idle" | "viewfinder" | "preview" | "analyzing" | "review" | "saved"
  >("idle")
  const [editableFields, setEditableFields] = useState<Record<string, string>>({})
  const [isZoomed, setIsZoomed] = useState(false)

  // Live session timer
  useEffect(() => {
    if (!hasActiveSession) {
      setSessionTime(0)
      setCapturePhase("idle")
      setCapturedCount(0)
      return
    }
    const interval = setInterval(() => setSessionTime((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [hasActiveSession])

  const openScanner = useCallback(() => {
    setShowQrScanner(true)
    setScanPhase("scanning")
    setShowManualEntry(false)
    setTimeout(() => setScanPhase("failed"), 3000)
  }, [])

  function handleSimulateScan() {
    setPatientId("AHM-924")
    setShowQrScanner(false)
    setSessionTime(0)
    onStartSession("AHM-924")
  }

  function handleManualSubmit() {
    if (manualCode.length >= 3) {
      const id = manualCode.toUpperCase()
      setPatientId(id)
      setShowQrScanner(false)
      setShowManualEntry(false)
      setManualCode("")
      setSessionTime(0)
      onStartSession(id)
    }
  }

  // Capture shutter -> open viewfinder
  function handleCapturePress() {
    setCapturePhase("viewfinder")
  }

  // Simulate scan -> show preview first (retake or confirm)
  function handleSimulateSnap() {
    setCapturePhase("preview")
  }

  // Doctor confirms the image is good -> branch online/offline
  function handleConfirmImage() {
    if (isOnline) {
      setCapturePhase("analyzing")
      setTimeout(() => {
        const fields: Record<string, string> = {}
        onlineExtractionResult.fields.forEach((f) => {
          fields[f.label] = f.value
        })
        setEditableFields(fields)
        setIsZoomed(false)
        setCapturePhase("review")
      }, 2500)
    } else {
      setCapturedCount((c) => c + 1)
      setCapturePhase("idle")
      onOfflineSnap()
    }
  }

  // Doctor retakes the image
  function handleRetake() {
    setCapturePhase("viewfinder")
  }

  function handleFieldChange(label: string, value: string) {
    setEditableFields((prev) => ({ ...prev, [label]: value }))
  }

  // Approve & save -> back to session (NOT end session), increment captured count
  function handleApproveAndSave() {
    setCapturedCount((c) => c + 1)
    setCapturePhase("saved")
    onRealtimeApproved(patientId)
    setTimeout(() => {
      setCapturePhase("idle")
    }, 1200)
  }

  // ── Dashboard: No Active Session ──
  if (!hasActiveSession) {
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
          onClick={openScanner}
          className="h-16 gap-3 rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-lg"
        >
          <QrCode className="size-6" />
          Start New Session
        </Button>

        <div className="grid grid-cols-3 gap-3">
          <Card className="shadow-none">
            <CardContent className="flex flex-col items-center py-3">
              <span className="text-2xl font-bold text-foreground">12</span>
              <span className="text-[10px] text-muted-foreground">Today</span>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="flex flex-col items-center py-3">
              <span className="text-2xl font-bold text-foreground">3</span>
              <span className="text-[10px] text-muted-foreground">Pending</span>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="flex flex-col items-center py-3">
              <span className="text-2xl font-bold text-success">96%</span>
              <span className="text-[10px] text-muted-foreground">AI Accuracy</span>
            </CardContent>
          </Card>
        </div>

        {!isOnline && (
          <Card className="border-warning/30 bg-warning/5 shadow-none">
            <CardContent className="flex items-center gap-3 py-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/15">
                <Loader2 className="size-4 text-warning-foreground" />
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
        <Dialog open={showQrScanner} onOpenChange={setShowQrScanner}>
          <DialogContent
            className="flex h-[85vh] max-w-[calc(100%-2rem)] flex-col rounded-2xl p-0 sm:max-w-sm"
            showCloseButton={false}
          >
            {!showManualEntry ? (
              <div className="flex flex-1 flex-col">
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <DialogHeader>
                    <DialogTitle className="text-lg text-foreground">
                      Scan Patient QR
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      Point camera at the QR code on the booklet cover
                    </DialogDescription>
                  </DialogHeader>
                  <button
                    onClick={() => setShowQrScanner(false)}
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-5" />
                    <span className="sr-only">Close scanner</span>
                  </button>
                </div>

                <div className="relative mx-5 flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-foreground/95">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.7)_100%)]" />
                  <div className="relative flex size-52 flex-col items-center justify-center">
                    <div className="absolute top-0 left-0 size-8 rounded-tl-xl border-t-[3px] border-l-[3px] border-primary" />
                    <div className="absolute top-0 right-0 size-8 rounded-tr-xl border-t-[3px] border-r-[3px] border-primary" />
                    <div className="absolute bottom-0 left-0 size-8 rounded-bl-xl border-b-[3px] border-l-[3px] border-primary" />
                    <div className="absolute bottom-0 right-0 size-8 rounded-br-xl border-b-[3px] border-r-[3px] border-primary" />
                    {scanPhase === "scanning" && (
                      <div className="absolute top-0 h-0.5 w-full animate-pulse bg-primary/80" />
                    )}
                    {scanPhase === "scanning" ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="size-8 animate-spin text-primary" />
                        <span className="text-sm font-medium text-primary-foreground/80">
                          Looking for QR code...
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <QrCode className="size-8 text-primary-foreground/40" />
                        <span className="text-sm font-medium text-primary-foreground/60">
                          No QR code detected
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3 px-5 pt-4 pb-5">
                  <Button
                    onClick={handleSimulateScan}
                    size="lg"
                    className="h-12 w-full gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    <QrCode className="size-4" />
                    Simulate Successful Scan
                  </Button>
                  {scanPhase === "failed" && (
                    <button
                      onClick={() => setShowManualEntry(true)}
                      className="flex items-center gap-2 py-2 text-sm font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      <Keyboard className="size-4" />
                      {"QR Damaged? Enter ID Manually"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-5 p-5">
                <div className="flex items-center justify-between">
                  <DialogHeader>
                    <DialogTitle className="text-lg text-foreground">
                      Enter Patient ID
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Type the ID printed below the QR code on the booklet
                    </DialogDescription>
                  </DialogHeader>
                  <button
                    onClick={() => setShowManualEntry(false)}
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-4" />
                    <span className="sr-only">Back to scanner</span>
                  </button>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-4">
                  <Input
                    type="text"
                    placeholder="e.g., AHM-924"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.slice(0, 7))}
                    className="h-16 text-center text-2xl font-bold uppercase tracking-widest"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: 3 letters - 3 digits (e.g., AHM-924)
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={handleManualSubmit}
                    size="lg"
                    disabled={manualCode.length < 3}
                    className="h-14 gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-md"
                  >
                    Confirm ID
                  </Button>
                  <button
                    onClick={() => setShowManualEntry(false)}
                    className="text-center text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Back to QR scanner
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ── Brief "Saved" flash after approve ──
  if (capturePhase === "saved") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20">
        <div className="flex size-20 items-center justify-center rounded-full bg-success/15">
          <CheckCircle className="size-10 text-success" />
        </div>
        <p className="text-lg font-bold text-foreground">Saved to EMR</p>
        <p className="text-sm text-muted-foreground">
          You can capture more notes or end the session
        </p>
      </div>
    )
  }

  // ── AI Analyzing Spinner (online) ──
  if (capturePhase === "analyzing") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-20">
        <div className="relative">
          <div className="flex size-24 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-12 text-primary" />
          </div>
          <Loader2 className="absolute -top-1 -right-1 size-7 animate-spin text-primary" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-xl font-bold text-foreground">Analyzing with AI...</p>
          <p className="text-sm text-muted-foreground">
            Gemini 2.5 Flash is reading the handwriting
          </p>
        </div>
        <div className="w-48">
          <Progress
            value={65}
            className="h-2 [&>[data-slot=progress-indicator]]:bg-primary [&>[data-slot=progress-indicator]]:animate-pulse"
          />
        </div>
      </div>
    )
  }

  // ── Image Preview: Retake or Confirm before AI kicks in ──
  if (capturePhase === "preview") {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={handleRetake}
            className="flex items-center gap-2 text-sm font-medium text-primary"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <p className="text-sm font-semibold text-foreground">Review Photo</p>
          <div className="w-14" />
        </div>

        <div className="flex flex-1 flex-col items-center gap-5 px-4 pb-4">
          <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-2xl border-2 border-border shadow-md">
            <Image
              src="/images/mock-scan-1.jpg"
              alt="Captured ordonnance photo"
              fill
              className="object-cover"
            />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {isOnline
              ? "Looks good? Confirm to send to Gemini AI for analysis."
              : "Confirm to save locally. It will sync when you are back online."}
          </p>

          <div className="flex w-full gap-3">
            <Button
              onClick={handleRetake}
              variant="outline"
              className="h-14 flex-1 gap-2 rounded-xl text-base font-semibold"
            >
              <RotateCcw className="size-5" />
              Retake
            </Button>
            <Button
              onClick={handleConfirmImage}
              className="h-14 flex-1 gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-md"
            >
              <CheckCircle className="size-5" />
              Confirm
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Split-Screen AI Review (online) ──
  if (capturePhase === "review") {
    const { fields, overallConfidence, predictionScore } = onlineExtractionResult
    return (
      <div className="flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <button
            onClick={() => setCapturePhase("idle")}
            className="flex items-center gap-2 text-sm font-medium text-primary"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <Badge className="bg-primary/10 text-xs text-primary">
            Real-time AI Review
          </Badge>
        </div>

        {/* Top: Image Preview */}
        <div className="border-b border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-foreground">Patient [{patientId}]</p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="size-3 text-primary" />
                AI Extraction Complete
              </p>
            </div>
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="flex size-8 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm hover:text-foreground"
              aria-label={isZoomed ? "Zoom out" : "Zoom in"}
            >
              {isZoomed ? <ZoomOut className="size-4" /> : <ZoomIn className="size-4" />}
            </button>
          </div>

          <div
            className={cn(
              "relative w-full overflow-hidden rounded-xl border border-border transition-all",
              isZoomed ? "aspect-[3/4]" : "aspect-[16/9]"
            )}
          >
            <Image
              src="/images/mock-scan-1.jpg"
              alt={`Scanned booklet for patient ${patientId}`}
              fill
              className={cn(
                "transition-transform duration-300",
                isZoomed ? "scale-100 object-contain" : "scale-110 object-cover"
              )}
            />
          </div>

          <div className="mt-3 flex gap-2">
            <Badge
              className={cn(
                "flex-1 justify-center gap-1.5 border px-3 py-1.5 text-xs",
                getConfidenceBg(overallConfidence)
              )}
            >
              <CheckCircle className="size-3" />
              Confidence: {overallConfidence}%
            </Badge>
            <Badge
              className={cn(
                "flex-1 justify-center gap-1.5 border px-3 py-1.5 text-xs",
                getConfidenceBg(predictionScore)
              )}
            >
              <Gauge className="size-3" />
              Accuracy: {predictionScore}%
            </Badge>
          </div>
        </div>

        {/* Bottom: Editable Fields - these scroll */}
        <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {"Gemini Predictions - Tap to edit"}
          </p>
          <div className="flex flex-col gap-2.5">
            {fields.map((field) => (
              <div key={field.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    {field.label}
                  </label>
                  <span
                    className={cn(
                      "text-[10px] font-semibold",
                      getConfidenceColor(field.confidence)
                    )}
                  >
                    {field.confidence}%
                  </span>
                </div>
                <Input
                  value={editableFields[field.label] ?? field.value}
                  onChange={(e) => handleFieldChange(field.label, e.target.value)}
                  className={cn(
                    "h-10 text-sm font-medium",
                    field.confidence < 80 &&
                      "border-warning/50 bg-warning/5 ring-1 ring-warning/20"
                  )}
                />
                <Progress
                  value={field.confidence}
                  className={cn("h-1", getBarClass(field.confidence))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Approve & Save - sticky at bottom */}
        <div className="sticky bottom-0 border-t border-border bg-card px-4 py-4">
          <Button
            onClick={handleApproveAndSave}
            size="lg"
            className="h-14 w-full gap-2 rounded-xl bg-success text-base font-bold text-success-foreground shadow-lg hover:bg-success/90"
          >
            <CheckCircle className="size-5" />
            Approve & Save
          </Button>
        </div>
      </div>
    )
  }

  // ── Ordonnance Camera Viewfinder ──
  if (capturePhase === "viewfinder") {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setCapturePhase("idle")}
            className="flex items-center gap-2 text-sm font-medium text-primary"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <p className="text-sm font-semibold text-foreground">Capture Ordonnance</p>
          <div className="w-14" />
        </div>

        <div className="relative mx-4 flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-foreground/95">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.6)_100%)]" />
          <div className="relative flex h-72 w-56 flex-col items-center justify-center">
            <div className="absolute top-0 left-0 size-10 rounded-tl-lg border-t-[3px] border-l-[3px] border-primary" />
            <div className="absolute top-0 right-0 size-10 rounded-tr-lg border-t-[3px] border-r-[3px] border-primary" />
            <div className="absolute bottom-0 left-0 size-10 rounded-bl-lg border-b-[3px] border-l-[3px] border-primary" />
            <div className="absolute bottom-0 right-0 size-10 rounded-br-lg border-b-[3px] border-r-[3px] border-primary" />
            <div className="absolute top-4 h-0.5 w-[calc(100%-2rem)] animate-pulse bg-primary/60" />
            <div className="flex flex-col items-center gap-2">
              <Camera className="size-10 text-primary-foreground/50" />
              <span className="px-4 text-center text-sm font-medium text-primary-foreground/70">
                Align the ordonnance page within the frame
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 px-4 pt-5 pb-4">
          <button
            onClick={handleSimulateSnap}
            className="group flex size-20 items-center justify-center rounded-full border-4 border-primary bg-primary shadow-xl transition-transform active:scale-95"
            aria-label="Take photo"
          >
            <div className="flex size-16 items-center justify-center rounded-full border-2 border-primary-foreground/30 bg-primary">
              <Camera className="size-7 text-primary-foreground" />
            </div>
          </button>
          <p className="text-xs font-medium text-muted-foreground">
            {isOnline
              ? "Take photo - You will preview before AI analyzes"
              : "Take photo - You will preview before saving to queue"}
          </p>
        </div>
      </div>
    )
  }

  // ── Active Session Screen (default) ──
  return (
    <div className="flex flex-col gap-5 px-4 py-6">
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
              {formatTime(sessionTime)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex items-center gap-3 pt-0">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <User className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              Patient [{patientId}]
            </p>
          </div>
          <Badge className="border-success/20 bg-success/15 text-xs text-success">
            In Progress
          </Badge>
        </CardContent>
      </Card>

      {/* Captured notes count */}
      {capturedCount > 0 && (
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="flex items-center gap-3 py-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/15">
              <FileText className="size-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {capturedCount} note{capturedCount > 1 ? "s" : ""} captured
              </p>
              <p className="text-xs text-muted-foreground">
                {isOnline ? "Reviewed & saved via AI" : "Saved locally, pending sync"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mode indicator */}
      <p className="text-center text-sm text-muted-foreground">
        {isOnline
          ? "Online - AI will analyze your notes in real-time"
          : "Offline - Photos will be saved to queue for later review"}
      </p>

      {/* Large Capture Shutter Button */}
      <div className="flex flex-col items-center gap-3 py-6">
        <button
          onClick={handleCapturePress}
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
        onClick={onEndSession}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        End Session
      </button>
    </div>
  )
}
