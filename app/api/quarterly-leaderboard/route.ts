import { NextResponse } from 'next/server';
import { fetchTopPlates, fetchDataThrough, cacheHeaders } from '@/lib/soda';

// Rebuild at most once an hour
export const revalidate = 3600;

// Cold (uncached) SF Open Data aggregations can exceed Vercel's 10s default
export const maxDuration = 60;

const WINDOW_DAYS = 90;

function shortDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Rolling 90-day window ending on the newest citation SF has published,
 * so the board always includes the latest data (current month too).
 */
export async function GET() {
  try {
    const latest = (await fetchDataThrough()) || new Date().toISOString();
    const endDay = latest.slice(0, 10);
    const start = new Date(`${endDay}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - (WINDOW_DAYS - 1));
    const startDay = start.toISOString().slice(0, 10);

    // Day-granular bounds keep the query string (and its cache key) stable all day
    const dateFilter = `citation_issued_datetime >= '${startDay}T00:00:00.000' AND citation_issued_datetime <= '${endDay}T23:59:59.999'`;
    const { data, total_citations } = await fetchTopPlates(dateFilter, revalidate);

    return NextResponse.json(
      {
        data,
        meta: {
          label: `Last ${WINDOW_DAYS} days: ${shortDate(startDay)} – ${shortDate(endDay)}`,
          total_citations,
          data_through: latest,
        },
      },
      { headers: cacheHeaders(revalidate) }
    );
  } catch (error) {
    console.error('Quarterly leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from SF Open Data' },
      { status: 502 }
    );
  }
}
