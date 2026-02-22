"use client"

import Image from "next/image"
import { ArrowLeft, RotateCcw, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImagePreviewProps {
  imageUrl: string
  isOnline: boolean
  onRetake: () => void
  onConfirm: () => void
}

export function ImagePreview({
  imageUrl,
  isOnline,
  onRetake,
  onConfirm,
}: ImagePreviewProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onRetake}
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
            src={imageUrl}
            alt="Captured ordonnance photo"
            fill
            className="object-cover"
            unoptimized
          />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {isOnline
            ? "Looks good? Confirm to send to Gemini AI for analysis."
            : "Confirm to save locally. It will sync when you are back online."}
        </p>

        <div className="flex w-full gap-3">
          <Button
            onClick={onRetake}
            variant="outline"
            className="h-14 flex-1 gap-2 rounded-xl text-base font-semibold"
          >
            <RotateCcw className="size-5" />
            Retake
          </Button>
          <Button
            onClick={onConfirm}
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
