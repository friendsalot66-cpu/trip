import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Place } from '../types';

// Function to create a numbered custom icon
const createNumberedIcon = (number: number | undefined, type: string) => {
  const typeClass = type === 'flight' ? 'is-flight' : type === 'hotel' ? 'is-hotel' : '';
  const isFlight = type === 'flight';

  const html = isFlight 
    ? `<div style="position: relative;">
         <div class="marker-pin is-flight"></div>
         <div class="marker-number" style="top:-6px">✈</div>
       </div>`
    : `<div style="position: relative;">
         <div class="marker-pin ${typeClass}"></div>
         <div class="marker-number">${number}</div>
       </div>`;
  
  return L.divIcon({
    className: 'custom-marker-icon',
    html: html,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -45]
  });
};

interface MapComponentProps {
  places: Place[];
  center: [number, number];
  zoom: number;
}

// Component to handle map resizing and flyTo operations
const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  
  // Fix "Grey Box" issue: Invalidate size when the component mounts or window resizes
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    
    // Observe the map container
    if (map.getContainer()) {
      resizeObserver.observe(map.getContainer());
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [map]);

  // Handle FlyTo
  useEffect(() => {
    const timer = setTimeout(() => {
        map.flyTo(center, zoom, { duration: 1.2, easeLinearity: 0.25 });
    }, 100);
    return () => clearTimeout(timer);
  }, [center, zoom, map]);

  return null;
};

export const MapComponent: React.FC<MapComponentProps> = ({ places, center, zoom }) => {
  // Create an array of lat/lng coordinates for the polyline
  const polylinePositions = places.map(place => [place.lat, place.lng] as [number, number]);

  // Helper to get index for numbering (skipping flights)
  let indexCounter = 0;
  const getMarkerIndex = (place: Place) => {
    if (place.type === 'flight') return undefined;
    indexCounter++;
    return indexCounter;
  };

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
      zoomControl={false}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <MapController center={center} zoom={zoom} />
      
      {/* Draw lines between points */}
      {places.length > 1 && (
        <Polyline 
          positions={polylinePositions} 
          pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.7, dashArray: '10, 10', lineCap: 'round' }} 
        />
      )}

      {places.map((place) => {
        return (
            <Marker 
            key={place.id} 
            position={[place.lat, place.lng]}
            icon={createNumberedIcon(getMarkerIndex(place), place.type)}
            >
            <Popup className="custom-popup">
                <div className="p-1 min-w-[150px]">
                <span className={`
                    text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white mb-1 inline-block
                    ${place.type === 'flight' ? 'bg-purple-500' : place.type === 'hotel' ? 'bg-amber-500' : 'bg-blue-500'}
                `}>
                    {place.type}
                </span>
                <strong className="block text-sm font-bold text-gray-800">{place.name}</strong>
                {place.time && <p className="text-xs font-mono text-gray-500 mt-0.5">{place.time}</p>}
                <p className="text-xs text-gray-600 mt-1">{place.remarks}</p>
                {place.address && <p className="text-[10px] text-gray-400 mt-1 italic truncate">{place.address}</p>}
                </div>
            </Popup>
            </Marker>
        );
      })}
    </MapContainer>
  );
};