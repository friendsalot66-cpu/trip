# AI Travel Planner

A React-based web application that allows users to plan travel itineraries with drag-and-drop organization, interactive maps, and AI-powered assistance for finding places and optimizing routes.

## 🚀 Features

*   **Interactive Planner**: Drag-and-drop support to reorder activities within a day or move them between days.
*   **Smart Maps**: Integrated Leaflet map that automatically updates to show the route and markers for the active day.
*   **AI Assistance**: 
    *   **Search**: Find real-world places with coordinates using Gemini AI.
    *   **Import**: Parse unstructured text (e.g., from chat logs) into a structured itinerary.
    *   **Optimize**: Reorder routes based on logical flow using AI "Thinking Mode".
*   **Cloud Sync**: Persist trips, itineraries, and cover images using Supabase.
*   **Responsive**: Mobile-friendly view with a toggle between List and Map modes.

## 🛠 Tech Stack

*   **Frontend**: React 19, TypeScript, Vite
*   **Styling**: Tailwind CSS
*   **Map**: React Leaflet, OpenStreetMap
*   **State/Drag & Drop**: @dnd-kit/core
*   **AI**: Google GenAI SDK (`@google/genai`) - Model: `gemini-2.5-flash`
*   **Backend/DB**: Supabase (PostgreSQL + Storage)

---

## 📂 File Structure & Responsibilities

### Core
*   **`index.html`**: Entry point. Contains the Tailwind script, Leaflet CSS, and Import Map for dependencies.
*   **`index.tsx`**: React DOM root rendering.
*   **`App.tsx`**: Main application controller. Manages global state (`days`, `tripInfo`, `view`), handles Supabase syncing (Auto-save), and coordinates Drag-and-Drop logic (`handleDragEnd`).
*   **`types.ts`**: TypeScript definitions for `Trip`, `DayItinerary`, `Place`, and `PlaceType`.

### Components (`/components`)
*   **`Dashboard.tsx`**: The home view. Lists all trips, handles creating new trips, deleting trips, and uploading cover images.
*   **`Sidebar.tsx`**: The left-hand panel in Planner view. Manages the list of days, search functionality, "Add Place" logic, and triggers AI modals.
*   **`PlaceCard.tsx`**: Individual card component for an activity/hotel/flight. Handles the drag handle UI and edit/delete actions.
*   **`MapComponent.tsx`**: Renders the Leaflet map. Handles custom numbered markers, polyline route drawing, and auto-panning (`flyTo`) when the user selects a place.

### Services (`/services`)
*   **`supabaseClient.ts`**: Wrapper for Supabase SDK. Handles `fetchTrips`, `createTrip`, `updateTripItinerary`, and `uploadTripCover`. Contains data sanitization logic to prevent app crashes on null fields.
*   **`geminiService.ts`**: The AI Logic layer. Connects to Google Gemini API.
    *   `findPlacesWithAI`: Geocoding and place search.
    *   `parseItineraryFromText`: Converts raw text into JSON itinerary.
    *   `optimizeItineraryWithAI`: Reorders list based on constraints.

---

## 🤖 AI Integration Details (`geminiService.ts`)

This application relies on **Strict JSON Output** from the AI. When modifying or swapping models, ensure the following schemas are maintained.

### 1. JSON Cleaning
The service uses a helper to strip Markdown formatting:
```typescript
const cleanJson = (text) => text.replace(/```json\s*|\s*```/g, "").trim();
```

### 2. Output Schemas
**A. Place Search (`findPlacesWithAI`)**
Expected output:
```json
{
  "candidates": [
    {
      "name": "string",
      "lat": number,
      "lng": number,
      "address": "string",
      "remarks": "string"
    }
  ]
}
```

**B. Itinerary Parsing (`parseItineraryFromText`)**
The AI must return a structure compatible with the `DayItinerary` type:
```json
{
  "destination": "string",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "days": [
    {
      "dayId": "string",
      "title": "string",
      "date": "YYYY-MM-DD",
      "places": [
        {
          "name": "string",
          "lat": number,
          "lng": number,
          "type": "activity" | "hotel" | "flight",
          "time": "HH:MM",
          "remarks": "string"
        }
      ]
    }
  ]
}
```

---

## ⚙️ Setup & Prerequisites

### 1. Environment Variables
You must configure the following keys.
*   **Local Development**: Create a `.env` file.
*   **Vercel/Cloud**: Add these to your project settings.

```env
# Required for AI features
API_KEY=AIzaSy... (Your Google Gemini API Key)

# Required for Data Persistence (Supabase)
# If missing, app runs in "Memory Mode" (data lost on reload)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-public-key
```

### 2. Supabase Database Schema
Run the following SQL in your Supabase SQL Editor to set up the backend:

```sql
-- 1. Create Trips Table
create table public.trips (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  destination text not null default '',
  start_date date not null default current_date,
  end_date date not null default current_date,
  title text default 'New Trip',
  itinerary jsonb default '[]'::jsonb,
  cover_image_url text,
  constraint trips_pkey primary key (id)
);

-- 2. Enable RLS (Public Access for Prototype)
alter table public.trips enable row level security;
create policy "Enable full access for anon" on public.trips for all to anon using (true);

-- 3. Storage for Cover Images
insert into storage.buckets (id, name, public) values ('trip-covers', 'trip-covers', true);
create policy "Public Access" on storage.objects for select using ( bucket_id = 'trip-covers' );
create policy "Allow Uploads" on storage.objects for insert with check ( bucket_id = 'trip-covers' );
create policy "Allow Updates" on storage.objects for update using ( bucket_id = 'trip-covers' );
```

### 3. Installation
Since this project uses ES Modules via CDN (in `index.html`), standard `npm install` is not strictly required for runtime, but recommended for type checking if developing locally.

```bash
npm install
npm run dev
```
