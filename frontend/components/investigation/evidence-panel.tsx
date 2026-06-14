"use client"

import { FileText, History, LineChart, Search, ShieldAlert, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SensorChart } from "@/components/sensor-chart"
import type { EvidenceCard } from "@/lib/domain-types"

const kindConfig = {
  tool: {
    icon: Search,
    label: "Root Cause Analysis",
    cls: "bg-primary/10 text-primary border-primary/20",
    category: "Analysis",
    order: 0,
  },
  document: {
    icon: FileText,
    label: "Cited document",
    cls: "bg-primary/10 text-primary border-primary/20",
    category: "Documents",
    order: 2,
  },
  history: {
    icon: History,
    label: "Historical match",
    cls: "bg-warning/10 text-warning border-warning/20",
    category: "History",
    order: 3,
  },
  chart: {
    icon: LineChart,
    label: "Sensor trend",
    cls: "bg-primary/10 text-primary border-primary/20",
    category: "Sensors",
    order: 1,
  },
  risk: {
    icon: ShieldAlert,
    label: "Risk position",
    cls: "bg-destructive/10 text-destructive border-destructive/20",
    category: "Risk",
    order: 4,
  },
} as const

function EvidenceBody({ card }: { card: EvidenceCard }) {
  if (card.kind === "chart" && card.sensor) {
    return <SensorChart sensor={card.sensor} height={140} />
  }

  // Root cause analysis card with confidence bar
  if (card.kind === "tool" && card.title.includes("Root Cause Analysis")) {
    const match = card.title.match(/(\d+)%/)
    const confidence = match ? Number.parseInt(match[1], 10) : 0

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <Progress value={confidence} className="h-1.5 flex-1" />
          <span className="font-mono text-xs font-semibold">{confidence}%</span>
        </div>
        {card.subtitle && (
          <Badge variant="outline" className="w-fit bg-warning/10 text-warning border-warning/20">
            {card.subtitle}
          </Badge>
        )}
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          {card.body}
        </p>
      </div>
    )
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
  // Group cards by category
  const grouped = cards.reduce<
    Record<string, { label: string; order: number; cards: EvidenceCard[] }>
  >((acc, card) => {
    const cfg = kindConfig[card.kind]
    const key = cfg.category
    if (!acc[key]) acc[key] = { label: key, order: cfg.order, cards: [] }
    acc[key].cards.push(card)
    return acc
  }, {})

  const categories = Object.values(grouped).sort((a, b) => a.order - b.order)

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Evidence trail
          </h2>
          {cards.length > 0 && (
            <div className="flex gap-1">
              {categories.map((cat) => (
                <Badge
                  key={cat.label}
                  variant="outline"
                  className="text-[10px]"
                >
                  {cat.label} {cat.cards.length}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Unique supporting evidence appears here: sensor trends, risk
            drivers, cited documents, maintenance history, and generated work
            artifacts. Repeated questions update existing cards instead of
            duplicating them.
          </p>
        ) : null}
        {categories.map((cat) => (
          <div key={cat.label} className="flex flex-col gap-2">
            {categories.length > 1 && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {cat.label}
              </span>
            )}
            {cat.cards.map((card) => {
              const cfg = kindConfig[card.kind]
              const key = `${card.kind}:${card.ref ?? card.title}:${card.subtitle ?? ""}`
              return (
                <Card key={key} className="gap-3 py-4 animate-in fade-in duration-300">
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
                    {card.subtitle && !card.title.includes("Root Cause Analysis") ? (
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
        ))}
      </div>
    </ScrollArea>
  )
}
