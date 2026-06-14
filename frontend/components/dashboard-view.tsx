"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Gauge,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { AlertsFeed } from "@/components/alerts-feed"
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
import { SensorChart } from "@/components/sensor-chart"
import { apiFetch } from "@/lib/api-client"
import type { Equipment, MaintenancePlan, Priority } from "@/lib/domain-types"

const statusConfig = {
  healthy: { label: "Healthy", dot: "bg-success", badge: "bg-success/10 text-success border-success/20" },
  watch: { label: "Watch", dot: "bg-warning", badge: "bg-warning/10 text-warning border-warning/20" },
  degraded: { label: "Degraded", dot: "bg-destructive", badge: "bg-destructive/10 text-destructive border-destructive/20" },
  critical: { label: "Critical", dot: "bg-destructive", badge: "bg-destructive text-destructive-foreground border-destructive" },
} as const

const priorityConfig: Record<Priority, { label: string; badge: string }> = {
  low: { label: "Low", badge: "bg-muted text-muted-foreground border-border" },
  medium: { label: "Medium", badge: "bg-primary/10 text-primary border-primary/20" },
  high: { label: "High", badge: "bg-warning/10 text-warning border-warning/20" },
  critical: { label: "Critical", badge: "bg-destructive/10 text-destructive border-destructive/20" },
}

export function DashboardView() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [plans, setPlans] = useState<MaintenancePlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [equipmentData, plansData] = await Promise.all([
          apiFetch<{ equipment: Equipment[] }>("/api/equipment"),
          apiFetch<{ plans: MaintenancePlan[] }>("/api/plans"),
        ])
        if (!cancelled) {
          setEquipment(equipmentData.equipment)
          setPlans(plansData.plans)
        }
      } catch {
        if (!cancelled) {
          setEquipment([])
          setPlans([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const kpis = useMemo(() => {
    const avgHealth =
      equipment.length === 0
        ? 0
        : Math.round(equipment.reduce((sum, asset) => sum + asset.healthScore, 0) / equipment.length)
    return {
      assetsMonitored: equipment.length,
      avgHealth,
      openActions: plans.filter((plan) => plan.status !== "completed").length,
      predictedFailures30d: equipment.filter(
        (asset) => asset.rulDays !== null && asset.rulDays <= 30,
      ).length,
    }
  }, [equipment, plans])

  const priorityQueue = plans
    .filter((plan) => plan.status !== "completed")
    .sort((a, b) => b.riskScore - a.riskScore)
  const watchlist = equipment.filter((asset) => asset.status !== "healthy")

  const kpiItems = [
    { label: "Assets Monitored", value: String(kpis.assetsMonitored), sub: "from uploaded data", icon: Gauge },
    { label: "Average Health", value: `${kpis.avgHealth}%`, sub: "fleet-wide health score", icon: Activity },
    { label: "Predicted Failures (30d)", value: String(kpis.predictedFailures30d), sub: "assets with RUL under 30 days", icon: TriangleAlert },
    { label: "Open Maintenance Actions", value: String(kpis.openActions), sub: "in the planner queue", icon: ClipboardList },
  ]

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="Plant Overview"
        description="Fleet health, failure predictions and maintenance priorities"
      >
        <Button render={<Link href="/investigation" />} nativeButton={false} size="sm">
          <Sparkles data-icon="inline-start" />
          <span className="hidden sm:inline">AI Investigation</span>
          <span className="sm:hidden">Investigate</span>
        </Button>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {equipment.length === 0 && !loading ? (
          <Card>
            <CardHeader>
              <CardTitle>No real plant data uploaded yet</CardTitle>
              <CardDescription>
                Upload equipment CSV, sensor readings, maintenance logs, spares, PDFs, manuals or SOPs to populate the dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link href="/knowledge" />} nativeButton={false}>
                Upload data
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <section aria-label="Key performance indicators" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiItems.map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </CardTitle>
                <kpi.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <span className="font-mono text-3xl font-semibold tracking-tight">
                  {kpi.value}
                </span>
                <span className="text-xs text-muted-foreground">{kpi.sub}</span>
              </CardContent>
            </Card>
          ))}
        </section>

        <AlertsFeed />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle>Equipment Health</CardTitle>
                <CardDescription>Live health scores from uploaded assets</CardDescription>
              </div>
              <Button render={<Link href="/equipment" />} nativeButton={false} variant="ghost" size="sm">
                View all
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardHeader>
            <CardContent>
              {equipment.length === 0 ? (
                <p className="text-sm text-muted-foreground">No equipment records available.</p>
              ) : (
                <div className="h-[400px] overflow-y-auto pr-2">
                  <ul className="flex flex-col gap-3">
                    {equipment.map((asset) => {
                      const cfg = statusConfig[asset.status]
                      return (
                        <li key={asset.id}>
                          <Link href={`/equipment/${asset.id}`} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 transition-colors hover:bg-accent">
                            <span className={`size-2 shrink-0 rounded-full ${cfg.dot}`} aria-hidden="true" />
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate text-sm font-medium">{asset.name}</span>
                              <span className="font-mono text-xs text-muted-foreground">{asset.id} - {asset.area}</span>
                            </div>
                            <div className="hidden w-28 shrink-0 sm:block">
                              <Progress value={asset.healthScore} className="h-1.5" />
                            </div>
                            <span className="w-10 shrink-0 text-right font-mono text-sm font-medium">{asset.healthScore}%</span>
                            <Badge variant="outline" className={`${cfg.badge} w-[4.75rem] shrink-0 justify-center`}>
                              {cfg.label}
                            </Badge>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Maintenance Priorities</CardTitle>
              <CardDescription>Ranked by risk score from backend logic</CardDescription>
            </CardHeader>
            <CardContent>
              {priorityQueue.length === 0 ? (
                <p className="text-sm text-muted-foreground">No maintenance plans yet.</p>
              ) : (
                <div className="h-[400px] overflow-y-auto pr-2">
                  <ol className="flex flex-col gap-3">
                    {priorityQueue.map((plan, index) => {
                      const cfg = priorityConfig[plan.priority]
                      return (
                        <li key={plan.id} className="flex items-start gap-3 rounded-md border px-3 py-2.5">
                          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold text-secondary-foreground">
                            {index + 1}
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-sm font-medium leading-snug text-pretty">{plan.title}</span>
                            <span className="font-mono text-xs text-muted-foreground">{plan.equipmentName} - due {plan.dueDate}</span>
                          </div>
                          <Badge variant="outline" className={cfg.badge}>{cfg.label}</Badge>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {watchlist.length > 0 ? (
          <section aria-label="Sensor trends for at-risk equipment">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Watchlist - degrading sensor trends
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {watchlist.map((asset) => {
                const sensor = asset.sensors.find((item) => item.trend !== "stable") ?? asset.sensors[0]
                if (!sensor) return null
                const cfg = statusConfig[asset.status]
                return (
                  <Card key={asset.id}>
                    <CardHeader className="flex flex-row items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <CardTitle className="text-sm">{asset.name}</CardTitle>
                        <CardDescription className="font-mono text-xs">
                          {sensor.name} - {sensor.current} {sensor.unit}
                          {asset.rulDays !== null ? ` - RUL ~${asset.rulDays}d` : ""}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={cfg.badge}>{cfg.label}</Badge>
                    </CardHeader>
                    <CardContent>
                      <SensorChart sensor={sensor} height={150} />
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
