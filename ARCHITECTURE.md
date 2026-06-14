# Architecture

## High-Level Overview

Two-service setup: Express backend handles data, reasoning, and LLM calls. Next.js frontend is purely a client that talks to the backend REST API.

```
User --> Next.js Frontend --> Express Backend --> Gemini LLM
                                    |
                              JSON File Store
                            (equipment, sensors,
                             documents, plans, etc.)
```

All data lives in `backend/data/store.json`. No database, no vector DB. Files get uploaded, parsed, classified, and stored as structured JSON.

## How the Reasoning Engine Works

When a user sends a message to the AI Investigation chat, the backend runs a 9-step pipeline before calling the LLM:

```
User message
    |
    v
1. detectIntent()         -- classify: investigation / status / risk / plan / spares / general
2. inferEquipment()       -- match message to a specific asset by ID or name
3. searchKnowledge()      -- TF-IDF search across indexed documents, equipment-boosted
4. deriveAlerts()         -- generate alerts from sensor thresholds + trends
5. computeRisk()          -- weighted score: criticality + health + RUL + alerts
6. findSimilarIncidents() -- keyword match against failure reports
7. analyzeRootCause()     -- evidence-weighted confidence scoring
8. buildPlan()            -- suggested maintenance steps with spares
9. callLlm()             -- Gemini gets all the above as structured context
    |
    v
Response: answer + evidence cards + risk + root cause + citations + suggested plan
```

The key idea is that the LLM never invents data. Sensor values, risk scores, RUL estimates, document citations -- all of it is computed deterministically first, then passed to the LLM as grounding context. The LLM's job is to synthesize it into a coherent, explainable answer.

## Data Ingestion

Upload flow:
1. User uploads files (CSV, PDF, DOCX, TXT) via `/api/ingest`
2. CSVs are auto-classified by header analysis (equipment, sensors, maintenance logs, spares, failure reports, operational records)
3. PDFs/DOCX get text-extracted and chunked into document sections
4. Documents are auto-linked to equipment by text matching
5. Everything goes into the JSON store

## Alerting and Predictions

Alerts are derived on-the-fly from sensor data:
- Threshold exceedance (current > threshold)
- Trend analysis (linear regression on history)
- Severity: Critical (>100%), High (>85%), Medium (>70%)

Failure predictions use a multi-factor model:
- Health degradation: 30% weight
- RUL proximity: up to 40pts (shorter RUL = higher score)
- Risk score: 25% weight
- Maintenance frequency: up to 8pts

Urgency bands: Immediate (>=75%), 7-day (>=55%), 30-day (>=35%), 90-day (>=20%)

## Feedback Loop

User can thumbs-up/down any AI response. Last 5 feedback records are included in the LLM context for subsequent queries, so the agent learns from corrections within the session.

## Knowledge Retrieval

Uses TF-IDF keyword search (not embeddings). Documents are chunked into sections, each scored by term frequency overlap with the query. Equipment-specific documents get a boost. Synonym expansion handles common maintenance terms (e.g., "bearing" expands to vibration, lubrication, alignment).

## API Surface

| Method | Endpoint | What it does |
|--------|----------|--------------|
| GET | /health | Health check |
| POST | /api/ingest | Upload and process files |
| GET | /api/equipment | All assets with derived alerts |
| GET | /api/equipment/:id | Single asset detail |
| GET | /api/alerts | Active alerts sorted by severity |
| GET | /api/predictions | Failure predictions by likelihood |
| GET | /api/documents | Indexed knowledge docs |
| POST | /api/chat | AI reasoning endpoint |
| POST | /api/plans | Create maintenance plan |
| GET | /api/plans | List plans |
| PATCH | /api/plans/:id | Update plan status |
| POST | /api/reports | Generate investigation report |
| GET | /api/reports | Reports + logbook entries |
| POST | /api/feedback | Submit recommendation feedback |

## Limitations

- Single-instance file store (no concurrent multi-server)
- Keyword search, not semantic/vector search
- RUL is trend-based linear regression, not ML model
- Alerts are poll-based (computed per API call), not pushed via WebSocket
- Conversation memory is 10-message sliding window
