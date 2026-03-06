/**
 * Type definitions for SF's Most Wanted Parkers application
 */

export interface LeaderboardEntry {
  rank: number;
  plate: string;
  total_fines: number;
  citation_count: number;
}

export interface Citation {
  date: string | null;
  violation: string;
  fine_amount?: number;
  citation_number?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
}

export interface PlateDetails {
  total_fines: number;
  citation_count: number;
  plate_state?: string;
  favorite_violation: string;
  all_citations: Citation[];
}

export interface MonthlyLeaderboardEntry {
  rank: number;
  plate: string;
  total_fines: number;
  citation_count: number;
  favorite_violation: string;
}

export interface AvailableMonth {
  year: number;
  month: number;
}

/**
 * @deprecated Use individual plate files instead (public/data/plates/{plate}.json)
 * This interface is kept for backward compatibility but the massive
 * all_plates_details.json file has been replaced with optimized structure.
 */
export interface AllPlatesDetails {
  [plate: string]: PlateDetails;
}

/**
 * Plate index entry for quick lookups
 * The plate index provides metadata about all plates without loading full details
 */
export interface PlateIndexEntry {
  total_fines: number;
  citation_count: number;
  plate_state: string;
  favorite_violation: string;
  file: string; // Relative path to individual plate file
}

/**
 * Plate index mapping
 */
export interface PlateIndex {
  [plate: string]: PlateIndexEntry;
}

