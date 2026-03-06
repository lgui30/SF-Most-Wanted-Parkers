import { promises as fs } from 'fs';
import path from 'path';
import dynamic from 'next/dynamic';
import SearchBar from '@/components/SearchBar';
import LeaderboardTable from '@/components/LeaderboardTable';
import MonthlyLeaderboard from '@/components/MonthlyLeaderboard';
import { LeaderboardEntry } from '@/types';
import { fetchLeaderboard } from '@/lib/db';

// Dynamically import map component (requires browser APIs)
const CitationHotspotsMap = dynamic(() => import('@/components/CitationHotspotsMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading map...</p>
      </div>
    </div>
  )
});

/**
 * Main page - Displays the leaderboard of worst parking offenders
 * 
 * This is a server component that loads the leaderboard data at build time
 * for optimal performance.
 */
async function getLeaderboardData(): Promise<LeaderboardEntry[]> {
  try {
    return await fetchLeaderboard(30);
  } catch (err) {
    console.error('DB error, falling back to file', err);
    try {
      const filePath = path.join(process.cwd(), 'public', 'data', 'leaderboard.json');
      const fileContents = await fs.readFile(filePath, 'utf8');
      const allData = JSON.parse(fileContents);
      return allData.slice(0, 30); // Only top 30
    } catch (error) {
      console.error('Error loading leaderboard data:', error);
      return [];
    }
  }
}

export default async function Home() {
  const leaderboardData = await getLeaderboardData();

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            SF&apos;s Most Wanted Parkers
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            The official leaderboard of San Francisco&apos;s worst parking offenders in 2025
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
              {leaderboardData.length} plates tracked
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <SearchBar />

        {/* Citation Hotspots Map */}
        <div className="mb-12">
          <CitationHotspotsMap />
        </div>

        {/* Monthly Leaderboard */}
        <div className="mb-12">
          <MonthlyLeaderboard />
        </div>

        {/* All-Time Leaderboard */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">
            All-Time Top 30 Offenders
          </h2>
          <LeaderboardTable data={leaderboardData} />
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-12 pt-8 border-t border-gray-300 dark:border-gray-600">
          <p>
            Data sourced from SFMTA Parking Citations dataset. 
            Showing 2025 citations only (January 1 - present).
          </p>
        </div>
      </div>
    </main>
  );
}

