import { NextResponse } from 'next/server';
import {
  soql,
  soqlString,
  monthFilter,
  parseYearMonth,
  revalidateForMonth,
  cacheHeaders,
} from '@/lib/soda';

// Cold (uncached) SF Open Data aggregations can exceed Vercel's 10s default
export const maxDuration = 60;

// Rough SF bounding box, to drop rows with missing (0,0) or garbage coordinates
const SF_BOUNDS = { minLat: 37.6, maxLat: 37.85, minLng: -122.55, maxLng: -122.35 };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseYearMonth(searchParams);

  if (!parsed) {
    return NextResponse.json({ error: 'Valid year and month required' }, { status: 400 });
  }

  const { year, month } = parsed;
  const revalidate = revalidateForMonth(year, month);
  const dateFilter = monthFilter(year, month);

  try {
    // Top 10 locations by citation count. Each citation already carries lat/lng,
    // so averaging them gives the spot's position without a geocoding round trip.
    const locations = await soql(
      {
        $select:
          'citation_location, COUNT(*) as citation_count, SUM(fine_amount) as total_fines, AVG(latitude) as lat, AVG(longitude) as lng',
        $where: `${dateFilter} AND citation_location IS NOT NULL AND citation_location != '' AND latitude > ${SF_BOUNDS.minLat} AND latitude < ${SF_BOUNDS.maxLat} AND longitude > ${SF_BOUNDS.minLng} AND longitude < ${SF_BOUNDS.maxLng}`,
        $group: 'citation_location',
        $order: 'citation_count DESC',
        $limit: '10',
      },
      revalidate
    );

    if (locations.length === 0) {
      return NextResponse.json({ hotspots: [] }, { headers: cacheHeaders(revalidate) });
    }

    // Violation breakdown for those locations
    const locationList = locations.map((l: any) => soqlString(l.citation_location)).join(',');
    const violations = await soql(
      {
        $select: 'citation_location, violation_desc, COUNT(*) as cnt',
        $where: `${dateFilter} AND citation_location IN (${locationList})`,
        $group: 'citation_location, violation_desc',
        $order: 'citation_location, cnt DESC',
        $limit: '500',
      },
      revalidate
    );

    const violationMap: Record<string, { top: string; breakdown: Record<string, number> }> = {};
    for (const v of violations) {
      const loc = v.citation_location;
      if (!violationMap[loc]) {
        violationMap[loc] = { top: v.violation_desc, breakdown: {} };
      }
      violationMap[loc].breakdown[v.violation_desc] = parseInt(v.cnt);
    }

    const hotspots = locations.map((l: any) => {
      const viol = violationMap[l.citation_location];
      return {
        location: l.citation_location,
        citation_count: parseInt(l.citation_count),
        total_fines: Math.round(parseFloat(l.total_fines) * 100) / 100,
        top_violation: viol?.top || 'Unknown',
        violation_breakdown: viol?.breakdown || {},
        latitude: parseFloat(l.lat),
        longitude: parseFloat(l.lng),
      };
    });

    return NextResponse.json({ hotspots }, { headers: cacheHeaders(revalidate) });
  } catch (error) {
    console.error('Monthly hotspots error:', error);
    return NextResponse.json({ error: 'Failed to fetch hotspots' }, { status: 502 });
  }
}
