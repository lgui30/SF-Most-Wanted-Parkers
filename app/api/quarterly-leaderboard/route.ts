import { NextResponse } from 'next/server';
import { fetchTopPlates, fetchDataThrough, cacheHeaders } from '@/lib/soda';

// Cold (uncached) SF Open Data aggregations can exceed Vercel's 10s default
export const maxDuration = 60;

// Cache SODA responses for an hour (the route itself runs per request, like the others)
const REVALIDATE = 3600;
const WINDOW_DAYS = 90;

function shortDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Rolling 90-day window ending today, so the board always includes the
 * latest published data (current month too). The window's start date and
 * the "data through" lookup don't depend on each other, so they run in parallel.
 */
export async function GET(request: Request) {
  // Reading the request keeps this route dynamic instead of a build-time static page
  void request.url;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const start = new Date(`${today}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - (WINDOW_DAYS - 1));
    const startDay = start.toISOString().slice(0, 10);

    // Day-granular bounds keep the query string (and its cache key) stable all day
    const dateFilter = `citation_issued_datetime >= '${startDay}T00:00:00.000' AND citation_issued_datetime <= '${today}T23:59:59.999'`;
    const [{ data, total_citations }, latest] = await Promise.all([
      fetchTopPlates(dateFilter, REVALIDATE),
      fetchDataThrough(),
    ]);
    const endDay = (latest || today).slice(0, 10);

    return NextResponse.json(
      {
        data,
        meta: {
          label: `Last ${WINDOW_DAYS} days: ${shortDate(startDay)} – ${shortDate(endDay)}`,
          total_citations,
          data_through: latest,
        },
      },
      { headers: cacheHeaders(REVALIDATE) }
    );
  } catch (error) {
    console.error('Quarterly leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from SF Open Data' },
      { status: 502 }
    );
  }
}
