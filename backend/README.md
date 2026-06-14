# Backend

Express + TypeScript API. Handles data ingestion, alert derivation, knowledge retrieval, risk computation, and LLM-backed chat.

Starts empty -- no seed data. Upload files through the frontend Knowledge page or `POST /api/ingest`.

## Setup

```bash
cp .env.example .env   # fill in your LLM key
npm install
npm run dev            # http://localhost:4000
```

## Environment

```
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
LLM_API_KEY=your_gemini_api_key
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL=gemini-3.5-flash
```

## Supported Inputs

**CSVs** (auto-classified by headers):
- Equipment master
- Sensor readings
- Maintenance logs
- Spare inventory
- Failure reports
- Operational records
- Steel process CSVs (ladle/EAF: data_temp, data_arc, data_gas, data_bulk, data_wire)

**Documents**: PDF, DOCX, TXT -- parsed and chunked into knowledge index.

## Testing

```bash
npm test         # 4 unit tests: RUL estimation, risk scoring, knowledge search, plan generation
npm run build    # TypeScript compile check
```

## Storage

Everything in `data/store.json`. Created on first ingestion. Raw uploaded files are parsed and indexed, not retained separately.
