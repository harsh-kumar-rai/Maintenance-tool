"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  ClipboardList,
  FileWarning,
  Megaphone,
  Search,
  Sparkles,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Separator } from "@/components/ui/separator"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { documents, getEquipment, type KnowledgeDoc } from "@/lib/demo-data"
import { cn } from "@/lib/utils"

const typeConfig: Record<
  KnowledgeDoc["type"],
  { icon: typeof BookOpen; badge: string }
> = {
  Manual: { icon: BookOpen, badge: "bg-primary/10 text-primary border-primary/20" },
  SOP: { icon: ClipboardList, badge: "bg-success/10 text-success border-success/20" },
  "Failure Report": {
    icon: FileWarning,
    badge: "bg-destructive/10 text-destructive border-destructive/20",
  },
  "OEM Bulletin": {
    icon: Megaphone,
    badge: "bg-warning/10 text-warning border-warning/20",
  },
}

const docTypes = ["All", "Manual", "SOP", "Failure Report", "OEM Bulletin"] as const

export function KnowledgeBrowser() {
  const [query, setQuery] = useState("")
  const [type, setType] = useState<(typeof docTypes)[number]>("All")
  const [selectedId, setSelectedId] = useState<string>(documents[0].id)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return documents.filter((d) => {
      if (type !== "All" && d.type !== type) return false
      if (!q) return true
      return (
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.sections.some(
          (s) =>
            s.heading.toLowerCase().includes(q) ||
            s.excerpt.toLowerCase().includes(q),
        )
      )
    })
  }, [query, type])

  const selected =
    filtered.find((d) => d.id === selectedId) ?? filtered[0] ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <InputGroup className="md:max-w-sm">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search manuals, SOPs, failure reports..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search knowledge base"
          />
        </InputGroup>
        <ToggleGroup
          type="single"
          variant="outline"
          value={type}
          onValueChange={(v) => v && setType(v as (typeof docTypes)[number])}
          className="flex-wrap"
        >
          {docTypes.map((t) => (
            <ToggleGroupItem key={t} value={t} className="text-xs">
              {t}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>No documents found</EmptyTitle>
            <EmptyDescription>
              No documents match &quot;{query}&quot;. Try a different search term or
              clear the type filter.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="flex flex-col gap-2">
            {filtered.map((doc) => {
              const Icon = typeConfig[doc.type].icon
              const active = selected?.id === doc.id
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedId(doc.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors",
                    active
                      ? "border-primary ring-1 ring-primary"
                      : "hover:bg-accent",
                  )}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
                    <Icon />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-medium leading-snug text-pretty">
                      {doc.title}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={typeConfig[doc.type].badge}>
                        {doc.type}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        {doc.id} · {doc.pages} pages
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {selected && (
            <Card className="h-fit">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={typeConfig[selected.type].badge}>
                    {selected.type}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {selected.id} · Updated {selected.updated}
                  </span>
                </div>
                <CardTitle className="text-pretty">{selected.title}</CardTitle>
                <CardDescription className="text-pretty">
                  {selected.summary}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Linked equipment:
                  </span>
                  {selected.equipmentIds.map((id) => {
                    const eq = getEquipment(id)
                    return (
                      <Button
                        key={id}
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-7 font-mono text-xs"
                      >
                        <Link href={`/equipment/${id}`}>{eq?.name ?? id}</Link>
                      </Button>
                    )
                  })}
                </div>
                <Separator />
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Indexed sections (retrievable by the AI agent)
                  </span>
                  {selected.sections.map((s) => (
                    <div
                      key={s.ref}
                      className="rounded-lg border bg-muted/40 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-primary">
                          {s.ref}
                        </span>
                        <span className="text-sm font-medium">{s.heading}</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                        {s.excerpt}
                      </p>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <Sparkles className="size-4 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground text-pretty">
                    These sections are embedded into the vector index. Ask the AI
                    Investigation agent about this equipment and it will cite them.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
