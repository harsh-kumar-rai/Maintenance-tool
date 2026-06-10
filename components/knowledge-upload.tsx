"use client"

import { useEffect, useRef, useState } from "react"
import { Check, FileUp, Loader2, Sparkles, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Progress } from "@/components/ui/progress"
import type { KnowledgeDoc } from "@/lib/demo-data"
import { cn } from "@/lib/utils"

const stages = [
  { label: "Uploading document", detail: "Transferring file to the knowledge store" },
  { label: "Parsing & chunking", detail: "Extracting text and splitting into retrievable sections" },
  { label: "Generating embeddings", detail: "Encoding chunks into the vector index" },
  { label: "Indexed & searchable", detail: "Document is now available to the AI agent" },
] as const

const STAGE_MS = 1100

export function KnowledgeUpload({
  onIndexed,
}: {
  onIndexed: (doc: KnowledgeDoc) => void
}) {
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [stage, setStage] = useState(-1) // -1 = not started
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function reset() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setFileName(null)
    setStage(-1)
  }

  function startPipeline(name: string) {
    setFileName(name)
    setStage(0)
    const advance = (next: number) => {
      timerRef.current = setTimeout(() => {
        setStage(next)
        if (next < stages.length - 1) {
          advance(next + 1)
        } else {
          const title = name.replace(/\.(pdf|docx?|txt)$/i, "")
          onIndexed({
            id: `DOC-${String(Math.floor(Math.random() * 900) + 100)}`,
            title,
            type: "Manual",
            equipmentIds: [],
            pages: Math.floor(Math.random() * 60) + 8,
            updated: "2026-06-10",
            summary:
              "Newly uploaded document. Parsed, chunked and embedded into the vector index — its sections are now retrievable by the AI Investigation agent.",
            sections: [
              {
                ref: "§1",
                heading: "Document indexed",
                excerpt: `${title} was processed into searchable chunks. Ask the AI agent about related equipment and it can cite this document.`,
              },
            ],
          })
        }
      }, STAGE_MS)
    }
    advance(1)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) startPipeline(file.name)
    e.target.value = ""
  }

  const done = stage === stages.length - 1
  const progress = stage < 0 ? 0 : ((stage + 1) / stages.length) * 100

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <SheetTrigger
        render={
          <Button size="sm">
            <Upload />
            Upload document
          </Button>
        }
      />
      <SheetContent side="right" className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Upload to knowledge base</SheetTitle>
          <SheetDescription>
            New documents are parsed, chunked and embedded so the AI agent can
            cite them in investigations.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 p-4">
          {stage < 0 ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="sr-only"
                onChange={handleFile}
                aria-label="Choose a document to upload"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/40 p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent"
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileUp className="size-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    Choose a file to upload
                  </span>
                  <span className="text-xs text-muted-foreground">
                    PDF, Word or text — manuals, SOPs, failure reports
                  </span>
                </div>
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  startPipeline("Ladle Crane Brake System Maintenance Manual.pdf")
                }
              >
                <Sparkles />
                Use a sample document
              </Button>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileUp className="size-4" />
                </div>
                <span className="min-w-0 truncate text-sm font-medium">
                  {fileName}
                </span>
              </div>
              <Progress value={progress} aria-label="Indexing progress" />
              <div className="flex flex-col gap-3">
                {stages.map((s, i) => {
                  const isDone = i < stage || done
                  const isActive = i === stage && !done
                  return (
                    <div
                      key={s.label}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                        isActive && "border-primary/40 bg-primary/5",
                        isDone && "border-success/30 bg-success/5",
                        !isActive && !isDone && "opacity-50",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5",
                          isDone
                            ? "bg-success text-success-foreground"
                            : isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isDone ? (
                          <Check />
                        ) : isActive ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <span className="text-xs">{i + 1}</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{s.label}</span>
                        <span className="text-xs text-muted-foreground text-pretty">
                          {s.detail}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {done && (
                <Button onClick={() => setOpen(false)}>
                  <Check />
                  Done — view in knowledge base
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
