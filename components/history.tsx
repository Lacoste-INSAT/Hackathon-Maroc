"use client"

import { ArrowLeft, User, Wifi, WifiOff, AlertTriangle, FileText } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { type HistoryStatus, type HistoryEntry } from "@/lib/mock-data"

interface HistoryProps {
  entries: HistoryEntry[]
  onBack: () => void
}

const statusConfig: Record<
  HistoryStatus,
  { label: string; color: string; icon: typeof Wifi }
> = {
  "ai-realtime": {
    label: "AI Real-time",
    color: "bg-success/15 text-success border-success/20",
    icon: Wifi,
  },
  "auto-synced": {
    label: "Auto-synced",
    color: "bg-primary/15 text-primary border-primary/20",
    icon: WifiOff,
  },
  "doctor-reviewed": {
    label: "Doctor Reviewed",
    color: "bg-warning/10 text-warning-foreground border-warning/20",
    icon: AlertTriangle,
  },
}

export function History({ entries, onBack }: HistoryProps) {
  const aiRealtime = entries.filter((e) => e.status === "ai-realtime").length
  const autoSynced = entries.filter((e) => e.status === "auto-synced").length
  const doctorReviewed = entries.filter(
    (e) => e.status === "doctor-reviewed"
  ).length
  const totalNotes = entries.reduce((sum, e) => sum + e.notesCount, 0)

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
            {"Today's History"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {entries.length} patients - {totalNotes} notes total
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-1 py-3">
            <Wifi className="size-4 text-success" />
            <span className="text-xl font-bold text-foreground">{aiRealtime}</span>
            <span className="text-center text-[9px] leading-tight text-muted-foreground">
              AI Real-time
            </span>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-1 py-3">
            <WifiOff className="size-4 text-primary" />
            <span className="text-xl font-bold text-foreground">{autoSynced}</span>
            <span className="text-center text-[9px] leading-tight text-muted-foreground">
              Auto-synced
            </span>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-1 py-3">
            <AlertTriangle className="size-4 text-warning-foreground" />
            <span className="text-xl font-bold text-foreground">{doctorReviewed}</span>
            <span className="text-center text-[9px] leading-tight text-muted-foreground">
              Doctor Reviewed
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusConfig).map(([key, config]) => (
          <div
            key={key}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium",
              config.color
            )}
          >
            <config.icon className="size-3" />
            {config.label}
          </div>
        ))}
      </div>

      {/* Patient List */}
      <div className="flex flex-col gap-2.5">
        {entries.map((entry) => {
          const config = statusConfig[entry.status]
          return (
            <Card key={entry.id} className="shadow-none">
              <CardContent className="flex items-center gap-3 py-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User className="size-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {entry.patient}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.patientId} - {entry.time}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="size-3" />
                    {entry.notesCount} note{entry.notesCount > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge
                    className={cn(
                      "gap-1 border text-[10px]",
                      config.color
                    )}
                  >
                    <config.icon className="size-3" />
                    {config.label}
                  </Badge>
                  <span className="text-xs font-semibold text-foreground">
                    {entry.confidence}%
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
