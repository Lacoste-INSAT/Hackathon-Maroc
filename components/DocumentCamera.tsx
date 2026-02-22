"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import { Camera, ArrowLeft } from "lucide-react"

interface DocumentCameraProps {
  isOnline: boolean
  onCapture: (imageDataUrl: string) => void
  onBack: () => void
}

export function DocumentCamera({
  isOnline,
  onCapture,
  onBack,
}: DocumentCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(false)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 2560 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setCameraReady(true)
      }
    } catch {
      setCameraError(true)
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  const handleCapture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // Draw full-res frame from video
    canvas.width = video.videoWidth || 1920
    canvas.height = video.videoHeight || 2560

    const ctx = canvas.getContext("2d")!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Export as JPEG at high quality (this is the ORIGINAL full-res)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85)

    stopCamera()
    onCapture(dataUrl)
  }, [onCapture])

  // Simulated capture for when camera isn't available
  const handleSimulatedCapture = useCallback(() => {
    // Create a simulated document image
    const canvas = document.createElement("canvas")
    canvas.width = 800
    canvas.height = 1100
    const ctx = canvas.getContext("2d")!

    // Draw a fake ordonnance
    ctx.fillStyle = "#faf8f5"
    ctx.fillRect(0, 0, 800, 1100)

    // Header
    ctx.fillStyle = "#1a365d"
    ctx.font = "bold 28px serif"
    ctx.fillText("ORDONNANCE MÉDICALE", 170, 60)

    ctx.fillStyle = "#4a5568"
    ctx.font = "16px sans-serif"
    ctx.fillText("Dr. Benali — CHU Rural Clinic, Tizi Ouzou", 180, 95)

    // Horizontal line
    ctx.strokeStyle = "#cbd5e0"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(40, 120)
    ctx.lineTo(760, 120)
    ctx.stroke()

    // Handwriting simulation
    ctx.fillStyle = "#1a202c"
    ctx.font = "italic 22px 'Georgia', serif"
    const lines = [
      "Patient: Ahmed Belkadi - AHM-924",
      "",
      "Symptômes: Fièvre, toux sèche,",
      "  fatigue depuis 3 jours",
      "",
      "Diagnostic: Infection respiratoire",
      "  haute (URI probable)",
      "",
      "Traitement:",
      "  Amoxicilline 500mg — 2cp/jour",
      "  pendant 7 jours",
      "  Paracétamol 1g — si douleur,",
      "  max 3/jour",
      "",
      "Notes: Contrôle dans 5j si pas",
      "  d'amélioration. Repos + hydratation.",
      "",
      "  Matin / Midi / Soir",
    ]
    lines.forEach((line, i) => {
      ctx.fillText(line, 60, 170 + i * 38)
    })

    // Signature simulation
    ctx.font = "italic 20px 'Georgia', serif"
    ctx.fillStyle = "#2b6cb0"
    ctx.fillText("— Dr. Benali", 550, 940)

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
    onCapture(dataUrl)
  }, [onCapture])

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => {
            stopCamera()
            onBack()
          }}
          className="flex items-center gap-2 text-sm font-medium text-primary"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <p className="text-sm font-semibold text-foreground">
          Capture Ordonnance
        </p>
        <div className="w-14" />
      </div>

      <div className="relative mx-4 flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-foreground/95">
        {/* Live camera feed */}
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

        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.6)_100%)]" />

        {/* Document frame overlay */}
        <div className="relative flex h-72 w-56 flex-col items-center justify-center">
          <div className="absolute top-0 left-0 size-10 rounded-tl-lg border-t-[3px] border-l-[3px] border-primary" />
          <div className="absolute top-0 right-0 size-10 rounded-tr-lg border-t-[3px] border-r-[3px] border-primary" />
          <div className="absolute bottom-0 left-0 size-10 rounded-bl-lg border-b-[3px] border-l-[3px] border-primary" />
          <div className="absolute bottom-0 right-0 size-10 rounded-br-lg border-b-[3px] border-r-[3px] border-primary" />

          {/* Animated guide line */}
          <div className="absolute top-4 h-0.5 w-[calc(100%-2rem)] animate-pulse bg-primary/60" />

          <div className="flex flex-col items-center gap-2">
            {cameraError ? (
              <>
                <Camera className="size-10 text-primary-foreground/50" />
                <span className="px-4 text-center text-sm font-medium text-primary-foreground/70">
                  Camera unavailable — use simulated capture
                </span>
              </>
            ) : !cameraReady ? (
              <>
                <Camera className="size-10 animate-pulse text-primary-foreground/50" />
                <span className="px-4 text-center text-sm font-medium text-primary-foreground/70">
                  Initializing camera...
                </span>
              </>
            ) : (
              <>
                <Camera className="size-10 text-primary-foreground/50" />
                <span className="px-4 text-center text-sm font-medium text-primary-foreground/70">
                  Align the ordonnance page within the frame
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 px-4 pt-5 pb-4">
        <button
          onClick={cameraError ? handleSimulatedCapture : (cameraReady ? handleCapture : handleSimulatedCapture)}
          className="group flex size-20 items-center justify-center rounded-full border-4 border-primary bg-primary shadow-xl transition-transform active:scale-95"
          aria-label="Take photo"
        >
          <div className="flex size-16 items-center justify-center rounded-full border-2 border-primary-foreground/30 bg-primary">
            <Camera className="size-7 text-primary-foreground" />
          </div>
        </button>
        <p className="text-xs font-medium text-muted-foreground">
          {isOnline
            ? "Take photo — You will preview before AI analyzes"
            : "Take photo — You will preview before saving to queue"}
        </p>
      </div>
    </div>
  )
}
