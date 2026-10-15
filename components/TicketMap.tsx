'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Citation } from '@/types';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
    }
  }, [points, map]);
  return null;
}

interface TicketMapProps {
  citations: Citation[];
}

/**
 * TicketMap component displays parking citations on an interactive map
 * 
 * Uses React Leaflet to show the locations of all parking tickets
 * for a specific license plate with popups showing violation details.
 */
export default function TicketMap({ citations }: TicketMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  // Only render map on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter citations with valid coordinates
  const validCitations = citations.filter(
    (citation) => 
      typeof citation.latitude === 'number' &&
      typeof citation.longitude === 'number' &&
      Number.isFinite(citation.latitude) &&
      Number.isFinite(citation.longitude)
  );

  if (!isMounted) {
    return (
      <div className="w-full h-[500px] bg-gray-200 rounded-lg flex items-center justify-center">
        <p className="text-gray-600">Loading map...</p>
      </div>
    );
  }

  if (validCitations.length === 0) {
    return (
      <div className="w-full h-[500px] bg-gray-100 rounded-lg flex items-center justify-center border-2 border-gray-300">
        <div className="text-center p-6">
          <p className="text-gray-700 font-semibold text-lg mb-2">No Location Data Available</p>
          <p className="text-gray-600">
            This plate has {citations.length} citation(s), but none have valid GPS coordinates.
          </p>
        </div>
      </div>
    );
  }

  // San Francisco coordinates
  const center: [number, number] = [37.7749, -122.4194];

  // Calculate bounds if we have citations
  let mapCenter = center;
  if (validCitations.length > 0) {
    const avgLat = validCitations.reduce((sum, c) => sum + c.latitude!, 0) / validCitations.length;
    const avgLng = validCitations.reduce((sum, c) => sum + c.longitude!, 0) / validCitations.length;
    mapCenter = [avgLat, avgLng];
  }

  return (
    <div className="w-full h-[500px] rounded-lg overflow-hidden shadow-lg border-2 border-gray-300">
      <MapContainer
        center={mapCenter}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={validCitations.map(c => [c.latitude!, c.longitude!] as [number, number])} />
        {validCitations.map((citation, index) => (
          <Marker
            key={index}
            position={[citation.latitude!, citation.longitude!]}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold text-gray-800 mb-1">
                  {citation.violation}
                </p>
                {citation.location && (
                  <p className="text-gray-700 text-xs">{citation.location}</p>
                )}
                {!!citation.fine_amount && (
                  <p className="text-red-600 text-xs font-semibold">${citation.fine_amount.toFixed(2)}</p>
                )}
                {citation.date && (
                  <p className="text-gray-600 text-xs">
                    {new Date(citation.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

