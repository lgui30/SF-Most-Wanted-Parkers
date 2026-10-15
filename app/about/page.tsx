import Link from 'next/link';

export const metadata = {
  title: "About — SF's Most Wanted Parkers",
  description: 'Data methodology, sources, and legitimacy report for SF parking citation data.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Link
          href="/"
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-6 inline-block"
        >
          &larr; Back to Leaderboard
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Data &amp; Methodology
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
          How we source, process, and display SF parking citation data
        </p>

        {/* Data Source */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
            Data Source
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              All data comes directly from the{' '}
              <a
                href="https://data.sfgov.org/Transportation/SFMTA-Parking-Citations/ab4h-6ztd"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                SFMTA Parking Citations dataset
              </a>{' '}
              published on the City of San Francisco&apos;s official Open Data Portal
              (<code className="text-sm bg-gray-100 dark:bg-gray-700 px-1 rounded">data.sfgov.org</code>).
            </p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm">
              <li className="flex gap-2">
                <span className="text-green-600 font-bold">&#10003;</span>
                <span><strong>Official government data</strong> — published by the San Francisco Municipal Transportation Agency (SFMTA)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 font-bold">&#10003;</span>
                <span><strong>Public record</strong> — parking citations are public information under California law</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 font-bold">&#10003;</span>
                <span><strong>Regularly updated</strong> — the dataset is updated by SFMTA on an ongoing basis</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 font-bold">&#10003;</span>
                <span><strong>Machine-readable API</strong> — accessed via Socrata Open Data API (SODA2) with no authentication required</span>
              </li>
            </ul>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
            How It Works
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white mb-1">1. Live API Queries</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                When you view a month&apos;s leaderboard, we send SoQL (Socrata Query Language) queries
                directly to the SF Open Data API. The API performs server-side aggregation — grouping
                citations by license plate and summing fines — so we get results in 1-2 seconds instead
                of downloading hundreds of thousands of raw records.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white mb-1">2. Aggregation</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                For each time period, we run three parallel queries:
              </p>
              <ul className="text-gray-600 dark:text-gray-400 text-sm mt-1 ml-4 list-disc space-y-1">
                <li><strong>Top plates</strong> — <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">GROUP BY vehicle_plate, SUM(fine_amount), COUNT(*)</code></li>
                <li><strong>Violation breakdown</strong> — top violation type per plate</li>
                <li><strong>Total count</strong> — total citations issued that month</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white mb-1">3. Hotspot Mapping</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                We aggregate citations by street address and plot the top 10 locations, using the
                latitude/longitude SFMTA records on each citation (averaged per address). No
                third-party geocoding is needed.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white mb-1">4. No Data Modification</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                We do not alter, fabricate, or editorialize any citation data. The only processing
                is aggregation (summing fines, counting citations) and filtering (by date range).
                What you see is a direct reflection of SFMTA&apos;s published records.
              </p>
            </div>
          </div>
        </section>

        {/* Data Fields */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
            Data Fields Used
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-4 font-semibold text-gray-800 dark:text-white">Field</th>
                    <th className="text-left py-2 font-semibold text-gray-800 dark:text-white">Description</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600 dark:text-gray-400">
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-4 font-mono text-xs">vehicle_plate</td>
                    <td className="py-2">License plate number</td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-4 font-mono text-xs">fine_amount</td>
                    <td className="py-2">Dollar amount of the fine</td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-4 font-mono text-xs">violation_desc</td>
                    <td className="py-2">Short code for the violation type</td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-4 font-mono text-xs">citation_issued_datetime</td>
                    <td className="py-2">Date and time the citation was issued</td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-4 font-mono text-xs">citation_location</td>
                    <td className="py-2">Street address where the citation was issued</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs">citation_number</td>
                    <td className="py-2">Unique citation ID (used for deduplication)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Limitations */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
            Limitations &amp; Disclaimers
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p>
              <strong className="text-gray-800 dark:text-white">Data freshness:</strong>{' '}
              SF publishes citations a few days after they&apos;re issued. The current month is
              shown as &ldquo;so far&rdquo; and fills in as new data is published. Results are
              cached for up to an hour, so a brand-new upload can take that long to appear.
            </p>
            <p>
              <strong className="text-gray-800 dark:text-white">Dismissed citations:</strong>{' '}
              The dataset includes all <em>issued</em> citations, including those that may have
              been contested and dismissed. We cannot distinguish between paid and unpaid fines.
            </p>
            <p>
              <strong className="text-gray-800 dark:text-white">Plate accuracy:</strong>{' '}
              License plates are recorded by citation officers. Occasional typos or misreadings
              may occur, which could attribute citations to the wrong vehicle.
            </p>
            <p>
              <strong className="text-gray-800 dark:text-white">Not legal advice:</strong>{' '}
              This site is for informational and entertainment purposes only. It does not
              constitute legal advice or an official record.
            </p>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
            Tech Stack
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-400">
              <div><strong className="text-gray-800 dark:text-white">Framework:</strong> Next.js 14</div>
              <div><strong className="text-gray-800 dark:text-white">Data API:</strong> Socrata SODA2</div>
              <div><strong className="text-gray-800 dark:text-white">Maps:</strong> Leaflet + OpenStreetMap</div>
              <div><strong className="text-gray-800 dark:text-white">Caching:</strong> Next.js data cache + CDN</div>
              <div><strong className="text-gray-800 dark:text-white">Hosting:</strong> Vercel</div>
              <div><strong className="text-gray-800 dark:text-white">Cost:</strong> $0 (all free APIs)</div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-gray-400 dark:text-gray-500 text-xs pt-6 border-t border-gray-200 dark:border-gray-700">
          <p>
            Questions or feedback?{' '}
            <a
              href="https://github.com/anthropics/claude-code/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Open an issue
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
