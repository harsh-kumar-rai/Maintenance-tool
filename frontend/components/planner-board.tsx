"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Check,
  ChevronDown,
  Circle,
  Clock,
  Package,
  Sparkles,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-client"
import type { MaintenancePlan, PlanStatus, Priority } from "@/lib/domain-types"

const priorityConfig: Record<Priority, { label: string; badge: string }> = {
  low: { label: "Low", badge: "bg-muted text-muted-foreground border-border" },
  medium: { label: "Medium", badge: "bg-primary/10 text-primary border-primary/20" },
  high: { label: "High", badge: "bg-warning/10 text-warning border-warning/20" },
  critical: { label: "Critical", badge: "bg-destructive/10 text-destructive border-destructive/20" },
}

const statusLabel: Record<PlanStatus, string> = {
  planned: "Planned",
  "in-progress": "In Progress",
  completed: "Completed",
}

const statusBadge: Record<PlanStatus, string> = {
  planned: "bg-primary/10 text-primary border-primary/20",
  "in-progress": "bg-warning/10 text-warning border-warning/20",
  completed: "bg-success/10 text-success border-success/20",
}

function PlanCard({
  plan,
  onToggleStep,
  onAdvance,
}: {
  plan: MaintenancePlan
  onToggleStep: (planId: string, stepId: string) => void
  onAdvance: (planId: string) => void
}) {
  const [open, setOpen] = useState(plan.priority === "critical")
  const pCfg = priorityConfig[plan.priority]
  const doneSteps = plan.steps.filter((s) => s.done).length

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base leading-snug text-pretty">
                  {plan.title}
                </CardTitle>
                {plan.source === "AI Investigation" ? (
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/20"
                  >
                    <Sparkles data-icon="inline-start" />
                    AI Intelligence
                  </Badge>
                ) : null}
              </div>
              <CardDescription className="font-mono text-xs">
                {plan.id} ·{" "}
                <Link
                  href={`/equipment/${plan.equipmentId}`}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {plan.equipmentName}
                </Link>{" "}
                · due {plan.dueDate} · est. {plan.estimatedDowntimeHours}h
                downtime
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={pCfg.badge}>
                {pCfg.label}
              </Badge>
              <Badge variant="outline" className={statusBadge[plan.status]}>
                {statusLabel[plan.status]}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">
                risk {plan.riskScore}
              </span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {plan.summary}
          </p>
          <CollapsibleTrigger
            render={<Button variant="ghost" size="sm" className="w-fit" />}
          >
            <ChevronDown
              data-icon="inline-start"
              className={cn("transition-transform", open && "rotate-180")}
            />
            {open ? "Hide" : "Show"} procedure ({doneSteps}/
            {plan.steps.length} steps)
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-4">
            <Separator />
            <div className="flex flex-col gap-1">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Procedure
              </h3>
              <ol className="flex flex-col gap-1">
                {plan.steps.map((step, i) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => onToggleStep(plan.id, step.id)}
                      disabled={plan.status === "completed"}
                      className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent disabled:pointer-events-none"
                    >
                      {step.done ? (
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                          <Check className="size-3" />
                        </span>
                      ) : (
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] text-muted-foreground">
                          {i + 1}
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-sm leading-relaxed text-pretty",
                          step.done && "text-muted-foreground line-through",
                        )}
                      >
                        {step.text}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>

            {plan.spares.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Required spares
                </h3>
                <ul className="flex flex-col gap-2">
                  {plan.spares.map((sp) => {
                    const available = sp.inStock >= sp.required
                    return (
                      <li
                        key={sp.code}
                        className="flex items-center gap-3 rounded-md border px-3 py-2"
                      >
                        <Package className="size-4 shrink-0 text-muted-foreground" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm font-medium">{sp.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {sp.code} · need {sp.required} · lead time{" "}
                            {sp.leadTimeDays}d
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
                          {available
                            ? `In stock (${sp.inStock})`
                            : "Procurement needed"}
                        </Badge>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

            {plan.status !== "completed" ? (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => onAdvance(plan.id)}>
                  {plan.status === "planned" ? (
                    <>
                      <Clock data-icon="inline-start" />
                      Start work
                    </>
                  ) : (
                    <>
                      <Check data-icon="inline-start" />
                      Mark completed
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

export function PlannerBoard() {
  const [plans, setPlans] = useState<MaintenancePlan[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadPlans() {
      try {
        const data = await apiFetch<{ plans: MaintenancePlan[] }>("/api/plans")
        if (!cancelled) setPlans(data.plans)
      } catch {
        if (!cancelled) setPlans([])
      }
    }
    void loadPlans()
    return () => {
      cancelled = true
    }
  }, [])

  const toggleStep = (planId: string, stepId: string) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              steps: p.steps.map((s) =>
                s.id === stepId ? { ...s, done: !s.done } : s,
              ),
            }
          : p,
      ),
    )
    void apiFetch<{ plan: MaintenancePlan }>(`/api/plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId }),
    })
  }

  const advance = (planId: string) => {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p
        if (p.status === "planned") return { ...p, status: "in-progress" }
        return {
          ...p,
          status: "completed",
          steps: p.steps.map((s) => ({ ...s, done: true })),
        }
      }),
    )
    const current = plans.find((p) => p.id === planId)
    const status = current?.status === "planned" ? "in-progress" : "completed"
    void apiFetch<{ plan: MaintenancePlan }>(`/api/plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
      .then((data) => {
        if (!data.plan) return
        setPlans((prev) =>
          prev.map((plan) => (plan.id === data.plan.id ? data.plan : plan)),
        )
      })
      .catch(() => undefined)
  }

  const open = plans
    .filter((p) => p.status !== "completed")
    .sort((a, b) => b.riskScore - a.riskScore)
  const completed = plans.filter((p) => p.status === "completed")

  return (
    <Tabs defaultValue="open" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="open">
            <Circle className="size-3" />
            Open ({open.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            <Check className="size-3" />
            Completed ({completed.length})
          </TabsTrigger>
        </TabsList>
        <p className="hidden font-mono text-xs text-muted-foreground sm:block">
          sorted by risk score
        </p>
      </div>
      <TabsContent value="open" className="flex flex-col gap-4">
        {open.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            No maintenance plans yet. Run an AI investigation from uploaded real data to create one.
          </div>
        ) : null}
        {open.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onToggleStep={toggleStep}
            onAdvance={advance}
          />
        ))}
      </TabsContent>
      <TabsContent value="completed" className="flex flex-col gap-4">
        {completed.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onToggleStep={toggleStep}
            onAdvance={advance}
          />
        ))}
      </TabsContent>
    </Tabs>
  )
}
