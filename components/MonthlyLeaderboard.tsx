'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MonthlyLeaderboardEntry } from '@/types';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getAvailableMonths() {
  // Generate months from Jan 2025 to last complete month
  const now = new Date();
  const months: { year: number; month: number }[] = [];
  let y = now.getFullYear();
  let m = now.getMonth(); // 0-indexed, so this is last month (current month incomplete)
  if (m === 0) { y--; m = 12; }

  // Go back from most recent complete month to Jan 2025
  while (y > 2025 || (y === 2025 && m >= 1)) {
    months.push({ year: y, month: m });
    m--;
    if (m === 0) { y--; m = 12; }
  }
  return months;
}

interface Meta {
  total_citations: number;
}

interface Props {
  onMonthChange?: (year: number, month: number) => void;
}

export default function MonthlyLeaderboard({ onMonthChange }: Props) {
  const availableMonths = getAvailableMonths();
  const [selectedMonth, setSelectedMonthState] = useState(availableMonths[0]);

  const setSelectedMonth = (m: { year: number; month: number }) => {
    setSelectedMonthState(m);
    onMonthChange?.(m.year, m.month);
  };

  // Notify parent of initial month
  useEffect(() => {
    if (selectedMonth) {
      onMonthChange?.(selectedMonth.year, selectedMonth.month);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [data, setData] = useState<MonthlyLeaderboardEntry[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMonth) return;
    setLoading(true);
    setError(null);

    fetch(`/api/monthly-leaderboard?year=${selectedMonth.year}&month=${selectedMonth.month}`)
      .then(res => res.json())
      .then(result => {
        if (result.error) {
          setError(result.error);
        } else {
          setData(result.data || []);
          setMeta(result.meta || null);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load data');
        setLoading(false);
      });
  }, [selectedMonth]);

  const currentIdx = availableMonths.findIndex(
    m => m.year === selectedMonth.year && m.month === selectedMonth.month
  );

  const navigateMonth = (direction: -1 | 1) => {
    // -1 = older (higher index), 1 = newer (lower index)
    const newIdx = currentIdx - direction;
    if (newIdx >= 0 && newIdx < availableMonths.length) {
      setSelectedMonth(availableMonths[newIdx]);
    }
  };

  const isNewest = currentIdx === 0;
  const isOldest = currentIdx === availableMonths.length - 1;

  return (
    <div>
      {/* Month navigator */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
          Monthly Most Wanted
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth(-1)}
            disabled={isOldest}
            className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-lg font-semibold text-gray-700 dark:text-gray-200 min-w-[180px] text-center">
            {MONTH_NAMES[selectedMonth.month]} {selectedMonth.year}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            disabled={isNewest}
            className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next month"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">
            Crunching {MONTH_NAMES[selectedMonth.month]} {selectedMonth.year} citation data...
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            Fetching live from SF Open Data
          </p>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No data for this month.
        </div>
      ) : (
        <>
          {/* Stats bar */}
          {meta && (
            <div className="flex items-center gap-3 mb-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                {(meta.total_citations || 0).toLocaleString()} citations
              </span>
            </div>
          )}

          {/* #1 Offender spotlight */}
          <div className="mb-6 p-6 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl text-white shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-red-100 text-sm font-medium uppercase tracking-wide">
                  {MONTH_NAMES[selectedMonth.month]} {selectedMonth.year} &mdash; #1 Most Wanted
                </p>
                <Link
                  href={`/plate/${encodeURIComponent(data[0].plate)}`}
                  className="text-4xl font-mono font-black hover:underline"
                >
                  {data[0].plate}
                </Link>
                <p className="text-red-100 mt-1">
                  Favorite violation: {data[0].favorite_violation}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">
                  ${(data[0].total_fines || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-red-100">
                  {data[0].citation_count || 0} tickets in one month
                </p>
              </div>
            </div>
          </div>

          {/* Remaining top offenders */}
          <div className="overflow-x-auto shadow-lg rounded-lg">
            <table className="min-w-full bg-white dark:bg-gray-800">
              <thead className="bg-gray-800 dark:bg-gray-900 text-white">
                <tr>
                  <th className="py-3 px-6 text-left">Rank</th>
                  <th className="py-3 px-6 text-left">License Plate</th>
                  <th className="py-3 px-6 text-left">Top Violation</th>
                  <th className="py-3 px-6 text-right">Fines</th>
                  <th className="py-3 px-6 text-right">Tickets</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {data.slice(1, 10).map((entry, index) => (
                  <tr
                    key={entry.plate}
                    className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      index < 2 ? 'bg-red-50 dark:bg-red-900/20' : ''
                    }`}
                  >
                    <td className="py-3 px-6">
                      <span className="font-bold">
                        {entry.rank === 2 && '🥈 '}
                        {entry.rank === 3 && '🥉 '}
                        #{entry.rank}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      <Link
                        href={`/plate/${encodeURIComponent(entry.plate)}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-mono font-bold"
                      >
                        {entry.plate}
                      </Link>
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-500 dark:text-gray-400">
                      {entry.favorite_violation}
                    </td>
                    <td className="py-3 px-6 text-right font-semibold text-red-600 dark:text-red-400">
                      ${(entry.total_fines || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <span className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-full text-sm font-medium">
                        {entry.citation_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
