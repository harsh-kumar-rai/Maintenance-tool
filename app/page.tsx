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
import {
  equipment,
  kpis,
  priorityQueue,
  priorityConfig,
  statusConfig,
} from "@/lib/demo-data"

const kpiItems = [
  {
    label: "Assets Monitored",
    value: String(kpis.assetsMonitored),
    sub: "across 5 plant areas",
    icon: Gauge,
  },
  {
    label: "Average Health",
    value: `${kpis.avgHealth}%`,
    sub: "fleet-wide health score",
    icon: Activity,
  },
  {
    label: "Predicted Failures (30d)",
    value: String(kpis.predictedFailures30d),
    sub: "assets with RUL under 30 days",
    icon: TriangleAlert,
  },
  {
    label: "Open Maintenance Actions",
    value: String(kpis.openActions),
    sub: "in the planner queue",
    icon: ClipboardList,
  },
]

export default function DashboardPage() {
  const watchlist = equipment.filter((e) => e.status !== "healthy")

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="Plant Overview"
        description="Fleet health, failure predictions and maintenance priorities"
      >
        <Button
          render={<Link href="/investigation" />}
          nativeButton={false}
          size="sm"
        >
          <Sparkles data-icon="inline-start" />
          <span className="hidden sm:inline">AI Investigation</span>
          <span className="sm:hidden">Investigate</span>
        </Button>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {/* KPI cards */}
        <section
          aria-label="Key performance indicators"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Equipment health grid */}
          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle>Equipment Health</CardTitle>
                <CardDescription>
                  Live health scores across all monitored assets
                </CardDescription>
              </div>
              <Button
                render={<Link href="/equipment" />}
                nativeButton={false}
                variant="ghost"
                size="sm"
              >
                View all
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {equipment.map((eq) => {
                  const cfg = statusConfig[eq.status]
                  return (
                    <li key={eq.id}>
                      <Link
                        href={`/equipment/${eq.id}`}
                        className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 transition-colors hover:bg-accent"
                      >
                        <span
                          className={`size-2 shrink-0 rounded-full ${cfg.dot}`}
                          aria-hidden="true"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium">
                            {eq.name}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {eq.id} · {eq.area}
                          </span>
                        </div>
                        <div className="hidden w-28 shrink-0 sm:block">
                          <Progress
                            value={eq.healthScore}
                            className="h-1.5 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-muted-foreground/20"
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right font-mono text-sm font-medium">
                          {eq.healthScore}%
                        </span>
                        <Badge
                          variant="outline"
                          className={`${cfg.badge} w-[4.75rem] shrink-0 justify-center`}
                        >
                          {cfg.label}
                        </Badge>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Priority queue */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle>Maintenance Priorities</CardTitle>
                <CardDescription>Ranked by AI risk score</CardDescription>
              </div>
              <Button
                render={<Link href="/planner" />}
                nativeButton={false}
                variant="ghost"
                size="sm"
              >
                Planner
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3">
                {priorityQueue.map((plan, i) => {
                  const cfg = priorityConfig[plan.priority]
                  return (
                    <li
                      key={plan.id}
                      className="flex items-start gap-3 rounded-md border px-3 py-2.5"
                    >
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold text-secondary-foreground">
                        {i + 1}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-sm font-medium leading-snug text-pretty">
                          {plan.title}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {plan.equipmentName} · due {plan.dueDate}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={cfg.badge}>
                          {cfg.label}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          risk {plan.riskScore}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Watchlist sensor trends */}
        <section aria-label="Sensor trends for at-risk equipment">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Watchlist — degrading sensor trends
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {watchlist.map((eq) => {
              const sensor =
                eq.sensors.find((s) => s.trend !== "stable") ?? eq.sensors[0]
              const cfg = statusConfig[eq.status]
              return (
                <Card key={eq.id}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-sm">{eq.name}</CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {sensor.name} · {sensor.current} {sensor.unit}
                        {eq.rulDays !== null ? ` · RUL ~${eq.rulDays}d` : ""}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={cfg.badge}>
                      {cfg.label}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <SensorChart sensor={sensor} height={150} />
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
