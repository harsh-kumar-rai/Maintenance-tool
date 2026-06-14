import { basename, extname } from "node:path"
import { parse } from "csv-parse/sync"
import mammoth from "mammoth"
import pdfParse from "pdf-parse"
import { addIngestion, addLogbook, loadStore, nextId, updateStore } from "./store.js"
import type {
  Criticality,
  Equipment,
  HealthStatus,
  IngestionRecord,
  KnowledgeDoc,
  MaintenanceRecord,
  OperationalRecord,
  Sensor,
  SensorPoint,
  Severity,
  SparePart,
  StoreData,
} from "./types.js"

export interface UploadFile {
  originalname: string
  mimetype: string
  buffer: Buffer
}

const headerAliases: Record<string, string[]> = {
  equipmentId: ["equipmentid", "equipment_id", "assetid", "asset_id", "id"],
  equipmentName: ["equipmentname", "equipment_name", "assetname", "asset_name", "name"],
  sensorId: ["sensorid", "sensor_id", "tag", "tagid", "instrumentid"],
  sensorName: ["sensorname", "sensor_name", "sensor", "parameter", "metric"],
  value: ["value", "reading", "current", "measurement"],
  time: ["time", "timestamp", "date", "datetime"],
  unit: ["unit", "uom"],
  nominal: ["nominal", "baseline", "normal"],
  threshold: ["threshold", "limit", "alarm_limit"],
  trend: ["trend", "direction"],
  rulDays: ["ruldays", "rul_days", "remainingusefullife", "remaining_useful_life", "remaininglife", "remaining_life"],
  area: ["area", "plantarea", "plant_area", "department"],
  type: ["type", "equipmenttype", "equipment_type", "assettype"],
  status: ["status", "healthstatus", "health_status"],
  healthScore: ["healthscore", "health_score", "health"],
  criticality: ["criticality", "criticalityrating", "priority"],
  manufacturer: ["manufacturer", "make", "oem"],
  installedYear: ["installedyear", "installed_year", "installationyear", "installation_year", "year"],
  lastMaintenance: ["lastmaintenance", "last_maintenance"],
  nextScheduled: ["nextscheduled", "next_scheduled"],
  description: ["description", "details", "remark", "remarks", "failure", "fault", "message", "issue", "symptoms"],
  technician: ["technician", "engineer", "owner"],
  downtimeHours: ["downtimehours", "downtime_hours", "delayhours", "delay_hours"],
  spareName: ["sparename", "spare_name", "part", "partname", "name"],
  code: ["code", "partcode", "part_code", "partid", "part_id", "sku"],
  required: ["required", "minimumstock", "minimum_stock", "qty", "quantity"],
  inStock: ["instock", "in_stock", "stock", "available", "quantity"],
  leadTimeDays: ["leadtimedays", "lead_time_days", "leadtime", "lead_time"],
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function pick(row: Record<string, unknown>, field: keyof typeof headerAliases) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value]),
  )
  for (const alias of headerAliases[field]) {
    const found = normalized.get(normalizeKey(alias))
    if (found !== undefined && found !== null && String(found).trim() !== "") {
      return String(found).trim()
    }
  }
  return ""
}

function numberValue(value: string, fallback = 0) {
  const cleaned = String(value).replace(/,/g, "").trim()
  if (!cleaned) return fallback
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : fallback
}

function normalizedStatus(value: string): HealthStatus {
  const v = value.toLowerCase()
  if (["critical", "degraded", "watch", "healthy"].includes(v)) {
    return v as HealthStatus
  }
  return "watch"
}

function normalizedCriticality(value: string): Criticality {
  const v = value.toLowerCase()
  if (["low", "medium", "high", "critical"].includes(v)) {
    return v as Criticality
  }
  return "medium"
}

function normalizedSeverity(value: string): Severity | undefined {
  const v = value.toLowerCase()
  if (["low", "medium", "high", "critical"].includes(v)) return v as Severity
  return undefined
}

function normalizedTrend(value: string, points: SensorPoint[]): Sensor["trend"] {
  const v = value.toLowerCase()
  if (v === "rising" || v === "falling" || v === "stable") return v
  if (points.length < 2) return "stable"
  const first = points[0].value
  const last = points[points.length - 1].value
  if (last > first) return "rising"
  if (last < first) return "falling"
  return "stable"
}

const steelProcessFiles = [
  "data_arc",
  "data_bulk",
  "data_bulk_time",
  "data_gas",
  "data_temp",
  "data_wire",
  "data_wire_time",
]

function rawKeys(rows: Record<string, unknown>[]) {
  return new Set(rows.flatMap((row) => Object.keys(row).map((key) => key.toLowerCase())))
}

function isSteelProcessCsv(rows: Record<string, unknown>[], fileName: string) {
  const name = basename(fileName, extname(fileName)).toLowerCase()
  const keys = rawKeys(rows)
  const hasKey = keys.has("key")
  return (
    hasKey &&
    (steelProcessFiles.includes(name) ||
      keys.has("температура") ||
      keys.has("активная мощность") ||
      keys.has("реактивная мощность") ||
      keys.has("газ 1") ||
      [...keys].some((key) => key.startsWith("bulk ") || key.startsWith("wire ")))
  )
}

function classifyCsv(rows: Record<string, unknown>[], fileName: string) {
  const keys = new Set(
    rows.flatMap((row) => Object.keys(row).map((key) => normalizeKey(key))),
  )
  const has = (field: keyof typeof headerAliases) =>
    headerAliases[field].some((alias) => keys.has(normalizeKey(alias)))

  if (isSteelProcessCsv(rows, fileName)) return "steel_process" as const
  if (has("equipmentId") && has("healthScore") && keys.has("temperature")) {
    return "sensor_readings" as const
  }
  if (keys.has("incidentid") && keys.has("rootcause")) return "failure_reports" as const
  if (has("sensorId") && has("value")) return "sensor_readings" as const
  if (has("criticality") && has("type") && has("equipmentName")) return "equipment" as const
  if (has("code") && (has("inStock") || has("leadTimeDays"))) return "spares" as const
  if (has("downtimeHours") || has("technician")) return "maintenance_logs" as const
  if (has("description")) return "operational_records" as const
  return "unknown" as const
}

function getByHeader(row: Record<string, unknown>, candidates: string[]) {
  const entries = Object.entries(row)
  for (const candidate of candidates) {
    const found = entries.find(
      ([key]) => key.toLowerCase() === candidate.toLowerCase(),
    )
    if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim()) {
      return String(found[1]).trim()
    }
  }
  return ""
}

function steelTime(row: Record<string, unknown>, candidates: string[]) {
  return getByHeader(row, candidates) || `heat-${getByHeader(row, ["key"]).padStart(6, "0")}`
}

function numericColumnTotal(row: Record<string, unknown>, prefix: string) {
  return Object.entries(row).reduce((total, [key, value]) => {
    if (!key.toLowerCase().startsWith(prefix)) return total
    return total + numberValue(String(value), 0)
  }, 0)
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stdDev(values: number[]) {
  if (values.length <= 1) return 0
  const mean = average(values)
  const variance = average(values.map((value) => (value - mean) ** 2))
  return Math.sqrt(variance)
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function sensorUnit(column: string) {
  const key = column.toLowerCase()
  if (key.includes("temperature")) return "C"
  if (key.includes("vibration")) return "mm/s"
  if (key.includes("pressure")) return "bar"
  if (key.includes("current")) return "A"
  if (key.includes("flow")) return "m3/h"
  return ""
}

function statusFromRiskScore(riskScore: number, healthScore: number): HealthStatus {
  if (riskScore >= 85 || healthScore < 45) return "critical"
  if (riskScore >= 70 || healthScore < 60) return "degraded"
  if (riskScore >= 45 || healthScore < 75) return "watch"
  return "healthy"
}

function upsertSensor(asset: Equipment, sensor: Sensor) {
  const index = asset.sensors.findIndex((item) => item.id === sensor.id)
  if (index >= 0) asset.sensors[index] = sensor
  else asset.sensors.push(sensor)
}

function updateSteelAssetHealth(asset: Equipment) {
  const abnormal = asset.sensors.filter((sensor) =>
    sensor.threshold >= sensor.nominal
      ? sensor.current >= sensor.threshold
      : sensor.current <= sensor.threshold,
  ).length
  asset.status = abnormal > 0 ? "degraded" : "watch"
  asset.healthScore = Math.max(45, 86 - abnormal * 14 - Math.max(0, asset.sensors.length - 2) * 2)
}

function steelAsset(data: StoreData) {
  return upsertEquipment(data, {
    id: "STEEL-LADLE-01",
    name: "Steel Ladle Heating Process",
    area: "Steelmaking",
    type: "Electric Arc / Ladle Furnace Process",
    status: "watch",
    healthScore: 82,
    criticality: "high",
    manufacturer: "Uploaded process dataset",
  })
}

function sensorFromHistory(
  id: string,
  name: string,
  unit: string,
  history: SensorPoint[],
  thresholdMode: "high" | "low",
) {
  const sorted = history
    .filter((point) => Number.isFinite(point.value) && point.value > 0)
    .sort((a, b) => a.time.localeCompare(b.time))
  if (sorted.length === 0) return null

  const values = sorted.map((point) => point.value)
  const nominal = Math.round(average(values) * 100) / 100
  const threshold =
    thresholdMode === "high"
      ? Math.round(nominal * 1.25 * 100) / 100
      : Math.round(nominal * 0.96 * 100) / 100
  const current = sorted[sorted.length - 1].value
  return {
    id,
    name,
    unit,
    current,
    nominal,
    threshold,
    trend: normalizedTrend("", sorted),
    history: sorted,
  } satisfies Sensor
}

function addSteelOperationalRecords(
  rows: Record<string, unknown>[],
  data: StoreData,
  fileName: string,
  description: string,
) {
  const asset = steelAsset(data)
  const cappedRows = rows.slice(0, 500)
  for (const row of cappedRows) {
    data.operationalRecords.push({
      id: nextId("OPR", data.operationalRecords),
      equipmentId: asset.id,
      timestamp: steelTime(row, ["time", "timestamp", "Время", "Время замера"]),
      category: "other",
      description: `${description} for heat ${getByHeader(row, ["key"]) || "unknown"}`,
      raw: row,
    })
  }
  return cappedRows.length
}

function ingestSteelProcessCsv(
  rows: Record<string, unknown>[],
  data: StoreData,
  fileName: string,
) {
  const name = basename(fileName, extname(fileName)).toLowerCase()
  const asset = steelAsset(data)
  let added = 0

  if (name === "data_temp" || rawKeys(rows).has("температура")) {
    const history = rows
      .map((row) => ({
        time: steelTime(row, ["Время замера", "temperature_time", "time", "timestamp"]),
        value: numberValue(getByHeader(row, ["Температура", "temperature", "temp"]), NaN),
      }))
      .filter((point) => Number.isFinite(point.value))
    const sensor = sensorFromHistory("BATH-TEMP", "Steel bath temperature", "C", history, "low")
    if (sensor) {
      upsertSensor(asset, sensor)
      added = history.length
    }
  } else if (name === "data_arc" || rawKeys(rows).has("активная мощность")) {
    const activeHistory = rows
      .map((row) => ({
        time: steelTime(row, ["Начало нагрева дугой", "arc_start", "start", "time"]),
        value: numberValue(getByHeader(row, ["Активная мощность", "active_power"]), NaN),
      }))
      .filter((point) => Number.isFinite(point.value))
    const reactiveHistory = rows
      .map((row) => ({
        time: steelTime(row, ["Конец нагрева дугой", "arc_end", "end", "time"]),
        value: numberValue(getByHeader(row, ["Реактивная мощность", "reactive_power"]), NaN),
      }))
      .filter((point) => Number.isFinite(point.value))
    const active = sensorFromHistory("ARC-ACTIVE-POWER", "Arc active power", "MW", activeHistory, "high")
    const reactive = sensorFromHistory("ARC-REACTIVE-POWER", "Arc reactive power", "MVAr", reactiveHistory, "high")
    if (active) upsertSensor(asset, active)
    if (reactive) upsertSensor(asset, reactive)
    added = activeHistory.length + reactiveHistory.length
  } else if (name === "data_gas" || rawKeys(rows).has("газ 1")) {
    const history = rows
      .map((row) => ({
        time: steelTime(row, ["time", "timestamp"]),
        value: numberValue(getByHeader(row, ["Газ 1", "gas_1", "gas"]), NaN),
      }))
      .filter((point) => Number.isFinite(point.value))
    const sensor = sensorFromHistory("ARGON-GAS-FLOW", "Argon gas flow", "Nm3", history, "high")
    if (sensor) {
      upsertSensor(asset, sensor)
      added = history.length
    }
  } else if (name === "data_bulk") {
    const history = rows
      .map((row) => ({
        time: steelTime(row, ["time", "timestamp"]),
        value: numericColumnTotal(row, "bulk "),
      }))
      .filter((point) => point.value > 0)
    const sensor = sensorFromHistory("BULK-ADDITIVE-TOTAL", "Bulk additive total", "kg", history, "high")
    if (sensor) {
      upsertSensor(asset, sensor)
      added = history.length
    }
  } else if (name === "data_wire") {
    const history = rows
      .map((row) => ({
        time: steelTime(row, ["time", "timestamp"]),
        value: numericColumnTotal(row, "wire "),
      }))
      .filter((point) => point.value > 0)
    const sensor = sensorFromHistory("WIRE-ADDITIVE-TOTAL", "Wire additive total", "kg", history, "high")
    if (sensor) {
      upsertSensor(asset, sensor)
      added = history.length
    }
  } else if (name === "data_bulk_time") {
    added = addSteelOperationalRecords(rows, data, fileName, "Bulk additive timing record")
  } else if (name === "data_wire_time") {
    added = addSteelOperationalRecords(rows, data, fileName, "Wire additive timing record")
  }

  updateSteelAssetHealth(asset)
  return added
}

function upsertEquipment(data: StoreData, incoming: Partial<Equipment> & { id: string }) {
  const existing = data.equipment.find((item) => item.id === incoming.id)
  if (existing) {
    Object.assign(existing, incoming)
    return existing
  }

  const created: Equipment = {
    id: incoming.id,
    name: incoming.name ?? incoming.id,
    area: incoming.area ?? "Unassigned",
    type: incoming.type ?? "Equipment",
    status: incoming.status ?? "watch",
    healthScore: incoming.healthScore ?? 75,
    criticality: incoming.criticality ?? "medium",
    rulDays: incoming.rulDays ?? null,
    lastMaintenance: incoming.lastMaintenance ?? "",
    nextScheduled: incoming.nextScheduled ?? "",
    manufacturer: incoming.manufacturer ?? "",
    installedYear: incoming.installedYear ?? null,
    sensors: incoming.sensors ?? [],
    history: incoming.history ?? [],
  }
  data.equipment.push(created)
  return created
}

function ingestEquipment(rows: Record<string, unknown>[], data: StoreData) {
  let added = 0
  for (const row of rows) {
    const id = pick(row, "equipmentId")
    if (!id) continue
    upsertEquipment(data, {
      id,
      name: pick(row, "equipmentName") || id,
      area: pick(row, "area") || "Unassigned",
      type: pick(row, "type") || "Equipment",
      status: normalizedStatus(pick(row, "status")),
      healthScore: numberValue(pick(row, "healthScore"), 75),
      criticality: normalizedCriticality(pick(row, "criticality")),
      rulDays: pick(row, "rulDays") ? numberValue(pick(row, "rulDays"), NaN) : null,
      lastMaintenance: pick(row, "lastMaintenance"),
      nextScheduled: pick(row, "nextScheduled"),
      manufacturer: pick(row, "manufacturer"),
      installedYear: pick(row, "installedYear")
        ? numberValue(pick(row, "installedYear"), 0)
        : null,
    })
    added += 1
  }
  return added
}

function ingestSensorReadings(rows: Record<string, unknown>[], data: StoreData) {
  if (rows.some((row) => getByHeader(row, ["temperature", "vibration", "pressure", "current", "flow_rate"]))) {
    return ingestWideSensorReadings(rows, data)
  }

  const grouped = new Map<string, SensorPoint[]>()
  const meta = new Map<string, { equipmentId: string; sensorId: string; name: string; unit: string; nominal: number; threshold: number; trend: string }>()

  for (const row of rows) {
    const equipmentId = pick(row, "equipmentId")
    const sensorId = pick(row, "sensorId") || pick(row, "sensorName")
    const rawValue = pick(row, "value")
    if (!equipmentId || !sensorId || !rawValue) continue

    const key = `${equipmentId}::${sensorId}`
    const point = {
      time: pick(row, "time") || new Date().toISOString(),
      value: numberValue(rawValue),
    }
    grouped.set(key, [...(grouped.get(key) ?? []), point])
    meta.set(key, {
      equipmentId,
      sensorId,
      name: pick(row, "sensorName") || sensorId,
      unit: pick(row, "unit"),
      nominal: numberValue(pick(row, "nominal"), point.value),
      threshold: numberValue(pick(row, "threshold"), point.value * 1.2),
      trend: pick(row, "trend"),
    })
  }

  let added = 0
  for (const [key, history] of grouped) {
    const info = meta.get(key)
    if (!info) continue
    const asset = upsertEquipment(data, { id: info.equipmentId })
    history.sort((a, b) => a.time.localeCompare(b.time))
    const current = history[history.length - 1]?.value ?? 0
    const sensor: Sensor = {
      id: info.sensorId,
      name: info.name,
      unit: info.unit,
      current,
      nominal: info.nominal,
      threshold: info.threshold,
      trend: normalizedTrend(info.trend, history),
      history,
    }
    const index = asset.sensors.findIndex((item) => item.id === sensor.id)
    if (index >= 0) asset.sensors[index] = sensor
    else asset.sensors.push(sensor)
    added += history.length
  }

  return added
}

function ingestWideSensorReadings(rows: Record<string, unknown>[], data: StoreData) {
  const ignored = new Set([
    "timestamp",
    "time",
    "date",
    "asset_id",
    "assetid",
    "equipment_id",
    "equipmentid",
    "health_score",
    "healthscore",
    "risk_score",
    "riskscore",
  ])
  const columns = Object.keys(rows[0] ?? {}).filter(
    (key) => !ignored.has(normalizeKey(key)) && !ignored.has(key.toLowerCase()),
  )
  const grouped = new Map<string, SensorPoint[]>()
  const latestMeta = new Map<string, { healthScore?: number; riskScore?: number; timestamp: string }>()

  for (const row of rows) {
    const equipmentId = pick(row, "equipmentId")
    if (!equipmentId) continue
    const timestamp = pick(row, "time") || new Date().toISOString()
    const healthScore = numberValue(getByHeader(row, ["health_score", "healthScore"]), NaN)
    const riskScore = numberValue(getByHeader(row, ["risk_score", "riskScore"]), NaN)
    latestMeta.set(equipmentId, {
      healthScore: Number.isFinite(healthScore) ? healthScore : undefined,
      riskScore: Number.isFinite(riskScore) ? riskScore : undefined,
      timestamp,
    })

    for (const column of columns) {
      const raw = getByHeader(row, [column])
      if (!raw) continue
      const value = numberValue(raw, NaN)
      if (!Number.isFinite(value)) continue
      const key = `${equipmentId}::${column}`
      grouped.set(key, [...(grouped.get(key) ?? []), { time: timestamp, value }])
    }
  }

  let added = 0
  for (const [key, history] of grouped) {
    const [equipmentId, column] = key.split("::")
    const asset = upsertEquipment(data, { id: equipmentId })
    history.sort((a, b) => a.time.localeCompare(b.time))
    const values = history.map((point) => point.value)
    const nominal = Math.round(average(values) * 100) / 100
    const sigma = stdDev(values)
    const threshold = Math.round((nominal + Math.max(sigma * 2.2, Math.abs(nominal) * 0.08)) * 100) / 100
    const current = history[history.length - 1]?.value ?? 0
    upsertSensor(asset, {
      id: normalizeKey(column).toUpperCase(),
      name: titleCase(column),
      unit: sensorUnit(column),
      current,
      nominal,
      threshold,
      trend: normalizedTrend("", history),
      history,
    })
    added += history.length
  }

  for (const [equipmentId, meta] of latestMeta) {
    const asset = upsertEquipment(data, { id: equipmentId })
    if (meta.healthScore !== undefined) asset.healthScore = Math.round(meta.healthScore)
    if (meta.riskScore !== undefined) {
      asset.status = statusFromRiskScore(meta.riskScore, asset.healthScore)
      asset.rulDays =
        meta.riskScore >= 85
          ? 7
          : meta.riskScore >= 70
            ? 21
            : meta.riskScore >= 45
              ? 60
              : null
    }
  }

  return added
}

function ingestMaintenanceLogs(rows: Record<string, unknown>[], data: StoreData) {
  let added = 0
  for (const row of rows) {
    const equipmentId = pick(row, "equipmentId")
    const issue = getByHeader(row, ["issue"])
    const rootCause = getByHeader(row, ["root_cause", "rootCause"])
    const action = getByHeader(row, ["action_taken", "actionTaken"])
    const description =
      pick(row, "description") ||
      [issue, rootCause ? `Root cause: ${rootCause}` : "", action ? `Action: ${action}` : ""]
        .filter(Boolean)
        .join(". ")
    if (!equipmentId || !description) continue

    const record: MaintenanceRecord = {
      id: getByHeader(row, ["record_id", "recordId"]) || nextId("MNT", data.equipment.flatMap((item) => item.history)),
      equipmentId,
      date: pick(row, "time") || new Date().toISOString().slice(0, 10),
      type: "Incident",
      description,
      technician: pick(row, "technician"),
      downtimeHours: numberValue(pick(row, "downtimeHours")),
    }
    const asset = upsertEquipment(data, { id: equipmentId })
    asset.history = [record, ...asset.history]
    added += 1
  }
  return added
}

function ingestSpares(rows: Record<string, unknown>[], data: StoreData) {
  let added = 0
  for (const row of rows) {
    const equipmentId = pick(row, "equipmentId")
    const equipmentType = getByHeader(row, ["equipment_type", "equipmentType", "Equipment"])
    const code = pick(row, "code")
    const name = pick(row, "spareName")
    if (!code) continue

    const targetIds = equipmentId
      ? [equipmentId]
      : data.equipment
          .filter((asset) => normalizeKey(asset.type) === normalizeKey(equipmentType))
          .map((asset) => asset.id)
    if (targetIds.length === 0) continue

    for (const id of targetIds) {
      const spare: SparePart = {
        equipmentId: id,
        code,
        name: name || code,
        required: numberValue(pick(row, "required"), 1),
        inStock: numberValue(pick(row, "inStock")),
        leadTimeDays: numberValue(pick(row, "leadTimeDays")),
      }
      const index = data.spares.findIndex(
        (item) => item.equipmentId === id && item.code === code,
      )
      if (index >= 0) data.spares[index] = spare
      else data.spares.push(spare)
      added += 1
    }
  }
  return added
}

function linkedEquipmentIdsByType(equipmentType: string, data: StoreData) {
  const normalized = normalizeKey(equipmentType)
  if (!normalized) return []
  return data.equipment
    .filter(
      (asset) =>
        normalizeKey(asset.type).includes(normalized) ||
        normalized.includes(normalizeKey(asset.type)) ||
        normalizeKey(asset.name).includes(normalized),
    )
    .map((asset) => asset.id)
}

function ingestFailureReports(rows: Record<string, unknown>[], data: StoreData) {
  let added = 0
  for (const row of rows) {
    const incidentId = getByHeader(row, ["Incident_ID", "incident_id", "id"]) || nextId("INC", data.operationalRecords)
    const equipmentType = getByHeader(row, ["Equipment", "equipment_type", "equipment"])
    const symptoms = getByHeader(row, ["Symptoms", "symptoms"])
    const rootCause = getByHeader(row, ["Root_Cause", "root_cause"])
    const correctiveAction = getByHeader(row, ["Corrective_Action", "corrective_action"])
    const lessons = getByHeader(row, ["Lessons_Learned", "lessons_learned"])
    const downtime = numberValue(getByHeader(row, ["Downtime_Hours", "downtime_hours"]), 0)
    if (!equipmentType && !symptoms && !rootCause) continue

    const equipmentIds = linkedEquipmentIdsByType(equipmentType, data)
    const sections = [
      { ref: "symptoms", heading: "Symptoms", excerpt: symptoms },
      { ref: "root-cause", heading: "Root Cause", excerpt: rootCause },
      { ref: "corrective-action", heading: "Corrective Action", excerpt: correctiveAction },
      { ref: "lessons-learned", heading: "Lessons Learned", excerpt: lessons },
    ].filter((section) => section.excerpt)

    data.documents.push({
      id: `FAIL-${incidentId}`,
      title: `${incidentId} - ${equipmentType || "Failure Report"}`,
      type: "Failure Report",
      equipmentIds,
      pages: 1,
      updated: new Date().toISOString().slice(0, 10),
      summary: [symptoms, rootCause, correctiveAction].filter(Boolean).join(" "),
      sections,
    })

    data.operationalRecords.push({
      id: incidentId,
      equipmentId: equipmentIds[0],
      category: "incident",
      severity: downtime >= 8 ? "critical" : downtime >= 4 ? "high" : "medium",
      description: `${equipmentType}: ${symptoms}. Root cause: ${rootCause}. Action: ${correctiveAction}.`,
      raw: row,
    })
    added += 1
  }
  return added
}

function ingestOperationalRecords(rows: Record<string, unknown>[], data: StoreData) {
  let added = 0
  for (const row of rows) {
    const description = pick(row, "description")
    if (!description) continue
    const record: OperationalRecord = {
      id: nextId("OPR", data.operationalRecords),
      equipmentId: pick(row, "equipmentId") || undefined,
      timestamp: pick(row, "time") || undefined,
      category: description.toLowerCase().includes("delay")
        ? "delay"
        : description.toLowerCase().includes("fault")
          ? "fault"
          : description.toLowerCase().includes("anomaly")
            ? "anomaly"
            : "incident",
      severity: normalizedSeverity(String(row.severity ?? "")),
      description,
      raw: row,
    }
    data.operationalRecords.push(record)
    added += 1
  }
  return added
}

function splitSections(text: string) {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return []
  const chunks: string[] = []
  for (let i = 0; i < clean.length; i += 900) {
    chunks.push(clean.slice(i, i + 900).trim())
  }
  return chunks.map((excerpt, index) => ({
    ref: `chunk-${index + 1}`,
    heading: index === 0 ? "Uploaded document text" : `Continuation ${index + 1}`,
    excerpt,
  }))
}

function inferDocType(fileName: string, text: string): KnowledgeDoc["type"] {
  const name = fileName.toLowerCase()
  const source = `${fileName} ${text.slice(0, 1000)}`.toLowerCase()
  if (name.includes("sop") || name.includes("procedure")) return "SOP"
  if (name.includes("manual")) return "Manual"
  if (name.includes("failure") || name.includes("incident")) return "Failure Report"
  if (source.includes("sop") || source.includes("procedure")) return "SOP"
  if (source.includes("manual")) return "Manual"
  if (source.includes("failure") || source.includes("root cause")) return "Failure Report"
  if (source.includes("bulletin") || source.includes("advisory")) return "OEM Bulletin"
  if (source.includes("log") || source.includes("delay") || source.includes("incident")) {
    return "Operational Log"
  }
  if (source.includes("manual")) return "Manual"
  return "Uploaded Document"
}

function linkedEquipmentIds(text: string, data: StoreData) {
  const lower = text.toLowerCase()
  const normalized = normalizeKey(text)
  return data.equipment
    .filter(
      (asset) =>
        lower.includes(asset.id.toLowerCase()) ||
        lower.includes(asset.name.toLowerCase()) ||
        lower.includes(asset.type.toLowerCase()) ||
        normalized.includes(normalizeKey(asset.name)) ||
        normalized.includes(normalizeKey(asset.type)),
    )
    .map((asset) => asset.id)
}

async function extractText(file: UploadFile) {
  const ext = extname(file.originalname).toLowerCase()
  if (ext === ".pdf" || file.mimetype === "application/pdf") {
    const parsed = await pdfParse(file.buffer)
    return { text: parsed.text, pages: parsed.numpages || 1 }
  }
  if (ext === ".docx") {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer })
    return { text: parsed.value, pages: 1 }
  }
  return { text: file.buffer.toString("utf8"), pages: 1 }
}

async function ingestDocument(file: UploadFile, data: StoreData) {
  const { text, pages } = await extractText(file)
  const sections = splitSections(text)
  if (sections.length === 0) return 0

  const doc: KnowledgeDoc = {
    id: nextId("DOC", data.documents),
    title: basename(file.originalname, extname(file.originalname)),
    type: inferDocType(file.originalname, text),
    equipmentIds: linkedEquipmentIds(`${file.originalname} ${text}`, data),
    pages,
    updated: new Date().toISOString().slice(0, 10),
    summary: sections[0].excerpt.slice(0, 240),
    sections,
  }
  data.documents = [doc, ...data.documents]
  return sections.length
}

function parseCsv(buffer: Buffer) {
  return parse(buffer.toString("utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, unknown>[]
}

export async function ingestFile(file: UploadFile) {
  const ext = extname(file.originalname).toLowerCase()
  let record: IngestionRecord | null = null

  try {
    if (ext === ".csv" || file.mimetype.includes("csv")) {
      const rows = parseCsv(file.buffer)
      const kind = classifyCsv(rows, file.originalname)
      let recordsAdded = 0
      await updateStore((data) => {
        if (kind === "equipment") recordsAdded = ingestEquipment(rows, data)
        else if (kind === "sensor_readings") recordsAdded = ingestSensorReadings(rows, data)
        else if (kind === "maintenance_logs") recordsAdded = ingestMaintenanceLogs(rows, data)
        else if (kind === "spares") recordsAdded = ingestSpares(rows, data)
        else if (kind === "failure_reports") recordsAdded = ingestFailureReports(rows, data)
        else if (kind === "operational_records") recordsAdded = ingestOperationalRecords(rows, data)
        else if (kind === "steel_process") recordsAdded = ingestSteelProcessCsv(rows, data, file.originalname)
      })
      record = await addIngestion({
        fileName: file.originalname,
        kind,
        recordsAdded,
        status: recordsAdded > 0 ? "indexed" : "skipped",
        message:
          recordsAdded > 0
            ? `Indexed ${recordsAdded} ${kind.replace("_", " ")} record(s).`
            : "No supported records found in CSV.",
      })
    } else {
      let recordsAdded = 0
      await updateStore(async (data) => {
        recordsAdded = await ingestDocument(file, data)
      })
      record = await addIngestion({
        fileName: file.originalname,
        kind: "document",
        recordsAdded,
        status: recordsAdded > 0 ? "indexed" : "skipped",
        message:
          recordsAdded > 0
            ? `Indexed ${recordsAdded} document chunk(s).`
            : "No readable text found in document.",
      })
    }
  } catch (error) {
    record = await addIngestion({
      fileName: file.originalname,
      kind: "unknown",
      recordsAdded: 0,
      status: "failed",
      message: error instanceof Error ? error.message : "Unable to ingest file.",
    })
  }

  const ingestion = record as IngestionRecord | null
  if (ingestion?.status === "indexed") {
    await addLogbook({
      actor: "System",
      actorType: "system",
      category: "knowledge",
      action: "Real data ingested",
      detail: `${ingestion.fileName}: ${ingestion.message}`,
      refId: ingestion.id,
    })
  }

  return ingestion
}

export async function getInputSummary() {
  const data = await loadStore()
  return {
    equipment: data.equipment.length,
    sensors: data.equipment.reduce((count, asset) => count + asset.sensors.length, 0),
    documents: data.documents.length,
    spares: data.spares.length,
    maintenanceLogs: data.equipment.reduce((count, asset) => count + asset.history.length, 0),
    operationalRecords: data.operationalRecords.length,
    ingestions: data.ingestions,
  }
}
