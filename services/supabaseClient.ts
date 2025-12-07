
import { createClient } from '@supabase/supabase-js';
import { Trip, DayItinerary } from '@/types';

// Supabase configuration
const supabaseUrl: string = 'https://fmazlncxcmsredrxygha.supabase.co';
const supabaseKey: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtYXpsbmN4Y21zcmVkcnh5Z2hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODkzODksImV4cCI6MjA4MDI2NTM4OX0.1FEZCmpvPPdnn-_PNbivLywiUivk62CEMn2uvSxusF8';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseKey && supabaseUrl !== '' && supabaseKey !== '';
};

export const fetchTrips = async (): Promise<Trip[]> => {
  if (!isSupabaseConfigured()) return [];
  
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching trips:', error);
    // Return empty array on error to prevent app crash
    return [];
  }
  
  // Sanitize data to ensure strict type compliance even if DB fields are null/missing
  return (data || []).map((t: any) => ({
      id: t.id,
      created_at: t.created_at,
      destination: t.destination || 'Unknown Destination',
      start_date: t.start_date || new Date().toISOString(),
      end_date: t.end_date || new Date().toISOString(),
      title: t.title || 'Untitled Trip',
      itinerary: t.itinerary || [],
      cover_image_url: t.cover_image_url
  }));
};

export const createTrip = async (destination: string, startDate: string, endDate: string, itinerary: DayItinerary[]): Promise<Trip | null> => {
  if (!isSupabaseConfigured()) {
    console.warn("Supabase not configured. Using mock storage (memory only).");
    return {
        id: crypto.randomUUID(),
        destination,
        start_date: startDate,
        end_date: endDate,
        title: `${destination} Trip`,
        itinerary
    };
  }

  const { data, error } = await supabase
    .from('trips')
    .insert([
      {
        destination,
        start_date: startDate,
        end_date: endDate,
        title: `${destination} Trip`,
        itinerary: itinerary
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating trip:', error);
    throw error;
  }
  
  // Sanitize response
  if (data) {
      return {
          id: data.id,
          created_at: data.created_at,
          destination: data.destination || destination,
          start_date: data.start_date || startDate,
          end_date: data.end_date || endDate,
          title: data.title || `${destination} Trip`,
          itinerary: data.itinerary || itinerary,
          cover_image_url: data.cover_image_url
      };
  }
  return null;
};

export const updateTripItinerary = async (tripId: string, itinerary: DayItinerary[]) => {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('trips')
    .update({ itinerary })
    .eq('id', tripId);

  if (error) {
    console.error('Error updating itinerary:', error);
    throw error;
  }
};

export const updateTripTitle = async (tripId: string, title: string) => {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('trips')
    .update({ title })
    .eq('id', tripId);

  if (error) {
    console.error('Error updating title:', error);
    throw error;
  }
};

export const uploadTripCover = async (tripId: string, file: File): Promise<string | null> => {
  if (!isSupabaseConfigured()) return null;

  const fileExt = file.name.split('.').pop();
  const fileName = `${tripId}-${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  // 1. Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from('trip-covers')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Error uploading image:', uploadError);
    return null;
  }

  // 2. Get Public URL
  const { data } = supabase.storage
    .from('trip-covers')
    .getPublicUrl(filePath);
    
  const publicUrl = data.publicUrl;

  // 3. Update Database Record
  const { error: dbError } = await supabase
    .from('trips')
    .update({ cover_image_url: publicUrl })
    .eq('id', tripId);

  if (dbError) {
    console.error('Error updating trip with image URL:', dbError);
    return null;
  }

  return publicUrl;
};

export const deleteTrip = async (tripId: string) => {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', tripId);
  
    if (error) {
      console.error('Error deleting trip:', error);
      throw error;
    }
  };
