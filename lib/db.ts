import { sql } from '@vercel/postgres';

// Wrapper to get leaderboard entries from Postgres
export async function fetchLeaderboard(limit = 30) {
  const { rows } = await sql`
    SELECT rank, plate, total_fines, citation_count
    FROM leaderboard
    ORDER BY rank ASC
    LIMIT ${limit};
  `;
  return rows as {
    rank: number;
    plate: string;
    total_fines: number;
    citation_count: number;
  }[];
}

export async function fetchPlateDetails(plate: string) {
  const { rows } = await sql`
    SELECT 
      plate,
      plate_state,
      favorite_violation,
      (
        SELECT jsonb_agg(citation)
        FROM jsonb_array_elements(citations) AS citation
        WHERE (citation->>'date')::timestamp >= '2025-01-01'::timestamp
      ) AS all_citations,
      (
        SELECT COUNT(*)::integer
        FROM jsonb_array_elements(citations) AS citation
        WHERE (citation->>'date')::timestamp >= '2025-01-01'::timestamp
      ) AS citation_count,
      (
        SELECT COALESCE(SUM((citation->>'fine_amount')::numeric), 0)
        FROM jsonb_array_elements(citations) AS citation
        WHERE (citation->>'date')::timestamp >= '2025-01-01'::timestamp
      ) AS total_fines
    FROM plate_details
    WHERE plate = ${plate}
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function fetchPlateCitations(plate: string) {
  const { rows } = await sql`
    SELECT 
      (
        SELECT jsonb_agg(citation)
        FROM jsonb_array_elements(citations) AS citation
        WHERE (citation->>'date')::timestamp >= '2025-01-01'::timestamp
      ) AS citations
    FROM plate_details 
    WHERE plate = ${plate} 
    LIMIT 1;
  `;
  return rows[0]?.citations || null;
}

// Fetch citation hotspots (top locations with most citations)
export async function fetchCitationHotspots(limit = 20) {
  const { rows } = await sql`
    SELECT location, citation_count, total_fines, top_violation, violation_breakdown
    FROM citation_hotspots
    ORDER BY citation_count DESC
    LIMIT ${limit};
  `;
  return rows as {
    location: string;
    citation_count: number;
    total_fines: number;
    top_violation: string;
    violation_breakdown: any;
  }[];
}

// Fetch monthly leaderboard - top offenders for a specific month
export async function fetchMonthlyLeaderboard(year: number, month: number, limit = 30) {
  const { rows } = await sql`
    SELECT rank, plate, total_fines, citation_count, favorite_violation
    FROM monthly_leaderboard
    WHERE year = ${year} AND month = ${month}
    ORDER BY rank ASC
    LIMIT ${limit};
  `;
  return rows as {
    rank: number;
    plate: string;
    total_fines: number;
    citation_count: number;
    favorite_violation: string;
  }[];
}

// Fetch all available months that have leaderboard data
export async function fetchAvailableMonths() {
  const { rows } = await sql`
    SELECT DISTINCT year, month
    FROM monthly_leaderboard
    ORDER BY year DESC, month DESC;
  `;
  return rows as { year: number; month: number }[];
}

// Fetch all hotspots for heatmap (more data)
export async function fetchAllHotspots(limit = 1000) {
  const { rows } = await sql`
    SELECT location, citation_count, total_fines, top_violation, violation_breakdown, latitude, longitude
    FROM citation_hotspots
    ORDER BY citation_count DESC
    LIMIT ${limit};
  `;
  return rows;
}
