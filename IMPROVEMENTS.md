# SF Most Wanted Parkers - Improvements

## 1. Test Coverage (Critical)
- Component tests exist only for SearchBar; `lib/soda.ts` has unit tests
- Zero tests for API routes (`/api/monthly-leaderboard`, `/api/quarterly-leaderboard`, `/api/monthly-hotspots`)
- Zero tests for the legacy plate fallback (`lib/db.ts` - `fetchPlateDetails`)
- Zero tests for map components (CitationHotspotsMap, TicketMap)
- Jest config sets 80% threshold that is not being met
- Add integration tests for the database-first → JSON fallback pattern

## 2. API Security (Critical)
- No rate limiting on any endpoint
- ~~`/api/citations` allows requesting up to 10M records in one call (`limit=all`) — DOS risk~~ (route removed)
- No input validation with a proper schema (zod/joi)
- No caching headers configured
- Add rate limiting middleware
- Add strict max limits on query parameters
- Validate all query params with zod

## 3. Performance (High)
- ~~`public/data/plate_index.json` is 68MB in the public directory~~ (removed and gitignored; `process_data.py` no longer writes it)
- Add ISR (incremental static regeneration) for static pages
- Split large JSON files into smaller chunks
- Add pagination UI for leaderboard and citations

## 4. Monthly Live Data Updates (High)
- Set up automated monthly data refresh from SF Open Data Portal
- Cron job or scheduled serverless function to fetch new citation data
- Automate database seeding after data fetch

## 5. Code Quality (Medium)
- Replace `alert()` calls with toast notifications
- Add React error boundaries for graceful component failures
- Replace `console.error` with a proper logging system

## 6. Configuration (Low)
- `next.config.js` is minimal — missing security headers, image optimization, compression
- Add bundle analyzer for monitoring bundle size
- Add Sentry or similar for error tracking
- Consider E2E tests with Playwright
