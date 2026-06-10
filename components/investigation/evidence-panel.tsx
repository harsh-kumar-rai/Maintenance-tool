"use client"

import { FileText, History, ShieldAlert, Wrench, LineChart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SensorChart } from "@/components/sensor-chart"
import { getEquipment, type EvidenceCard } from "@/lib/demo-data"

const kindConfig = {
  tool: { icon: Wrench, label: "Action", cls: "bg-primary/10 text-primary border-primary/20" },
  document: { icon: FileText, label: "Cited document", cls: "bg-primary/10 text-primary border-primary/20" },
  history: { icon: History, label: "Historical match", cls: "bg-warning/10 text-warning border-warning/20" },
  chart: { icon: LineChart, label: "Sensor data", cls: "bg-primary/10 text-primary border-primary/20" },
  risk: { icon: ShieldAlert, label: "Risk assessment", cls: "bg-destructive/10 text-destructive border-destructive/20" },
} as const

function EvidenceBody({ card }: { card: EvidenceCard }) {
  if (card.kind === "chart" && card.body.startsWith("chart:")) {
    const [, eqId, sensorId] = card.body.split(":")
    const sensor = getEquipment(eqId)?.sensors.find((s) => s.id === sensorId)
    if (sensor) {
      return <SensorChart sensor={sensor} height={140} />
    }
  }
  return (
    <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
      {card.kind === "document" || card.kind === "history" ? (
        <>
          <span aria-hidden="true">{'"'}</span>
          {card.body}
          <span aria-hidden="true">{'"'}</span>
        </>
      ) : (
        card.body
      )}
    </p>
  )
}

export function EvidencePanel({ cards }: { cards: EvidenceCard[] }) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Evidence trail
        </h2>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Evidence gathered by the agent will appear here as the
            investigation progresses — cited manual sections, sensor data,
            historical failures and risk assessments.
          </p>
        ) : null}
        {cards.map((card, i) => {
          const cfg = kindConfig[card.kind]
          return (
            <Card key={i} className="gap-3 py-4">
              <CardHeader className="px-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={cfg.cls}>
                    <cfg.icon data-icon="inline-start" />
                    {cfg.label}
                  </Badge>
                  {card.ref ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {card.ref}
                    </span>
                  ) : null}
                </div>
                <CardTitle className="text-sm leading-snug text-pretty">
                  {card.title}
                </CardTitle>
                {card.subtitle ? (
                  <CardDescription className="font-mono text-xs">
                    {card.subtitle}
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="px-4">
                <EvidenceBody card={card} />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </ScrollArea>
  )
}
