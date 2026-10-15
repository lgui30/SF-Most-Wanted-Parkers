"""
SF Most Wanted Parkers - Data Processing Script

This script fetches parking citation data from SF Open Data Portal,
processes it to identify the worst parking offenders, and generates
structured JSON files for the web application.

Usage:
    python process_data.py [--start-date YYYY-MM-DD] [--limit N]

Requirements:
    - requests: For API calls
    - pandas: For data processing
    - python-dotenv: For environment variables
"""

import json
import os
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from urllib.parse import urlencode

import pandas as pd
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class ParkingDataProcessor:
    """
    Processes parking citation data from SF Open Data Portal.
    
    Fetches data via Socrata API, aggregates by plate number,
    and generates leaderboard and detailed citation data.
    """
    
    # Socrata API endpoints
    BASE_URL = "https://data.sfgov.org/resource/ab4h-6ztd.json"
    APP_TOKEN = os.getenv('SOCRATA_APP_TOKEN')  # Optional but recommended for higher rate limits
    
    # Field mappings
    REQUIRED_FIELDS = [
        'citation_number',
        'citation_issued_datetime',
        'violation_desc',
        'citation_location',
        'vehicle_plate_state',
        'vehicle_plate',
        'fine_amount',
        'the_geom'  # Contains coordinates as Point geometry
    ]
    
    def __init__(self, csv_file: Optional[str] = None, start_date: str = '2025-01-01'):
        """
        Initialize the processor.
        
        Args:
            csv_file: Optional path to CSV file (for backward compatibility with tests)
            start_date: Start date for filtering citations (YYYY-MM-DD format)
        """
        self.csv_file = csv_file
        self.start_date = pd.to_datetime(start_date)
        self.df: Optional[pd.DataFrame] = None
        self.plate_data: Dict[str, Dict[str, Any]] = {}
        self.output_dir = Path('public/data')
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def fetch_from_api(self, limit: int = 100000, offset: int = 0) -> List[Dict]:
        """
        Fetch data from SF Open Data Socrata API.
        
        Args:
            limit: Maximum number of records to fetch per request
            offset: Starting offset for pagination
            
        Returns:
            List of citation records
            
        Raises:
            requests.RequestException: If API request fails
        """
        params = {
            '$limit': limit,
            '$offset': offset,
            '$order': 'citation_issued_datetime DESC',
            '$where': f"citation_issued_datetime >= '{self.start_date.strftime('%Y-%m-%d')}T00:00:00.000'",
            '$select': ','.join(self.REQUIRED_FIELDS)
        }
        
        headers = {}
        if self.APP_TOKEN:
            headers['X-App-Token'] = self.APP_TOKEN
            
        try:
            print(f"Fetching records (offset: {offset}, limit: {limit})...")
            response = requests.get(
                self.BASE_URL,
                params=params,
                headers=headers,
                timeout=60
            )
            response.raise_for_status()
            
            data = response.json()
            print(f"✓ Fetched {len(data)} records")
            return data
            
        except requests.exceptions.Timeout as e:
            print(f"✗ Request timeout: {e}", file=sys.stderr)
            raise
        except requests.exceptions.RequestException as e:
            print(f"✗ API request failed: {e}", file=sys.stderr)
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response status: {e.response.status_code}", file=sys.stderr)
                print(f"Response body: {e.response.text[:500]}", file=sys.stderr)
            raise
    
    def fetch_all_data(self, batch_size: int = 50000) -> pd.DataFrame:
        """
        Fetch all available data from the API with pagination.
        
        Args:
            batch_size: Number of records to fetch per request
            
        Returns:
            DataFrame containing all fetched records
        """
        all_records = []
        offset = 0
        
        print(f"\nFetching data from SF Open Data Portal...")
        print(f"Start date: {self.start_date.strftime('%Y-%m-%d')}")
        print(f"Batch size: {batch_size:,}\n")
        
        while True:
            try:
                batch = self.fetch_from_api(limit=batch_size, offset=offset)
                
                if not batch:
                    print("No more records to fetch.\n")
                    break
                    
                all_records.extend(batch)
                offset += len(batch)
                
                # If we got fewer records than requested, we've reached the end
                if len(batch) < batch_size:
                    print("Reached end of available data.\n")
                    break
                    
                # Rate limiting - be nice to the API
                time.sleep(0.5)
                
            except Exception as e:
                print(f"Error fetching batch at offset {offset}: {e}", file=sys.stderr)
                # Try to continue with what we have
                if all_records:
                    print(f"Continuing with {len(all_records)} records fetched so far...")
                    break
                else:
                    raise
        
        if not all_records:
            print("Warning: No records fetched from API", file=sys.stderr)
            return pd.DataFrame()
        
        print(f"Total records fetched: {len(all_records):,}\n")
        
        # Convert to DataFrame
        df = pd.DataFrame(all_records)
        
        # Clean and standardize the data
        df = self._clean_data(df)
        
        return df
    
    def _clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean and standardize the fetched data.
        
        Args:
            df: Raw DataFrame from API
            
        Returns:
            Cleaned DataFrame
        """
        if df.empty:
            return df
        
        print("Cleaning and standardizing data...")
        
        # Convert date column to datetime
        if 'citation_issued_datetime' in df.columns:
            df['citation_issued_datetime'] = pd.to_datetime(
                df['citation_issued_datetime'],
                errors='coerce'
            )
        
        # Convert fine_amount to numeric, handling errors
        if 'fine_amount' in df.columns:
            df['fine_amount'] = pd.to_numeric(
                df['fine_amount'],
                errors='coerce'
            ).fillna(0.0)
        
        # Extract coordinates from the_geom field
        if 'the_geom' in df.columns:
            def extract_coords(geom):
                """Extract lat/lon from GeoJSON Point geometry"""
                if pd.isna(geom) or not isinstance(geom, dict):
                    return None, None
                try:
                    coords = geom.get('coordinates', [])
                    if len(coords) == 2:
                        # GeoJSON format is [longitude, latitude]
                        return coords[1], coords[0]  # Return as (lat, lon)
                except:
                    pass
                return None, None
            
            # Apply extraction
            coords = df['the_geom'].apply(extract_coords)
            df['latitude'] = coords.apply(lambda x: x[0])
            df['longitude'] = coords.apply(lambda x: x[1])
            
            print(f"  Extracted coordinates for {df['latitude'].notna().sum():,} records")
        
        # Clean plate numbers - remove whitespace and convert to uppercase
        if 'vehicle_plate' in df.columns:
            df['vehicle_plate'] = df['vehicle_plate'].astype(str).str.strip().str.upper()
            # Filter out invalid plates
            df = df[df['vehicle_plate'].str.len() > 0]
            df = df[df['vehicle_plate'] != 'NAN']
            df = df[df['vehicle_plate'] != 'NONE']
        
        # Drop rows with missing critical data
        df = df.dropna(subset=['vehicle_plate', 'citation_issued_datetime'])
        
        # Remove duplicate citations (same citation number)
        if 'citation_number' in df.columns:
            df = df.drop_duplicates(subset=['citation_number'], keep='first')
        
        print(f"✓ Cleaned data: {len(df):,} valid records\n")
        
        return df
    
    def load_data(self):
        """
        Load data from CSV file or API.
        
        For backward compatibility with tests, can load from CSV.
        For production, fetches from API.
        """
        if self.csv_file and os.path.exists(self.csv_file):
            print(f"Loading data from CSV file: {self.csv_file}")
            self.df = pd.read_csv(self.csv_file)
            
            # Standardize column names and clean data
            if 'citation_issued_datetime' in self.df.columns:
                self.df['citation_issued_datetime'] = pd.to_datetime(
                    self.df['citation_issued_datetime']
                )
            
            # Convert fine_amount to numeric, handling errors
            if 'fine_amount' in self.df.columns:
                self.df['fine_amount'] = pd.to_numeric(
                    self.df['fine_amount'],
                    errors='coerce'
                ).fillna(0.0)
            
            print(f"✓ Loaded {len(self.df):,} records from CSV\n")
        else:
            # Fetch from API
            self.df = self.fetch_all_data()
    
    def filter_by_date(self, start_date: Optional[str] = None):
        """
        Filter citations by start date.
        
        Args:
            start_date: Start date in YYYY-MM-DD format (uses instance default if not provided)
        """
        if start_date:
            self.start_date = pd.to_datetime(start_date)
        
        if self.df is None or self.df.empty:
            print("Warning: No data to filter", file=sys.stderr)
            return
        
        print(f"Filtering citations since {self.start_date.strftime('%Y-%m-%d')}...")
        
        original_count = len(self.df)
        self.df = self.df[self.df['citation_issued_datetime'] >= self.start_date]
        filtered_count = len(self.df)
        
        print(f"✓ Kept {filtered_count:,} of {original_count:,} records "
              f"({filtered_count/original_count*100:.1f}%)\n")
    
    def process_plates(self):
        """
        Group citations by plate and calculate aggregated statistics.
        """
        if self.df is None or self.df.empty:
            print("Warning: No data to process", file=sys.stderr)
            self.plate_data = {}
            return
        
        print("Processing plates and calculating statistics...")
        
        self.plate_data = {}
        
        # Group by vehicle plate
        grouped = self.df.groupby('vehicle_plate')
        
        for plate, group in grouped:
            # Skip invalid plates
            if not plate or plate == '' or pd.isna(plate):
                continue
            
            # Calculate aggregated statistics
            total_fines = float(group['fine_amount'].sum())
            citation_count = len(group)
            
            # Get plate state (most common one if multiple)
            plate_state = 'CA'  # Default
            if 'vehicle_plate_state' in group.columns:
                state_counts = group['vehicle_plate_state'].value_counts()
                if len(state_counts) > 0:
                    plate_state = state_counts.index[0]
            
            # Store all citations for this plate
            all_citations = []
            for _, row in group.iterrows():
                citation = {
                    'citation_number': str(row.get('citation_number', '')),
                    'date': row['citation_issued_datetime'].isoformat() if pd.notna(row['citation_issued_datetime']) else None,
                    'violation': str(row.get('violation_desc', 'Unknown')),
                    'location': str(row.get('citation_location', '')),
                    'fine_amount': float(row.get('fine_amount', 0.0))
                }
                
                # Add coordinates if available
                if 'latitude' in row and 'longitude' in row:
                    if pd.notna(row['latitude']) and pd.notna(row['longitude']):
                        citation['latitude'] = float(row['latitude'])
                        citation['longitude'] = float(row['longitude'])
                
                all_citations.append(citation)
            
            # Sort citations by date (newest first)
            all_citations.sort(key=lambda x: x['date'] or '', reverse=True)
            
            self.plate_data[plate] = {
                'total_fines': total_fines,
                'citation_count': citation_count,
                'plate_state': plate_state,
                'all_citations': all_citations
            }
        
        print(f"✓ Processed {len(self.plate_data):,} unique plates\n")
    
    def calculate_favorite_violations(self):
        """
        Calculate the most common violation type for each plate.
        """
        if not self.plate_data:
            print("Warning: No plate data to process", file=sys.stderr)
            return
        
        print("Calculating favorite violations...")
        
        for plate, data in self.plate_data.items():
            # Count violations
            violations = [c['violation'] for c in data['all_citations']]
            if violations:
                violation_counts = Counter(violations)
                favorite = violation_counts.most_common(1)[0][0]
                data['favorite_violation'] = favorite
            else:
                data['favorite_violation'] = 'Unknown'
        
        print("✓ Calculated favorite violations\n")
    
    def generate_leaderboard(self, top_n: int = 100) -> List[Dict]:
        """
        Generate leaderboard of worst offenders.
        
        Args:
            top_n: Number of top offenders to include
            
        Returns:
            List of leaderboard entries
        """
        print(f"Generating top {top_n} leaderboard...")
        
        # Sort plates by total fines
        sorted_plates = sorted(
            self.plate_data.items(),
            key=lambda x: (x[1]['total_fines'], x[1]['citation_count']),
            reverse=True
        )[:top_n]
        
        leaderboard = []
        for rank, (plate, data) in enumerate(sorted_plates, 1):
            leaderboard.append({
                'rank': rank,
                'plate': plate,
                'plate_state': data.get('plate_state', 'CA'),
                'total_fines': round(data['total_fines'], 2),
                'citation_count': data['citation_count'],
                'favorite_violation': data.get('favorite_violation', 'Unknown')
            })
        
        print(f"✓ Generated leaderboard with {len(leaderboard)} entries\n")
        
        return leaderboard
    
    def generate_heatmap_data(self):
        """
        Generate street-level heat map data for visualization.

        Strategy: Use citation_location (street address) to aggregate all citations.
        The frontend will use Nominatim (OpenStreetMap) to geocode and display these addresses.
        This works for ALL citations, not just those with coordinates.
        
        Creates two files:
        1. street_heatmap.json - Top locations with citation counts and violation breakdowns
        2. violation_summary.json - Overview of violation types across the city
        """
        if self.df is None or self.df.empty:
            print("Warning: No data available for heat map generation", file=sys.stderr)
            return
        
        print("Generating heat map data...")
        
        # Filter to only 2025 data for current year visualization
        current_year_start = pd.to_datetime('2025-01-01')
        df_2025 = self.df[self.df['citation_issued_datetime'] >= current_year_start].copy()
        
        print(f"  Using {len(df_2025):,} citations from 2025")
        
        # Street-level aggregation using citation_location
        street_aggregations = []
        
        if 'citation_location' in df_2025.columns:
            location_groups = df_2025.groupby('citation_location')
            
            for location, group in location_groups:
                # Skip empty/invalid locations
                if not location or location == '' or pd.isna(location):
                    continue
                
                # Count violations by type
                violation_counts = Counter()
                if 'violation_desc' in group.columns:
                    violation_counts = Counter(group['violation_desc'].dropna())
                
                # Get top violations
                top_violations = dict(violation_counts.most_common(5))
                
                street_aggregations.append({
                    'location': str(location),  # Street address (e.g., "100 MARKET ST")
                    'citation_count': len(group),
                    'total_fines': float(group['fine_amount'].sum()) if 'fine_amount' in group.columns else 0,
                    'top_violation': violation_counts.most_common(1)[0][0] if violation_counts else 'Unknown',
                    'violation_breakdown': {str(k): int(v) for k, v in top_violations.items()},
                })
        
        # Sort by citation count and keep top locations (limit to reduce file size)
        street_aggregations.sort(key=lambda x: x['citation_count'], reverse=True)
        
        # Keep top 1000 locations for performance
        top_locations = street_aggregations[:1000]
        
        print(f"  Generated {len(street_aggregations):,} unique street locations")
        print(f"  Keeping top {len(top_locations):,} locations for heat map")
        
        # Save street heat map data
        street_heatmap_path = self.output_dir / 'street_heatmap.json'
        with open(street_heatmap_path, 'w', encoding='utf-8') as f:
            json.dump(top_locations, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Saved street heat map: {street_heatmap_path}")
        
        # Generate violation type summary
        violation_summary = {}
        if 'violation_desc' in df_2025.columns:
            violation_counts = df_2025['violation_desc'].value_counts()
            for violation, count in violation_counts.head(20).items():
                violation_summary[str(violation)] = int(count)
        
        violation_summary_path = self.output_dir / 'violation_summary.json'
        with open(violation_summary_path, 'w', encoding='utf-8') as f:
            json.dump(violation_summary, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Saved violation summary: {violation_summary_path}\n")
    
    def save_output_files(self, top_n: int = 100):
        """
        Save processed data to JSON files in optimized format.
        
        Saves individual plate files instead of one massive JSON file
        for better performance and memory efficiency.
        
        Args:
            top_n: Number of top offenders to include in leaderboard
        """
        print("Saving output files (optimized structure)...")
        
        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate and save leaderboard
        leaderboard = self.generate_leaderboard(top_n)
        leaderboard_path = self.output_dir / 'leaderboard.json'
        
        with open(leaderboard_path, 'w', encoding='utf-8') as f:
            json.dump(leaderboard, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Saved leaderboard: {leaderboard_path}")
        
        # Create plates directory for individual plate files
        plates_dir = self.output_dir / 'plates'
        plates_dir.mkdir(exist_ok=True)
        
        print(f"Saving individual plate files...")
        for i, (plate, data) in enumerate(self.plate_data.items(), 1):
            # Save each plate's data in separate file
            plate_file = plates_dir / f"{plate}.json"
            with open(plate_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            # Progress indicator for large datasets
            if i % 1000 == 0:
                print(f"  Progress: {i:,} / {len(self.plate_data):,} plates saved")
        
        print(f"✓ Saved {len(self.plate_data):,} individual plate files to {plates_dir}")
        
        # Print summary statistics
        print("\n" + "="*60)
        print("SUMMARY STATISTICS")
        print("="*60)
        print(f"Total unique plates: {len(self.plate_data):,}")
        print(f"Total citations: {sum(d['citation_count'] for d in self.plate_data.values()):,}")
        print(f"Total fines: ${sum(d['total_fines'] for d in self.plate_data.values()):,.2f}")
        
        if leaderboard:
            print(f"\nTop offender: {leaderboard[0]['plate']} "
                  f"(${leaderboard[0]['total_fines']:,.2f}, "
                  f"{leaderboard[0]['citation_count']} citations)")
        
        print("="*60 + "\n")
    
    def run(self, top_n: int = 100):
        """
        Run the complete data processing pipeline.
        
        Args:
            top_n: Number of top offenders to include in leaderboard
        """
        print("\n" + "="*60)
        print("SF MOST WANTED PARKERS - DATA PROCESSING")
        print("="*60 + "\n")
        
        start_time = time.time()
        
        try:
            # Step 1: Load data
            self.load_data()
            
            if self.df is None or self.df.empty:
                print("Error: No data loaded. Exiting.", file=sys.stderr)
                return
            
            # Step 2: Filter by date
            self.filter_by_date()
            
            # Step 3: Process plates
            self.process_plates()
            
            # Step 4: Calculate favorite violations
            self.calculate_favorite_violations()
            
            # Step 5: Generate heat map data
            self.generate_heatmap_data()
            
            # Step 6: Save output files
            self.save_output_files(top_n)
            
            elapsed = time.time() - start_time
            print(f"✓ Processing complete in {elapsed:.1f} seconds\n")
            
        except Exception as e:
            print(f"\n✗ Error during processing: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            sys.exit(1)


def main():
    """Main entry point for the script."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Fetch and process SF parking citation data'
    )
    parser.add_argument(
        '--start-date',
        default='2025-01-01',
        help='Start date for filtering citations (YYYY-MM-DD). Default: 2025-01-01'
    )
    parser.add_argument(
        '--top-n',
        type=int,
        default=100,
        help='Number of top offenders to include in leaderboard. Default: 100'
    )
    parser.add_argument(
        '--csv',
        help='Optional: Load data from CSV file instead of API'
    )
    
    args = parser.parse_args()
    
    # Validate date format
    try:
        pd.to_datetime(args.start_date)
    except Exception as e:
        print(f"Error: Invalid date format '{args.start_date}'. Use YYYY-MM-DD", file=sys.stderr)
        sys.exit(1)
    
    # Create processor and run
    processor = ParkingDataProcessor(
        csv_file=args.csv,
        start_date=args.start_date
    )
    processor.run(top_n=args.top_n)


if __name__ == '__main__':
    main()


