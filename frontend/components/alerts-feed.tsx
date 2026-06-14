"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Activity, ArrowRight, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Alert } from "@/lib/maintenance-types"
import { apiFetch } from "@/lib/api-client"

const severityBadge: Record<Alert["severity"], string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  high: "bg-warning/10 text-warning border-warning/20",
  medium: "bg-primary/10 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
}

export function AlertsFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadAlerts() {
      try {
        const data = await apiFetch<{ alerts: Alert[] }>("/api/alerts")
        if (!cancelled) setAlerts(data.alerts)
      } catch {
        // The dashboard remains useful with the static cards if alerts fail.
      }
    }

    void loadAlerts()
    const timer = window.setInterval(loadAlerts, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Live Abnormality Alerts</CardTitle>
          <CardDescription>
            Derived from thresholds, trends and trend-based RUL
          </CardDescription>
        </div>
        <Activity className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Activity className="size-4" />
            No active abnormality alerts.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {alerts.slice(0, 4).map((alert, alertIdx) => (
              <li
                key={`${alert.id}-${alertIdx}`}
                className="flex flex-col gap-2 rounded-md border px-3 py-2.5 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-pretty">
                        {alert.title}
                      </span>
                      <Badge
                        variant="outline"
                        className={severityBadge[alert.severity]}
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
                      {alert.message}
                    </p>
                  </div>
                </div>
                <Button
                  render={
                    <Link href={`/investigation?equipment=${alert.equipmentId}`} />
                  }
                  nativeButton={false}
                  variant="ghost"
                  size="sm"
                  className="w-fit"
                >
                  Investigate
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
