"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import {
  Check,
  Loader2,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  investigationScript,
  type EvidenceCard,
  type ScriptTurn,
} from "@/lib/demo-data"
import { EvidencePanel } from "./evidence-panel"

interface ToolStepState {
  label: string
  detail: string
  status: "running" | "done"
}

interface MessageState {
  role: "user" | "assistant"
  content: string
  streaming: boolean
  toolSteps: ToolStepState[]
  feedback?: "up" | "down"
}

const SUGGESTED =
  "Stand 3 of the hot rolling mill is showing high vibration on the drive-side work roll. What's going on and what should we do?"

export function InvestigationView() {
  const [messages, setMessages] = useState<MessageState[]>([])
  const [evidence, setEvidence] = useState<EvidenceCard[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const turnIndex = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [])

  useEffect(scrollToBottom, [messages, scrollToBottom])

  const playAssistantTurn = useCallback(
    async (turn: ScriptTurn) => {
      setBusy(true)

      // Show tool steps one at a time
      const steps = turn.toolSteps ?? []
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", streaming: true, toolSteps: [] },
      ])

      for (let i = 0; i < steps.length; i++) {
        setMessages((prev) => {
          const next = [...prev]
          const last = { ...next[next.length - 1] }
          last.toolSteps = [
            ...last.toolSteps.map((s) => ({ ...s, status: "done" as const })),
            { ...steps[i], status: "running" as const },
          ]
          next[next.length - 1] = last
          return next
        })
        scrollToBottom()
        await new Promise((r) => setTimeout(r, 650 + Math.random() * 350))
      }

      // Mark all steps done
      setMessages((prev) => {
        const next = [...prev]
        const last = { ...next[next.length - 1] }
        last.toolSteps = last.toolSteps.map((s) => ({
          ...s,
          status: "done" as const,
        }))
        next[next.length - 1] = last
        return next
      })

      // Reveal evidence cards progressively
      const cards = turn.evidence ?? []
      for (const card of cards) {
        setEvidence((prev) => [...prev, card])
        await new Promise((r) => setTimeout(r, 400))
      }

      // Stream the answer word by word
      const words = turn.content.split(" ")
      let acc = ""
      for (let i = 0; i < words.length; i++) {
        acc += (i > 0 ? " " : "") + words[i]
        if (i % 3 === 0 || i === words.length - 1) {
          const snapshot = acc
          setMessages((prev) => {
            const next = [...prev]
            const last = { ...next[next.length - 1] }
            last.content = snapshot
            next[next.length - 1] = last
            return next
          })
          scrollToBottom()
          await new Promise((r) => setTimeout(r, 24))
        }
      }

      setMessages((prev) => {
        const next = [...prev]
        const last = { ...next[next.length - 1] }
        last.streaming = false
        next[next.length - 1] = last
        return next
      })
      setBusy(false)
    },
    [scrollToBottom],
  )

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return
      setInput("")
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, streaming: false, toolSteps: [] },
      ])

      // Find the next scripted assistant turn
      const script = investigationScript
      let idx = turnIndex.current
      // advance past the user turn in the script
      while (idx < script.length && script[idx].role !== "assistant") idx++
      const turn = script[idx]
      turnIndex.current = idx + 1

      if (turn) {
        await playAssistantTurn(turn)
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "This is a frontend demo — the live agent backend will be connected next. Try restarting the investigation to replay the scripted scenario.",
            streaming: false,
            toolSteps: [],
          },
        ])
      }
    },
    [busy, playAssistantTurn],
  )

  const setFeedback = useCallback((index: number, value: "up" | "down") => {
    setMessages((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        feedback: next[index].feedback === value ? undefined : value,
      }
      return next
    })
  }, [])

  return (
    <div className="flex min-h-0 flex-1">
      {/* Chat column */}
      <div className="flex min-w-0 flex-1 flex-col border-r">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 md:p-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold">
                    Start an investigation
                  </h2>
                  <p className="max-w-md text-sm text-muted-foreground text-pretty">
                    Describe a symptom or anomaly. The agent will analyze
                    sensor data, search manuals and historical failures, and
                    recommend prioritized actions.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="max-w-full whitespace-normal text-left h-auto py-2.5"
                  onClick={() => handleSend(SUGGESTED)}
                >
                  {SUGGESTED}
                </Button>
              </div>
            ) : null}

            {messages.map((msg, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    msg.role === "user"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-primary text-primary-foreground",
                  )}
                  aria-hidden="true"
                >
                  {msg.role === "user" ? (
                    <User className="size-4" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {msg.role === "user" ? "You" : "Maintenance Agent"}
                  </span>

                  {msg.toolSteps.length > 0 ? (
                    <div className="flex flex-col gap-1.5 rounded-md border bg-secondary/50 p-3">
                      {msg.toolSteps.map((step, si) => (
                        <div
                          key={si}
                          className="flex items-center gap-2 font-mono text-xs"
                        >
                          {step.status === "running" ? (
                            <Loader2 className="size-3.5 animate-spin text-primary" />
                          ) : (
                            <Check className="size-3.5 text-success" />
                          )}
                          <span className="font-semibold text-foreground">
                            {step.label}
                          </span>
                          <span className="truncate text-muted-foreground">
                            {step.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {msg.content ? (
                    <div className="prose-sm flex flex-col gap-2 text-sm leading-relaxed [&_strong]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.streaming && msg.toolSteps.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Analyzing...
                    </div>
                  ) : null}

                  {msg.role === "assistant" && !msg.streaming && msg.content ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Helpful recommendation"
                        onClick={() => setFeedback(i, "up")}
                        className={cn(
                          msg.feedback === "up" && "text-success bg-success/10",
                        )}
                      >
                        <ThumbsUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Unhelpful recommendation"
                        onClick={() => setFeedback(i, "down")}
                        className={cn(
                          msg.feedback === "down" &&
                            "text-destructive bg-destructive/10",
                        )}
                      >
                        <ThumbsDown />
                      </Button>
                      {msg.feedback ? (
                        <span className="text-xs text-muted-foreground">
                          Feedback recorded — used to improve future
                          recommendations
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t bg-card p-3 md:p-4">
          <form
            className="mx-auto flex max-w-3xl items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              handleSend(input)
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe a symptom, anomaly or question..."
              aria-label="Message the maintenance agent"
              disabled={busy}
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !input.trim()}
              aria-label="Send message"
            >
              {busy ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </form>
          <p className="mx-auto mt-2 flex max-w-3xl items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <Wrench className="size-3" />
            Agent tools: getSensorHistory · searchKnowledgeBase ·
            getMaintenanceHistory · checkSparesInventory · computeRiskPriority
          </p>
        </div>
      </div>

      {/* Evidence panel */}
      <aside
        className="hidden w-96 shrink-0 bg-secondary/30 lg:block"
        aria-label="Evidence trail"
      >
        <EvidencePanel cards={evidence} />
      </aside>
    </div>
  )
}
