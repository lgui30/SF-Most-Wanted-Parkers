import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SODA2_URL = 'https://data.sfgov.org/resource/ab4h-6ztd.json';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// In-memory geocode cache (persists across requests in the same server process)
const geocodeCache: Record<string, { lat: number; lng: number } | null> = {};

async function soql(params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${SODA2_URL}?${qs}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`SODA2 error: ${res.status}`);
  return res.json();
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (address in geocodeCache) return geocodeCache[address];

  try {
    const params = new URLSearchParams({
      q: `${address}, San Francisco, CA`,
      format: 'json',
      limit: '1',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': 'SF-Most-Wanted-Parkers-App' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0) {
        const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        geocodeCache[address] = result;
        return result;
      }
    }
  } catch (e) {
    // Geocoding failed, skip this location
  }
  geocodeCache[address] = null;
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || '');
  const month = parseInt(searchParams.get('month') || '');

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'year and month required' },
      { status: 400 }
    );
  }

  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00.000`;
    const dateFilter = `citation_issued_datetime >= '${startDate}' AND citation_issued_datetime < '${endDate}'`;

    // Get top 10 locations by citation count (server-side aggregation)
    const locations = await soql({
      '$select': 'citation_location, COUNT(*) as citation_count, SUM(fine_amount) as total_fines',
      '$where': `${dateFilter} AND citation_location IS NOT NULL AND citation_location != ''`,
      '$group': 'citation_location',
      '$order': 'citation_count DESC',
      '$limit': '10',
    });

    // Get violation breakdown for these top locations
    const locationList = locations
      .map((l: any) => `'${l.citation_location.replace(/'/g, "''")}'`)
      .join(',');

    const violations = await soql({
      '$select': 'citation_location, violation_desc, COUNT(*) as cnt',
      '$where': `${dateFilter} AND citation_location IN (${locationList})`,
      '$group': 'citation_location, violation_desc',
      '$order': 'citation_location, cnt DESC',
      '$limit': '500',
    });

    // Build violation lookup
    const violationMap: Record<string, { top: string; breakdown: Record<string, number> }> = {};
    for (const v of violations) {
      const loc = v.citation_location;
      if (!violationMap[loc]) {
        violationMap[loc] = { top: v.violation_desc, breakdown: {} };
      }
      violationMap[loc].breakdown[v.violation_desc] = parseInt(v.cnt);
    }

    // Geocode all 10 locations in parallel
    const geocodeResults = await Promise.all(
      locations.map((l: any) => geocode(l.citation_location))
    );

    const hotspots = locations
      .map((l: any, i: number) => {
        const coords = geocodeResults[i];
        if (!coords) return null;
        const viol = violationMap[l.citation_location];
        return {
          location: l.citation_location,
          citation_count: parseInt(l.citation_count),
          total_fines: Math.round(parseFloat(l.total_fines) * 100) / 100,
          top_violation: viol?.top || 'Unknown',
          violation_breakdown: viol?.breakdown || {},
          latitude: coords.lat,
          longitude: coords.lng,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ hotspots });
  } catch (error) {
    console.error('Monthly hotspots error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hotspots' },
      { status: 500 }
    );
  }
}
