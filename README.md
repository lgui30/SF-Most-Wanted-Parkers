# SF Most Wanted Parkers

A Next.js app that ranks San Francisco's worst parking offenders using SFMTA citation data queried live from [SF Open Data](https://data.sf.gov/Transportation/SFMTA-Parking-Citations/ab4h-6ztd). No database, no API keys, no paid services.

## Features

- **Monthly Most Wanted**: top offenders for any month since Jan 2025, including the current month so far
- **Last 90 days**: rolling top 30 ending on the newest citation SF has published
- **Hotspot map**: the month's top 10 ticketed addresses on OpenStreetMap
- **Plate search**: full 2025+ citation history for any plate, with a map of every ticket
- **Dark mode**, responsive layout, violation code tooltips

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Data:** SF Open Data SODA2 API (free, no key), via `lib/soda.ts`
- **Maps:** Leaflet + React-Leaflet + OpenStreetMap tiles (free)
- **Hosting:** Vercel (auto-deploys `main`)
- **Testing:** Jest + React Testing Library

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables are required.

Optional: set `SOCRATA_APP_TOKEN` (a free Socrata app token) to raise SF Open Data's rate limits.

## How Data Flows

1. Pages call the app's API routes (`/api/monthly-leaderboard`, `/api/quarterly-leaderboard`, `/api/monthly-hotspots`); plate pages query directly from a server component.
2. Those run SoQL aggregation queries against SF Open Data through `lib/soda.ts`.
3. Responses are cached in the Next.js data cache and at Vercel's CDN: one hour for recent data, a day for months that are over. Repeat visits don't hit SF Open Data.
4. Each citation carries its own latitude/longitude, so maps need no geocoding service.

SF publishes citations a few days after they're issued, so the current month is labeled "so far" and shows the latest published date.

## Project Structure

```
app/
  page.tsx                     # Home: monthly board, hotspot map, 90-day board
  about/page.tsx               # Methodology
  plate/[plateNumber]/page.tsx # Plate detail (live)
  api/                         # Cached live SODA queries
components/                    # Leaderboards, maps, search, theme toggle
lib/soda.ts                    # SF Open Data client: caching, SoQL escaping, validation
lib/violationCodes.ts          # Violation code descriptions
```

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm test             # Run Jest tests
```

## Legacy Pipeline

Earlier versions served data from a Neon Postgres snapshot filled by Python scripts (`process_data.py`, `fetch_*.py`, `scripts/`) and a monthly GitHub Action. The site no longer reads that database. The Action's schedule is disabled; it can still be run manually from the Actions tab.

## Acknowledgments

- Data: [SF Open Data](https://datasf.org/), SFMTA Parking Citations
- Maps: [Leaflet](https://leafletjs.com/) and [OpenStreetMap](https://www.openstreetmap.org/)

## License

MIT
