"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Gauge,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { apiFetch } from "@/lib/api-client"

interface PredictedFailure {
  equipmentId: string
  equipmentName: string
  equipmentType: string
  area: string
  healthScore: number
  rulDays: number | null
  riskScore: number
  riskLevel: "low" | "medium" | "high" | "critical"
  failureLikelihood: number
  urgencyBand: "immediate" | "7d" | "30d" | "90d" | "low"
  topDrivers: string[]
  worstSensor?: {
    name: string
    current: number
    unit: string
    threshold: number
    trend: string
  }
}

const urgencyConfig = {
  immediate: {
    label: "Immediate",
    badge: "bg-destructive text-destructive-foreground border-destructive",
    ring: "ring-destructive/30",
    bar: "bg-destructive",
  },
  "7d": {
    label: "Within 7 days",
    badge: "bg-destructive/10 text-destructive border-destructive/20",
    ring: "ring-destructive/20",
    bar: "bg-destructive/80",
  },
  "30d": {
    label: "Within 30 days",
    badge: "bg-warning/10 text-warning border-warning/20",
    ring: "ring-warning/20",
    bar: "bg-warning",
  },
  "90d": {
    label: "Within 90 days",
    badge: "bg-primary/10 text-primary border-primary/20",
    ring: "ring-primary/20",
    bar: "bg-primary/70",
  },
  low: {
    label: "Low risk",
    badge: "bg-muted text-muted-foreground border-border",
    ring: "",
    bar: "bg-muted",
  },
} as const

const riskBadge: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-primary/10 text-primary border-primary/20",
  high: "bg-warning/10 text-warning border-warning/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
}

export function PredictedFailures() {
  const [predictions, setPredictions] = useState<PredictedFailure[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadPredictions() {
      try {
        const data = await apiFetch<{ predictions: PredictedFailure[] }>(
          "/api/predictions",
        )
        if (!cancelled) setPredictions(data.predictions)
      } catch {
        if (!cancelled) setPredictions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadPredictions()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return null

  if (predictions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Gauge />
          </EmptyMedia>
          <EmptyTitle>No failure predictions</EmptyTitle>
          <EmptyDescription>
            Upload equipment and sensor data to generate failure predictions.
            Assets with degrading trends or low health scores will appear here
            with urgency estimates.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const bands = ["immediate", "7d", "30d", "90d"] as const
  const grouped = bands
    .map((band) => ({
      band,
      items: predictions.filter((p) => p.urgencyBand === band),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {bands.map((band) => {
          const count = predictions.filter((p) => p.urgencyBand === band).length
          const cfg = urgencyConfig[band]
          return (
            <Card key={band} className="py-3">
              <CardContent className="px-3">
                <div className="font-mono text-2xl font-semibold">{count}</div>
                <Badge variant="outline" className={`${cfg.badge} mt-1`}>
                  {cfg.label}
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {grouped.map(({ band, items }) => {
        const cfg = urgencyConfig[band]
        return (
          <section key={band}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4" />
              {cfg.label}
              <Badge variant="outline" className={cfg.badge}>
                {items.length}
              </Badge>
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((pred) => {
                const rCfg = riskBadge[pred.riskLevel] ?? riskBadge.low
                return (
                  <Card
                    key={pred.equipmentId}
                    className={`ring-1 ${cfg.ring}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-1">
                          <CardTitle className="text-base leading-snug">
                            {pred.equipmentName}
                          </CardTitle>
                          <CardDescription className="font-mono text-xs">
                            {pred.equipmentId} · {pred.equipmentType} ·{" "}
                            {pred.area}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className={cfg.badge}>
                          {cfg.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">
                            Failure likelihood
                          </span>
                          <span className="font-mono text-lg font-semibold">
                            {pred.failureLikelihood}%
                          </span>
                          <Progress
                            value={pred.failureLikelihood}
                            className="h-1.5"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">
                            Health
                          </span>
                          <span className="font-mono text-lg font-semibold">
                            {pred.healthScore}%
                          </span>
                          <Progress
                            value={pred.healthScore}
                            className="h-1.5"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">
                            RUL
                          </span>
                          <span className="font-mono text-lg font-semibold">
                            {pred.rulDays !== null ? `~${pred.rulDays}d` : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={rCfg}>
                          Risk: {pred.riskLevel}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {pred.riskScore}/100
                        </span>
                      </div>

                      {pred.worstSensor && (
                        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                          <TrendingUp className="size-4 shrink-0 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="text-xs font-medium">
                              {pred.worstSensor.name}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {pred.worstSensor.current}{" "}
                              {pred.worstSensor.unit} · threshold{" "}
                              {pred.worstSensor.threshold}{" "}
                              {pred.worstSensor.unit} · {pred.worstSensor.trend}
                            </span>
                          </div>
                        </div>
                      )}

                      {pred.topDrivers.length > 0 && (
                        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                          {pred.topDrivers.join(" — ")}
                        </p>
                      )}

                      <Button
                        render={
                          <Link
                            href={`/investigation?equipment=${pred.equipmentId}`}
                          />
                        }
                        nativeButton={false}
                        size="sm"
                        className="w-fit"
                      >
                        <Sparkles data-icon="inline-start" />
                        Investigate
                        <ArrowRight className="size-3" />
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
