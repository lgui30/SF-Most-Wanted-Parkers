#!/usr/bin/env python3
"""
Fetch SF Parking Citation Data from SFMTA Dataset (SODA2 API)

Fetches parking citation data month by month, stores in Postgres,
and builds a monthly leaderboard of top offenders.

Usage:
    python fetch_2025_data.py --start-year 2026 --start-month 2 --end-year 2026 --end-month 2
    python fetch_2025_data.py  # defaults: 2025-01 to current month
"""

import json
import os
import sys
import time
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from collections import Counter, defaultdict

import pandas as pd
import requests
import psycopg2
from psycopg2.extras import Json
from dotenv import load_dotenv

load_dotenv('.env.local')

DATABASE_URL = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL')

# SODA2 API - works without authentication
BASE_URL = "https://data.sfgov.org/resource/ab4h-6ztd.json"

REQUIRED_FIELDS = [
    'citation_number',
    'citation_issued_datetime',
    'violation_desc',
    'citation_location',
    'vehicle_plate_state',
    'vehicle_plate',
    'fine_amount',
    'the_geom'
]


def fetch_month_data(year: int, month: int, batch_size: int = 50000) -> List[Dict]:
    """Fetch all citation data for a specific month using SODA2 API."""
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)

    start_str = start_date.strftime('%Y-%m-%dT00:00:00.000')
    end_str = end_date.strftime('%Y-%m-%dT00:00:00.000')

    print(f"  Fetching {year}-{month:02d} ({start_str} to {end_str})...")

    all_data = []
    offset = 0

    while True:
        params = {
            '$limit': batch_size,
            '$offset': offset,
            '$order': 'citation_issued_datetime DESC',
            '$where': f"citation_issued_datetime >= '{start_str}' AND citation_issued_datetime < '{end_str}'",
            '$select': ','.join(REQUIRED_FIELDS)
        }

        try:
            response = requests.get(BASE_URL, params=params, timeout=60)
            response.raise_for_status()
            data = response.json()

            if not data:
                break

            all_data.extend(data)
            offset += len(data)
            print(f"    Fetched {len(data):,} records (total: {len(all_data):,})")

            if len(data) < batch_size:
                break

            time.sleep(0.5)

        except requests.exceptions.Timeout:
            print(f"    Timeout at offset {offset}, continuing with {len(all_data):,} records...")
            break
        except requests.exceptions.RequestException as e:
            print(f"    Error: {e}")
            if all_data:
                print(f"    Continuing with {len(all_data):,} records...")
                break
            raise

    print(f"  Total for {year}-{month:02d}: {len(all_data):,} records")
    return all_data


def clean_data(raw_data: List[Dict]) -> pd.DataFrame:
    """Clean and standardize raw citation data."""
    if not raw_data:
        return pd.DataFrame()

    df = pd.DataFrame(raw_data)

    df['citation_issued_datetime'] = pd.to_datetime(
        df['citation_issued_datetime'], errors='coerce'
    )
    df['fine_amount'] = pd.to_numeric(
        df['fine_amount'], errors='coerce'
    ).fillna(0.0)

    # Extract coordinates from the_geom
    df['latitude'] = None
    df['longitude'] = None
    if 'the_geom' in df.columns:
        def extract_coords(geom):
            if pd.isna(geom) or not isinstance(geom, dict):
                return None, None
            try:
                coords = geom.get('coordinates', [])
                if len(coords) == 2:
                    return coords[1], coords[0]
            except Exception:
                pass
            return None, None

        coords = df['the_geom'].apply(extract_coords)
        df['latitude'] = coords.apply(lambda x: x[0])
        df['longitude'] = coords.apply(lambda x: x[1])

    # Clean plate numbers
    df['vehicle_plate'] = df['vehicle_plate'].astype(str).str.strip().str.upper()
    df = df[df['vehicle_plate'].str.len() > 0]
    df = df[~df['vehicle_plate'].isin(['NAN', 'NONE', 'NULL', ''])]

    df = df.dropna(subset=['vehicle_plate', 'citation_issued_datetime'])

    if 'citation_number' in df.columns:
        df = df.drop_duplicates(subset=['citation_number'], keep='first')

    return df


def aggregate_by_plate(df: pd.DataFrame) -> Dict[str, Dict]:
    """Aggregate citations by plate number."""
    plate_data = {}
    grouped = df.groupby('vehicle_plate')

    for plate, group in grouped:
        if not plate or plate == '' or pd.isna(plate):
            continue

        total_fines = float(group['fine_amount'].sum())
        citation_count = len(group)

        plate_state = 'CA'
        if 'vehicle_plate_state' in group.columns:
            state_counts = group['vehicle_plate_state'].value_counts()
            if len(state_counts) > 0:
                plate_state = state_counts.index[0]

        all_citations = []
        for _, row in group.iterrows():
            citation = {
                'citation_number': str(row.get('citation_number', '')),
                'date': row['citation_issued_datetime'].isoformat() if pd.notna(row['citation_issued_datetime']) else None,
                'violation': str(row.get('violation_desc', 'Unknown')),
                'location': str(row.get('citation_location', '')),
                'fine_amount': float(row.get('fine_amount', 0.0))
            }
            if pd.notna(row.get('latitude')) and pd.notna(row.get('longitude')):
                citation['latitude'] = float(row['latitude'])
                citation['longitude'] = float(row['longitude'])
            all_citations.append(citation)

        all_citations.sort(key=lambda x: x['date'] or '', reverse=True)

        violations = [c['violation'] for c in all_citations]
        violation_counts = Counter(violations)
        favorite_violation = violation_counts.most_common(1)[0][0] if violations else 'Unknown'

        plate_data[plate] = {
            'total_fines': total_fines,
            'citation_count': citation_count,
            'plate_state': plate_state,
            'favorite_violation': favorite_violation,
            'all_citations': all_citations
        }

    return plate_data


def aggregate_by_location(df: pd.DataFrame) -> Dict[str, Dict]:
    """Aggregate citations by location for hotspots."""
    location_data = {}

    valid_df = df[df['citation_location'].notna() & (df['citation_location'].str.strip() != '')]
    valid_df = valid_df[~valid_df['citation_location'].isin(['None', 'NULL', ''])]

    grouped = valid_df.groupby('citation_location')

    for location, group in grouped:
        if not location or location == '' or pd.isna(location):
            continue

        location = str(location).strip()
        total_fines = float(group['fine_amount'].sum())
        citation_count = len(group)

        violations = group['violation_desc'].value_counts()
        top_violation = violations.index[0] if len(violations) > 0 else 'Unknown'
        violation_breakdown = violations.to_dict()

        latitude = None
        longitude = None
        if 'latitude' in group.columns and 'longitude' in group.columns:
            coords = group[['latitude', 'longitude']].dropna()
            if len(coords) > 0:
                latitude = float(coords.iloc[0]['latitude'])
                longitude = float(coords.iloc[0]['longitude'])

        location_data[location] = {
            'citation_count': citation_count,
            'total_fines': total_fines,
            'top_violation': top_violation,
            'violation_breakdown': violation_breakdown,
            'latitude': latitude,
            'longitude': longitude
        }

    return location_data


def ensure_schema(conn):
    """Create monthly_leaderboard table if it doesn't exist."""
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS monthly_leaderboard (
            year            INTEGER NOT NULL,
            month           INTEGER NOT NULL,
            rank            INTEGER NOT NULL,
            plate           TEXT    NOT NULL,
            total_fines     NUMERIC NOT NULL,
            citation_count  INTEGER NOT NULL,
            favorite_violation TEXT,
            PRIMARY KEY (year, month, rank)
        );
        CREATE INDEX IF NOT EXISTS idx_monthly_lb_date
            ON monthly_leaderboard(year DESC, month DESC);
    """)
    conn.commit()
    cur.close()


def store_month_data(plate_data: Dict[str, Dict], location_data: Dict[str, Dict],
                     year: int, month: int):
    """Store month's data in database. Idempotent - clears old data for the month first."""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        ensure_schema(conn)

        # --- Delete existing citations for this month to avoid double-counting ---
        month_start = f"{year}-{month:02d}-01"
        if month == 12:
            month_end = f"{year + 1}-01-01"
        else:
            month_end = f"{year}-{month + 1:02d}-01"

        print(f"  Clearing old data for {year}-{month:02d}...")

        # For each plate, remove citations from this month from JSONB array
        cur.execute("""
            UPDATE plate_details
            SET citations = (
                SELECT COALESCE(jsonb_agg(c), '[]'::jsonb)
                FROM jsonb_array_elements(citations) AS c
                WHERE (c->>'date')::timestamp < %s::timestamp
                   OR (c->>'date')::timestamp >= %s::timestamp
            )
            WHERE EXISTS (
                SELECT 1 FROM jsonb_array_elements(citations) AS c
                WHERE (c->>'date')::timestamp >= %s::timestamp
                  AND (c->>'date')::timestamp < %s::timestamp
            )
        """, (month_start, month_end, month_start, month_end))
        conn.commit()

        # --- Store plate details ---
        print(f"  Storing {len(plate_data):,} plates...")
        stored = 0
        for plate, data in plate_data.items():
            cur.execute("""
                INSERT INTO plate_details (plate, total_fines, citation_count, plate_state, favorite_violation, citations)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (plate) DO UPDATE SET
                    citations = plate_details.citations || EXCLUDED.citations,
                    total_fines = (
                        SELECT COALESCE(SUM((c->>'fine_amount')::numeric), 0)
                        FROM jsonb_array_elements(plate_details.citations || EXCLUDED.citations) AS c
                    ),
                    citation_count = (
                        SELECT COUNT(*)
                        FROM jsonb_array_elements(plate_details.citations || EXCLUDED.citations)
                    ),
                    plate_state = EXCLUDED.plate_state,
                    favorite_violation = EXCLUDED.favorite_violation
            """, (
                plate,
                data['total_fines'],
                data['citation_count'],
                data['plate_state'],
                data['favorite_violation'],
                Json(data['all_citations'])
            ))
            stored += 1
            if stored % 2000 == 0:
                conn.commit()
                print(f"    {stored:,} / {len(plate_data):,} plates...")

        conn.commit()
        print(f"  Stored {stored:,} plates")

        # --- Store location hotspots (replace for this month) ---
        print(f"  Storing {len(location_data):,} hotspots...")
        hotspot_count = 0
        for location, data in location_data.items():
            cur.execute("""
                INSERT INTO citation_hotspots
                    (location, citation_count, total_fines, top_violation, violation_breakdown, latitude, longitude)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (location) DO UPDATE SET
                    citation_count = citation_hotspots.citation_count + EXCLUDED.citation_count,
                    total_fines = citation_hotspots.total_fines + EXCLUDED.total_fines,
                    top_violation = EXCLUDED.top_violation,
                    violation_breakdown = citation_hotspots.violation_breakdown || EXCLUDED.violation_breakdown,
                    latitude = COALESCE(EXCLUDED.latitude, citation_hotspots.latitude),
                    longitude = COALESCE(EXCLUDED.longitude, citation_hotspots.longitude)
            """, (
                location,
                data['citation_count'],
                data['total_fines'],
                data['top_violation'],
                Json(data['violation_breakdown']),
                data['latitude'],
                data['longitude']
            ))
            hotspot_count += 1

        conn.commit()
        print(f"  Stored {hotspot_count:,} hotspots")

        # --- Build monthly leaderboard for this month ---
        print(f"  Building monthly leaderboard for {year}-{month:02d}...")

        # Sort plates by fines for THIS month only
        sorted_plates = sorted(
            plate_data.items(),
            key=lambda x: (x[1]['total_fines'], x[1]['citation_count']),
            reverse=True
        )[:30]

        # Clear old monthly leaderboard for this month
        cur.execute(
            "DELETE FROM monthly_leaderboard WHERE year = %s AND month = %s",
            (year, month)
        )

        for rank, (plate, data) in enumerate(sorted_plates, 1):
            cur.execute("""
                INSERT INTO monthly_leaderboard (year, month, rank, plate, total_fines, citation_count, favorite_violation)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                year, month, rank, plate,
                round(data['total_fines'], 2),
                data['citation_count'],
                data['favorite_violation']
            ))

        conn.commit()
        if sorted_plates:
            top_plate, top_data = sorted_plates[0]
            print(f"  #1 offender: {top_plate} - ${top_data['total_fines']:,.0f} ({top_data['citation_count']} tickets)")

    except Exception as e:
        print(f"  Error storing data: {e}")
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def update_alltime_leaderboard():
    """Rebuild the all-time leaderboard from plate_details."""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        print("  Rebuilding all-time leaderboard...")
        cur.execute("DELETE FROM leaderboard")
        cur.execute("""
            INSERT INTO leaderboard (rank, plate, total_fines, citation_count)
            SELECT
                ROW_NUMBER() OVER (ORDER BY total_fines DESC, citation_count DESC),
                plate, total_fines, citation_count
            FROM plate_details
            ORDER BY total_fines DESC, citation_count DESC
            LIMIT 30
        """)
        conn.commit()
        cur.execute("SELECT COUNT(*) FROM leaderboard")
        count = cur.fetchone()[0]
        print(f"  All-time leaderboard updated ({count} entries)")
    except Exception as e:
        print(f"  Error updating leaderboard: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


def main():
    parser = argparse.ArgumentParser(description='Fetch SF Parking Citation Data')
    parser.add_argument('--start-year', type=int, default=2025)
    parser.add_argument('--end-year', type=int, default=2026)
    parser.add_argument('--start-month', type=int, default=1)
    parser.add_argument('--end-month', type=int, default=12)
    parser.add_argument('--dry-run', action='store_true', help='Fetch and process but do not write to DB')
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("SF PARKING CITATIONS - MONTHLY DATA FETCHER")
    print(f"Range: {args.start_year}-{args.start_month:02d} to {args.end_year}-{args.end_month:02d}")
    print(f"API: SODA2 (no auth required)")
    print("=" * 60 + "\n")

    start_time = time.time()
    total_citations = 0
    processed_months = 0

    try:
        for year in range(args.start_year, args.end_year + 1):
            year_start = args.start_month if year == args.start_year else 1
            year_end = args.end_month if year == args.end_year else 12

            # Don't fetch future months
            now = datetime.now()
            if year == now.year:
                year_end = min(year_end, now.month)
            elif year > now.year:
                break

            for month in range(year_start, year_end + 1):
                print(f"\n--- {year}-{month:02d} ---")

                raw_data = fetch_month_data(year, month)
                if not raw_data:
                    print(f"  No data for {year}-{month:02d}")
                    continue

                df = clean_data(raw_data)
                if df.empty:
                    print(f"  No valid data after cleaning")
                    continue

                plate_data = aggregate_by_plate(df)
                location_data = aggregate_by_location(df)

                print(f"  {len(df):,} clean citations, {len(plate_data):,} plates, {len(location_data):,} locations")

                if args.dry_run:
                    # Just show the top 5
                    sorted_p = sorted(plate_data.items(), key=lambda x: x[1]['total_fines'], reverse=True)[:5]
                    print(f"  [DRY RUN] Top 5:")
                    for i, (p, d) in enumerate(sorted_p, 1):
                        print(f"    {i}. {p}: ${d['total_fines']:,.0f} ({d['citation_count']} tickets) - {d['favorite_violation']}")
                else:
                    store_month_data(plate_data, location_data, year, month)

                total_citations += len(raw_data)
                processed_months += 1
                time.sleep(1)

        if not args.dry_run:
            update_alltime_leaderboard()

        elapsed = time.time() - start_time
        print("\n" + "=" * 60)
        print("COMPLETE")
        print(f"Months processed: {processed_months}")
        print(f"Total citations: {total_citations:,}")
        print(f"Time: {elapsed:.1f}s ({elapsed/60:.1f}m)")
        print("=" * 60 + "\n")

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
