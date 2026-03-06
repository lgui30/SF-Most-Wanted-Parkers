'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MonthlyLeaderboardEntry } from '@/types';
import ViolationBadge from '@/components/ViolationBadge';

interface Meta {
  label: string;
  total_citations: number;
}

export default function QuarterlyLeaderboard() {
  const [data, setData] = useState<MonthlyLeaderboardEntry[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/quarterly-leaderboard')
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
  }, []);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400">Loading quarterly rankings...</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Fetching live from SF Open Data</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-12 text-red-500">{error}</div>;
  }

  if (data.length === 0) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">No data available.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
            Top 30 Offenders
          </h2>
          {meta && (
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {meta.label} &middot; {(meta.total_citations || 0).toLocaleString()} total citations
            </p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto shadow-lg rounded-lg">
        <table className="min-w-full bg-white dark:bg-gray-800">
          <thead className="bg-gray-800 dark:bg-gray-900 text-white">
            <tr>
              <th className="py-3 px-6 text-left">Rank</th>
              <th className="py-3 px-6 text-left">License Plate</th>
              <th className="py-3 px-6 text-left">Top Violation</th>
              <th className="py-3 px-6 text-right">Total Fines</th>
              <th className="py-3 px-6 text-right">Citations</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 dark:text-gray-300">
            {data.map((entry, index) => (
              <tr
                key={entry.plate}
                className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  index < 3 ? 'bg-red-50 dark:bg-red-900/20' : ''
                }`}
              >
                <td className="py-4 px-6 text-left">
                  <span className="font-bold text-lg">
                    {entry.rank === 1 && '🥇 '}
                    {entry.rank === 2 && '🥈 '}
                    {entry.rank === 3 && '🥉 '}
                    #{entry.rank}
                  </span>
                </td>
                <td className="py-4 px-6 text-left">
                  <Link
                    href={`/plate/${encodeURIComponent(entry.plate)}`}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-mono font-bold text-lg hover:underline"
                  >
                    {entry.plate}
                  </Link>
                </td>
                <td className="py-4 px-6 text-sm text-gray-500 dark:text-gray-400">
                  <ViolationBadge code={entry.favorite_violation} />
                </td>
                <td className="py-4 px-6 text-right font-semibold text-red-600 dark:text-red-400">
                  ${(entry.total_fines || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-4 px-6 text-right">
                  <span className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-full text-sm font-medium">
                    {(entry.citation_count || 0).toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
