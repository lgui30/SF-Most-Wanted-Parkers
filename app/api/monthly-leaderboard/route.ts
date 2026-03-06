import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SODA2_URL = 'https://data.sfgov.org/resource/ab4h-6ztd.json';

function buildDateRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00.000`;
  return { start, end };
}

async function soql(params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${SODA2_URL}?${qs}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`SODA2 error: ${res.status}`);
  return res.json();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || '');
  const month = parseInt(searchParams.get('month') || '');

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'year and month required (e.g. ?year=2026&month=2)' },
      { status: 400 }
    );
  }

  try {
    const { start, end } = buildDateRange(year, month);
    const dateFilter = `citation_issued_datetime >= '${start}' AND citation_issued_datetime < '${end}'`;

    // Run all 3 queries in parallel for speed
    const [topPlatesRaw, totalResult] = await Promise.all([
      // Query 1: Top 30 plates by fines (server-side GROUP BY)
      soql({
        '$select': 'vehicle_plate, SUM(fine_amount) as total_fines, COUNT(*) as citation_count',
        '$where': `${dateFilter} AND vehicle_plate IS NOT NULL AND vehicle_plate != ''`,
        '$group': 'vehicle_plate',
        '$order': 'total_fines DESC',
        '$limit': '31',
      }),
      // Query 2: Total citation count for the month
      soql({
        '$select': 'COUNT(*) as total',
        '$where': dateFilter,
      }),
    ]);

    // Filter out empty plates, take top 30
    const topPlates = topPlatesRaw
      .filter((p: any) => p.vehicle_plate?.trim())
      .slice(0, 30);

    if (topPlates.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { year, month, total_citations: 0, unique_plates: 0 },
      });
    }

    // Query 3: Get violation breakdown for top plates
    const plateList = topPlates.map((p: any) => `'${p.vehicle_plate}'`).join(',');
    const violationData = await soql({
      '$select': 'vehicle_plate, violation_desc, COUNT(*) as cnt',
      '$where': `${dateFilter} AND vehicle_plate IN (${plateList})`,
      '$group': 'vehicle_plate, violation_desc',
      '$order': 'vehicle_plate, cnt DESC',
      '$limit': '5000',
    });

    // Build favorite violation lookup
    const favViolation: Record<string, string> = {};
    for (const v of violationData) {
      if (!favViolation[v.vehicle_plate]) {
        favViolation[v.vehicle_plate] = v.violation_desc;
      }
    }

    const data = topPlates.map((p: any, i: number) => ({
      rank: i + 1,
      plate: p.vehicle_plate.trim().toUpperCase(),
      total_fines: Math.round(parseFloat(p.total_fines) * 100) / 100,
      citation_count: parseInt(p.citation_count),
      favorite_violation: favViolation[p.vehicle_plate] || 'Unknown',
    }));

    return NextResponse.json({
      data,
      meta: {
        year,
        month,
        total_citations: parseInt(totalResult[0]?.total || '0'),
      },
    });
  } catch (error) {
    console.error('Monthly leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from SF Open Data' },
      { status: 500 }
    );
  }
}
