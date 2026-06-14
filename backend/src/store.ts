import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import type {
  IngestionRecord,
  LogbookEntry,
  MaintenancePlan,
  Report,
  StoreData,
} from "./types.js"

const dataFile = resolve(process.env.DATA_FILE ?? "data/store.json")

function emptyStore(): StoreData {
  return {
    equipment: [],
    documents: [],
    spares: [],
    plans: [],
    reports: [],
    logbook: [],
    feedback: [],
    operationalRecords: [],
    ingestions: [],
  }
}

let cache: StoreData | null = null

export async function loadStore() {
  if (cache) return cache

  try {
    const raw = await readFile(dataFile, "utf8")
    cache = { ...emptyStore(), ...JSON.parse(raw) } as StoreData
  } catch {
    cache = emptyStore()
  }

  return cache
}

export async function saveStore(data: StoreData) {
  cache = data
  await mkdir(dirname(dataFile), { recursive: true })
  await writeFile(dataFile, JSON.stringify(data, null, 2), "utf8")
}

export async function updateStore(
  mutator: (data: StoreData) => void | Promise<void>,
) {
  const data = await loadStore()
  await mutator(data)
  await saveStore(data)
  return data
}

export function nextId(prefix: string, items: Array<{ id: string }>) {
  const max = items.reduce((current, item) => {
    const match = item.id.match(new RegExp(`^${prefix}-(\\d+)$`))
    return match ? Math.max(current, Number(match[1])) : current
  }, 0)
  return `${prefix}-${String(max + 1).padStart(3, "0")}`
}

export async function addLogbook(
  entry: Omit<LogbookEntry, "id" | "timestamp">,
) {
  let created: LogbookEntry | null = null
  await updateStore((data) => {
    created = {
      id: nextId("LOG", data.logbook),
      timestamp: new Date().toISOString(),
      ...entry,
    }
    data.logbook = [created, ...data.logbook]
  })
  return created
}

export async function addIngestion(
  record: Omit<IngestionRecord, "id" | "createdAt">,
) {
  let created: IngestionRecord | null = null
  await updateStore((data) => {
    created = {
      id: nextId("ING", data.ingestions),
      createdAt: new Date().toISOString(),
      ...record,
    }
    data.ingestions = [created, ...data.ingestions]
  })
  return created
}

export async function resetStore() {
  await saveStore(emptyStore())
}

export async function deleteDocument(documentId: string) {
  let removed = false
  await updateStore((data) => {
    const before = data.documents.length
    data.documents = data.documents.filter((doc) => doc.id !== documentId)
    removed = data.documents.length !== before
  })
  return removed
}

export async function clearDocuments() {
  await updateStore((data) => {
    data.documents = []
  })
}

export async function replacePlans(plans: MaintenancePlan[]) {
  await updateStore((data) => {
    data.plans = plans
  })
}

export async function replaceReports(reports: Report[]) {
  await updateStore((data) => {
    data.reports = reports
  })
}
