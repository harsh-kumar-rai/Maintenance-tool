import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Sparkles } from "lucide-react"
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
import {
  documents,
  getEquipment,
  equipment,
  statusConfig,
} from "@/lib/demo-data"

export function generateStaticParams() {
  return equipment.map((e) => ({ id: e.id }))
}

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const eq = getEquipment(id)
  if (!eq) notFound()

  const cfg = statusConfig[eq.status]
  const relatedDocs = documents.filter((d) => d.equipmentIds.includes(eq.id))

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader title={eq.name} description={`${eq.id} · ${eq.type} · ${eq.area}`}>
        <div className="flex items-center gap-2">
          <Button
            render={<Link href="/equipment" />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <ArrowLeft data-icon="inline-start" />
            <span className="hidden sm:inline">All equipment</span>
          </Button>
          <Button
            render={<Link href={`/investigation?equipment=${eq.id}`} />}
            nativeButton={false}
            size="sm"
          >
            <Sparkles data-icon="inline-start" />
            Investigate with AI
          </Button>
        </div>
      </PageHeader>

      <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {/* Summary strip */}
        <section
          aria-label="Equipment summary"
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Health Score
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <span className="font-mono text-3xl font-semibold">
                {eq.healthScore}%
              </span>
              <Progress value={eq.healthScore} className="h-1.5" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Badge variant="outline" className={`${cfg.badge} w-fit`}>
                {cfg.label}
              </Badge>
              <span className="text-xs capitalize text-muted-foreground">
                Criticality: {eq.criticality}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Remaining Useful Life
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <span className="font-mono text-3xl font-semibold">
                {eq.rulDays !== null ? `~${eq.rulDays}d` : "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                {eq.rulDays !== null
                  ? "trend-based estimate"
                  : "no degradation detected"}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Maintenance
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <span className="font-mono text-sm">
                Last: {eq.lastMaintenance}
              </span>
              <span className="font-mono text-sm">
                Next: {eq.nextScheduled}
              </span>
            </CardContent>
          </Card>
        </section>

        {/* Sensors */}
        <section aria-label="Sensor readings">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Live sensors
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {eq.sensors.map((sensor) => (
              <Card key={sensor.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-sm">{sensor.name}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      nominal {sensor.nominal} {sensor.unit} · threshold{" "}
                      {sensor.threshold} {sensor.unit}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-lg font-semibold">
                      {sensor.current}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        {sensor.unit}
                      </span>
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        sensor.trend === "stable"
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-warning/10 text-warning border-warning/20"
                      }
                    >
                      {sensor.trend}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <SensorChart sensor={sensor} height={160} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Maintenance history */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Maintenance History</CardTitle>
              <CardDescription>
                Recorded interventions for this asset
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Technician
                    </TableHead>
                    <TableHead className="pr-6 text-right">Downtime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eq.history.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="pl-6 font-mono text-sm">
                        {rec.date}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            rec.type === "Breakdown"
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : rec.type === "Corrective"
                                ? "bg-warning/10 text-warning border-warning/20"
                                : "bg-muted text-muted-foreground"
                          }
                        >
                          {rec.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-72 text-sm text-pretty">
                        {rec.description}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {rec.technician}
                      </TableCell>
                      <TableCell className="pr-6 text-right font-mono text-sm">
                        {rec.downtimeHours}h
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Related docs + asset info */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Related Documents</CardTitle>
                <CardDescription>From the knowledge base</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {relatedDocs.map((doc) => (
                    <li key={doc.id}>
                      <Link
                        href={`/knowledge?doc=${doc.id}`}
                        className="flex flex-col gap-0.5 rounded-md border px-3 py-2 transition-colors hover:bg-accent"
                      >
                        <span className="text-sm font-medium leading-snug text-pretty">
                          {doc.title}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {doc.type} · {doc.pages} pages · updated {doc.updated}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {relatedDocs.length === 0 ? (
                    <li className="text-sm text-muted-foreground">
                      No linked documents.
                    </li>
                  ) : null}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Asset Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Manufacturer</dt>
                    <dd className="font-medium">{eq.manufacturer}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Installed</dt>
                    <dd className="font-mono">{eq.installedYear}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Type</dt>
                    <dd className="font-medium">{eq.type}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Plant area</dt>
                    <dd className="font-medium">{eq.area}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
