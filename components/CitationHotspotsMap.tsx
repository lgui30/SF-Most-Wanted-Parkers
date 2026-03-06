'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Hotspot {
  location: string;
  citation_count: number;
  total_fines: number;
  top_violation: string;
  violation_breakdown: Record<string, number>;
  latitude: number;
  longitude: number;
}

function FitBounds({ hotspots }: { hotspots: Hotspot[] }) {
  const map = useMap();
  useEffect(() => {
    if (hotspots.length > 0) {
      const bounds = L.latLngBounds(
        hotspots.map(h => [h.latitude, h.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [hotspots, map]);
  return null;
}

interface Props {
  year?: number;
  month?: number;
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CitationHotspotsMap({ year, month }: Props) {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !year || !month) return;

    setIsLoading(true);
    fetch(`/api/monthly-hotspots?year=${year}&month=${month}`)
      .then(res => res.json())
      .then(data => {
        setHotspots(data.hotspots || []);
        setIsLoading(false);
      })
      .catch(() => {
        setHotspots([]);
        setIsLoading(false);
      });
  }, [isMounted, year, month]);

  const getMarkerColor = (count: number): string => {
    if (count >= 500) return '#dc2626';
    if (count >= 300) return '#ea580c';
    if (count >= 200) return '#f59e0b';
    if (count >= 100) return '#eab308';
    return '#84cc16';
  };

  const getMarkerSize = (count: number): number => {
    return Math.min(8 + Math.log(count + 1) * 3, 20);
  };

  const label = year && month ? `${MONTH_NAMES[month]} ${year}` : '';

  return (
    <div className="w-full">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          Top Violation Hotspots
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
          {isLoading
            ? `Loading hotspots for ${label}...`
            : hotspots.length > 0
            ? `Top ${hotspots.length} most ticketed locations in ${label}`
            : `No hotspot data for ${label}`}
        </p>
      </div>

      <div className="w-full h-[500px] rounded-lg shadow-lg overflow-hidden border border-gray-300 dark:border-gray-600 relative">
        {isLoading && (
          <div className="absolute inset-0 z-[1000] bg-white/70 dark:bg-gray-900/70 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mx-auto mb-3"></div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Geocoding top locations...</p>
            </div>
          </div>
        )}

        {isMounted && (
          <MapContainer
            center={[37.7749, -122.4194]}
            zoom={12}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {hotspots.length > 0 && <FitBounds hotspots={hotspots} />}

            {hotspots.map((hotspot, index) => {
              const color = getMarkerColor(hotspot.citation_count);
              const size = getMarkerSize(hotspot.citation_count);

              return (
                <CircleMarker
                  key={`${hotspot.location}-${index}`}
                  center={[hotspot.latitude, hotspot.longitude]}
                  radius={size}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity: 0.8,
                    color: '#ffffff',
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div style={{ padding: '8px', minWidth: '240px', fontFamily: 'system-ui, sans-serif' }}>
                      <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 'bold', color: '#1f2937' }}>
                        {hotspot.location}
                      </h3>
                      <div style={{ display: 'grid', gap: '4px', fontSize: '13px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#6b7280' }}>Citations:</span>
                          <span style={{ fontWeight: 700, color: '#dc2626' }}>{hotspot.citation_count.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#6b7280' }}>Total Fines:</span>
                          <span style={{ fontWeight: 700, color: '#dc2626' }}>${hotspot.total_fines.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#6b7280' }}>Top Violation:</span>
                          <span style={{ fontWeight: 600, color }}>{hotspot.top_violation}</span>
                        </div>
                      </div>
                      {Object.keys(hotspot.violation_breakdown).length > 1 && (
                        <div style={{ fontSize: '11px', color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: '6px' }}>
                          {Object.entries(hotspot.violation_breakdown).slice(0, 5).map(([v, c]) => (
                            <div key={v}>{v}: {c}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
