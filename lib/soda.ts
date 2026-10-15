/**
 * Shared client for the SFMTA Parking Citations dataset on SF Open Data (Socrata SODA2).
 * https://data.sf.gov/Transportation/SFMTA-Parking-Citations/ab4h-6ztd
 */

// data.sfgov.org now 301-redirects here; hit the canonical host directly.
export const SODA_URL = 'https://data.sf.gov/resource/ab4h-6ztd.json';

// Citations for a closed month don't change much, so cache them longer.
const ONE_HOUR = 60 * 60;
const ONE_DAY = 24 * ONE_HOUR;

/**
 * Run a SoQL query. Responses are cached in the Next.js data cache for
 * `revalidate` seconds so repeat page views don't re-hit SF Open Data.
 */
export async function soql<T = any>(
  params: Record<string, string>,
  revalidate: number = ONE_HOUR
): Promise<T[]> {
  const qs = new URLSearchParams(params);
  const headers: Record<string, string> = { Accept: 'application/json' };
  // Optional app token raises Socrata's rate limits
  if (process.env.SOCRATA_APP_TOKEN) {
    headers['X-App-Token'] = process.env.SOCRATA_APP_TOKEN;
  }
  const res = await fetch(`${SODA_URL}?${qs}`, {
    headers,
    next: { revalidate },
    // Fail cleanly instead of hanging if SF Open Data is having a slow moment
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`SODA2 error: ${res.status}`);
  return res.json();
}

/** Escape a value for use inside a single-quoted SoQL string literal. */
export function soqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function isoMonthStart(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000`;
}

/** SoQL WHERE clause covering [start month, end month) by citation issue date. */
export function dateRangeFilter(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number
) {
  return `citation_issued_datetime >= '${isoMonthStart(startYear, startMonth)}' AND citation_issued_datetime < '${isoMonthStart(endYear, endMonth)}'`;
}

/** SoQL WHERE clause for a single calendar month. */
export function monthFilter(year: number, month: number) {
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  return dateRangeFilter(year, month, endYear, endMonth);
}

/** Cache lifetime for a month: a day once it's over, an hour while it's still filling in. */
export function revalidateForMonth(year: number, month: number) {
  const now = new Date();
  const current = now.getFullYear() * 12 + now.getMonth();
  const requested = year * 12 + (month - 1);
  return requested < current - 1 ? ONE_DAY : ONE_HOUR;
}

/**
 * Parse and validate ?year=&month= query params. Returns null if invalid
 * or outside the range the app supports (Jan 2025 through the current month).
 */
export function parseYearMonth(searchParams: URLSearchParams) {
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  const now = new Date();
  if (year < 2025 || year * 12 + month > now.getFullYear() * 12 + now.getMonth() + 1) {
    return null;
  }
  return { year, month };
}

/** True if year/month is the current calendar month (still filling in). */
export function isCurrentMonth(year: number, month: number) {
  const now = new Date();
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

/**
 * Latest citation date SF has published (the city posts with a few days' lag).
 * Bounded by today because the dataset contains a few mistyped future dates.
 */
export async function fetchDataThrough(): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await soql(
    {
      $select: 'MAX(citation_issued_datetime) as max_date',
      $where: `citation_issued_datetime >= '2025-01-01' AND citation_issued_datetime <= '${today}T23:59:59'`,
    },
    ONE_HOUR
  );
  return rows[0]?.max_date ?? null;
}

/** Shared Cache-Control for live-data API responses (CDN cache + stale-while-revalidate). */
export function cacheHeaders(seconds: number) {
  return { 'Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}` };
}

export interface TopPlate {
  rank: number;
  plate: string;
  total_fines: number;
  citation_count: number;
  favorite_violation: string;
}

/** Top 30 plates by total fines within a SoQL date filter, with each plate's most common violation. */
export async function fetchTopPlates(dateFilter: string, revalidate: number) {
  const [topPlatesRaw, totalResult] = await Promise.all([
    soql(
      {
        $select: 'vehicle_plate, SUM(fine_amount) as total_fines, COUNT(*) as citation_count',
        $where: `${dateFilter} AND vehicle_plate IS NOT NULL AND vehicle_plate != ''`,
        $group: 'vehicle_plate',
        $order: 'total_fines DESC',
        $limit: '31',
      },
      revalidate
    ),
    soql({ $select: 'COUNT(*) as total', $where: dateFilter }, revalidate),
  ]);

  const total_citations = parseInt(totalResult[0]?.total || '0');
  const topPlates = topPlatesRaw.filter((p: any) => p.vehicle_plate?.trim()).slice(0, 30);
  if (topPlates.length === 0) return { data: [] as TopPlate[], total_citations };

  const plateList = topPlates.map((p: any) => soqlString(p.vehicle_plate)).join(',');
  const violationData = await soql(
    {
      $select: 'vehicle_plate, violation_desc, COUNT(*) as cnt',
      $where: `${dateFilter} AND vehicle_plate IN (${plateList})`,
      $group: 'vehicle_plate, violation_desc',
      $order: 'vehicle_plate, cnt DESC',
      $limit: '5000',
    },
    revalidate
  );

  const favViolation: Record<string, string> = {};
  for (const v of violationData) {
    if (!favViolation[v.vehicle_plate]) favViolation[v.vehicle_plate] = v.violation_desc;
  }

  const data: TopPlate[] = topPlates.map((p: any, i: number) => ({
    rank: i + 1,
    plate: p.vehicle_plate.trim().toUpperCase(),
    total_fines: Math.round(parseFloat(p.total_fines) * 100) / 100,
    citation_count: parseInt(p.citation_count),
    favorite_violation: favViolation[p.vehicle_plate] || 'Unknown',
  }));

  return { data, total_citations };
}

/** Plates are short alphanumerics; reject anything else before it reaches a query. */
export function isValidPlate(plate: string) {
  return /^[A-Z0-9 -]{1,10}$/.test(plate);
}

export interface PlateCitationRow {
  citation_number?: string;
  citation_issued_datetime?: string;
  violation?: string;
  violation_desc?: string;
  citation_location?: string;
  vehicle_plate_state?: string;
  fine_amount?: string;
  latitude?: string;
  longitude?: string;
}

/** Every citation issued to a plate since Jan 1 2025, newest first. */
export async function fetchPlateCitationsLive(plate: string) {
  return soql<PlateCitationRow>(
    {
      $select:
        'citation_number, citation_issued_datetime, violation, violation_desc, citation_location, vehicle_plate_state, fine_amount, latitude, longitude',
      $where: `vehicle_plate = ${soqlString(plate)} AND citation_issued_datetime >= '2025-01-01T00:00:00.000'`,
      $order: 'citation_issued_datetime DESC',
      $limit: '5000',
    },
    ONE_HOUR
  );
}
