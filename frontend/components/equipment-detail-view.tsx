"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  Package,
  ShieldAlert,
  Sparkles,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SensorChart } from "@/components/sensor-chart"
import { apiFetch } from "@/lib/api-client"
import type {
  Alert,
  Equipment,
  HealthStatus,
  KnowledgeDoc,
  RiskAssessment,
  SparePart,
} from "@/lib/domain-types"

const statusConfig: Record<HealthStatus, { label: string; badge: string }> = {
  healthy: { label: "Healthy", badge: "bg-success/10 text-success border-success/20" },
  watch: { label: "Watch", badge: "bg-warning/10 text-warning border-warning/20" },
  degraded: { label: "Degraded", badge: "bg-destructive/10 text-destructive border-destructive/20" },
  critical: { label: "Critical", badge: "bg-destructive text-destructive-foreground border-destructive" },
}

const severityBadge: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-primary/10 text-primary border-primary/20",
  high: "bg-warning/10 text-warning border-warning/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
}

const riskBadge: Record<string, string> = {
  low: "bg-success/10 text-success border-success/20",
  medium: "bg-primary/10 text-primary border-primary/20",
  high: "bg-warning/10 text-warning border-warning/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
}

export function EquipmentDetailView({ id }: { id: string }) {
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [risk, setRisk] = useState<RiskAssessment | null>(null)
  const [spares, setSpares] = useState<SparePart[]>([])
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await apiFetch<{
          equipment: Equipment
          documents: KnowledgeDoc[]
          alerts: Alert[]
          risk: RiskAssessment
          spares: SparePart[]
        }>(`/api/equipment/${id}`)
        if (!cancelled) {
          setEquipment(data.equipment)
          setDocuments(data.documents)
          setAlerts(data.alerts ?? [])
          setRisk(data.risk ?? null)
          setSpares(data.spares ?? [])
          setMissing(false)
        }
      } catch {
        if (!cancelled) setMissing(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (missing) {
    return (
      <div className="flex min-h-svh flex-col">
        <PageHeader title="Equipment not found" description={id}>
          <Button render={<Link href="/equipment" />} nativeButton={false} variant="outline" size="sm">
            <ArrowLeft data-icon="inline-start" />
            All equipment
          </Button>
        </PageHeader>
        <main className="p-4 md:p-6">
          <Card>
            <CardHeader>
              <CardTitle>No real record for this asset</CardTitle>
              <CardDescription>
                Upload equipment and sensor CSV files, then reopen this asset.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    )
  }

  if (!equipment) {
    return (
      <div className="flex min-h-svh flex-col">
        <PageHeader title="Loading equipment" description={id} />
      </div>
    )
  }

  const cfg = statusConfig[equipment.status]
  const showFailureWarning = equipment.rulDays !== null && equipment.rulDays <= 30

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader title={equipment.name} description={`${equipment.id} - ${equipment.type} - ${equipment.area}`}>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/equipment" />} nativeButton={false} variant="outline" size="sm">
            <ArrowLeft data-icon="inline-start" />
            <span className="hidden sm:inline">All equipment</span>
          </Button>
          <Button render={<Link href={`/investigation?equipment=${equipment.id}`} />} nativeButton={false} size="sm">
            <Sparkles data-icon="inline-start" />
            Investigate with AI
          </Button>
        </div>
      </PageHeader>

      <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {showFailureWarning && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertTriangle className="size-5 shrink-0 text-destructive" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-destructive">
                Predicted failure within {equipment.rulDays} days
              </span>
              <span className="text-xs text-muted-foreground">
                Trend-based remaining useful life estimate is critically low. Investigate and schedule maintenance immediately.
              </span>
            </div>
            <Button
              render={<Link href={`/investigation?equipment=${equipment.id}`} />}
              nativeButton={false}
              size="sm"
              variant="destructive"
              className="ml-auto shrink-0"
            >
              <Sparkles data-icon="inline-start" />
              Investigate
            </Button>
          </div>
        )}

        <section aria-label="Equipment summary" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Health Score</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <span className="font-mono text-3xl font-semibold">{equipment.healthScore}%</span>
              <Progress value={equipment.healthScore} className="h-1.5" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Badge variant="outline" className={`${cfg.badge} w-fit`}>{cfg.label}</Badge>
              <span className="text-xs capitalize text-muted-foreground">Criticality: {equipment.criticality}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Remaining Useful Life</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <span className="font-mono text-3xl font-semibold">{equipment.rulDays !== null ? `~${equipment.rulDays}d` : "-"}</span>
              <span className="text-xs text-muted-foreground">trend-based estimate</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Maintenance</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <span className="font-mono text-sm">Last: {equipment.lastMaintenance || "-"}</span>
              <span className="font-mono text-sm">Next: {equipment.nextScheduled || "-"}</span>
            </CardContent>
          </Card>
          {risk && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Risk Assessment</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-muted-foreground" />
                  <Badge variant="outline" className={riskBadge[risk.level] ?? riskBadge.low}>
                    {risk.level.toUpperCase()}
                  </Badge>
                  <span className="font-mono text-sm font-semibold">{risk.score}/100</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                  {risk.drivers.join(" — ")}
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {alerts.length > 0 && (
          <section aria-label="Active alerts">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Active alerts</h2>
            <div className="flex flex-col gap-2">
              {alerts.map((alert, alertIdx) => (
                <div key={`${alert.id}-${alertIdx}`} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                  <AlertTriangle className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">{alert.title}</span>
                    <span className="text-xs text-muted-foreground">{alert.message}</span>
                  </div>
                  <Badge variant="outline" className={severityBadge[alert.severity] ?? severityBadge.low}>
                    {alert.severity}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {alert.value} {alert.unit}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-label="Sensor readings">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Live sensors</h2>
          {equipment.sensors.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                No sensor readings uploaded for this asset.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {equipment.sensors.map((sensor) => (
                <Card key={sensor.id}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-sm">{sensor.name}</CardTitle>
                      <CardDescription className="font-mono text-xs">
                        nominal {sensor.nominal} {sensor.unit} - threshold {sensor.threshold} {sensor.unit}
                      </CardDescription>
                    </div>
                    <span className="font-mono text-lg font-semibold">{sensor.current}<span className="ml-1 text-xs font-normal text-muted-foreground">{sensor.unit}</span></span>
                  </CardHeader>
                  <CardContent>
                    <SensorChart sensor={sensor} height={160} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Maintenance History</CardTitle>
              <CardDescription>Uploaded records for this asset</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="pr-6 text-right">Downtime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment.history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        No maintenance logs uploaded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    equipment.history.map((record, idx) => (
                      <TableRow key={`${record.id}-${idx}`}>
                        <TableCell className="pl-6 font-mono text-sm">{record.date}</TableCell>
                        <TableCell>{record.type}</TableCell>
                        <TableCell className="text-sm text-pretty">{record.description}</TableCell>
                        <TableCell className="pr-6 text-right font-mono text-sm">{record.downtimeHours}h</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            {spares.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Spare Parts</CardTitle>
                  <CardDescription>Linked inventory for this asset</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {spares.map((sp) => {
                      const available = sp.inStock >= sp.required
                      return (
                        <li key={sp.code} className="flex items-center gap-3 rounded-md border px-3 py-2">
                          <Package className="size-4 shrink-0 text-muted-foreground" />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="text-sm font-medium">{sp.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {sp.code} · need {sp.required} · in stock {sp.inStock} · lead {sp.leadTimeDays}d
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              available
                                ? "bg-success/10 text-success border-success/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            }
                          >
                            {available ? "In stock" : "Low stock"}
                          </Badge>
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Related Documents</CardTitle>
                <CardDescription>Linked by asset ID or name during ingestion</CardDescription>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No linked documents yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {documents.map((doc, docIdx) => (
                      <li key={`${doc.id}-${docIdx}`} className="rounded-md border px-3 py-2">
                        <span className="text-sm font-medium">{doc.title}</span>
                        <div className="font-mono text-xs text-muted-foreground">{doc.type} - {doc.pages} pages</div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
