export type HealthStatus = "healthy" | "watch" | "degraded" | "critical"
export type Criticality = "low" | "medium" | "high" | "critical"
export type Priority = "low" | "medium" | "high" | "critical"
export type PlanStatus = "planned" | "in-progress" | "completed"
export type Severity = "low" | "medium" | "high" | "critical"

export interface SensorPoint {
  time: string
  value: number
}

export interface Sensor {
  id: string
  name: string
  unit: string
  current: number
  nominal: number
  threshold: number
  trend: "stable" | "rising" | "falling"
  history: SensorPoint[]
}

export interface MaintenanceRecord {
  id: string
  equipmentId: string
  date: string
  type: "Preventive" | "Corrective" | "Breakdown" | "Inspection" | "Incident"
  description: string
  technician: string
  downtimeHours: number
}

export interface Equipment {
  id: string
  name: string
  area: string
  type: string
  status: HealthStatus
  healthScore: number
  criticality: Criticality
  rulDays: number | null
  lastMaintenance: string
  nextScheduled: string
  manufacturer: string
  installedYear: number | null
  sensors: Sensor[]
  history: MaintenanceRecord[]
}

export interface SparePart {
  equipmentId: string
  name: string
  code: string
  required: number
  inStock: number
  leadTimeDays: number
}

export interface PlanStep {
  id: string
  text: string
  done: boolean
}

export interface MaintenancePlan {
  id: string
  title: string
  equipmentId: string
  equipmentName: string
  priority: Priority
  status: PlanStatus
  riskScore: number
  dueDate: string
  estimatedDowntimeHours: number
  source: "AI Investigation" | "Scheduled" | "Manual"
  summary: string
  steps: PlanStep[]
  spares: Omit<SparePart, "equipmentId">[]
}

export interface KnowledgeDoc {
  id: string
  title: string
  type: "Manual" | "SOP" | "Failure Report" | "OEM Bulletin" | "Operational Log" | "Uploaded Document"
  equipmentIds: string[]
  pages: number
  updated: string
  summary: string
  sections: { ref: string; heading: string; excerpt: string }[]
}

export interface KnowledgeChunk {
  id: string
  documentId: string
  documentTitle: string
  documentType: KnowledgeDoc["type"]
  equipmentIds: string[]
  ref: string
  heading: string
  excerpt: string
  score: number
}

export interface Alert {
  id: string
  equipmentId: string
  equipmentName: string
  sensorId: string
  sensorName: string
  severity: Severity
  title: string
  message: string
  value: number
  unit: string
  threshold: number
  trend: Sensor["trend"]
  rulDays: number | null
  detectedAt: string
}

export interface EvidenceCard {
  kind: "tool" | "document" | "history" | "chart" | "risk"
  title: string
  subtitle?: string
  body: string
  ref?: string
  status?: "running" | "done"
  sensor?: Sensor
}

export interface ToolStep {
  label: string
  detail: string
  status?: "running" | "done"
}

export interface RiskAssessment {
  score: number
  level: Priority
  drivers: string[]
}

export interface RootCauseAnalysis {
  description: string
  confidence: number
  supportingEvidence: string[]
  failureMode?: string
}

export interface HistoricalIncident {
  incidentId: string
  equipmentType: string
  symptoms: string
  rootCause: string
  correctiveAction: string
  relevanceScore: number
}

export interface SuggestedMaintenancePlan {
  title: string
  equipmentId: string
  equipmentName: string
  priority: Priority
  riskScore: number
  dueDate: string
  estimatedDowntimeHours: number
  summary: string
  steps: { text: string }[]
  spares: Omit<SparePart, "equipmentId">[]
}

export interface ChatRequest {
  message: string
  equipmentId?: string
  conversationId?: string
  feedbackContext?: string
}

export interface ChatResponse {
  conversationId: string
  equipmentId?: string
  answer: string
  toolSteps: ToolStep[]
  evidence: EvidenceCard[]
  risk?: RiskAssessment
  rootCause?: RootCauseAnalysis
  similarIncidents: HistoricalIncident[]
  citations: KnowledgeChunk[]
  suggestedPlan?: SuggestedMaintenancePlan
  generatedBy: "llm"
}

export interface Report {
  id: string
  title: string
  type: "Investigation Report" | "Weekly Summary" | "Monthly Reliability"
  generatedBy: "AI Agent" | "System"
  date: string
  equipmentIds: string[]
  summary: string
  sections: { heading: string; body: string }[]
}

export type LogCategory = "investigation" | "plan" | "work" | "system" | "knowledge"

export interface LogbookEntry {
  id: string
  timestamp: string
  actor: string
  actorType: "ai" | "human" | "system"
  category: LogCategory
  action: string
  detail: string
  equipmentId?: string
  refId?: string
}

export interface FeedbackRecord {
  id: string
  conversationId?: string
  equipmentId?: string
  rating: "up" | "down"
  message?: string
  correction?: string
  createdAt: string
}

export interface OperationalRecord {
  id: string
  equipmentId?: string
  timestamp?: string
  category: "delay" | "fault" | "incident" | "anomaly" | "other"
  severity?: Severity
  description: string
  raw: Record<string, unknown>
}

export interface IngestionRecord {
  id: string
  fileName: string
  kind: "equipment" | "sensor_readings" | "maintenance_logs" | "spares" | "document" | "failure_reports" | "operational_records" | "steel_process" | "unknown"
  recordsAdded: number
  status: "indexed" | "skipped" | "failed"
  message: string
  createdAt: string
}

export interface StoreData {
  equipment: Equipment[]
  documents: KnowledgeDoc[]
  spares: SparePart[]
  plans: MaintenancePlan[]
  reports: Report[]
  logbook: LogbookEntry[]
  feedback: FeedbackRecord[]
  operationalRecords: OperationalRecord[]
  ingestions: IngestionRecord[]
}
