import { addLogbook, loadStore, nextId, updateStore } from "./store.js"
import type {
  Alert,
  ChatRequest,
  ChatResponse,
  Equipment,
  EvidenceCard,
  FeedbackRecord,
  HistoricalIncident,
  KnowledgeChunk,
  KnowledgeDoc,
  MaintenancePlan,
  OperationalRecord,
  Priority,
  Report,
  RiskAssessment,
  RootCauseAnalysis,
  Sensor,
  SensorPoint,
  SparePart,
  StoreData,
  SuggestedMaintenancePlan,
  ToolStep,
} from "./types.js"

export class LlmProviderError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 502) {
    super(message)
    this.name = "LlmProviderError"
    this.statusCode = statusCode
  }
}

interface ConversationMessage {
  role: "user" | "assistant"
  content: string
}

const conversationMemory = new Map<string, ConversationMessage[]>()
const maxConversationMessages = 10

function tokens(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9#\s-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2),
  )
}

const retrievalSynonyms: Record<string, string[]> = {
  bearing: ["vibration", "lubrication", "alignment", "temperature"],
  vibration: ["bearing", "misalignment", "imbalance"],
  temperature: ["thermal", "overheating", "cooling"],
  cooling: ["flow", "temperature", "water"],
  flow: ["cooling", "pump", "water"],
  pressure: ["hydraulic", "pneumatic", "flow"],
  rul: ["remaining", "useful", "life", "prediction"],
  risk: ["criticality", "priority", "severity"],
  spare: ["inventory", "stock", "lead", "part"],
  spares: ["inventory", "stock", "lead", "part"],
  failure: ["root", "cause", "incident", "breakdown"],
  sop: ["procedure", "isolation", "loto"],
  manual: ["oem", "procedure", "threshold"],
}

function expandedQueryTokens(query: string) {
  const base = tokens(query)
  for (const token of [...base]) {
    for (const synonym of retrievalSynonyms[token] ?? []) base.add(synonym)
    if (token.endsWith("s") && token.length > 4) base.add(token.slice(0, -1))
  }
  return base
}

function sensorDirection(sensor: Sensor) {
  return sensor.threshold >= sensor.nominal ? "high" : "low"
}

function hasCrossedThreshold(sensor: Sensor) {
  return sensorDirection(sensor) === "high"
    ? sensor.current >= sensor.threshold
    : sensor.current <= sensor.threshold
}

function sensorSlope(points: SensorPoint[]) {
  if (points.length < 2) return 0
  return (points[points.length - 1].value - points[0].value) / (points.length - 1)
}

function distanceToThreshold(sensor: Sensor) {
  const range = Math.max(Math.abs(sensor.threshold - sensor.nominal), 0.001)
  const raw =
    sensorDirection(sensor) === "high"
      ? (sensor.current - sensor.nominal) / range
      : (sensor.nominal - sensor.current) / range
  return Math.max(0, raw)
}

export function estimateSensorRulDays(sensor: Sensor) {
  if (hasCrossedThreshold(sensor)) return 0
  const slope = sensorSlope(sensor.history)
  if (Math.abs(slope) < 0.001) return null

  const movingToward =
    sensorDirection(sensor) === "high" ? slope > 0 : slope < 0
  if (!movingToward) return null

  const remaining =
    sensorDirection(sensor) === "high"
      ? sensor.threshold - sensor.current
      : sensor.current - sensor.threshold
  return Math.max(1, Math.round(remaining / Math.abs(slope)))
}

export function estimateEquipmentRulDays(asset: Equipment) {
  if (asset.rulDays !== null) return asset.rulDays
  const estimates = asset.sensors
    .map(estimateSensorRulDays)
    .filter((value): value is number => value !== null)
  return estimates.length ? Math.min(...estimates) : null
}

function severityRank(severity: Alert["severity"]) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[severity]
}

function alertSeverity(asset: Equipment, sensor: Sensor): Alert["severity"] {
  const rul = estimateEquipmentRulDays(asset)
  const closeness = distanceToThreshold(sensor)
  if (hasCrossedThreshold(sensor)) return "critical"
  if (asset.status === "critical") return "critical"
  if (rul !== null && rul <= 30) return "critical"
  if (asset.status === "degraded" || closeness >= 0.75 || sensor.trend !== "stable") return "high"
  if (closeness >= 0.5) return "medium"
  return "low"
}

export function deriveAlerts(equipment: Equipment[]) {
  const alerts: Alert[] = []
  for (const asset of equipment) {
    for (const sensor of asset.sensors) {
      const closeness = distanceToThreshold(sensor)
      const sensorRulDays = estimateSensorRulDays(sensor)
      if (
        !hasCrossedThreshold(sensor) &&
        closeness < 0.75 &&
        !(sensor.trend !== "stable" && closeness >= 0.55) &&
        !(sensorRulDays !== null && sensorRulDays <= 30) &&
        !(asset.status === "critical" && closeness >= 0.45)
      ) {
        continue
      }
      const rulDays = estimateEquipmentRulDays(asset)
      const severity = alertSeverity(asset, sensor)
      alerts.push({
        id: `ALT-${asset.id}-${sensor.id}`,
        equipmentId: asset.id,
        equipmentName: asset.name,
        sensorId: sensor.id,
        sensorName: sensor.name,
        severity,
        title: `${asset.name}: ${sensor.name}`,
        message: `${sensor.current} ${sensor.unit} with ${sensor.trend} trend${
          rulDays !== null ? `; trend-based RUL ~${rulDays} days` : ""
        }.`,
        value: sensor.current,
        unit: sensor.unit,
        threshold: sensor.threshold,
        trend: sensor.trend,
        rulDays,
        detectedAt: new Date().toISOString(),
      })
    }
  }
  return alerts.sort((a, b) => {
    const severityDelta = severityRank(b.severity) - severityRank(a.severity)
    return severityDelta || (a.rulDays ?? 999) - (b.rulDays ?? 999)
  })
}

export function searchKnowledge(
  query: string,
  documents: Awaited<ReturnType<typeof loadStore>>["documents"],
  equipmentId?: string,
  limit = 5,
): KnowledgeChunk[] {
  const queryTokens = expandedQueryTokens(query)
  const originalQueryTokens = tokens(query)
  const lowerQuery = query.toLowerCase()
  const chunks: KnowledgeChunk[] = []
  for (const doc of documents) {
    for (const section of doc.sections) {
      const haystack = [
        doc.title,
        doc.type,
        doc.summary,
        section.ref,
        section.heading,
        section.excerpt,
        ...doc.equipmentIds,
      ].join(" ")
      const hayTokens = tokens(haystack)
      const titleTokens = tokens(`${doc.title} ${section.heading}`)
      let score = 0
      for (const token of queryTokens) {
        if (hayTokens.has(token)) score += originalQueryTokens.has(token) ? 1.5 : 0.75
      }
      for (const token of originalQueryTokens) {
        if (titleTokens.has(token)) score += 1.5
      }
      if (equipmentId && doc.equipmentIds.includes(equipmentId)) score += 6
      if (lowerQuery.includes("sop") && doc.type === "SOP") score += 3
      if (lowerQuery.includes("manual") && doc.type === "Manual") score += 3
      if (
        (lowerQuery.includes("failure") ||
          lowerQuery.includes("root cause") ||
          lowerQuery.includes("incident")) &&
        doc.type === "Failure Report"
      ) {
        score += 3
      }
      if (lowerQuery.includes("history") && doc.type === "Operational Log") score += 2
      if (score <= 0) continue
      chunks.push({
        id: `${doc.id}:${section.ref}`,
        documentId: doc.id,
        documentTitle: doc.title,
        documentType: doc.type,
        equipmentIds: doc.equipmentIds,
        ref: section.ref,
        heading: section.heading,
        excerpt: section.excerpt,
        score,
      })
    }
  }
  return chunks.sort((a, b) => b.score - a.score).slice(0, limit)
}

function priorityFromScore(score: number): Priority {
  if (score >= 85) return "critical"
  if (score >= 65) return "high"
  if (score >= 45) return "medium"
  return "low"
}

export function computeRisk(asset: Equipment, alerts: Alert[]): RiskAssessment {
  const criticalityWeight = {
    low: 8,
    medium: 16,
    high: 26,
    critical: 34,
  }[asset.criticality]
  const healthRisk = Math.round((100 - asset.healthScore) * 0.35)
  const rulDays = estimateEquipmentRulDays(asset)
  const rulRisk =
    rulDays === null
      ? 0
      : rulDays <= 7
        ? 28
        : rulDays <= 30
          ? 24
          : rulDays <= 90
            ? 14
            : 6
  const activeAlerts = alerts.filter((alert) => alert.equipmentId === asset.id)
  const alertRisk = Math.min(14, activeAlerts.length * 5)
  const score = Math.min(100, criticalityWeight + healthRisk + rulRisk + alertRisk)
  return {
    score,
    level: priorityFromScore(score),
    drivers: [
      `${asset.criticality} process criticality`,
      `${asset.healthScore}% health score`,
      rulDays !== null ? `trend-based RUL ~${rulDays} days` : "no RUL estimate",
      `${activeAlerts.length} active alert${activeAlerts.length === 1 ? "" : "s"}`,
    ],
  }
}

export function analyzeRootCause(
  asset: Equipment,
  alerts: Alert[],
  chunks: KnowledgeChunk[],
  incidents: HistoricalIncident[],
  risk?: RiskAssessment,
): RootCauseAnalysis | undefined {
  if (!asset) return undefined

  const sensor = [...asset.sensors].sort((a, b) =>
    distanceToThreshold(b) - distanceToThreshold(a),
  )[0]
  const supporting: string[] = []
  let confidence = 30
  let description = ""
  let failureMode: string | undefined

  // Sensor-driven root cause
  if (sensor && distanceToThreshold(sensor) >= 0.5) {
    const direction = sensor.current > sensor.nominal ? "elevated" : "depressed"
    description = `${sensor.name} is ${direction} at ${sensor.current} ${sensor.unit} (threshold ${sensor.threshold} ${sensor.unit}, trend ${sensor.trend}), indicating progressive degradation of the monitored subsystem.`
    supporting.push(`Sensor ${sensor.name}: ${sensor.current} ${sensor.unit} with ${sensor.trend} trend`)
    confidence += 20
    failureMode = `${sensor.name} exceedance`
  } else if (asset.status === "degraded" || asset.status === "critical") {
    description = `${asset.name} health score is ${asset.healthScore}%, indicating accumulated degradation across monitored parameters.`
    confidence += 10
  } else {
    description = `No clear abnormality detected. ${asset.name} is within normal operating parameters.`
  }

  // Historical maintenance pattern
  if (asset.history.length > 0) {
    const recentRepeat = asset.history.filter((h) =>
      h.description.toLowerCase().includes(sensor?.name.toLowerCase().split(" ")[0] ?? ""),
    )
    if (recentRepeat.length > 0) {
      supporting.push(`${recentRepeat.length} previous maintenance record(s) reference the same subsystem`)
      confidence += 10
      if (recentRepeat.length >= 2) {
        description += ` Historical pattern: ${recentRepeat.length} prior corrective actions on this subsystem suggest a recurring failure mode.`
        failureMode = failureMode ?? "Recurring subsystem failure"
      }
    } else {
      supporting.push(`${asset.history.length} maintenance record(s) reviewed, no direct subsystem match`)
      confidence += 5
    }
  }

  // Document evidence
  const sopChunks = chunks.filter((c) => c.documentType === "SOP" || c.documentType === "Manual")
  const failureChunks = chunks.filter((c) => c.documentType === "Failure Report")
  if (sopChunks.length > 0) {
    supporting.push(`${sopChunks.length} SOP/manual section(s) retrieved: ${sopChunks.map((c) => c.heading).join(", ")}`)
    confidence += 10
  }
  if (failureChunks.length > 0) {
    supporting.push(`${failureChunks.length} failure report(s) matched: ${failureChunks.map((c) => c.documentTitle).join(", ")}`)
    confidence += 10
    if (!failureMode) failureMode = "Prior documented failure pattern"
  }

  // Similar incidents boost
  if (incidents.length > 0) {
    const best = incidents[0]
    supporting.push(`Similar historical incident: ${best.incidentId} — "${best.rootCause}"`)
    confidence += 8
    if (!failureMode) failureMode = best.rootCause
    if (!description.includes("Historical pattern")) {
      description += ` A similar incident (${best.incidentId}) on ${best.equipmentType} had root cause: "${best.rootCause}".`
    }
  }

  // Risk-driven confidence
  if (risk && risk.score >= 65) confidence += 5

  confidence = Math.min(95, confidence)

  return { description, confidence, supportingEvidence: supporting, failureMode }
}

export function findSimilarIncidents(
  asset: Equipment,
  message: string,
  documents: KnowledgeDoc[],
  operationalRecords: OperationalRecord[],
  limit = 3,
): HistoricalIncident[] {
  const queryLower = `${message} ${asset.name} ${asset.type}`.toLowerCase()
  const queryTokens = tokens(queryLower)
  const results: HistoricalIncident[] = []

  // Search failure report documents
  for (const doc of documents) {
    if (doc.type !== "Failure Report") continue
    const symptomsSection = doc.sections.find((s) => s.heading.toLowerCase().includes("symptom"))
    const rootCauseSection = doc.sections.find((s) => s.heading.toLowerCase().includes("root cause"))
    const correctiveSection = doc.sections.find((s) => s.heading.toLowerCase().includes("corrective"))
    if (!symptomsSection && !rootCauseSection) continue

    const haystack = [doc.title, doc.summary, ...doc.sections.map((s) => s.excerpt)].join(" ").toLowerCase()
    const hayTokens = tokens(haystack)

    let score = 0
    for (const token of queryTokens) {
      if (hayTokens.has(token)) score += 1
    }
    // Equipment type match boost
    if (haystack.includes(asset.type.toLowerCase())) score += 4
    if (doc.equipmentIds.includes(asset.id)) score += 6

    if (score < 2) continue

    results.push({
      incidentId: doc.id.replace("FAIL-", ""),
      equipmentType: doc.title.split(" - ")[1] ?? doc.title,
      symptoms: symptomsSection?.excerpt ?? doc.summary.slice(0, 150),
      rootCause: rootCauseSection?.excerpt ?? "Root cause not documented",
      correctiveAction: correctiveSection?.excerpt ?? "Corrective action not documented",
      relevanceScore: Math.min(100, Math.round(score * 8)),
    })
  }

  // Search operational records with incident category
  for (const record of operationalRecords) {
    if (record.category !== "incident" && record.category !== "fault") continue
    const haystack = record.description.toLowerCase()
    const hayTokens = tokens(haystack)
    let score = 0
    for (const token of queryTokens) {
      if (hayTokens.has(token)) score += 1
    }
    if (record.equipmentId === asset.id) score += 5
    if (score < 2) continue

    results.push({
      incidentId: record.id,
      equipmentType: asset.type,
      symptoms: record.description.slice(0, 150),
      rootCause: record.description,
      correctiveAction: "See operational record for details",
      relevanceScore: Math.min(100, Math.round(score * 6)),
    })
  }

  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit)
}

function worstSensor(asset: Equipment) {
  return [...asset.sensors].sort((a, b) => {
    const distance = distanceToThreshold(b) - distanceToThreshold(a)
    return distance || Math.abs(sensorSlope(b.history)) - Math.abs(sensorSlope(a.history))
  })[0]
}

function inferEquipment(message: string, equipment: Equipment[], explicit?: string) {
  if (explicit) {
    const found = equipment.find((asset) => asset.id === explicit)
    if (found) return found
  }
  const lower = message.toLowerCase()
  return (
    equipment.find(
      (asset) =>
        lower.includes(asset.id.toLowerCase()) ||
        lower.includes(asset.name.toLowerCase()) ||
        lower.includes(asset.type.toLowerCase()),
    ) ?? equipment[0]
  )
}

function dueDate(priority: Priority) {
  const days = { critical: 4, high: 8, medium: 15, low: 30 }[priority]
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function relevantSpares(spares: SparePart[], equipmentId: string) {
  return spares
    .filter((spare) => spare.equipmentId === equipmentId)
    .map(({ equipmentId: _equipmentId, ...spare }) => spare)
}

function reportBullet(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- Evidence not uploaded."
}

function confidencePercent(
  asset: Equipment | undefined,
  chunks: KnowledgeChunk[],
  risk?: RiskAssessment,
) {
  if (!asset) return 30
  let confidence = 45
  if (asset.sensors.length > 0) confidence += 20
  if (asset.history.length > 0) confidence += 10
  if (chunks.length > 0) confidence += 15
  if (chunks.some((chunk) => chunk.documentType === "Manual" || chunk.documentType === "SOP")) {
    confidence += 5
  }
  if (chunks.some((chunk) => chunk.documentType === "Failure Report")) confidence += 5
  if (risk) confidence += 5
  return Math.min(93, confidence)
}

function sensorEvidence(asset: Equipment) {
  return asset.sensors.slice(0, 3).map((sensor) => {
    const first = sensor.history[0]
    const last = sensor.history[sensor.history.length - 1]
    const movement =
      first && last
        ? `${sensor.name} moved from ${first.value} ${sensor.unit} to ${last.value} ${sensor.unit} over ${sensor.history.length} readings`
        : `${sensor.name} current value ${sensor.current} ${sensor.unit}`
    return `${movement}; threshold ${sensor.threshold} ${sensor.unit}; trend ${sensor.trend}.`
  })
}

function historyEvidence(asset: Equipment) {
  return asset.history.slice(0, 2).map((item) =>
    `${item.date}: ${item.type} record - ${item.description}${
      item.downtimeHours ? `; downtime ${item.downtimeHours}h` : ""
    }.`,
  )
}

function documentEvidence(chunks: KnowledgeChunk[]) {
  return chunks.slice(0, 3).map((chunk) =>
    `${chunk.documentType} ${chunk.documentTitle} ${chunk.ref}: ${chunk.excerpt}`,
  )
}

function recommendationReason(
  asset: Equipment,
  risk: RiskAssessment | undefined,
  chunks: KnowledgeChunk[],
) {
  const sensor = worstSensor(asset)
  const drivers = risk?.drivers.join("; ") || "risk drivers unavailable"
  const sourceCoverage = chunks.length
    ? "uploaded document evidence is available"
    : "manual/SOP/failure-report evidence is not uploaded"
  return sensor
    ? `${sensor.name} is the controlling signal; ${drivers}; ${sourceCoverage}.`
    : `${drivers}; ${sourceCoverage}.`
}

function investigationFocus(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes("spare") || lower.includes("inventory") || lower.includes("stock")) {
    return "spare readiness and work-order feasibility"
  }
  if (lower.includes("temperature") || lower.includes("temp") || lower.includes("thermal")) {
    return "temperature trend and process stability"
  }
  if (lower.includes("arc") || lower.includes("power") || lower.includes("electrode")) {
    return "arc power stability and electrical heating condition"
  }
  if (lower.includes("gas") || lower.includes("argon") || lower.includes("flow")) {
    return "gas flow condition and process support utilities"
  }
  if (lower.includes("risk") || lower.includes("critical") || lower.includes("priority")) {
    return "maintenance risk classification and operating exposure"
  }
  if (lower.includes("plan") || lower.includes("work order") || lower.includes("schedule")) {
    return "maintenance planning and execution readiness"
  }
  if (lower.includes("manual") || lower.includes("sop") || lower.includes("failure")) {
    return "document-backed failure mode verification"
  }
  return "equipment condition and maintenance recommendation"
}

function querySpecificActions(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes("spare") || lower.includes("inventory") || lower.includes("stock")) {
    return ["Verify spare availability, reservation status, and lead time before releasing the work order."]
  }
  if (lower.includes("temperature") || lower.includes("temp") || lower.includes("thermal")) {
    return ["Validate bath temperature readings, sensor calibration, and recent heat-cycle deviations."]
  }
  if (lower.includes("arc") || lower.includes("power") || lower.includes("electrode")) {
    return ["Inspect electrode regulation, transformer loading trend, and abnormal arc power variation."]
  }
  if (lower.includes("gas") || lower.includes("argon") || lower.includes("flow")) {
    return ["Check gas flow control, line restriction, and process utility supply stability."]
  }
  if (lower.includes("manual") || lower.includes("sop") || lower.includes("failure")) {
    return ["Cross-check the recommendation against uploaded manual, SOP, and failure-report sections."]
  }
  if (lower.includes("plan") || lower.includes("work order") || lower.includes("schedule")) {
    return ["Convert the recommendation into a planned maintenance work order with downtime approval."]
  }
  return []
}

type ChatIntent =
  | "status"
  | "risk"
  | "create_plan"
  | "spares"
  | "evidence"
  | "investigation"
  | "general"

function detectIntent(message: string): ChatIntent {
  const lower = message.toLowerCase().trim()
  if (
    /\b(create|generate|make|prepare|draft|ok|okay|yes)\b/.test(lower) &&
    /\b(plan|work order|wo|job card)\b/.test(lower)
  ) {
    return "create_plan"
  }
  if (/\b(spare|spares|inventory|stock|lead time|store)\b/.test(lower)) return "spares"
  if (/\b(manual|sop|failure report|evidence|citation|document|history)\b/.test(lower)) {
    return "evidence"
  }
  if (/\b(risk|critical|priority|rul|remaining useful life)\b/.test(lower)) return "risk"
  if (
    lower === "status" ||
    lower === "update" ||
    lower === "health" ||
    /\b(current status|plant status|equipment status|health status)\b/.test(lower)
  ) {
    return "status"
  }
  if (
    /\b(investigate|diagnose|diagnosis|recommend|recommendation|root cause|abnormal|abnormality|why|what should|prioritize|action plan|report)\b/.test(
      lower,
    )
  ) {
    return "investigation"
  }
  return "general"
}

function primarySensorLine(asset: Equipment) {
  const sensor = worstSensor(asset)
  if (!sensor) return "No linked sensor trend is available."
  return `${sensor.name} is ${sensor.current} ${sensor.unit} against ${sensor.threshold} ${sensor.unit}, trend ${sensor.trend}.`
}

function activeAlertCount(asset: Equipment, alerts: Alert[]) {
  return alerts.filter((alert) => alert.equipmentId === asset.id).length
}

function noAssetAnswer(intent: ChatIntent) {
  if (intent === "status" || intent === "general") {
    return `No plant asset is indexed yet. Upload the equipment and sensor CSV files first; after ingestion, status can be reported with health score, active alerts, risk level, and confidence.`
  }

  if (intent === "create_plan") {
    return `A maintenance plan cannot be prepared yet because no equipment record is indexed. Upload equipment, sensor trend, maintenance history, and spare inventory data, then request the plan again.`
  }

  return `No maintenance recommendation can be issued yet because equipment, sensor trend, and document evidence are not indexed. Upload the real plant files from the Knowledge page, then run the investigation again.`
}

function statusAnswer(
  asset: Equipment | undefined,
  alerts: Alert[],
  chunks: KnowledgeChunk[],
  risk?: RiskAssessment,
) {
  if (!asset) return noAssetAnswer("status")
  const confidence = confidencePercent(asset, chunks, risk)
  const alertCount = activeAlertCount(asset, alerts)
  const riskLabel = risk?.level.toUpperCase() ?? "UNCLASSIFIED"
  return `Current status: ${asset.name} is in ${asset.status.toUpperCase()} condition with ${riskLabel} maintenance risk (${risk?.score ?? "N/A"}/100). ${primarySensorLine(asset)}

There are ${alertCount} active alert${alertCount === 1 ? "" : "s"}. Confidence is ${confidence}% because the assessment is supported by sensor trends${chunks.length ? " and uploaded documents" : "; manuals/SOPs/failure reports are not uploaded yet"}.

Operational recommendation: keep the asset under maintenance watch, verify the controlling signal at field level, and escalate to a work order if the trend continues or production exposure increases.`
}

function riskAnswer(
  asset: Equipment | undefined,
  alerts: Alert[],
  chunks: KnowledgeChunk[],
  risk?: RiskAssessment,
) {
  if (!asset) return noAssetAnswer("risk")
  const confidence = confidencePercent(asset, chunks, risk)
  return `Risk assessment for ${asset.name}: ${risk?.level.toUpperCase() ?? "UNCLASSIFIED"} (${risk?.score ?? "N/A"}/100), confidence ${confidence}%.

Main driver: ${primarySensorLine(asset)} Supporting factors: ${risk?.drivers.join("; ") ?? "risk drivers unavailable"}.

Recommendation: maintain operating watch and prepare maintenance action around the controlling signal. The confidence will improve after uploading manuals, SOPs, prior failure reports, and spare availability.`
}

function planReadinessAnswer(
  asset: Equipment | undefined,
  chunks: KnowledgeChunk[],
  risk?: RiskAssessment,
  plan?: SuggestedMaintenancePlan,
) {
  if (!asset || !plan) return noAssetAnswer("create_plan")
  const confidence = confidencePercent(asset, chunks, risk)
  const spareLine = plan.spares.length
    ? `Spares identified: ${plan.spares.map((spare) => `${spare.name} (${spare.code})`).join(", ")}.`
    : "Spare inventory is not uploaded; stores confirmation is required before release."

  return `Plan package is ready for ${asset.name}.

Priority: ${plan.priority.toUpperCase()}
Risk Score: ${plan.riskScore}/100
Confidence: ${confidence}%
Target Date: ${plan.dueDate}
Estimated Downtime: ${plan.estimatedDowntimeHours}h

Reason for recommendation: ${recommendationReason(asset, risk, chunks)}

Work scope:
${reportBullet(plan.steps.slice(0, 4).map((step) => step.text))}

${spareLine}

Next step: use the Create plan action below to register this in Planner and create the logbook entry.`
}

function sparesAnswer(asset: Equipment | undefined, spares: ReturnType<typeof relevantSpares>) {
  if (!asset) return noAssetAnswer("spares")
  if (spares.length === 0) {
    return `Spare readiness for ${asset.name}: not confirmed.

No spare inventory records are indexed for this asset. Do not release a corrective work order until stores confirms part availability, reservation status, and lead time.

Next step: upload the spare inventory CSV or manually confirm the critical parts needed for the planned scope.`
  }

  return `Spare readiness for ${asset.name}: ${spares.length} item${spares.length === 1 ? "" : "s"} indexed.

${reportBullet(
  spares.map(
    (spare) =>
      `${spare.name} (${spare.code}): required ${spare.required}, in stock ${spare.inStock}, lead time ${spare.leadTimeDays} days.`,
  ),
)}

Next step: reserve parts with insufficient buffer before scheduling downtime.`
}

function evidenceAnswer(asset: Equipment | undefined, chunks: KnowledgeChunk[]) {
  if (!asset) return noAssetAnswer("evidence")
  const documentLine = chunks.length
    ? reportBullet(documentEvidence(chunks))
    : "- Manuals, SOPs, and failure reports are not uploaded for this asset."
  const historyLine = asset.history.length
    ? reportBullet(historyEvidence(asset))
    : "- Maintenance history is not uploaded for this asset."

  return `Evidence position for ${asset.name}:

Sensor evidence:
${reportBullet(sensorEvidence(asset))}

Maintenance history:
${historyLine}

Documents:
${documentLine}

Recommendation: upload the OEM manual, relevant SOP, and prior failure report to raise confidence and support a citation-backed maintenance decision.`
}

export function buildPlan(
  asset: Equipment,
  risk: RiskAssessment,
  spares: ReturnType<typeof relevantSpares>,
): SuggestedMaintenancePlan {
  const sensor = worstSensor(asset)
  const issue = sensor
    ? `${sensor.name} abnormality`
    : `${asset.name} maintenance investigation`

  // Build context-specific steps instead of generic ones
  const steps: { text: string }[] = []

  // Step 1: Always start with condition confirmation
  steps.push({
    text: sensor
      ? `Confirm ${sensor.name} reading of ${sensor.current} ${sensor.unit} on ${asset.name} with field verification (threshold: ${sensor.threshold} ${sensor.unit})`
      : `Confirm condition on ${asset.name} with field inspection and verification against operating parameters`,
  })

  // Step 2: Isolation procedure
  steps.push({
    text: `Apply isolation and LOTO procedure for ${asset.name} (${asset.type}) in ${asset.area}`,
  })

  // Step 3: Context-specific inspection
  if (sensor && sensor.trend === "rising") {
    steps.push({
      text: `Inspect ${sensor.name} subsystem for overheating, fouling, or mechanical wear causing rising ${sensor.unit} readings`,
    })
  } else if (sensor && sensor.trend === "falling") {
    steps.push({
      text: `Inspect ${sensor.name} subsystem for flow restrictions, leaks, or sensor degradation causing falling ${sensor.unit} readings`,
    })
  } else {
    steps.push({
      text: "Inspect degrading subsystem using cited manual/SOP guidance and compare against OEM specifications",
    })
  }

  // Step 4: Repair/replace with specific spare parts if available
  if (spares.length > 0) {
    const spareList = spares.slice(0, 3).map((sp) => `${sp.name} (${sp.code})`).join(", ")
    const lowStock = spares.filter((sp) => sp.inStock < sp.required)
    steps.push({
      text: `Replace confirmed defective components using available spares: ${spareList}${
        lowStock.length > 0
          ? `. ⚠ Low stock: ${lowStock.map((sp) => `${sp.name} — need ${sp.required}, have ${sp.inStock}, lead ${sp.leadTimeDays}d`).join("; ")}`
          : ""
      }`,
    })
  } else {
    steps.push({
      text: "Replace or repair confirmed defective components — no linked spare parts found; verify inventory availability before scheduling",
    })
  }

  // Step 5: Return to service
  steps.push({
    text: sensor
      ? `Return ${asset.name} to service and verify ${sensor.name} returns to nominal range (${sensor.nominal} ${sensor.unit}) before closing work order`
      : `Return ${asset.name} to service and verify all sensor/process values are back near nominal before closing work order`,
  })

  // Step 6: Follow-up monitoring if recurring issue
  if (asset.history.length >= 2) {
    steps.push({
      text: `Schedule follow-up vibration/thermal check in 7 days — ${asset.history.length} prior maintenance records suggest recurring degradation pattern on this asset`,
    })
  }

  return {
    title: `${issue} - ${asset.name}`,
    equipmentId: asset.id,
    equipmentName: asset.name,
    priority: risk.level,
    riskScore: risk.score,
    dueDate: dueDate(risk.level),
    estimatedDowntimeHours: risk.level === "critical" ? 12 : risk.level === "high" ? 8 : 4,
    summary: sensor
      ? `${sensor.name} is ${sensor.trend} at ${sensor.current} ${sensor.unit}; verify the condition and execute corrective maintenance before threshold breach.`
      : `Investigate ${asset.name} based on uploaded real data and maintenance context.`,
    steps,
    spares,
  }
}

function deterministicAnswer(
  requestMessage: string,
  asset: Equipment | undefined,
  chunks: KnowledgeChunk[],
  alerts: Alert[],
  risk?: RiskAssessment,
  plan?: SuggestedMaintenancePlan,
  spares: ReturnType<typeof relevantSpares> = [],
  intent: ChatIntent = detectIntent(requestMessage),
) {
  const confidence = confidencePercent(asset, chunks, risk)
  const focus = investigationFocus(requestMessage)
  if (intent === "status" || intent === "general") {
    return statusAnswer(asset, alerts, chunks, risk)
  }
  if (intent === "risk") {
    return riskAnswer(asset, alerts, chunks, risk)
  }
  if (intent === "create_plan") {
    return planReadinessAnswer(asset, chunks, risk, plan)
  }
  if (intent === "spares") {
    return sparesAnswer(asset, spares)
  }
  if (intent === "evidence") {
    return evidenceAnswer(asset, chunks)
  }

  if (!asset) {
    return `INVESTIGATION SUMMARY

No equipment has been classified because no real equipment or sensor data is indexed.
Investigation focus: ${focus}.

CURRENT CONDITION

No equipment master, sensor trend, maintenance history, manual, SOP, or failure-report evidence is available in the local index.

KEY EVIDENCE

- Uploaded equipment records: 0.
- Uploaded sensor trends: 0.
- Uploaded maintenance documents: 0.

RISK ASSESSMENT

Risk Level: UNCLASSIFIED
Confidence: ${confidence}%
Reason for recommendation: operational data is required before issuing a maintenance recommendation.

RECOMMENDED ACTIONS

- Upload real CSV files for equipment, sensor readings, maintenance history, spares, and operational records.
- Upload manuals, SOPs, OEM bulletins, and failure reports for citation-backed recommendations.
- Re-run the investigation after the relevant asset data is indexed.

NEXT STEPS

Load the plant data set from the Knowledge page, then start the investigation from the affected equipment record.`
  }

  const sensor = worstSensor(asset)
  const assetAlerts = alerts.filter((alert) => alert.equipmentId === asset.id)
  const riskLevel = risk?.level.toUpperCase() ?? "UNCLASSIFIED"
  const currentCondition = [
    `${asset.name} status: ${asset.status.toUpperCase()}; health score ${asset.healthScore}%.`,
    sensor
      ? `${sensor.name}: ${sensor.current} ${sensor.unit}; threshold ${sensor.threshold} ${sensor.unit}; trend ${sensor.trend}.`
      : "No linked sensor trend is available for this equipment.",
    `${assetAlerts.length} active alert${assetAlerts.length === 1 ? "" : "s"} associated with this asset.`,
  ]
  const evidence = [
    ...sensorEvidence(asset),
    ...historyEvidence(asset),
    ...documentEvidence(chunks),
  ]
  const actionItems = plan
    ? [
        ...querySpecificActions(requestMessage),
        ...plan.steps.slice(0, 4).map((step) => step.text),
        plan.spares.length
          ? `Reserve required spare inventory: ${plan.spares
              .map((spare) => `${spare.name} (${spare.code})`)
              .join(", ")}.`
          : "Confirm spare requirements from maintenance store inventory.",
      ]
    : [
        "Confirm equipment condition with field inspection.",
        "Review available maintenance history and OEM guidance.",
        "Create a maintenance work order after evidence review.",
      ]

  return `INVESTIGATION SUMMARY

${asset.name} has been classified as ${riskLevel} for maintenance priority.
Investigation focus: ${focus}.

CURRENT CONDITION

${reportBullet(currentCondition)}

KEY EVIDENCE

${reportBullet(evidence)}

RISK ASSESSMENT

Risk Level: ${riskLevel}
Risk Score: ${risk?.score ?? "N/A"}/100
Confidence: ${confidence}%
Reason for recommendation: ${recommendationReason(asset, risk, chunks)}

RECOMMENDED ACTIONS

${reportBullet(actionItems)}

NEXT STEPS

${plan ? `Generate a maintenance work order for "${plan.title}", target completion by ${plan.dueDate}, and plan ${plan.estimatedDowntimeHours}h downtime.` : "Generate a maintenance work order after sensor, history, manual, SOP, and failure-report evidence is uploaded."}`
}

const requiredReportHeadings = [
  "INVESTIGATION SUMMARY",
  "CURRENT CONDITION",
  "KEY EVIDENCE",
  "RISK ASSESSMENT",
  "RECOMMENDED ACTIONS",
  "NEXT STEPS",
]

function hasRequiredReportFormat(answer: string) {
  const normalized = answer.toUpperCase()
  return requiredReportHeadings.every((heading) => normalized.includes(heading))
}

function sanitizeIndustrialLanguage(answer: string) {
  return answer
    .replace(/\bI think\b/gi, "")
    .replace(/\bIt seems\b/gi, "")
    .replace(/\bI found\b/gi, "")
    .replace(/\bBased on my analysis,?\s*/gi, "")
    .replace(/\bHope this helps\.?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function compactAsset(asset: Equipment | undefined) {
  if (!asset) return undefined
  return {
    id: asset.id,
    name: asset.name,
    area: asset.area,
    type: asset.type,
    status: asset.status,
    healthScore: asset.healthScore,
    criticality: asset.criticality,
    trendBasedRulDays: estimateEquipmentRulDays(asset),
    lastMaintenance: asset.lastMaintenance,
    nextScheduled: asset.nextScheduled,
    sensors: asset.sensors.map((sensor) => {
      const first = sensor.history[0]
      const last = sensor.history[sensor.history.length - 1]
      return {
        id: sensor.id,
        name: sensor.name,
        current: sensor.current,
        unit: sensor.unit,
        nominal: sensor.nominal,
        threshold: sensor.threshold,
        trend: sensor.trend,
        readingCount: sensor.history.length,
        firstReading: first,
        lastReading: last,
      }
    }),
    maintenanceHistory: asset.history.slice(0, 5),
  }
}

function compactLlmContext(
  asset: Equipment | undefined,
  alerts: Alert[],
  chunks: KnowledgeChunk[],
  risk: RiskAssessment | undefined,
  suggestedPlan: SuggestedMaintenancePlan | undefined,
  spares: ReturnType<typeof relevantSpares>,
  intent: ChatIntent,
  feedback: FeedbackRecord[],
  rootCause?: RootCauseAnalysis,
  similarIncidents?: HistoricalIncident[],
) {
  return {
    intent,
    asset: compactAsset(asset),
    alerts: alerts.filter((alert) => !asset || alert.equipmentId === asset.id).slice(0, 10),
    risk,
    rootCause: rootCause ?? null,
    similarIncidents: (similarIncidents ?? []).slice(0, 3),
    confidence: confidencePercent(asset, chunks, risk),
    citations: chunks.slice(0, 5),
    suggestedPlan,
    spares,
    feedback,
    missingEvidence: {
      manualsOrSops: chunks.every(
        (chunk) => chunk.documentType !== "Manual" && chunk.documentType !== "SOP",
      ),
      failureReports: chunks.every((chunk) => chunk.documentType !== "Failure Report"),
      maintenanceHistory: !asset || asset.history.length === 0,
      spareInventory: spares.length === 0,
    },
  }
}

async function callLlm(
  request: ChatRequest,
  context: unknown,
  intent: ChatIntent,
) {
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new LlmProviderError(
      "LLM_API_KEY is not configured. Add a valid Gemini API key in backend/.env.",
      503,
    )
  }

  const baseUrl =
    process.env.LLM_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai"
  const model = process.env.LLM_MODEL ?? "gemini-3.5-flash"

  let response: Response
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.55,
      messages: [
        {
          role: "system",
          content: `You are a senior steel plant maintenance engineer talking with plant operations.

Use only the provided uploaded-data context. Do not invent sensor values, manuals, SOPs, failure reports, spare availability, or maintenance history.

Respond naturally to the operator's actual instruction. Use a professional industrial maintenance engineering communication style: direct, operational, calm, and human.

This is a conversation. Use the previous conversation messages when available. Do not repeat the same answer every turn.

For short requests such as "status", "ok", "create plan", "what next", or "check spares", answer as a maintenance engineer would in a control room: concise, specific, and action-oriented.

For status, risk, plan, spare, or evidence questions, answer in a concise operational note. Do not repeat the full investigation report unless the user asked for an investigation, diagnosis, formal recommendation, or report.

For formal investigation, diagnosis, or recommendation requests, use these headings in this exact order:

INVESTIGATION SUMMARY
CURRENT CONDITION
KEY EVIDENCE
RISK ASSESSMENT
RECOMMENDED ACTIONS
NEXT STEPS

Style requirements:
- Use concise operational language.
- Avoid first-person and chatbot phrasing.
- Do not use these phrases: "I think", "It seems", "I found", "Based on my analysis", "Hope this helps".
- Include Risk Level, Confidence as a percentage, and Reason for recommendation when making a maintenance recommendation.
- Explain recommendations using available evidence from sensor trends, maintenance history, manuals, SOPs, and failure reports.
- Cite uploaded document refs when present.
- Describe RUL only as trend-based RUL.
- Use bullet points with "-".
- If evidence is missing, state "Evidence not uploaded" for that category and specify the required input.

Detected user intent: ${intent}.`,
        },
        { role: "system", content: JSON.stringify(context, null, 2) },
        ...(request.conversationId
          ? conversationMemory.get(request.conversationId)?.slice(-maxConversationMessages) ?? []
          : []),
        { role: "user", content: request.message },
      ],
    }),
    })
  } catch {
    throw new LlmProviderError(
      "LLM provider is unreachable. Check network access and Gemini API availability.",
      503,
    )
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "")
    const message =
      response.status === 429
        ? "Gemini API rate limit reached. Wait for the free-tier quota to reset or use another API key."
        : `LLM provider request failed with ${response.status}${
            details ? `: ${details.slice(0, 240)}` : ""
          }`
    throw new LlmProviderError(message, response.status)
  }
  const data = await response.json()
  const answer = data?.choices?.[0]?.message?.content
  const styledAnswer =
    typeof answer === "string" && answer.trim()
      ? sanitizeIndustrialLanguage(answer)
      : ""
  if (!styledAnswer) {
    throw new LlmProviderError("LLM provider returned an empty response.", 502)
  }
  return {
    answer: styledAnswer,
    generatedBy: "llm" as const,
  }
}

export interface PredictedFailure {
  equipmentId: string
  equipmentName: string
  equipmentType: string
  area: string
  healthScore: number
  rulDays: number | null
  riskScore: number
  riskLevel: Priority
  failureLikelihood: number
  urgencyBand: "immediate" | "7d" | "30d" | "90d" | "low"
  topDrivers: string[]
  worstSensor?: { name: string; current: number; unit: string; threshold: number; trend: string }
}

export function computePredictions(equipment: Equipment[]): PredictedFailure[] {
  const alerts = deriveAlerts(equipment)

  return equipment
    .map((asset) => {
      const risk = computeRisk(asset, alerts)
      const rulDays = estimateEquipmentRulDays(asset)
      const worst = worstSensor(asset)

      // Multi-factor failure likelihood (0–100)
      const healthFactor = Math.max(0, 100 - asset.healthScore) * 0.3
      const rulFactor =
        rulDays === null ? 10 : rulDays <= 7 ? 40 : rulDays <= 30 ? 28 : rulDays <= 90 ? 15 : 5
      const riskFactor = risk.score * 0.25
      const maintenanceFrequency = asset.history.length >= 3 ? 8 : asset.history.length >= 1 ? 4 : 0

      const failureLikelihood = Math.min(100, Math.round(healthFactor + rulFactor + riskFactor + maintenanceFrequency))

      const urgencyBand: PredictedFailure["urgencyBand"] =
        failureLikelihood >= 75 ? "immediate"
          : failureLikelihood >= 55 || (rulDays !== null && rulDays <= 7) ? "7d"
          : failureLikelihood >= 35 || (rulDays !== null && rulDays <= 30) ? "30d"
          : failureLikelihood >= 20 || (rulDays !== null && rulDays <= 90) ? "90d"
          : "low"

      return {
        equipmentId: asset.id,
        equipmentName: asset.name,
        equipmentType: asset.type,
        area: asset.area,
        healthScore: asset.healthScore,
        rulDays,
        riskScore: risk.score,
        riskLevel: risk.level,
        failureLikelihood,
        urgencyBand,
        topDrivers: risk.drivers,
        worstSensor: worst
          ? { name: worst.name, current: worst.current, unit: worst.unit, threshold: worst.threshold, trend: worst.trend }
          : undefined,
      }
    })
    .filter((p) => p.urgencyBand !== "low")
    .sort((a, b) => b.failureLikelihood - a.failureLikelihood)
}

export async function runAgent(request: ChatRequest): Promise<ChatResponse> {
  const data = await loadStore()
  const intent = detectIntent(request.message)
  const asset = inferEquipment(request.message, data.equipment, request.equipmentId)
  const alerts = deriveAlerts(data.equipment)
  const chunks = searchKnowledge(
    `${request.message} ${asset?.name ?? ""}`,
    data.documents,
    asset?.id,
  )
  const risk = asset ? computeRisk(asset, alerts) : undefined
  const spares = asset ? relevantSpares(data.spares, asset.id) : []
  const suggestedPlan = asset && risk ? buildPlan(asset, risk, spares) : undefined

  // --- Similar incidents & root cause analysis ---
  const similarIncidents = asset
    ? findSimilarIncidents(asset, request.message, data.documents, data.operationalRecords)
    : []
  const rootCause = asset
    ? analyzeRootCause(asset, alerts, chunks, similarIncidents, risk)
    : undefined

  const baseDataStep = {
    label: "readPlantData",
    detail: `Loaded ${data.equipment.length} asset(s), ${data.documents.length} document(s), ${data.spares.length} spare record(s)`,
    status: "done" as const,
  }
  const knowledgeStep = {
    label: "searchKnowledgeBase",
    detail: `Retrieved ${chunks.length} relevant document chunk(s)`,
    status: "done" as const,
  }
  const alertStep = {
    label: "deriveAlerts",
    detail: `Derived ${alerts.length} alert(s) from sensor readings`,
    status: "done" as const,
  }
  const riskStep = risk
    ? {
        label: "computeRiskPriority",
        detail: `Risk ${risk.score}/100 → ${risk.level.toUpperCase()}`,
        status: "done" as const,
      }
    : undefined
  const rootCauseStep = rootCause
    ? {
        label: "analyzeRootCause",
        detail: `Root cause confidence ${rootCause.confidence}%${rootCause.failureMode ? ` — ${rootCause.failureMode}` : ""}`,
        status: "done" as const,
      }
    : undefined
  const incidentStep = similarIncidents.length > 0
    ? {
        label: "matchHistoricalIncidents",
        detail: `Found ${similarIncidents.length} similar past incident(s)`,
        status: "done" as const,
      }
    : undefined

  const toolSteps: ToolStep[] =
    intent === "status" || intent === "general"
      ? [
          baseDataStep,
          {
            label: "summarizeOperatingStatus",
            detail: `${asset?.name ?? "No asset"}; ${alerts.length} active alert(s)`,
            status: "done" as const,
          },
          ...(riskStep ? [riskStep] : []),
        ]
      : intent === "create_plan"
        ? [
            baseDataStep,
            ...(riskStep ? [riskStep] : []),
            {
              label: "draftMaintenancePlan",
              detail: suggestedPlan
                ? `${suggestedPlan.priority.toUpperCase()} priority, due ${suggestedPlan.dueDate}`
                : "Plan draft requires indexed equipment data",
              status: "done" as const,
            },
            {
              label: "checkSparesInventory",
              detail: `${spares.length} linked spare record(s)`,
              status: "done" as const,
            },
          ]
        : intent === "spares"
          ? [
              baseDataStep,
              {
                label: "checkSparesInventory",
                detail: `${spares.length} linked spare record(s) for ${asset?.name ?? "selected asset"}`,
                status: "done" as const,
              },
            ]
          : intent === "evidence"
            ? [
                baseDataStep,
                knowledgeStep,
                {
                  label: "getMaintenanceHistory",
                  detail: `${asset?.history.length ?? 0} maintenance history record(s)`,
                  status: "done" as const,
                },
                ...(incidentStep ? [incidentStep] : []),
              ]
            : [
                baseDataStep,
                knowledgeStep,
                alertStep,
                ...(riskStep ? [riskStep] : []),
                ...(rootCauseStep ? [rootCauseStep] : []),
                ...(incidentStep ? [incidentStep] : []),
              ]
  const sensor = asset ? worstSensor(asset) : undefined
  const evidence: EvidenceCard[] = [
    ...(sensor
      ? [
          {
            kind: "chart" as const,
            title: `${sensor.name} trend`,
            subtitle: `${asset?.id} - ${asset?.name}`,
            body: `${sensor.current} ${sensor.unit}`,
            sensor,
          },
        ]
      : []),
    ...chunks.slice(0, 3).map((chunk) => ({
      kind:
        chunk.documentType === "Failure Report" || chunk.documentType === "Operational Log"
          ? ("history" as const)
          : ("document" as const),
      title: chunk.documentTitle,
      subtitle: `${chunk.ref} - ${chunk.heading}`,
      ref: chunk.documentId,
      body: chunk.excerpt,
    })),
    ...(risk
      ? [
          {
            kind: "risk" as const,
            title: `Risk priority: ${risk.level.toUpperCase()}`,
            subtitle: `Score ${risk.score}/100`,
            body: risk.drivers.join(" — "),
          },
        ]
      : []),
    ...(rootCause
      ? [
          {
            kind: "tool" as const,
            title: `Root Cause Analysis (${rootCause.confidence}% confidence)`,
            subtitle: rootCause.failureMode ?? undefined,
            body: rootCause.description,
          },
        ]
      : []),
    ...similarIncidents.slice(0, 2).map((inc) => ({
      kind: "history" as const,
      title: `Similar incident: ${inc.incidentId}`,
      subtitle: `${inc.equipmentType} — ${inc.relevanceScore}% match`,
      body: `Symptoms: ${inc.symptoms.slice(0, 120)}. Root cause: ${inc.rootCause.slice(0, 120)}.`,
      ref: inc.incidentId,
    })),
  ]

  const conversationId = request.conversationId ?? `CONV-${Date.now().toString(36)}`
  const llmResult = await callLlm(
    { ...request, conversationId },
    compactLlmContext(
      asset,
      alerts,
      chunks,
      risk,
      suggestedPlan,
      spares,
      intent,
      data.feedback.slice(0, 5),
      rootCause,
      similarIncidents,
    ),
    intent,
  )

  const nextHistory = [
    ...(conversationMemory.get(conversationId) ?? []),
    { role: "user" as const, content: request.message },
    { role: "assistant" as const, content: llmResult.answer },
  ].slice(-maxConversationMessages)
  conversationMemory.set(conversationId, nextHistory)

  return {
    conversationId,
    equipmentId: asset?.id,
    answer: llmResult.answer,
    toolSteps,
    evidence,
    risk,
    rootCause,
    similarIncidents,
    citations: chunks,
    suggestedPlan,
    generatedBy: llmResult.generatedBy,
  }
}

export async function createPlan(input: SuggestedMaintenancePlan) {
  let created: MaintenancePlan | null = null
  await updateStore((data) => {
    const existing = data.plans.find(
      (plan) => plan.title === input.title && plan.equipmentId === input.equipmentId,
    )
    if (existing) {
      created = existing
      return
    }
    created = {
      id: nextId("PLAN", data.plans),
      title: input.title,
      equipmentId: input.equipmentId,
      equipmentName: input.equipmentName,
      priority: input.priority,
      status: "planned",
      riskScore: input.riskScore,
      dueDate: input.dueDate,
      estimatedDowntimeHours: input.estimatedDowntimeHours,
      source: "AI Investigation",
      summary: input.summary,
      steps: input.steps.map((step, index) => ({
        id: `step-${index + 1}`,
        text: step.text,
        done: false,
      })),
      spares: input.spares,
    }
    data.plans = [created, ...data.plans]
  })
  const plan = created as MaintenancePlan | null
  if (plan) {
    await addLogbook({
      actor: "AI Agent",
      actorType: "ai",
      category: "plan",
      action: "Maintenance plan created",
      detail: `${plan.id} ${plan.title}`,
      equipmentId: plan.equipmentId,
      refId: plan.id,
    })
  }
  return plan
}

export async function updatePlan(
  planId: string,
  updates: { status?: MaintenancePlan["status"]; stepId?: string },
) {
  let updated: MaintenancePlan | null = null
  await updateStore((data) => {
    data.plans = data.plans.map((plan) => {
      if (plan.id !== planId) return plan
      updated = {
        ...plan,
        status: updates.status ?? plan.status,
        steps: updates.stepId
          ? plan.steps.map((step) =>
              step.id === updates.stepId ? { ...step, done: !step.done } : step,
            )
          : updates.status === "completed"
            ? plan.steps.map((step) => ({ ...step, done: true }))
            : plan.steps,
      }
      return updated
    })
  })
  const plan = updated as MaintenancePlan | null
  if (plan && updates.status) {
    await addLogbook({
      actor: "Maintenance Engineer",
      actorType: "human",
      category: updates.status === "completed" ? "work" : "plan",
      action: "Maintenance plan updated",
      detail: `${plan.id} moved to ${updates.status}`,
      equipmentId: plan.equipmentId,
      refId: plan.id,
    })
  }
  return plan
}

export async function createReport(input: ChatResponse) {
  if (!input.equipmentId || !input.risk || !input.suggestedPlan) return null
  const equipmentId = input.equipmentId
  const risk = input.risk
  const suggestedPlan = input.suggestedPlan
  let report: Report | null = null
  await updateStore((data) => {
    const asset = data.equipment.find((item) => item.id === equipmentId)
    report = {
      id: nextId("RPT", data.reports),
      title: `Investigation Report - ${asset?.name ?? equipmentId}`,
      type: "Investigation Report",
      generatedBy: "AI Agent",
      date: new Date().toISOString().slice(0, 10),
      equipmentIds: [equipmentId],
      summary: `Risk ${risk.score}/100 (${risk.level}). Recommended plan: ${suggestedPlan.title}.`,
      sections: [
        { heading: "1. Trigger", body: input.toolSteps.map((step) => step.detail).join("; ") },
        { heading: "2. Evidence", body: input.citations.map((chunk) => `${chunk.documentId} ${chunk.ref}`).join("; ") || "No citations available." },
        { heading: "3. Risk", body: risk.drivers.join("; ") },
        { heading: "4. Recommendation", body: suggestedPlan.summary },
      ],
    }
    data.reports = [report, ...data.reports]
  })
  const created = report as Report | null
  if (created) {
    await addLogbook({
      actor: "AI Agent",
      actorType: "ai",
      category: "investigation",
      action: "Investigation report generated",
      detail: `${created.id} ${created.title}`,
      equipmentId,
      refId: created.id,
    })
  }
  return created
}

export async function saveFeedback(
  input: Omit<FeedbackRecord, "id" | "createdAt">,
) {
  let feedback: FeedbackRecord | null = null
  await updateStore((data) => {
    feedback = {
      id: nextId("FDB", data.feedback),
      createdAt: new Date().toISOString(),
      ...input,
    }
    data.feedback = [feedback, ...data.feedback]
  })
  return feedback as FeedbackRecord | null
}
