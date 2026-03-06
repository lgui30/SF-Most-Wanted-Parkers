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
  const router = useRouter();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate input
    const trimmedPlate = plate.trim().toUpperCase();
    if (!trimmedPlate) {
      alert('Please enter a license plate number');
      return;
    }

    // Navigate to the plate details page
    router.push(`/plate/${encodeURIComponent(trimmedPlate)}`);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-5">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="Enter license plate (e.g., 7ABC123)"
          className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          aria-label="License plate search"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Search
        </button>
      </form>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
        Search for any California license plate to see their parking violation history
      </p>
    </div>
  );
}

