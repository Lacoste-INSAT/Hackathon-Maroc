"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  ChevronRight,
  X,
  CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { ExtractionResult, ExtractionField } from "@/lib/types"

interface NeedsReviewCardProps {
  patientId: string
  result: ExtractionResult
  onReviewNow: (editedFields: Record<string, string>) => void
  onReviewLater: () => void
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

export function NeedsReviewCard({
  patientId,
  result,
  onReviewNow,
  onReviewLater,
}: NeedsReviewCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editableFields, setEditableFields] = useState<Record<string, string>>({})
  const [visible, setVisible] = useState(false)

  // Initialize editable fields
  useEffect(() => {
    const fields: Record<string, string> = {}
    result.fields.forEach((f) => {
      fields[f.label] = f.value
    })
    setEditableFields(fields)
    // Animate in
    requestAnimationFrame(() => setVisible(true))
  }, [result])

  // Auto-dismiss after 10 seconds if not expanded
  useEffect(() => {
    if (expanded) return
    const timer = setTimeout(() => {
      handleDismiss()
    }, 10000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  function handleDismiss() {
    setVisible(false)
    setTimeout(onReviewLater, 300)
  }

  function handleFieldChange(label: string, value: string) {
    setEditableFields((prev) => ({ ...prev, [label]: value }))
  }

  function handleSubmitReview() {
    setVisible(false)
    setTimeout(() => onReviewNow(editableFields), 300)
  }

  // Find the weakest field
  const weakestField = result.fields.reduce<ExtractionField | null>(
    (weakest, f) =>
      !weakest || f.confidence < weakest.confidence ? f : weakest,
    null
  )

  return (
    <div
      className={cn(
        "absolute inset-x-3 bottom-16 z-50 rounded-2xl border border-warning/30 bg-card shadow-2xl transition-all duration-300",
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-8 opacity-0",
        expanded ? "max-h-[70vh] overflow-y-auto" : "max-h-48"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/15">
          <AlertTriangle className="size-5 text-warning-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">
            AI Needs Your Review
          </p>
          <p className="text-xs text-muted-foreground">
            Patient [{patientId}] — Confidence{" "}
            <span className={getConfidenceColor(result.overallConfidence)}>
              {result.overallConfidence}%
            </span>
          </p>
          {weakestField && !expanded && (
            <p className="mt-1 text-xs text-warning-foreground">
              Concern: {weakestField.label} ({weakestField.confidence}%
              confidence)
            </p>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Expanded: inline review */}
      {expanded && (
        <div className="border-t border-border px-4 pt-3 pb-4">
          <div className="mb-3 flex gap-2">
            <Badge
              className={cn(
                "flex-1 justify-center gap-1 border text-xs",
                getConfidenceBg(result.overallConfidence)
              )}
            >
              Confidence: {result.overallConfidence}%
            </Badge>
            <Badge
              className={cn(
                "flex-1 justify-center gap-1 border text-xs",
                getConfidenceBg(result.predictionScore)
              )}
            >
              Accuracy: {result.predictionScore}%
            </Badge>
          </div>

          <div className="flex flex-col gap-2.5">
            {result.fields.map((field) => (
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
                  onChange={(e) =>
                    handleFieldChange(field.label, e.target.value)
                  }
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

          <Button
            onClick={handleSubmitReview}
            size="lg"
            className="mt-4 h-12 w-full gap-2 rounded-xl bg-success text-base font-bold text-success-foreground shadow-lg hover:bg-success/90"
          >
            <CheckCircle className="size-5" />
            Approve & Save
          </Button>
        </div>
      )}

      {/* Footer actions (collapsed) */}
      {!expanded && (
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <Button
            onClick={() => setExpanded(true)}
            size="sm"
            className="h-9 flex-1 gap-1 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
          >
            Review Now
            <ChevronRight className="size-3.5" />
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            size="sm"
            className="h-9 flex-1 rounded-lg text-sm font-medium"
          >
            Review Later
          </Button>
        </div>
      )}
    </div>
  )
}
