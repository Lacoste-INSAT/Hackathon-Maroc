"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  QrCode,
  Keyboard,
  X,
  Loader2,
  Camera as CameraIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface QrScannerProps {
  open: boolean
  onClose: () => void
  onScanSuccess: (code: string) => void
}

export function QrScanner({ open, onClose, onScanSuccess }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)
  const [scanPhase, setScanPhase] = useState<"scanning" | "failed">("scanning")
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualCode, setManualCode] = useState("")
  const [cameraError, setCameraError] = useState(false)
  const [scanLineY, setScanLineY] = useState(0)

  // Animate the scan line
  useEffect(() => {
    if (!open || showManualEntry) return
    let y = 0
    let direction = 1
    const animate = () => {
      y += direction * 1.5
      if (y > 100) direction = -1
      if (y < 0) direction = 1
      setScanLineY(y)
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [open, showManualEntry])

  // Start camera when dialog opens
  useEffect(() => {
    if (!open) {
      stopCamera()
      setScanPhase("scanning")
      setShowManualEntry(false)
      setManualCode("")
      setCameraError(false)
      return
    }

    startCamera()
    const failTimer = setTimeout(() => setScanPhase("failed"), 5000)
    return () => {
      clearTimeout(failTimer)
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        // Start scanning for QR codes
        scanLoop()
      }
    } catch {
      setCameraError(true)
    }
  }

  function stopCamera() {
    cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  const scanLoop = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(scanLoop)
      return
    }

    const ctx = canvas.getContext("2d")!
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    try {
      // Use jsQR as the primary scanner (reliable cross-browser)
      const jsQR = (await import("jsqr")).default
      const result = jsQR(imageData.data, imageData.width, imageData.height)
      if (result?.data) {
        stopCamera()
        onScanSuccess(result.data)
        return
      }
    } catch {
      // jsQR failed, continue scanning
    }

    animFrameRef.current = requestAnimationFrame(scanLoop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onScanSuccess])

  function handleManualSubmit() {
    if (manualCode.length >= 3) {
      stopCamera()
      onScanSuccess(manualCode.toUpperCase())
    }
  }

  function handleSimulateScan() {
    stopCamera()
    onScanSuccess("AHM-924")
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
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
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" />
                <span className="sr-only">Close scanner</span>
              </button>
            </div>

            <div className="relative mx-5 flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-foreground/95">
              {/* Live video feed */}
              {!cameraError && (
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
              )}
              <canvas ref={canvasRef} className="hidden" />

              {/* Vignette overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.7)_100%)]" />

              {/* Scan frame */}
              <div className="relative flex size-52 flex-col items-center justify-center">
                {/* Corner brackets */}
                <div className="absolute top-0 left-0 size-8 rounded-tl-xl border-t-[3px] border-l-[3px] border-primary" />
                <div className="absolute top-0 right-0 size-8 rounded-tr-xl border-t-[3px] border-r-[3px] border-primary" />
                <div className="absolute bottom-0 left-0 size-8 rounded-bl-xl border-b-[3px] border-l-[3px] border-primary" />
                <div className="absolute bottom-0 right-0 size-8 rounded-br-xl border-b-[3px] border-r-[3px] border-primary" />

                {/* Animated scan line */}
                {scanPhase === "scanning" && (
                  <div
                    className="absolute left-2 right-2 h-0.5 bg-primary/80 shadow-[0_0_8px_rgba(var(--primary),0.5)] transition-none"
                    style={{ top: `${scanLineY}%` }}
                  />
                )}

                {/* Status indicator */}
                {cameraError ? (
                  <div className="flex flex-col items-center gap-2">
                    <CameraIcon className="size-8 text-primary-foreground/40" />
                    <span className="px-4 text-center text-sm font-medium text-primary-foreground/60">
                      Camera access denied
                    </span>
                  </div>
                ) : scanPhase === "scanning" ? (
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
  )
}
