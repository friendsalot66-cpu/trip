

export type PlaceType = 'activity' | 'flight' | 'hotel';

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  remarks: string;
  address?: string;
  type: PlaceType;
  time?: string; // e.g., "14:00" or "Check-in"
}

export interface DayItinerary {
  dayId: string;
  title: string;
  date?: string; // ISO string YYYY-MM-DD
  places: Place[];
}

export interface TripInfo {
  destination: string;
  startDate: string;
  endDate: string;
}

export interface Trip {
  id: string;
  created_at?: string;
  destination: string;
  start_date: string;
  end_date: string;
  title: string;
  itinerary: DayItinerary[];
  cover_image_url?: string;
}

export interface MapViewState {
  center: [number, number];
  zoom: number;
}