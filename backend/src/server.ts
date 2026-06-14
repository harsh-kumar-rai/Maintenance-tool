import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import cors from "cors"
import { config } from "dotenv"
import express from "express"
import multer from "multer"
import {
  computePredictions,
  computeRisk,
  createPlan,
  createReport,
  deriveAlerts,
  runAgent,
  saveFeedback,
  updatePlan,
} from "./engine.js"
import { getInputSummary, ingestFile } from "./ingest.js"
import { clearDocuments, deleteDocument, loadStore, resetStore } from "./store.js"
import type { ChatRequest, ChatResponse, SuggestedMaintenancePlan } from "./types.js"

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") })

const app = express()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
})

const port = Number(process.env.PORT ?? 4000)
const frontendOrigin =
  process.env.FRONTEND_ORIGIN ?? process.env.CORS_ORIGIN ?? "http://localhost:3000"

app.use(cors({ origin: frontendOrigin, credentials: false }))
app.use(express.json({ limit: "5mb" }))

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "maintenance-wizard-backend" })
})

app.get("/api/inputs", async (_req, res, next) => {
  try {
    res.json(await getInputSummary())
  } catch (error) {
    next(error)
  }
})

app.post("/api/ingest", upload.array("files"), async (req, res, next) => {
  try {
    const files = (req.files ?? []) as Express.Multer.File[]
    const results = []
    for (const file of files) {
      results.push(await ingestFile(file))
    }
    res.json({ results, summary: await getInputSummary() })
  } catch (error) {
    next(error)
  }
})

app.get("/api/equipment", async (_req, res, next) => {
  try {
    const store = await loadStore()
    res.json({ equipment: store.equipment, alerts: deriveAlerts(store.equipment) })
  } catch (error) {
    next(error)
  }
})

app.get("/api/equipment/:id", async (req, res, next) => {
  try {
    const store = await loadStore()
    const equipment = store.equipment.find((asset) => asset.id === req.params.id)
    if (!equipment) {
      res.status(404).json({ error: "Equipment not found" })
      return
    }
    const documents = store.documents.filter((doc) =>
      doc.equipmentIds.includes(equipment.id),
    )
    const alerts = deriveAlerts([equipment])
    const risk = computeRisk(equipment, alerts)
    const spares = store.spares.filter(
      (sp) => sp.equipmentId === equipment.id || sp.equipmentId === equipment.type,
    )
    res.json({ equipment, documents, alerts, risk, spares })
  } catch (error) {
    next(error)
  }
})

app.get("/api/alerts", async (_req, res, next) => {
  try {
    const store = await loadStore()
    res.json({ alerts: deriveAlerts(store.equipment) })
  } catch (error) {
    next(error)
  }
})

app.get("/api/predictions", async (_req, res, next) => {
  try {
    const store = await loadStore()
    res.json({ predictions: computePredictions(store.equipment) })
  } catch (error) {
    next(error)
  }
})

app.get("/api/documents", async (_req, res, next) => {
  try {
    const store = await loadStore()
    res.json({ documents: store.documents })
  } catch (error) {
    next(error)
  }
})

app.delete("/api/documents/:id", async (req, res, next) => {
  try {
    const removed = await deleteDocument(req.params.id)
    if (!removed) {
      res.status(404).json({ error: "Document not found" })
      return
    }
    res.json({ ok: true, summary: await getInputSummary() })
  } catch (error) {
    next(error)
  }
})

app.delete("/api/documents", async (_req, res, next) => {
  try {
    await clearDocuments()
    res.json({ ok: true, summary: await getInputSummary() })
  } catch (error) {
    next(error)
  }
})

app.delete("/api/data", async (_req, res, next) => {
  try {
    await resetStore()
    res.json({ ok: true, summary: await getInputSummary() })
  } catch (error) {
    next(error)
  }
})

app.post("/api/chat", async (req, res, next) => {
  try {
    const body = req.body as ChatRequest
    if (!body.message?.trim()) {
      res.status(400).json({ error: "message is required" })
      return
    }
    res.json(await runAgent(body))
  } catch (error) {
    next(error)
  }
})

app.get("/api/plans", async (_req, res, next) => {
  try {
    const store = await loadStore()
    res.json({ plans: store.plans })
  } catch (error) {
    next(error)
  }
})

app.post("/api/plans", async (req, res, next) => {
  try {
    const body = req.body as SuggestedMaintenancePlan
    if (!body.title || !body.equipmentId) {
      res.status(400).json({ error: "title and equipmentId are required" })
      return
    }
    res.json({ plan: await createPlan(body) })
  } catch (error) {
    next(error)
  }
})

app.patch("/api/plans/:id", async (req, res, next) => {
  try {
    const plan = await updatePlan(req.params.id, req.body)
    if (!plan) {
      res.status(404).json({ error: "Plan not found" })
      return
    }
    res.json({ plan })
  } catch (error) {
    next(error)
  }
})

app.get("/api/reports", async (_req, res, next) => {
  try {
    const store = await loadStore()
    res.json({ reports: store.reports, logbook: store.logbook })
  } catch (error) {
    next(error)
  }
})

app.post("/api/reports", async (req, res, next) => {
  try {
    const body = req.body as ChatResponse
    const report = await createReport(body)
    if (!report) {
      res.status(400).json({ error: "complete investigation response is required" })
      return
    }
    res.json({ report })
  } catch (error) {
    next(error)
  }
})

app.post("/api/feedback", async (req, res, next) => {
  try {
    if (req.body.rating !== "up" && req.body.rating !== "down") {
      res.status(400).json({ error: "rating must be up or down" })
      return
    }
    res.json({ feedback: await saveFeedback(req.body) })
  } catch (error) {
    next(error)
  }
})

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error)
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Internal server error",
    })
  },
)

app.listen(port, () => {
  console.log(`Maintenance Wizard backend listening on http://localhost:${port}`)
})
