import assert from "node:assert/strict"
import test from "node:test"
import {
  buildPlan,
  computeRisk,
  estimateEquipmentRulDays,
  estimateSensorRulDays,
  searchKnowledge,
} from "../src/engine.ts"
import type { Alert, Equipment, KnowledgeDoc, Sensor } from "../src/types.ts"

const risingTemperature: Sensor = {
  id: "TMP-01",
  name: "Bearing temperature",
  unit: "C",
  current: 80,
  nominal: 60,
  threshold: 100,
  trend: "rising",
  history: [
    { time: "2026-06-01T00:00:00Z", value: 70 },
    { time: "2026-06-02T00:00:00Z", value: 75 },
    { time: "2026-06-03T00:00:00Z", value: 80 },
  ],
}

const asset: Equipment = {
  id: "EQ-100",
  name: "Critical Mill Asset",
  area: "Rolling Mill",
  type: "Hot Rolling Stand",
  status: "degraded",
  healthScore: 62,
  criticality: "critical",
  rulDays: null,
  lastMaintenance: "2026-05-01",
  nextScheduled: "2026-07-01",
  manufacturer: "OEM",
  installedYear: 2018,
  sensors: [risingTemperature],
  history: [],
}

test("estimates trend-based RUL from sensor slope", () => {
  assert.equal(estimateSensorRulDays(risingTemperature), 4)
  assert.equal(estimateEquipmentRulDays(asset), 4)
})

test("computes high risk from criticality, poor health and short RUL", () => {
  const riskyAsset: Equipment = { ...asset, healthScore: 35 }
  const alerts: Alert[] = [
    {
      id: "ALT-1",
      equipmentId: asset.id,
      equipmentName: asset.name,
      sensorId: risingTemperature.id,
      sensorName: risingTemperature.name,
      severity: "critical",
      title: "Bearing warning",
      message: "Temperature rising",
      value: 80,
      unit: "C",
      threshold: 100,
      trend: "rising",
      rulDays: 4,
      detectedAt: "2026-06-12T00:00:00Z",
    },
  ]

  const risk = computeRisk(riskyAsset, alerts)
  assert.equal(risk.level, "critical")
  assert.ok(risk.score >= 85)
  assert.ok(risk.drivers.some((driver) => driver.includes("RUL")))
})

test("ranks matching knowledge chunks with equipment-specific boost", () => {
  const docs: KnowledgeDoc[] = [
    {
      id: "DOC-1",
      title: "General pump manual",
      type: "Manual",
      equipmentIds: [],
      pages: 1,
      updated: "2026-06-01",
      summary: "Lubrication notes",
      sections: [
        {
          ref: "chunk-1",
          heading: "Pump lubrication",
          excerpt: "Grease pump bearings after inspection.",
        },
      ],
    },
    {
      id: "DOC-2",
      title: "Critical Mill Asset bearing SOP",
      type: "SOP",
      equipmentIds: ["EQ-100"],
      pages: 2,
      updated: "2026-06-01",
      summary: "Bearing temperature response",
      sections: [
        {
          ref: "chunk-1",
          heading: "High temperature response",
          excerpt: "Inspect bearing, oil film, alignment and cooling before restart.",
        },
      ],
    },
  ]

  const results = searchKnowledge("bearing temperature inspection", docs, "EQ-100")
  assert.equal(results[0].documentId, "DOC-2")
})

test("creates a suggested maintenance plan from risk and spares", () => {
  const plan = buildPlan(
    asset,
    { score: 91, level: "critical", drivers: ["short RUL"] },
    [{ code: "BRG-9", name: "Roll bearing", required: 1, inStock: 1, leadTimeDays: 0 }],
  )

  assert.equal(plan.equipmentId, "EQ-100")
  assert.equal(plan.priority, "critical")
  assert.ok(plan.steps.length >= 4)
  assert.equal(plan.spares[0].code, "BRG-9")
})
