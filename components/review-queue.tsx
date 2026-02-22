"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowLeft,
  Gauge,
  PartyPopper,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  queuedRecords as initialQueuedRecords,
  approvedRecords as initialApprovedRecords,
  type PatientRecord,
} from "@/lib/mock-data"

interface ReviewQueueProps {
  onBack: () => void
  extraQueueItems?: PatientRecord[]
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

export function ReviewQueue({ onBack, extraQueueItems = [] }: ReviewQueueProps) {
  const [queue, setQueue] = useState<PatientRecord[]>([
    ...extraQueueItems,
    ...initialQueuedRecords,
  ])
  const [approved, setApproved] = useState<PatientRecord[]>([
    ...initialApprovedRecords,
  ])
  const [currentIndex, setCurrentIndex] = useState<number | null>(null)
  const [editableFields, setEditableFields] = useState<Record<string, string>>({})
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [allDone, setAllDone] = useState(false)

  const currentRecord = currentIndex !== null ? queue[currentIndex] : null

  const openRecord = useCallback(
    (index: number) => {
      setCurrentIndex(index)
      const record = queue[index]
      if (record) {
        const fields: Record<string, string> = {}
        record.extractedFields.forEach((f) => {
          fields[f.label] = f.value
        })
        setEditableFields(fields)
        setIsTransitioning(false)
      }
    },
    [queue]
  )

  function handleFieldChange(label: string, value: string) {
    setEditableFields((prev) => ({ ...prev, [label]: value }))
  }

  function handleSubmitAndVerify() {
    if (currentIndex === null || !currentRecord) return
    setIsTransitioning(true)

    setTimeout(() => {
      const submittedRecord: PatientRecord = {
        ...currentRecord,
        status: "approved",
        overallConfidence: 100,
        syncedAt: "Just now",
      }
      setApproved((prev) => [submittedRecord, ...prev])

      const newQueue = queue.filter((_, i) => i !== currentIndex)
      setQueue(newQueue)

      if (newQueue.length === 0) {
        setCurrentIndex(null)
        setAllDone(true)
      } else {
        const nextIndex = Math.min(currentIndex, newQueue.length - 1)
        setCurrentIndex(nextIndex)
        const nextRecord = newQueue[nextIndex]
        if (nextRecord) {
          const fields: Record<string, string> = {}
          nextRecord.extractedFields.forEach((f) => {
            fields[f.label] = f.value
          })
          setEditableFields(fields)
        }
        setIsTransitioning(false)
      }
    }, 400)
  }

  // ── All Records Up to Date ──
  if (allDone) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-4 py-20">
        <div className="flex size-24 items-center justify-center rounded-full bg-success/15">
          <PartyPopper className="size-12 text-success" />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-bold text-foreground">
            All records up to date!
          </h2>
          <p className="text-sm text-muted-foreground">
            Every flagged record has been reviewed and verified.
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
          <span>{approved.length} records verified today</span>
        </div>
        <Button
          onClick={onBack}
          size="lg"
          className="h-14 w-full max-w-xs gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-md"
        >
          Back to Dashboard
        </Button>
      </div>
    )
  }

  // ── Single Record Review (split screen) ──
  if (currentRecord && currentIndex !== null) {
    return (
      <div
        className={cn(
          "flex flex-col transition-all duration-300",
          isTransitioning
            ? "-translate-x-full opacity-0"
            : "translate-x-0 opacity-100"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <button
            onClick={() => setCurrentIndex(null)}
            className="flex items-center gap-2 text-sm font-medium text-primary"
          >
            <ArrowLeft className="size-4" />
            Queue
          </button>
          <Badge className="bg-muted text-xs text-muted-foreground">
            {currentIndex + 1} of {queue.length}
          </Badge>
        </div>

        {/* Top: Scanned Image */}
        <div className="border-b border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-foreground">
                {currentRecord.patient}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentRecord.patientId} - {currentRecord.date}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge
                className={cn(
                  "gap-1 border text-xs",
                  getConfidenceBg(currentRecord.overallConfidence)
                )}
              >
                <AlertTriangle className="size-3" />
                {currentRecord.overallConfidence}%
              </Badge>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Gauge className="size-3" />
                Pred: {currentRecord.predictionScore}%
              </span>
            </div>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border">
            <Image
              src={currentRecord.scanImage}
              alt={`Scanned booklet for ${currentRecord.patient}`}
              fill
              className="object-cover"
            />
          </div>

          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
            <p className="text-xs font-medium text-warning-foreground">
              Flagged: {currentRecord.reason}
            </p>
          </div>
        </div>

        {/* Bottom: Editable Fields */}
        <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {"Gemini's best guess - Edit to correct"}
          </p>
          <div className="flex flex-col gap-2.5">
            {currentRecord.extractedFields.map((field) => (
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
        </div>

        {/* Submit */}
        <div className="sticky bottom-0 border-t border-border bg-card px-4 py-4">
          <Button
            onClick={handleSubmitAndVerify}
            size="lg"
            className="h-14 w-full gap-2 rounded-xl bg-success text-base font-bold text-success-foreground shadow-lg hover:bg-success/90"
          >
            <CheckCircle className="size-5" />
            Submit & Verify
            {queue.length > 1 && (
              <span className="ml-1 flex items-center text-sm font-normal opacity-80">
                <ChevronRight className="size-4" />
                Next
              </span>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // ── Queue List View ──
  return (
    <div className="flex flex-col gap-5 px-4 py-6">
      <div className="flex items-start gap-3">
        <button
          onClick={onBack}
          className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Review Queue
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {queue.length} record{queue.length !== 1 ? "s" : ""} flagged by Gemini {"(confidence < 80%)"}
          </p>
        </div>
      </div>

      {/* Needs Review */}
      {queue.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning-foreground" />
            <span className="text-sm font-semibold text-foreground">
              Needs Your Review ({queue.length})
            </span>
          </div>
          {queue.map((record, index) => (
            <Card key={record.id} className="border-warning/30 shadow-none">
              <CardContent className="flex flex-col gap-3 py-3">
                <div className="flex gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border">
                    <Image
                      src={record.scanImage}
                      alt={`Scan for ${record.patient}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-center gap-1">
                    <p className="font-semibold text-foreground">
                      {record.patient}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {record.date} - {record.patientId}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Badge
                    className={cn(
                      "flex-1 justify-center gap-1 border text-xs",
                      getConfidenceBg(record.overallConfidence)
                    )}
                  >
                    <AlertTriangle className="size-3" />
                    Conf: {record.overallConfidence}%
                  </Badge>
                  <Badge
                    className={cn(
                      "flex-1 justify-center gap-1 border text-xs",
                      getConfidenceBg(record.predictionScore)
                    )}
                  >
                    <Gauge className="size-3" />
                    Pred: {record.predictionScore}%
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="flex-1 text-xs text-muted-foreground">
                    {record.reason}
                  </span>
                  <Button
                    onClick={() => openRecord(index)}
                    size="sm"
                    className="h-9 gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
                  >
                    Review
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Auto-Approved */}
      {approved.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="size-4 text-success" />
            <span className="text-sm font-semibold text-foreground">
              Auto-Approved ({approved.length})
            </span>
            <span className="text-xs text-muted-foreground">
              {"- Confidence 80%+"}
            </span>
          </div>
          {approved.map((record) => (
            <Card
              key={record.id}
              className="border-border/50 opacity-75 shadow-none"
            >
              <CardContent className="flex items-center gap-3 py-3">
                <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-border">
                  <Image
                    src={record.scanImage}
                    alt={`Scan for ${record.patient}`}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {record.patient}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {record.syncedAt
                      ? `Synced ${record.syncedAt}`
                      : record.date}
                  </p>
                </div>
                <Badge className="gap-1 border-success/20 bg-success/15 text-xs text-success">
                  <CheckCircle className="size-3" />
                  {record.overallConfidence}%
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
