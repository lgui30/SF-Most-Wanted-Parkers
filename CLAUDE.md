# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SF Most Wanted Parkers is a Next.js 14 app that ranks San Francisco's worst parking offenders using SFMTA parking citation data queried live from SF Open Data. There is no database and no paid service in the runtime path.

## Development Commands

```bash
npm run dev          # http://localhost:3000
npm run build        # Production build
npm test             # Jest
```

No environment variables are required. `SOCRATA_APP_TOKEN` is optional (raises rate limits).

## Architecture

**Live data**: Everything queries SF Open Data (SODA2, `data.sf.gov`, dataset `ab4h-6ztd`) through `lib/soda.ts`. All SoQL goes through that module:
- `soql()` fetches with `next: { revalidate }` so results sit in the Next.js data cache; it has a 45s timeout.
- `soqlString()` escapes string literals. Never interpolate unescaped values into SoQL.
- `parseYearMonth()` / `isValidPlate()` validate user input before it reaches a query.
- `fetchTopPlates()` builds a top-30 leaderboard for any date filter; `fetchDataThrough()` returns the newest published citation date.

**Caching**: API routes set `Cache-Control` via `cacheHeaders()` and `maxDuration = 60` (cold SODA aggregations can exceed Vercel's 10s default). Months that are over cache for a day; the current/previous month for an hour.

**Pages**:
- `app/page.tsx` (client): `MonthlyLeaderboard` (includes the in-progress month, labeled "so far"), `CitationHotspotsMap` synced to the selected month, `QuarterlyLeaderboard` (rolling 90 days ending at the newest published citation).
- `app/plate/[plateNumber]/page.tsx` (server): live per-plate lookup. Shows "Data Temporarily Unavailable" if SODA fails, rather than "Not Found".

**Maps**: Leaflet + React-Leaflet + OpenStreetMap tiles, dynamically imported with `ssr: false`. Citations include lat/lng, so hotspot positions come from `AVG(latitude/longitude)` per address. Do not add a geocoding service.

**Dates**: All data is limited to citations from Jan 1, 2025 onwards. SF publishes with a lag of a few days.

**Theme**: `ThemeProvider` must always render its provider (swapping it in after mount remounts the whole tree). An inline script in `app/layout.tsx` applies the theme class before first paint.

## Type System & Aliases

Types live in `types/index.ts`. `@/*` maps to the repo root (`@/lib/soda`, `@/components/...`, `@/types`).

## Legacy

`process_data.py`, `fetch_*.py`, `scripts/` and `.github/workflows/monthly-data-update.yml` belong to the old Neon Postgres pipeline. Nothing in the app reads that database; the workflow's schedule is disabled (manual dispatch only).

## Deployment

Vercel's GitHub integration deploys `main` to production automatically. No env vars needed.
