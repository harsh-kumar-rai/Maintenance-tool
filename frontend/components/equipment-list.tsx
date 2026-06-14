"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiFetch } from "@/lib/api-client"
import type { Equipment, HealthStatus } from "@/lib/domain-types"

const statusConfig: Record<HealthStatus, { label: string; badge: string }> = {
  healthy: { label: "Healthy", badge: "bg-success/10 text-success border-success/20" },
  watch: { label: "Watch", badge: "bg-warning/10 text-warning border-warning/20" },
  degraded: { label: "Degraded", badge: "bg-destructive/10 text-destructive border-destructive/20" },
  critical: { label: "Critical", badge: "bg-destructive text-destructive-foreground border-destructive" },
}

const statuses: ("all" | HealthStatus)[] = ["all", "healthy", "watch", "degraded", "critical"]

export function EquipmentList() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [query, setQuery] = useState("")
  const [area, setArea] = useState("All areas")
  const [status, setStatus] = useState<"all" | HealthStatus>("all")

  useEffect(() => {
    let cancelled = false
    async function loadEquipment() {
      try {
        const data = await apiFetch<{ equipment: Equipment[] }>("/api/equipment")
        if (!cancelled) setEquipment(data.equipment)
      } catch {
        if (!cancelled) setEquipment([])
      }
    }
    void loadEquipment()
    return () => {
      cancelled = true
    }
  }, [])

  const areas = useMemo(
    () => ["All areas", ...Array.from(new Set(equipment.map((e) => e.area)))],
    [equipment],
  )

  const filtered = useMemo(() => {
    return equipment.filter((eq) => {
      if (area !== "All areas" && eq.area !== area) return false
      if (status !== "all" && eq.status !== status) return false
      if (
        query &&
        !`${eq.name} ${eq.id} ${eq.type}`.toLowerCase().includes(query.toLowerCase())
      )
        return false
      return true
    })
  }, [equipment, query, area, status])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID or type..."
            className="pl-8"
            aria-label="Search equipment"
          />
        </div>
        <Select value={area} onValueChange={(v) => v && setArea(v)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by area">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {areas.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as "all" | HealthStatus)}
        >
          <SelectTrigger
            className="w-full sm:w-40"
            aria-label="Filter by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All statuses" : statusConfig[s].label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Asset</TableHead>
                <TableHead className="hidden md:table-cell">Area</TableHead>
                <TableHead>Health</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Criticality
                </TableHead>
                <TableHead className="hidden lg:table-cell">RUL</TableHead>
                <TableHead className="hidden xl:table-cell pr-6">
                  Next Scheduled
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((eq) => {
                const cfg = statusConfig[eq.status]
                return (
                  <TableRow key={eq.id} className="group">
                    <TableCell className="pl-6">
                      <Link
                        href={`/equipment/${eq.id}`}
                        className="flex flex-col gap-0.5"
                      >
                        <span className="font-medium group-hover:underline">
                          {eq.name}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {eq.id} - {eq.type}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {eq.area}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={eq.healthScore}
                          className="h-1.5 w-16"
                        />
                        <span className="font-mono text-sm">
                          {eq.healthScore}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className={cfg.badge}>
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden capitalize lg:table-cell">
                      {eq.criticality}
                    </TableCell>
                    <TableCell className="hidden font-mono text-sm lg:table-cell">
                      {eq.rulDays !== null ? `~${eq.rulDays}d` : "N/A"}
                    </TableCell>
                    <TableCell className="hidden pr-6 font-mono text-sm text-muted-foreground xl:table-cell">
                      {eq.nextScheduled}
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No real equipment records found. Upload an equipment CSV in
                    the Knowledge Base page.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
