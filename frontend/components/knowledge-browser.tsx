"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  ClipboardList,
  Database,
  FileWarning,
  Megaphone,
  RefreshCw,
  Search,
  Trash2,
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
import { KnowledgeUpload } from "@/components/knowledge-upload"
import { apiFetch } from "@/lib/api-client"
import type { IngestionRecord, InputSummary, KnowledgeDoc } from "@/lib/domain-types"
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
  "Operational Log": {
    icon: ClipboardList,
    badge: "bg-muted text-muted-foreground border-border",
  },
  "Uploaded Document": {
    icon: BookOpen,
    badge: "bg-primary/10 text-primary border-primary/20",
  },
}

const docTypes = ["All", "Manual", "SOP", "Failure Report", "Operational Log"] as const

export function KnowledgeBrowser() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [summary, setSummary] = useState<InputSummary | null>(null)
  const [actionBusy, setActionBusy] = useState<"delete-doc" | "clear-docs" | "reset-all" | null>(null)
  const [query, setQuery] = useState("")
  const [type, setType] = useState<(typeof docTypes)[number]>("All")
  const [selectedId, setSelectedId] = useState<string>("")

  async function loadKnowledge() {
    const [docsData, summaryData] = await Promise.all([
      apiFetch<{ documents: KnowledgeDoc[] }>("/api/documents"),
      apiFetch<InputSummary>("/api/inputs"),
    ])
    setDocs(docsData.documents)
    setSummary(summaryData)
    setSelectedId((current) =>
      docsData.documents.some((doc) => doc.id === current)
        ? current
        : docsData.documents[0]?.id || "",
    )
  }

  useEffect(() => {
    void loadKnowledge().catch(() => {
      setDocs([])
      setSummary(null)
    })
  }, [])

  function handleUploaded(nextSummary: InputSummary, _results: IngestionRecord[]) {
    setSummary(nextSummary)
    void loadKnowledge()
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return docs.filter((d) => {
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
  }, [docs, query, type])

  const selected =
    filtered.find((d) => d.id === selectedId) ?? filtered[0] ?? null

  async function deleteSelectedDocument() {
    if (!selected) return
    const confirmed = window.confirm(`Delete indexed document "${selected.title}"?`)
    if (!confirmed) return
    setActionBusy("delete-doc")
    try {
      await apiFetch(`/api/documents/${selected.id}`, { method: "DELETE" })
      await loadKnowledge()
    } finally {
      setActionBusy(null)
    }
  }

  async function clearIndexedDocuments() {
    const confirmed = window.confirm(
      "Clear all indexed documents? Equipment, sensors, spares, plans and logbook entries will remain.",
    )
    if (!confirmed) return
    setActionBusy("clear-docs")
    try {
      await apiFetch("/api/documents", { method: "DELETE" })
      await loadKnowledge()
    } finally {
      setActionBusy(null)
    }
  }

  async function resetIndexedData() {
    const confirmed = window.confirm(
      "Reset all indexed plant data, plans, reports, feedback and logbook entries? Use this before loading a fresh final dataset.",
    )
    if (!confirmed) return
    setActionBusy("reset-all")
    try {
      const data = await apiFetch<{ summary: InputSummary }>("/api/data", {
        method: "DELETE",
      })
      setDocs([])
      setSummary(data.summary)
      setSelectedId("")
    } finally {
      setActionBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Control panel: search, filters, and actions on the same line */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <InputGroup className="w-64">
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
            variant="outline"
            value={[type]}
            onValueChange={(v) => {
              const next = v[0]
              if (next) setType(next as (typeof docTypes)[number])
            }}
            className="flex-wrap"
          >
            {docTypes.map((t) => (
              <ToggleGroupItem key={t} value={t} className="text-xs">
                {t}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <KnowledgeUpload onUploaded={handleUploaded} />
          <Button
            variant="outline"
            size="sm"
            disabled={!selected || actionBusy !== null}
            onClick={deleteSelectedDocument}
          >
            <Trash2 />
            Delete selected
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={docs.length === 0 || actionBusy !== null}
            onClick={clearIndexedDocuments}
          >
            <Trash2 />
            Clear docs
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={actionBusy !== null}
            onClick={resetIndexedData}
          >
            {actionBusy === "reset-all" ? <RefreshCw className="animate-spin" /> : <Database />}
            Reset data
          </Button>
        </div>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {[
            ["Assets", summary.equipment],
            ["Sensors", summary.sensors],
            ["Docs", summary.documents],
            ["Spares", summary.spares],
            ["Logs", summary.maintenanceLogs],
            ["Ops", summary.operationalRecords],
          ].map(([label, value]) => (
            <Card key={label} className="py-3">
              <CardContent className="px-3">
                <div className="font-mono text-xl font-semibold">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>No documents found</EmptyTitle>
            <EmptyDescription>
              Upload real manuals, SOPs, failure reports, PDFs, DOCX, TXT or
              CSV files to populate the knowledge base.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="flex flex-col gap-2">
            {filtered.map((doc, docIdx) => {
              const Icon = typeConfig[doc.type].icon
              const active = selected?.id === doc.id
              return (
                <button
                  key={`${doc.id}-${docIdx}`}
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
                        {doc.id} - {doc.pages} pages
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
                    {selected.id} - Updated {selected.updated}
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
                  {selected.equipmentIds.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      None yet - link equipment to improve retrieval
                    </span>
                  )}
                  {selected.equipmentIds.map((id, eqIdx) => (
                    <Button
                      key={`${id}-${eqIdx}`}
                      render={<Link href={`/equipment/${id}`} />}
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                      className="h-7 font-mono text-xs"
                    >
                      {id}
                    </Button>
                  ))}
                </div>
                <Separator />
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Indexed sections (retrievable by the AI agent)
                  </span>
                  {selected.sections.map((s, sIdx) => (
                    <div
                      key={`${s.ref}-${sIdx}`}
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
                  <Search className="size-4 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground text-pretty">
                    AI Investigation retrieves these chunks by equipment link,
                    section text and maintenance keywords. Clear links and concise
                    sections produce stronger citations.
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
