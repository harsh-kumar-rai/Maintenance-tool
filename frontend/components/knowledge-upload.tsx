"use client"

import { useRef, useState } from "react"
import { Check, FileUp, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { backendUrl } from "@/lib/api-client"
import type { IngestionRecord, InputSummary } from "@/lib/domain-types"

export function KnowledgeUpload({
  onUploaded,
}: {
  onUploaded: (summary: InputSummary, results: IngestionRecord[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<IngestionRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError(null)

    const form = new FormData()
    Array.from(files).forEach((file) => form.append("files", file))

    try {
      const res = await fetch(backendUrl("/api/ingest"), {
        method: "POST",
        body: form,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Upload failed (${res.status})`)
      }
      const data = (await res.json()) as {
        results: IngestionRecord[]
        summary: InputSummary
      }
      setResults(data.results)
      onUploaded(data.summary, data.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="sm">
            <Upload />
            Upload data
          </Button>
        }
      />
      <SheetContent side="right" className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Upload plant data</SheetTitle>
          <SheetDescription>
            Upload CSV files for equipment, sensors, maintenance logs and
            spares, plus PDF/DOCX/TXT manuals, SOPs and failure reports.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 p-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.pdf,.docx,.txt,.md"
            className="sr-only"
            onChange={(event) => uploadFiles(event.target.files)}
            aria-label="Choose real data files"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/40 p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent disabled:pointer-events-none disabled:opacity-60"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              {busy ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6" />}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {busy ? "Indexing files..." : "Choose files to upload"}
              </span>
              <span className="text-xs text-muted-foreground">
                CSV, PDF, DOCX, TXT or Markdown
              </span>
            </div>
          </button>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {results.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Last ingestion
              </span>
              {results.map((result) => (
                <div key={result.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-success" />
                    <span className="text-sm font-medium">{result.fileName}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {result.kind} - {result.status} - {result.message}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
