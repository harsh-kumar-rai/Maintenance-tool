"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import {
  Check,
  ClipboardList,
  FileText,
  Loader2,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-client"
import type { EvidenceCard } from "@/lib/domain-types"
import type {
  ChatResponse,
  SuggestedMaintenancePlan,
} from "@/lib/maintenance-types"
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
  response?: ChatResponse
  suggestedPlan?: SuggestedMaintenancePlan
  planId?: string
  reportId?: string
  actionBusy?: "plan" | "report"
}

interface SavedInvestigationState {
  conversationId?: string
  messages: MessageState[]
  evidence: EvidenceCard[]
}

const SUGGESTED =
  "Review the uploaded plant data. What abnormalities, risk drivers and maintenance actions should we prioritize?"

function evidenceKey(card: EvidenceCard) {
  if (card.kind === "chart" && card.sensor) return `chart:${card.sensor.id}`
  if (card.kind === "risk") return `risk:${card.title}`
  if (card.ref) return `${card.kind}:${card.ref}:${card.title}`
  return `${card.kind}:${card.title}:${card.subtitle ?? ""}`
}

function dedupeEvidence(cards: EvidenceCard[]) {
  const byKey = new Map<string, EvidenceCard>()
  for (const card of cards) byKey.set(evidenceKey(card), card)
  return [...byKey.values()]
}

function mergeEvidenceCards(
  current: EvidenceCard[],
  incoming: EvidenceCard[],
) {
  return dedupeEvidence([...current, ...incoming])
}

export function InvestigationView() {
  const searchParams = useSearchParams()
  const equipmentId = searchParams.get("equipment") ?? undefined
  const suggestedPrompt = equipmentId
    ? `Investigate equipment ${equipmentId}. Which abnormal signals, risks, likely causes and maintenance actions should we prioritize?`
    : SUGGESTED
  const storageKey = `maintenance-wizard:investigation:${equipmentId ?? "general"}`

  const [messages, setMessages] = useState<MessageState[]>([])
  const [evidence, setEvidence] = useState<EvidenceCard[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const conversationId = useRef<string | undefined>(undefined)
  const scrollRef = useRef<HTMLDivElement>(null)
  const restored = useRef(false)
  const skipNextSave = useRef(false)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [])

  useEffect(scrollToBottom, [messages, scrollToBottom])

  useEffect(() => {
    restored.current = false
    skipNextSave.current = true

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        restored.current = true
        conversationId.current = undefined
        setMessages([])
        setEvidence([])
        return
      }

      const saved = JSON.parse(raw) as SavedInvestigationState
      conversationId.current = saved.conversationId
      setMessages(
        (saved.messages ?? []).map((message) => ({
          ...message,
          streaming: false,
          actionBusy: undefined,
          toolSteps: (message.toolSteps ?? []).map((step) => ({
            ...step,
            status: "done",
          })),
        })),
      )
      setEvidence(dedupeEvidence(saved.evidence ?? []))
    } catch {
      conversationId.current = undefined
      setMessages([])
      setEvidence([])
    } finally {
      restored.current = true
    }
  }, [storageKey])

  useEffect(() => {
    if (!restored.current) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    if (messages.some((message) => message.streaming)) return

    const state: SavedInvestigationState = {
      conversationId: conversationId.current,
      messages,
      evidence,
    }
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  }, [evidence, messages, storageKey])

  const updateLastAssistant = useCallback(
    (updater: (message: MessageState) => MessageState) => {
      setMessages((prev) => {
        const next = [...prev]
        next[next.length - 1] = updater(next[next.length - 1])
        return next
      })
    },
    [],
  )

  const playApiResponse = useCallback(
    async (response: ChatResponse) => {
      for (const card of response.evidence ?? []) {
        setEvidence((prev) => mergeEvidenceCards(prev, [card]))
      }

      // Animate tool steps one by one before the answer
      const steps = response.toolSteps ?? []
      for (let i = 0; i < steps.length; i++) {
        const stepIndex = i
        updateLastAssistant((last) => ({
          ...last,
          toolSteps: steps.slice(0, stepIndex + 1).map((s, j) => ({
            label: s.label,
            detail: s.detail,
            status: j < stepIndex ? "done" : "running",
          })),
        }))
        scrollToBottom()
        await new Promise((resolve) => setTimeout(resolve, 350))
        // Mark current step as done
        updateLastAssistant((last) => ({
          ...last,
          toolSteps: last.toolSteps.map((s, j) =>
            j === stepIndex ? { ...s, status: "done" } : s,
          ),
        }))
      }

      // Stream answer text word by word
      const words = response.answer.split(" ")
      let acc = ""
      for (let i = 0; i < words.length; i++) {
        acc += (i > 0 ? " " : "") + words[i]
        if (i % 3 === 0 || i === words.length - 1) {
          const snapshot = acc
          updateLastAssistant((last) => ({ ...last, content: snapshot }))
          scrollToBottom()
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
      }

      updateLastAssistant((last) => ({
        ...last,
        streaming: false,
        response,
        suggestedPlan: response.suggestedPlan,
      }))
    },
    [scrollToBottom, updateLastAssistant],
  )

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return
      setInput("")
      setBusy(true)
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, streaming: false, toolSteps: [] },
        { role: "assistant", content: "", streaming: true, toolSteps: [] },
      ])

      try {
        const response = await apiFetch<ChatResponse>("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            equipmentId,
            conversationId: conversationId.current,
          }),
        })
        conversationId.current = response.conversationId
        await playApiResponse(response)
      } catch (error) {
        updateLastAssistant((last) => ({
          ...last,
          content:
            error instanceof Error
              ? `AI service error: ${error.message}`
              : "AI service error. Check the LLM API configuration and try again.",
          streaming: false,
        }))
      } finally {
        setBusy(false)
      }
    },
    [busy, equipmentId, playApiResponse, updateLastAssistant],
  )

  const setFeedback = useCallback(
    (index: number, value: "up" | "down") => {
      setMessages((prev) => {
        const next = [...prev]
        next[index] = {
          ...next[index],
          feedback: next[index].feedback === value ? undefined : value,
        }
        return next
      })

      const msg = messages[index]
      if (msg?.response) {
        void apiFetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: msg.response.conversationId,
            equipmentId: msg.response.equipmentId,
            rating: value,
            message: msg.content,
          }),
        })
      }
    },
    [messages],
  )

  const createPlan = useCallback(
    async (index: number) => {
      const msg = messages[index]
      if (!msg?.suggestedPlan || msg.planId) return

      setMessages((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], actionBusy: "plan" }
        return next
      })

      try {
        const data = await apiFetch<{ plan: { id: string; title: string } }>(
          "/api/plans",
          {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg.suggestedPlan),
          },
        )
        setMessages((prev) => {
          const next = [...prev]
          next[index] = {
            ...next[index],
            planId: data.plan.id,
            actionBusy: undefined,
          }
          return next
        })
        setEvidence((prev) =>
          mergeEvidenceCards(prev, [
            {
            kind: "tool",
            title: `Plan ready: ${data.plan.id}`,
            subtitle: data.plan.title,
            body: "The maintenance plan is now available in the Planner and a logbook entry was recorded.",
            ref: data.plan.id,
            },
          ]),
        )
      } catch {
        setMessages((prev) => {
          const next = [...prev]
          next[index] = { ...next[index], actionBusy: undefined }
          return next
        })
      }
    },
    [messages],
  )

  const createReport = useCallback(
    async (index: number) => {
      const msg = messages[index]
      if (!msg?.response || msg.reportId) return

      setMessages((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], actionBusy: "report" }
        return next
      })

      try {
        const data = await apiFetch<{ report: { id: string; title: string } }>(
          "/api/reports",
          {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg.response),
          },
        )
        setMessages((prev) => {
          const next = [...prev]
          next[index] = {
            ...next[index],
            reportId: data.report.id,
            actionBusy: undefined,
          }
          return next
        })
        setEvidence((prev) =>
          mergeEvidenceCards(prev, [
            {
            kind: "tool",
            title: `Report generated: ${data.report.id}`,
            subtitle: data.report.title,
            body: "The structured investigation report is available under Reports & Logbook.",
            ref: data.report.id,
            },
          ]),
        )
      } catch {
        setMessages((prev) => {
          const next = [...prev]
          next[index] = { ...next[index], actionBusy: undefined }
          return next
        })
      }
    },
    [messages],
  )

  return (
    <div className="flex min-h-0 flex-1">
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
                  className="h-auto max-w-full whitespace-normal py-2.5 text-left"
                  onClick={() => handleSend(suggestedPrompt)}
                >
                  {suggestedPrompt}
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

                  {msg.role === "assistant" && msg.toolSteps.length > 0 ? (
                    <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 px-3 py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Agent workflow
                      </span>
                      {msg.toolSteps.map((step, j) => (
                        <div
                          key={j}
                          className="flex items-center gap-2 text-xs"
                        >
                          {step.status === "running" ? (
                            <Loader2 className="size-3 shrink-0 animate-spin text-primary" />
                          ) : (
                            <Check className="size-3 shrink-0 text-success" />
                          )}
                          <span
                            className={cn(
                              "font-mono font-medium",
                              step.status === "running"
                                ? "text-primary"
                                : "text-muted-foreground",
                            )}
                          >
                            {step.label}
                          </span>
                          <span className="text-muted-foreground/70">
                            {step.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {msg.content ? (
                    <div className="prose-sm flex flex-col gap-2 text-sm leading-relaxed [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.streaming && msg.toolSteps.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Waiting for maintenance agent response...
                    </div>
                  ) : null}

                  {msg.role === "assistant" && !msg.streaming && msg.content ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Helpful recommendation"
                        onClick={() => setFeedback(i, "up")}
                        className={cn(
                          msg.feedback === "up" && "bg-success/10 text-success",
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
                            "bg-destructive/10 text-destructive",
                        )}
                      >
                        <ThumbsDown />
                      </Button>
                      {msg.feedback ? (
                        <span className="text-xs text-muted-foreground">
                          Feedback recorded and available to future agent
                          context
                        </span>
                      ) : null}
                      {msg.suggestedPlan ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => createPlan(i)}
                            disabled={msg.actionBusy === "plan" || !!msg.planId}
                          >
                            {msg.actionBusy === "plan" ? (
                              <Loader2
                                data-icon="inline-start"
                                className="animate-spin"
                              />
                            ) : (
                              <ClipboardList data-icon="inline-start" />
                            )}
                            {msg.planId ? `Plan ${msg.planId}` : "Create plan"}
                          </Button>
                          {msg.planId ? (
                            <Button
                              render={<Link href="/planner" />}
                              nativeButton={false}
                              variant="ghost"
                              size="sm"
                            >
                              Open planner
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      {msg.response ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => createReport(i)}
                            disabled={
                              msg.actionBusy === "report" || !!msg.reportId
                            }
                          >
                            {msg.actionBusy === "report" ? (
                              <Loader2
                                data-icon="inline-start"
                                className="animate-spin"
                              />
                            ) : (
                              <FileText data-icon="inline-start" />
                            )}
                            {msg.reportId
                              ? `Report ${msg.reportId}`
                              : "Generate report"}
                          </Button>
                          {msg.reportId ? (
                            <Button
                              render={<Link href="/reports" />}
                              nativeButton={false}
                              variant="ghost"
                              size="sm"
                            >
                              Open reports
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

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
          <p className="mx-auto mt-2 max-w-3xl text-xs text-muted-foreground">
            LLM-only mode.{" "}
            {conversationId.current
              ? `Conversation active (${conversationId.current}).`
              : "New conversation."}{" "}
            {equipmentId ? `Equipment filter: ${equipmentId}. ` : ""}
            Evidence trail: {evidence.length} unique item
            {evidence.length === 1 ? "" : "s"}.
          </p>
        </div>
      </div>

      <aside
        className="hidden w-96 shrink-0 bg-secondary/30 lg:block"
        aria-label="Evidence trail"
      >
        <EvidencePanel cards={evidence} />
      </aside>
    </div>
  )
}
