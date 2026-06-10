// Demo data for Maintenance Tool — will be replaced by real backend later.

export type HealthStatus = "healthy" | "watch" | "degraded" | "critical"
export type Criticality = "low" | "medium" | "high" | "critical"
export type Priority = "low" | "medium" | "high" | "critical"
export type PlanStatus = "planned" | "in-progress" | "completed"

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
  date: string
  type: "Preventive" | "Corrective" | "Breakdown" | "Inspection"
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
  installedYear: number
  sensors: Sensor[]
  history: MaintenanceRecord[]
}

function genHistory(base: number, drift: number, noise: number, points = 24): SensorPoint[] {
  const out: SensorPoint[] = []
  for (let i = 0; i < points; i++) {
    const hour = (i + 24 - points) % 24
    const v = base + drift * (i / points) + Math.sin(i * 1.7) * noise + Math.cos(i * 0.9) * noise * 0.6
    out.push({ time: `${String(hour).padStart(2, "0")}:00`, value: Math.round(v * 10) / 10 })
  }
  return out
}

export const equipment: Equipment[] = [
  {
    id: "EQ-1001",
    name: "Blast Furnace #2",
    area: "Ironmaking",
    type: "Blast Furnace",
    status: "watch",
    healthScore: 78,
    criticality: "critical",
    rulDays: 46,
    lastMaintenance: "2026-05-12",
    nextScheduled: "2026-07-04",
    manufacturer: "SMS Group",
    installedYear: 2011,
    sensors: [
      { id: "S-01", name: "Hearth Temperature", unit: "°C", current: 1486, nominal: 1480, threshold: 1540, trend: "stable", history: genHistory(1482, 6, 8) },
      { id: "S-02", name: "Cooling Water Flow", unit: "m³/h", current: 612, nominal: 640, threshold: 560, trend: "falling", history: genHistory(640, -30, 6) },
      { id: "S-03", name: "Top Gas Pressure", unit: "bar", current: 2.4, nominal: 2.5, threshold: 2.9, trend: "stable", history: genHistory(2.5, -0.1, 0.05) },
    ],
    history: [
      { id: "M-101", date: "2026-05-12", type: "Preventive", description: "Tuyere inspection and cooling stave check", technician: "R. Sharma", downtimeHours: 6 },
      { id: "M-102", date: "2026-02-20", type: "Corrective", description: "Replaced damaged tuyere #14, hot blast leakage", technician: "A. Mukherjee", downtimeHours: 14 },
      { id: "M-103", date: "2025-11-03", type: "Inspection", description: "Refractory thickness ultrasonic survey", technician: "S. Patel", downtimeHours: 0 },
    ],
  },
  {
    id: "EQ-1002",
    name: "Hot Rolling Mill — Stand 3",
    area: "Rolling",
    type: "Rolling Mill",
    status: "degraded",
    healthScore: 54,
    criticality: "critical",
    rulDays: 18,
    lastMaintenance: "2026-04-02",
    nextScheduled: "2026-06-20",
    manufacturer: "Primetals",
    installedYear: 2014,
    sensors: [
      { id: "S-04", name: "Work Roll Bearing Vibration", unit: "mm/s", current: 7.8, nominal: 3.2, threshold: 9.0, trend: "rising", history: genHistory(4.5, 3.4, 0.4) },
      { id: "S-05", name: "Bearing Temperature (DS)", unit: "°C", current: 86, nominal: 65, threshold: 95, trend: "rising", history: genHistory(68, 18, 2) },
      { id: "S-06", name: "Hydraulic Pressure (AGC)", unit: "bar", current: 208, nominal: 210, threshold: 190, trend: "stable", history: genHistory(210, -2, 2) },
    ],
    history: [
      { id: "M-104", date: "2026-04-02", type: "Preventive", description: "Work roll change and chock lubrication", technician: "V. Singh", downtimeHours: 4 },
      { id: "M-105", date: "2024-09-17", type: "Breakdown", description: "DS work roll bearing seizure — cage fatigue failure. Bearing and chock replaced.", technician: "A. Mukherjee", downtimeHours: 31 },
      { id: "M-106", date: "2024-03-08", type: "Corrective", description: "AGC servo valve replacement, pressure instability", technician: "R. Sharma", downtimeHours: 9 },
    ],
  },
  {
    id: "EQ-1003",
    name: "Continuous Caster #1",
    area: "Steelmaking",
    type: "Slab Caster",
    status: "healthy",
    healthScore: 91,
    criticality: "high",
    rulDays: null,
    lastMaintenance: "2026-05-28",
    nextScheduled: "2026-08-15",
    manufacturer: "Danieli",
    installedYear: 2017,
    sensors: [
      { id: "S-07", name: "Mold Oscillation Amplitude", unit: "mm", current: 6.1, nominal: 6.0, threshold: 7.5, trend: "stable", history: genHistory(6.0, 0.1, 0.1) },
      { id: "S-08", name: "Mold Cooling ΔT", unit: "°C", current: 7.2, nominal: 7.0, threshold: 10.0, trend: "stable", history: genHistory(7.0, 0.2, 0.3) },
    ],
    history: [
      { id: "M-107", date: "2026-05-28", type: "Preventive", description: "Mold copper plate inspection, segment roll alignment", technician: "S. Patel", downtimeHours: 8 },
    ],
  },
  {
    id: "EQ-1004",
    name: "BOF Converter B",
    area: "Steelmaking",
    type: "Basic Oxygen Furnace",
    status: "healthy",
    healthScore: 88,
    criticality: "critical",
    rulDays: null,
    lastMaintenance: "2026-06-01",
    nextScheduled: "2026-09-01",
    manufacturer: "SMS Group",
    installedYear: 2013,
    sensors: [
      { id: "S-09", name: "Trunnion Bearing Temperature", unit: "°C", current: 58, nominal: 55, threshold: 80, trend: "stable", history: genHistory(56, 2, 1.5) },
      { id: "S-10", name: "Lance Cooling Water ΔT", unit: "°C", current: 11.3, nominal: 11.0, threshold: 16.0, trend: "stable", history: genHistory(11, 0.3, 0.4) },
    ],
    history: [
      { id: "M-108", date: "2026-06-01", type: "Inspection", description: "Refractory lining laser scan — 412 heats remaining estimate", technician: "V. Singh", downtimeHours: 2 },
    ],
  },
  {
    id: "EQ-1005",
    name: "Sinter Plant Main Exhaust Fan",
    area: "Agglomeration",
    type: "Induced Draft Fan",
    status: "watch",
    healthScore: 71,
    criticality: "high",
    rulDays: 62,
    lastMaintenance: "2026-03-15",
    nextScheduled: "2026-06-25",
    manufacturer: "Howden",
    installedYear: 2009,
    sensors: [
      { id: "S-11", name: "Impeller Vibration", unit: "mm/s", current: 5.4, nominal: 3.8, threshold: 8.0, trend: "rising", history: genHistory(4.2, 1.2, 0.3) },
      { id: "S-12", name: "Motor Winding Temperature", unit: "°C", current: 92, nominal: 85, threshold: 120, trend: "stable", history: genHistory(88, 4, 2) },
    ],
    history: [
      { id: "M-109", date: "2026-03-15", type: "Corrective", description: "Impeller dust buildup cleaned, dynamic balancing performed", technician: "A. Mukherjee", downtimeHours: 12 },
    ],
  },
  {
    id: "EQ-1006",
    name: "Ladle Crane #4",
    area: "Steelmaking",
    type: "EOT Crane 250t",
    status: "healthy",
    healthScore: 85,
    criticality: "critical",
    rulDays: null,
    lastMaintenance: "2026-05-20",
    nextScheduled: "2026-07-20",
    manufacturer: "Konecranes",
    installedYear: 2015,
    sensors: [
      { id: "S-13", name: "Hoist Motor Current", unit: "A", current: 142, nominal: 140, threshold: 175, trend: "stable", history: genHistory(140, 2, 3) },
      { id: "S-14", name: "Wire Rope Wear Index", unit: "%", current: 22, nominal: 0, threshold: 40, trend: "rising", history: genHistory(18, 4, 0.5) },
    ],
    history: [
      { id: "M-110", date: "2026-05-20", type: "Inspection", description: "Wire rope NDT and brake pad measurement", technician: "S. Patel", downtimeHours: 3 },
    ],
  },
  {
    id: "EQ-1007",
    name: "Reheating Furnace #1",
    area: "Rolling",
    type: "Walking Beam Furnace",
    status: "watch",
    healthScore: 74,
    criticality: "medium",
    rulDays: 90,
    lastMaintenance: "2026-04-18",
    nextScheduled: "2026-07-10",
    manufacturer: "Tenova",
    installedYear: 2012,
    sensors: [
      { id: "S-15", name: "Zone 2 Temperature Deviation", unit: "°C", current: 14, nominal: 5, threshold: 25, trend: "rising", history: genHistory(8, 6, 1.5) },
      { id: "S-16", name: "Skid Pipe Cooling Flow", unit: "m³/h", current: 88, nominal: 92, threshold: 78, trend: "stable", history: genHistory(91, -3, 1) },
    ],
    history: [
      { id: "M-111", date: "2026-04-18", type: "Corrective", description: "Zone 2 burner nozzle replacement — uneven heating pattern", technician: "V. Singh", downtimeHours: 10 },
    ],
  },
  {
    id: "EQ-1008",
    name: "Cold Mill Tandem Line",
    area: "Cold Rolling",
    type: "5-Stand Tandem Mill",
    status: "healthy",
    healthScore: 93,
    criticality: "high",
    rulDays: null,
    lastMaintenance: "2026-06-05",
    nextScheduled: "2026-09-05",
    manufacturer: "Primetals",
    installedYear: 2019,
    sensors: [
      { id: "S-17", name: "Strip Tension Variance", unit: "%", current: 1.8, nominal: 1.5, threshold: 4.0, trend: "stable", history: genHistory(1.6, 0.2, 0.15) },
      { id: "S-18", name: "Backup Roll Vibration", unit: "mm/s", current: 2.1, nominal: 2.0, threshold: 5.5, trend: "stable", history: genHistory(2.0, 0.1, 0.15) },
    ],
    history: [
      { id: "M-112", date: "2026-06-05", type: "Preventive", description: "Scheduled roll change, emulsion system filter swap", technician: "R. Sharma", downtimeHours: 5 },
    ],
  },
]

// ---------------- Maintenance Planner ----------------

export interface PlanStep {
  id: string
  text: string
  done: boolean
}

export interface SparePart {
  name: string
  code: string
  required: number
  inStock: number
  leadTimeDays: number
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
  spares: SparePart[]
}

export const plans: MaintenancePlan[] = [
  {
    id: "PLAN-001",
    title: "Replace DS work roll bearing — Stand 3",
    equipmentId: "EQ-1002",
    equipmentName: "Hot Rolling Mill — Stand 3",
    priority: "critical",
    status: "planned",
    riskScore: 92,
    dueDate: "2026-06-14",
    estimatedDowntimeHours: 12,
    source: "AI Investigation",
    summary:
      "Rising vibration (7.8 mm/s) and bearing temperature (86°C) indicate advanced outer-race wear on the drive-side work roll bearing. Matches 2024 failure signature. Replace before predicted RUL of 18 days.",
    steps: [
      { id: "st-1", text: "Isolate Stand 3, apply LOTO procedure per SOP-RM-007", done: false },
      { id: "st-2", text: "Remove work roll assembly with roll change car", done: false },
      { id: "st-3", text: "Extract DS chock, inspect bearing seat for fretting", done: false },
      { id: "st-4", text: "Install new bearing kit SKF 231/600 with fresh seals", done: false },
      { id: "st-5", text: "Regrease per spec, reassemble and align chock", done: false },
      { id: "st-6", text: "Trial run at low speed, verify vibration < 3.5 mm/s", done: false },
    ],
    spares: [
      { name: "Spherical roller bearing kit", code: "SKF 231/600 CA/W33", required: 1, inStock: 2, leadTimeDays: 45 },
      { name: "Chock seal set", code: "CS-RM3-DS", required: 1, inStock: 4, leadTimeDays: 14 },
    ],
  },
  {
    id: "PLAN-002",
    title: "Cooling stave water flow restoration",
    equipmentId: "EQ-1001",
    equipmentName: "Blast Furnace #2",
    priority: "high",
    status: "in-progress",
    riskScore: 74,
    dueDate: "2026-06-18",
    estimatedDowntimeHours: 8,
    source: "AI Investigation",
    summary:
      "Cooling water flow declined 4.4% over 30 days, likely scaling in stave circuits 8–11. Schedule chemical flushing during next planned stoppage to prevent stave damage.",
    steps: [
      { id: "st-1", text: "Confirm flow deviation with manual ultrasonic flow check", done: true },
      { id: "st-2", text: "Prepare chemical flushing rig and descaling agent", done: true },
      { id: "st-3", text: "Flush circuits 8–11 during planned stoppage", done: false },
      { id: "st-4", text: "Verify flow restored to ≥ 635 m³/h", done: false },
    ],
    spares: [
      { name: "Descaling agent (200L)", code: "CHEM-DSC-200", required: 2, inStock: 5, leadTimeDays: 7 },
    ],
  },
  {
    id: "PLAN-003",
    title: "Sinter fan impeller balancing & wear check",
    equipmentId: "EQ-1005",
    equipmentName: "Sinter Plant Main Exhaust Fan",
    priority: "medium",
    status: "planned",
    riskScore: 58,
    dueDate: "2026-06-25",
    estimatedDowntimeHours: 10,
    source: "Scheduled",
    summary:
      "Vibration trending up since March cleaning. Inspect impeller for erosion wear and re-balance. Liner plates may need replacement at next opportunity.",
    steps: [
      { id: "st-1", text: "Shut down fan, apply LOTO per SOP-SP-003", done: false },
      { id: "st-2", text: "Inspect impeller blades for erosion, measure thickness", done: false },
      { id: "st-3", text: "Perform in-situ dynamic balancing", done: false },
      { id: "st-4", text: "Replace casing liner plates if wear > 40%", done: false },
    ],
    spares: [
      { name: "Casing liner plate set", code: "LP-IDF-09", required: 1, inStock: 1, leadTimeDays: 30 },
    ],
  },
  {
    id: "PLAN-004",
    title: "Zone 2 burner tuning — Reheating Furnace #1",
    equipmentId: "EQ-1007",
    equipmentName: "Reheating Furnace #1",
    priority: "medium",
    status: "planned",
    riskScore: 46,
    dueDate: "2026-07-02",
    estimatedDowntimeHours: 6,
    source: "Manual",
    summary:
      "Zone 2 temperature deviation rising again after April nozzle replacement. Air-fuel ratio drift suspected; tune burners and verify zone uniformity.",
    steps: [
      { id: "st-1", text: "Capture zone thermal profile with portable pyrometer", done: false },
      { id: "st-2", text: "Tune air-fuel ratio on burners B-21 through B-26", done: false },
      { id: "st-3", text: "Verify deviation < 8°C across zone", done: false },
    ],
    spares: [],
  },
  {
    id: "PLAN-005",
    title: "Wire rope replacement — Ladle Crane #4",
    equipmentId: "EQ-1006",
    equipmentName: "Ladle Crane #4",
    priority: "low",
    status: "completed",
    riskScore: 30,
    dueDate: "2026-05-22",
    estimatedDowntimeHours: 5,
    source: "Scheduled",
    summary:
      "Preventive replacement of main hoist wire rope at 22% wear index, ahead of 40% retirement criterion for ladle duty cranes.",
    steps: [
      { id: "st-1", text: "Position crane at maintenance bay", done: true },
      { id: "st-2", text: "Replace main hoist rope, verify reeving", done: true },
      { id: "st-3", text: "Load test at 110% SWL", done: true },
    ],
    spares: [
      { name: "Wire rope 40mm 8xK26WS", code: "WR-LC4-M", required: 1, inStock: 1, leadTimeDays: 60 },
    ],
  },
]

// ---------------- Knowledge Base ----------------

export interface KnowledgeDoc {
  id: string
  title: string
  type: "Manual" | "SOP" | "Failure Report" | "OEM Bulletin"
  equipmentIds: string[]
  pages: number
  updated: string
  summary: string
  sections: { ref: string; heading: string; excerpt: string }[]
}

export const documents: KnowledgeDoc[] = [
  {
    id: "DOC-001",
    title: "Work Roll Bearing Maintenance Manual — Hot Strip Mill",
    type: "Manual",
    equipmentIds: ["EQ-1002"],
    pages: 84,
    updated: "2025-08-10",
    summary: "OEM maintenance manual covering bearing inspection intervals, vibration limits, lubrication schedules and replacement procedures for work roll bearings.",
    sections: [
      { ref: "§4.3", heading: "Vibration limits and alarm thresholds", excerpt: "Sustained RMS vibration above 7.1 mm/s at the chock indicates advanced rolling-element wear. Immediate replacement is recommended when combined with bearing temperature exceeding 80°C under normal rolling load." },
      { ref: "§5.1", heading: "Bearing replacement procedure", excerpt: "Removal of the drive-side chock requires the roll change car and hydraulic extraction tooling. Inspect the bearing seat for fretting corrosion before fitting the new bearing." },
    ],
  },
  {
    id: "DOC-002",
    title: "SOP-RM-007: Stand Isolation & LOTO — Rolling Mill",
    type: "SOP",
    equipmentIds: ["EQ-1002", "EQ-1008"],
    pages: 12,
    updated: "2026-01-22",
    summary: "Lockout-tagout procedure for safe isolation of mill stands before mechanical maintenance.",
    sections: [
      { ref: "Step 3", heading: "Hydraulic isolation", excerpt: "Depressurize the AGC circuit and verify zero pressure on gauge PG-31 before any work on the roll stack." },
    ],
  },
  {
    id: "DOC-003",
    title: "Failure Analysis Report FA-2024-117: Stand 3 Bearing Seizure",
    type: "Failure Report",
    equipmentIds: ["EQ-1002"],
    pages: 22,
    updated: "2024-10-30",
    summary: "Root cause analysis of the September 2024 drive-side work roll bearing seizure at Stand 3, resulting in 31 hours of downtime.",
    sections: [
      { ref: "§2", heading: "Failure signature", excerpt: "Vibration rose from 4.1 to 8.6 mm/s over 19 days, accompanied by bearing temperature climbing from 66°C to 91°C. Root cause: cage fatigue accelerated by lubricant contamination." },
      { ref: "§5", heading: "Recommendations", excerpt: "Institute vibration trend alarms at 6.5 mm/s. Replace bearings proactively when the combined vibration-temperature signature matches this profile." },
    ],
  },
  {
    id: "DOC-004",
    title: "Blast Furnace Cooling System Operation Manual",
    type: "Manual",
    equipmentIds: ["EQ-1001"],
    pages: 130,
    updated: "2025-03-14",
    summary: "Covers stave cooling circuits, water quality requirements, flow monitoring and descaling procedures for BF#2.",
    sections: [
      { ref: "§7.2", heading: "Flow degradation and scaling", excerpt: "A sustained flow reduction exceeding 4% from baseline indicates scaling in the stave circuits. Chemical flushing should be performed before flow drops below 88% of nominal." },
    ],
  },
  {
    id: "DOC-005",
    title: "SOP-SP-003: Induced Draft Fan Maintenance Procedure",
    type: "SOP",
    equipmentIds: ["EQ-1005"],
    pages: 18,
    updated: "2025-09-02",
    summary: "Safe shutdown, inspection and balancing procedure for the sinter plant main exhaust fan.",
    sections: [
      { ref: "Step 5", heading: "Impeller wear assessment", excerpt: "Measure blade thickness at the marked reference points. Replace liner plates when erosion exceeds 40% of original thickness." },
    ],
  },
  {
    id: "DOC-006",
    title: "OEM Bulletin PB-2025-09: AGC Servo Valve Advisory",
    type: "OEM Bulletin",
    equipmentIds: ["EQ-1002", "EQ-1008"],
    pages: 6,
    updated: "2025-09-20",
    summary: "Primetals advisory on early wear in series-D AGC servo valves; updated inspection interval from 12 to 8 months.",
    sections: [
      { ref: "§1", heading: "Affected units", excerpt: "Series-D servo valves manufactured 2022–2024 exhibit accelerated spool wear under high-frequency gauge control duty." },
    ],
  },
  {
    id: "DOC-007",
    title: "Reheating Furnace Burner Tuning Guide",
    type: "Manual",
    equipmentIds: ["EQ-1007"],
    pages: 44,
    updated: "2025-06-30",
    summary: "Burner air-fuel ratio tuning, zone temperature uniformity targets and troubleshooting for walking beam furnaces.",
    sections: [
      { ref: "§3.4", heading: "Zone uniformity targets", excerpt: "Zone temperature deviation should be maintained below 10°C. Deviations above 15°C cause skid marks and rolling defects downstream." },
    ],
  },
  {
    id: "DOC-008",
    title: "Failure Analysis Report FA-2023-089: Sinter Fan Bearing Failure",
    type: "Failure Report",
    equipmentIds: ["EQ-1005"],
    pages: 16,
    updated: "2023-12-12",
    summary: "Analysis of pillow-block bearing failure on the sinter exhaust fan caused by prolonged unbalance from dust accumulation.",
    sections: [
      { ref: "§4", heading: "Lessons learned", excerpt: "Unbalance from dust buildup increases bearing load exponentially. Vibration above 5.0 mm/s should trigger cleaning and balancing within 30 days." },
    ],
  },
]

// ---------------- Scripted AI Investigation ----------------

export interface EvidenceCard {
  kind: "tool" | "document" | "history" | "chart" | "risk"
  title: string
  subtitle?: string
  body: string
  ref?: string
  status?: "running" | "done"
}

export interface ScriptTurn {
  role: "user" | "assistant"
  content: string
  toolSteps?: { label: string; detail: string }[]
  evidence?: EvidenceCard[]
}

export const investigationScript: ScriptTurn[] = [
  {
    role: "user",
    content:
      "Stand 3 of the hot rolling mill is showing high vibration on the drive-side work roll. What's going on and what should we do?",
  },
  {
    role: "assistant",
    content:
      "**Diagnosis: Advanced drive-side work roll bearing wear — likely outer race / rolling element fatigue.**\n\nHere's what I found:\n\n1. **Sensor evidence** — Vibration has risen from 4.5 to 7.8 mm/s over the past 3 weeks, and DS bearing temperature is up to 86°C (nominal 65°C). Both are trending upward together, which points to bearing degradation rather than roll imbalance.\n\n2. **Manual threshold exceeded** — The OEM manual (§4.3) states that sustained vibration above 7.1 mm/s combined with temperature above 80°C indicates advanced rolling-element wear requiring immediate replacement.\n\n3. **Historical match** — This is a near-identical signature to failure FA-2024-117 (Sept 2024), when this same bearing seized after vibration climbed from 4.1 to 8.6 mm/s over 19 days. That event cost **31 hours of downtime**.\n\n**Risk assessment: CRITICAL (92/100)** — critical-class equipment, predicted RUL of ~18 days, and an unplanned failure would halt the entire hot strip line.\n\n**Recommendation:** Schedule a planned bearing replacement within the next 7–10 days. The required bearing kit (SKF 231/600) is **in stock (2 units)** — no procurement delay. A planned replacement takes ~12 hours versus 31+ hours for a breakdown.\n\nShall I create a maintenance plan for this?",
    toolSteps: [
      { label: "getSensorHistory", detail: "Fetched 21-day vibration & temperature trends for EQ-1002" },
      { label: "searchKnowledgeBase", detail: "Found 3 relevant sections in 2 documents" },
      { label: "getMaintenanceHistory", detail: "Matched historical failure FA-2024-117" },
      { label: "checkSparesInventory", detail: "SKF 231/600 — 2 in stock" },
      { label: "computeRiskPriority", detail: "Score 92/100 → CRITICAL" },
    ],
    evidence: [
      {
        kind: "chart",
        title: "Vibration trend — DS work roll bearing",
        subtitle: "EQ-1002 · last 24 readings",
        body: "chart:EQ-1002:S-04",
      },
      {
        kind: "document",
        title: "Work Roll Bearing Maintenance Manual",
        subtitle: "§4.3 — Vibration limits and alarm thresholds",
        ref: "DOC-001",
        body: "Sustained RMS vibration above 7.1 mm/s at the chock indicates advanced rolling-element wear. Immediate replacement is recommended when combined with bearing temperature exceeding 80°C under normal rolling load.",
      },
      {
        kind: "history",
        title: "Failure Analysis FA-2024-117",
        subtitle: "Sept 2024 · Stand 3 bearing seizure · 31h downtime",
        ref: "DOC-003",
        body: "Vibration rose from 4.1 to 8.6 mm/s over 19 days, accompanied by bearing temperature climbing from 66°C to 91°C. Root cause: cage fatigue accelerated by lubricant contamination.",
      },
      {
        kind: "risk",
        title: "Risk priority: CRITICAL",
        subtitle: "Score 92/100",
        body: "Criticality: critical · RUL: ~18 days · Spares: in stock · Downtime if unplanned: 31+ h",
      },
    ],
  },
  {
    role: "user",
    content: "Yes, create the plan. Also — why not just regrease the bearing instead of replacing it?",
  },
  {
    role: "assistant",
    content:
      "**Maintenance plan created: PLAN-001 — \"Replace DS work roll bearing — Stand 3\"** (priority: Critical, due 2026-06-14). You can review the full 6-step procedure in the Planner.\n\n**On regreasing instead of replacing:** that would not be advisable here, for three reasons:\n\n1. **The damage is mechanical, not lubrication-related.** The combined vibration + temperature signature indicates physical wear of the rolling elements or outer race. Regreasing cannot reverse material fatigue — at best it temporarily lowers the temperature while wear continues.\n\n2. **The 2024 failure proves the risk.** In FA-2024-117, the team initially responded with regreasing; the bearing seized 6 days later. The report's §5 recommendation explicitly says to replace proactively when this signature appears.\n\n3. **Economics favor replacement now.** Planned replacement: ~12h downtime with parts in stock. A seizure mid-campaign: 31+ hours, possible chock and roll journal damage, and quality losses on the strip in the mill at failure time.\n\nIf you want, I can also schedule a lubricant contamination analysis on the other stands — the 2024 root cause involved contaminated grease, and it would be cheap insurance.",
    toolSteps: [
      { label: "createMaintenancePlan", detail: "PLAN-001 created with 6 steps, 2 spare parts linked" },
      { label: "searchKnowledgeBase", detail: "Retrieved FA-2024-117 §5 recommendations" },
    ],
    evidence: [
      {
        kind: "tool",
        title: "Plan created: PLAN-001",
        subtitle: "Replace DS work roll bearing — Stand 3",
        body: "6 steps · 12h estimated downtime · Critical priority · Due 2026-06-14 · Spares reserved: SKF 231/600 CA/W33 ×1, chock seal set ×1",
      },
      {
        kind: "document",
        title: "Failure Analysis FA-2024-117",
        subtitle: "§5 — Recommendations",
        ref: "DOC-003",
        body: "Institute vibration trend alarms at 6.5 mm/s. Replace bearings proactively when the combined vibration-temperature signature matches this profile.",
      },
    ],
  },
]

// ---------------- Dashboard aggregates ----------------

export const kpis = {
  assetsMonitored: equipment.length,
  avgHealth: Math.round(equipment.reduce((a, e) => a + e.healthScore, 0) / equipment.length),
  openActions: plans.filter((p) => p.status !== "completed").length,
  predictedFailures30d: equipment.filter((e) => e.rulDays !== null && e.rulDays <= 30).length,
}

export const priorityQueue = plans
  .filter((p) => p.status !== "completed")
  .sort((a, b) => b.riskScore - a.riskScore)

export function getEquipment(id: string): Equipment | undefined {
  return equipment.find((e) => e.id === id)
}

export const statusConfig: Record<HealthStatus, { label: string; dot: string; badge: string }> = {
  healthy: { label: "Healthy", dot: "bg-success", badge: "bg-success/10 text-success border-success/20" },
  watch: { label: "Watch", dot: "bg-warning", badge: "bg-warning/10 text-warning border-warning/20" },
  degraded: { label: "Degraded", dot: "bg-destructive", badge: "bg-destructive/10 text-destructive border-destructive/20" },
  critical: { label: "Critical", dot: "bg-destructive", badge: "bg-destructive text-destructive-foreground border-destructive" },
}

export const priorityConfig: Record<Priority, { label: string; badge: string }> = {
  low: { label: "Low", badge: "bg-muted text-muted-foreground border-border" },
  medium: { label: "Medium", badge: "bg-primary/10 text-primary border-primary/20" },
  high: { label: "High", badge: "bg-warning/10 text-warning border-warning/20" },
  critical: { label: "Critical", badge: "bg-destructive/10 text-destructive border-destructive/20" },
}
