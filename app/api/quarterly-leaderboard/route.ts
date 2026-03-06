import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SODA2_URL = 'https://data.sfgov.org/resource/ab4h-6ztd.json';

async function soql(params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${SODA2_URL}?${qs}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`SODA2 error: ${res.status}`);
  return res.json();
}

function getQuarterRange() {
  // Last 3 complete months
  const now = new Date();
  let endYear = now.getFullYear();
  let endMonth = now.getMonth() + 1; // current month (incomplete, use as end boundary)

  let startYear = endYear;
  let startMonth = endMonth - 3;
  if (startMonth <= 0) {
    startMonth += 12;
    startYear -= 1;
  }

  const start = `${startYear}-${String(startMonth).padStart(2, '0')}-01T00:00:00.000`;
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00.000`;

  return { start, end, startYear, startMonth, endYear, endMonth: endMonth - 1 };
}

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export async function GET() {
  try {
    const { start, end, startYear, startMonth, endYear, endMonth } = getQuarterRange();
    const dateFilter = `citation_issued_datetime >= '${start}' AND citation_issued_datetime < '${end}'`;

    const label = `${MONTH_NAMES[startMonth]} ${startYear} - ${MONTH_NAMES[endMonth]} ${endYear}`;

    // Run queries in parallel
    const [topPlatesRaw, totalResult] = await Promise.all([
      soql({
        '$select': 'vehicle_plate, SUM(fine_amount) as total_fines, COUNT(*) as citation_count',
        '$where': `${dateFilter} AND vehicle_plate IS NOT NULL AND vehicle_plate != ''`,
        '$group': 'vehicle_plate',
        '$order': 'total_fines DESC',
        '$limit': '31',
      }),
      soql({
        '$select': 'COUNT(*) as total',
        '$where': dateFilter,
      }),
    ]);

    const topPlates = topPlatesRaw
      .filter((p: any) => p.vehicle_plate?.trim())
      .slice(0, 30);

    if (topPlates.length === 0) {
      return NextResponse.json({ data: [], meta: { label, total_citations: 0 } });
    }

    // Get violations for top plates
    const plateList = topPlates.map((p: any) => `'${p.vehicle_plate}'`).join(',');
    const violationData = await soql({
      '$select': 'vehicle_plate, violation_desc, COUNT(*) as cnt',
      '$where': `${dateFilter} AND vehicle_plate IN (${plateList})`,
      '$group': 'vehicle_plate, violation_desc',
      '$order': 'vehicle_plate, cnt DESC',
      '$limit': '5000',
    });

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
        label,
        total_citations: parseInt(totalResult[0]?.total || '0'),
      },
    });
  } catch (error) {
    console.error('Quarterly leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from SF Open Data' },
      { status: 500 }
    );
  }
}
