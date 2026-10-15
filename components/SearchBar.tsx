'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

/**
 * SearchBar component for searching license plates
 *
 * Allows users to search for a specific license plate and navigate
 * to its detail page.
 */
export default function SearchBar() {
  const [plate, setPlate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Plates are stored without spaces or dashes ("7 ABC-123" -> "7ABC123")
    const normalizedPlate = plate.trim().toUpperCase().replace(/[\s-]/g, '');
    if (!normalizedPlate) {
      setError('Please enter a license plate number');
      return;
    }
    if (!/^[A-Z0-9]{1,10}$/.test(normalizedPlate)) {
      setError('Plates contain only letters and numbers (up to 10 characters)');
      return;
    }

    setError(null);
    router.push(`/plate/${encodeURIComponent(normalizedPlate)}`);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-5">
      <form onSubmit={handleSubmit} className="flex gap-2" noValidate>
        <input
          type="text"
          value={plate}
          onChange={(e) => {
            setPlate(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Enter license plate (e.g., 7ABC123)"
          className={`flex-1 min-w-0 px-4 py-3 text-lg border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
            error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          }`}
          aria-label="License plate search"
          aria-invalid={!!error}
          aria-describedby={error ? 'plate-search-error' : undefined}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Search
        </button>
      </form>
      {error ? (
        <p id="plate-search-error" role="alert" className="text-sm text-red-600 dark:text-red-400 mt-2 text-center">
          {error}
        </p>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
          Search any license plate ticketed in San Francisco since 2025
        </p>
      )}
    </div>
  );
}
