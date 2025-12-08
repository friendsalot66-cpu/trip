
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Place } from '../types';
import { Youtube, PlusCircle } from 'lucide-react';

// Function to create a numbered custom icon
const createNumberedIcon = (number: number | undefined, type: string, colorClass: string = '') => {
  const isFlight = type === 'flight';
  const isStopover = type === 'stopover';
  const typeClass = isFlight ? 'is-flight' : type === 'hotel' ? 'is-hotel' : isStopover ? 'is-stopover' : '';

  const html = isFlight 
    ? `<div style="position: relative;">
         <div class="marker-pin is-flight"></div>
         <div class="marker-number" style="top:-6px">✈</div>
       </div>`
    : `<div style="position: relative;">
         <div class="marker-pin ${typeClass}" style="${colorClass ? `background-color: ${colorClass}` : ''}"></div>
         <div class="marker-number">${number || ''}</div>
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
  allPlaces?: { dayIndex: number, places: Place[] }[]; // For Overview Mode
  isOverview?: boolean;
  stopoverCandidates?: Place[];
  onAddPlace?: (place: Place) => void;
}

// Component to handle map resizing, flyTo, and auto-zoom bounds
const MapController: React.FC<{ 
    center: [number, number]; 
    zoom: number; 
    bounds?: L.LatLngBounds;
    places?: Place[];
    isOverview?: boolean;
}> = ({ center, zoom, bounds, places, isOverview }) => {
  const map = useMap();
  const prevCenterRef = useRef<string>('');
  const prevPlacesLenRef = useRef<number>(0);
  const prevOverviewRef = useRef<boolean>(false);

  // 1. Resize Handler
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (map.getContainer()) resizeObserver.observe(map.getContainer());
    return () => resizeObserver.disconnect();
  }, [map]);

  // 2. Logic Controller
  useEffect(() => {
      const centerKey = `${center[0]},${center[1]}`;
      const hasPlacesChanged = places && places.length !== prevPlacesLenRef.current;
      const hasCenterChanged = centerKey !== prevCenterRef.current;
      const isSwitchingToOverview = isOverview && !prevOverviewRef.current;
      
      // A. Priority: Overview Mode Bounds
      if (isOverview && bounds && bounds.isValid()) {
           map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 0.5 });
      }
      // B. Priority: Day Switch (Places array changed significantly)
      else if (hasPlacesChanged && !isOverview && places && places.length > 0) {
          const locations = places
            .filter(p => p.type !== 'flight' && !isNaN(p.lat) && !isNaN(p.lng))
            .map(p => L.latLng(p.lat, p.lng));
          
          if (locations.length > 0) {
              const newBounds = L.latLngBounds(locations);
              map.fitBounds(newBounds, { padding: [50, 50], animate: true, duration: 0.5 });
          } else if (hasCenterChanged && !isNaN(center[0])) {
               // Fallback if no valid places to zoom to, but center exists
               map.flyTo(center, zoom, { duration: 0.5 });
          }
      }
      // C. Priority: Explicit Center Change (User Click)
      else if (hasCenterChanged && !isNaN(center[0])) {
           map.flyTo(center, zoom, { duration: 0.5, easeLinearity: 0.25 });
      }

      // Update Refs
      prevCenterRef.current = centerKey;
      prevPlacesLenRef.current = places ? places.length : 0;
      prevOverviewRef.current = !!isOverview;

  }, [places, center, zoom, map, bounds, isOverview]);

  return null;
};

// Distinct colors for days in Overview mode
const DAY_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export const MapComponent: React.FC<MapComponentProps> = ({ places, center, zoom, allPlaces, isOverview, stopoverCandidates, onAddPlace }) => {
  
  // Guard against invalid centers
  const safeCenter: [number, number] = (!center || isNaN(center[0]) || isNaN(center[1])) 
    ? [25.0330, 121.5654] 
    : center;

  let mapContent;
  let mapBounds: L.LatLngBounds | undefined;

  if (isOverview && allPlaces) {
      // Collect all points to fit bounds, checking validity
      const allPoints = allPlaces.flatMap(d => d.places
        .filter(p => !isNaN(p.lat) && !isNaN(p.lng))
        .map(p => L.latLng(p.lat, p.lng))
      );
      
      if (allPoints.length > 0) {
          mapBounds = L.latLngBounds(allPoints);
      }

      mapContent = allPlaces.map((day, dayIdx) => {
          const color = DAY_COLORS[dayIdx % DAY_COLORS.length];
          const validPlaces = day.places.filter(p => !isNaN(p.lat) && !isNaN(p.lng));
          const polyPositions = validPlaces.map(p => [p.lat, p.lng] as [number, number]);
          
          return (
              <React.Fragment key={dayIdx}>
                  {validPlaces.length > 1 && (
                      <Polyline 
                        positions={polyPositions} 
                        pathOptions={{ color: color, weight: 3, opacity: 0.8 }} 
                      />
                  )}
                  {validPlaces.map((place, idx) => (
                      <Marker
                        key={`${dayIdx}-${place.id}`}
                        position={[place.lat, place.lng]}
                        icon={createNumberedIcon(idx + 1, place.type, color)}
                      >
                         <Popup>
                            <strong>Day {dayIdx + 1}: {place.name}</strong>
                         </Popup>
                      </Marker>
                  ))}
              </React.Fragment>
          )
      });
  } else {
      // Single Day View
      const validPlaces = places.filter(p => !isNaN(p.lat) && !isNaN(p.lng));
      const polylinePositions = validPlaces.map(place => [place.lat, place.lng] as [number, number]);
      
      let indexCounter = 0;
      const getMarkerIndex = (place: Place) => {
        if (place.type === 'flight') return undefined;
        indexCounter++;
        return indexCounter;
      };

      mapContent = (
          <>
            {validPlaces.length > 1 && (
                <Polyline 
                positions={polylinePositions} 
                pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.7, dashArray: '10, 10', lineCap: 'round' }} 
                />
            )}
            {validPlaces.map((place) => (
                <Marker 
                    key={place.id} 
                    position={[place.lat, place.lng]}
                    icon={createNumberedIcon(getMarkerIndex(place), place.type)}
                >
                    <Popup className="custom-popup">
                        <div className="p-1 min-w-[180px]">
                        <span className={`
                            text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white mb-1 inline-block
                            ${place.type === 'flight' ? 'bg-purple-500' : place.type === 'hotel' ? 'bg-amber-500' : 'bg-blue-500'}
                        `}>
                            {place.type}
                        </span>
                        <strong className="block text-sm font-bold text-gray-800">{place.name}</strong>
                        {place.time && <p className="text-xs font-mono text-gray-500 mt-0.5">{place.time}</p>}
                        <p className="text-xs text-gray-600 mt-1">{place.remarks}</p>
                        {place.travelTime && <p className="text-xs text-brand-600 font-bold mt-1">🚗 {place.travelTime}</p>}
                        {place.expenses && <p className="text-xs text-emerald-600 font-bold mt-1">💰 {place.expenses.currency}{place.expenses.amount}</p>}
                        </div>
                    </Popup>
                </Marker>
            ))}

            {/* Stopover Candidates (Green Pins) */}
            {stopoverCandidates && stopoverCandidates.filter(p => !isNaN(p.lat) && !isNaN(p.lng)).map((place, idx) => (
                <Marker
                    key={`stopover-${idx}`}
                    position={[place.lat, place.lng]}
                    icon={createNumberedIcon(undefined, 'stopover')}
                >
                    <Popup className="custom-popup">
                        <div className="p-0 min-w-[200px] overflow-hidden rounded-lg">
                            <div className="h-24 w-full bg-gray-200 relative overflow-hidden">
                                <img 
                                    src={`https://placehold.co/400x200/10b981/ffffff?text=${encodeURIComponent(place.name)}`}
                                    alt={place.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="p-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white bg-emerald-500 mb-1 inline-block">
                                    Recommended
                                </span>
                                <strong className="block text-sm font-bold text-gray-800 mb-1">{place.name}</strong>
                                <p className="text-xs text-gray-500 mb-2">{place.address}</p>
                                <p className="text-xs text-gray-600 mb-3">{place.remarks}</p>
                                
                                {onAddPlace && (
                                    <button
                                        onClick={() => onAddPlace({ ...place, id: crypto.randomUUID(), type: 'activity' })}
                                        className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 py-2 rounded transition-colors shadow-sm mb-2"
                                    >
                                        <PlusCircle size={14} /> Add to Itinerary
                                    </button>
                                )}
                                <a 
                                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(place.name + " travel guide")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 py-2 rounded transition-colors"
                                >
                                    <Youtube size={14} /> Watch on YouTube
                                </a>
                            </div>
                        </div>
                    </Popup>
                </Marker>
            ))}
          </>
      );
  }

  return (
    <MapContainer
      center={safeCenter}
      zoom={zoom}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
      zoomControl={false}
      scrollWheelZoom={true}
      className="map-container"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <MapController 
        center={safeCenter} 
        zoom={zoom} 
        bounds={mapBounds} 
        places={!isOverview ? places : undefined} 
        isOverview={isOverview}
      />
      {mapContent}
    </MapContainer>
  );
};
