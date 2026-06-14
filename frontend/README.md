# Frontend

Next.js UI for the Maintenance Tool. No local data, no API routes -- reads everything from the backend on port 4000.

## Setup

Start the backend first, then:

```bash
npm install
npm run dev      # http://localhost:3000
```

Optional `.env.local`:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

## Screens

- **Dashboard** -- fleet health KPIs, active alerts, equipment list, maintenance priorities, sensor trend watchlist
- **Equipment** -- browse all assets, drill into individual asset with sensors, history, risk, spares
- **AI Investigation** -- chat with the maintenance agent, see tool steps, evidence panel, create plans and reports
- **Planner** -- view and manage generated maintenance plans
- **Predictions** -- failure predictions grouped by urgency band
- **Knowledge** -- upload data files, view indexed documents and ingestion history
- **Reports** -- generated investigation reports + digital logbook with search/filter

## Commands

```bash
npm run dev          # development server
npm run build        # production build
npm run typecheck    # TypeScript check (0 errors)
```
