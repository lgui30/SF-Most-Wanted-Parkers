'use client';

import { getViolationDefinition } from '@/lib/violationCodes';

interface Props {
  code: string;
  className?: string;
}

export default function ViolationBadge({ code, className = '' }: Props) {
  const definition = getViolationDefinition(code);

  return (
    <span className={`relative group cursor-help ${className}`}>
      <span className="border-b border-dotted border-gray-400 dark:border-gray-500">
        {code}
      </span>
      {definition && (
        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs leading-relaxed shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 text-center">
          {definition}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
        </span>
      )}
    </span>
  );
}
