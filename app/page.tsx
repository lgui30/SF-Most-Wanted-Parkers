'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '@/components/SearchBar';
import MonthlyLeaderboard from '@/components/MonthlyLeaderboard';
import QuarterlyLeaderboard from '@/components/QuarterlyLeaderboard';

const CitationHotspotsMap = dynamic(() => import('@/components/CitationHotspotsMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading map...</p>
      </div>
    </div>
  )
});

export default function Home() {
  const [mapMonth, setMapMonth] = useState<{ year: number; month: number } | null>(null);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            SF&apos;s Most Wanted Parkers
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            The official leaderboard of San Francisco&apos;s worst parking offenders
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Live data from SF Open Data Portal
          </p>
        </div>

        {/* Search Bar */}
        <SearchBar />

        {/* Monthly Leaderboard */}
        <div className="mb-8">
          <MonthlyLeaderboard
            onMonthChange={(year, month) => setMapMonth({ year, month })}
          />
        </div>

        {/* Map synced to selected month */}
        <div className="mb-12">
          {mapMonth && (
            <CitationHotspotsMap year={mapMonth.year} month={mapMonth.month} />
          )}
        </div>

        {/* Quarterly Leaderboard */}
        <div className="mb-8">
          <QuarterlyLeaderboard />
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-12 pt-8 border-t border-gray-300 dark:border-gray-600">
          <p>
            Data sourced from{' '}
            <a
              href="https://data.sfgov.org/Transportation/SFMTA-Parking-Citations/ab4h-6ztd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              SFMTA Parking Citations dataset
            </a>
            . Updated live.
          </p>
        </div>
      </div>
    </main>
  );
}
