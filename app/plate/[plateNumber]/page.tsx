import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Metadata } from 'next';
import { Citation, PlateDetails } from '@/types';
import { fetchPlateCitationsLive, isValidPlate } from '@/lib/soda';
import ViolationBadge from '@/components/ViolationBadge';

// Dynamically import the map component with no SSR
const TicketMap = dynamic(() => import('@/components/TicketMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
      <p className="text-gray-600 dark:text-gray-300">Loading map...</p>
    </div>
  ),
});

interface PageProps {
  params: {
    plateNumber: string;
  };
}

function toNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) && n !== 0 ? n : undefined;
}

function mostCommon(values: string[]): string {
  const counts: Record<string, number> = {};
  let best = 'Unknown';
  let bestCount = 0;
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > bestCount) {
      best = v;
      bestCount = counts[v];
    }
  }
  return best;
}

function summarize(citations: Citation[], plate_state?: string): PlateDetails {
  return {
    plate_state,
    all_citations: citations,
    citation_count: citations.length,
    total_fines: citations.reduce((sum, c) => sum + (c.fine_amount || 0), 0),
    favorite_violation: mostCommon(citations.map(c => c.violation)),
  };
}

type PlateLookup =
  | { status: 'found'; details: PlateDetails }
  | { status: 'not_found' }
  | { status: 'unavailable' };

/** Load a plate's 2025+ citations live from SF Open Data (free, no database). */
async function getPlateDetails(plateNumber: string): Promise<PlateLookup> {
  try {
    const rows = await fetchPlateCitationsLive(plateNumber);
    if (rows.length === 0) return { status: 'not_found' };
    const citations: Citation[] = rows.map(row => ({
      date: row.citation_issued_datetime || null,
      violation: row.violation_desc || row.violation || 'Unknown',
      fine_amount: parseFloat(row.fine_amount || '0') || 0,
      citation_number: row.citation_number,
      location: row.citation_location,
      latitude: toNumber(row.latitude),
      longitude: toNumber(row.longitude),
    }));
    return { status: 'found', details: summarize(citations, rows[0].vehicle_plate_state) };
  } catch (err) {
    console.error('SF Open Data lookup failed', err);
    return { status: 'unavailable' };
  }
}

function formatDate(date: string | null) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDay(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatMoney(amount: number) {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function generateMetadata({ params }: PageProps): Metadata {
  const plateNumber = decodeURIComponent(params.plateNumber).toUpperCase();
  return {
    title: `${plateNumber} | SF's Most Wanted Parkers`,
    description: `Parking citation history for plate ${plateNumber} in San Francisco since 2025.`,
  };
}

/**
 * Plate Details Page - Shows the "rap sheet" for a specific license plate
 *
 * Displays all parking violations, statistics, and a map of ticket locations.
 */
export default async function PlatePage({ params }: PageProps) {
  const plateNumber = decodeURIComponent(params.plateNumber).trim().toUpperCase();
  const lookup: PlateLookup = isValidPlate(plateNumber)
    ? await getPlateDetails(plateNumber)
    : { status: 'not_found' };

  // Handle plate not found, or SF Open Data being down
  if (lookup.status !== 'found') {
    const unavailable = lookup.status === 'unavailable';
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-12 max-w-6xl">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {unavailable ? 'Data Temporarily Unavailable' : 'Plate Not Found'}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              {unavailable ? (
                <>SF Open Data isn&apos;t responding right now. Try again in a minute.</>
              ) : (
                <>
                  No parking violations since 2025 for plate{' '}
                  <span className="font-mono font-bold">{plateNumber}</span>
                </>
              )}
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              ← Back to Leaderboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const plateDetails = lookup.details;
  const { all_citations } = plateDetails;
  const mappedCount = all_citations.filter(c => c.latitude && c.longitude).length;
  const firstDate = all_citations[all_citations.length - 1]?.date;
  const lastDate = all_citations[0]?.date;

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-4 inline-block"
          >
            ← Back to Leaderboard
          </Link>
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-2">
            <span className="font-mono">{plateNumber}</span>
            {plateDetails.plate_state && (
              <span className="ml-3 align-middle text-base font-semibold px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                {plateDetails.plate_state}
              </span>
            )}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Parking violations since Jan 2025
            {lastDate && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {' '}&middot; most recent {formatDay(lastDate)}
              </span>
            )}
          </p>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-red-500">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
              Total Fines
            </h3>
            <p className="text-4xl font-bold text-red-600 dark:text-red-400">
              {formatMoney(plateDetails.total_fines)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-orange-500">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
              Total Citations
            </h3>
            <p className="text-4xl font-bold text-orange-600 dark:text-orange-400">
              {plateDetails.citation_count.toLocaleString()}
            </p>
            {firstDate && lastDate && plateDetails.citation_count > 1 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatDay(firstDate)} –{' '}
                {formatDay(lastDate)}
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
              Favorite Violation
            </h3>
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 leading-tight">
              <ViolationBadge code={plateDetails.favorite_violation} />
            </p>
          </div>
        </div>

        {/* Map Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
            Ticket Locations
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {mappedCount === all_citations.length
              ? `All ${mappedCount} citations mapped`
              : `${mappedCount} of ${all_citations.length} citations have map coordinates`}
          </p>
          <TicketMap citations={all_citations} />
        </div>

        {/* Citations */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
            All Citations
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Date
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Violation
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Location
                  </th>
                  <th className="py-3 px-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Fine
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {all_citations.map((citation, index) => (
                  <tr
                    key={citation.citation_number || index}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatDate(citation.date)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      <ViolationBadge code={citation.violation} />
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {citation.location ||
                        (citation.latitude && citation.longitude
                          ? `${citation.latitude.toFixed(4)}, ${citation.longitude.toFixed(4)}`
                          : 'No location data')}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                      {citation.fine_amount ? formatMoney(citation.fine_amount) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
