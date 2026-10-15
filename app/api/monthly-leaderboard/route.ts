import { NextResponse } from 'next/server';
import {
  fetchTopPlates,
  fetchDataThrough,
  monthFilter,
  parseYearMonth,
  revalidateForMonth,
  isCurrentMonth,
  cacheHeaders,
} from '@/lib/soda';

// Cold (uncached) SF Open Data aggregations can exceed Vercel's 10s default
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseYearMonth(searchParams);

  if (!parsed) {
    return NextResponse.json(
      { error: 'Valid year and month required (e.g. ?year=2026&month=2)' },
      { status: 400 }
    );
  }

  const { year, month } = parsed;
  const revalidate = revalidateForMonth(year, month);

  try {
    const partial = isCurrentMonth(year, month);
    const [{ data, total_citations }, data_through] = await Promise.all([
      fetchTopPlates(monthFilter(year, month), revalidate),
      partial ? fetchDataThrough() : Promise.resolve(null),
    ]);
    return NextResponse.json(
      { data, meta: { year, month, total_citations, partial, data_through } },
      { headers: cacheHeaders(revalidate) }
    );
  } catch (error) {
    console.error('Monthly leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from SF Open Data' },
      { status: 502 }
    );
  }
}
