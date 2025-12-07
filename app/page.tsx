"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DropAnimation,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Sidebar } from '../components/Sidebar';
import { PlaceCard } from '../components/PlaceCard';
import { Dashboard } from '../components/Dashboard';
import { DayItinerary, Place, TripInfo, Trip } from '../types';
import { MapIcon, List, Sparkles, Loader2, MapPin } from 'lucide-react';
import { createTrip, fetchTrips, updateTripItinerary, deleteTrip, isSupabaseConfigured, updateTripTitle, uploadTripCover } from '../services/supabaseClient';
import { optimizeItineraryWithAI, parseItineraryFromText, calculateTravelTimes } from '../services/aiService'; // UPDATED

const DEFAULT_CENTER: [number, number] = [25.0330, 121.5654]; // Taipei

// Dynamically import MapComponent to disable SSR
const MapComponent = dynamic(() => import('../components/MapComponent').then(mod => mod.MapComponent), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full bg-slate-200"><Loader2 className="animate-spin text-slate-500" size={48} /></div>
});


// Pre-defined Taipei Itinerary Data (Traditional Chinese)
const TAIPEI_PRESET_ITINERARY: DayItinerary[] = [
  {
    dayId: 'day-1',
    title: 'Day 1 12/18(四) 中山→華山→信義',
    date: '2024-12-18',
    places: [
      { id: 'tpe-flight-1', name: 'CX564 HKG→TPE', lat: 25.0797, lng: 121.2342, remarks: '08:30 HKG → 10:15 TPE', type: 'flight', time: '08:30' },
      { id: 'tpe-food-1', name: '軟食力 行天宮店', lat: 25.0630, lng: 121.5330, remarks: '蛋餅 4.5⭐ (14:00關)', type: 'activity', time: '10:15-12:00' },
      { id: 'tpe-hotel-1', name: '慕舍酒店 (Hotel Mvsa)', lat: 25.0485, lng: 121.5360, remarks: 'Check-in / 寄行李', type: 'hotel', time: '12:15-13:00' },
      { id: 'tpe-spot-1', name: '華山1914文化創意產業園區', lat: 25.0441, lng: 121.5293, remarks: '逛展覽/文創', type: 'activity', time: '13:30-15:30' },
      { id: 'tpe-cafe-1', name: '興波咖啡 Simple Kaffa', lat: 25.0445, lng: 121.5290, remarks: '華山旗艦店 (4.7⭐)', type: 'activity', time: '15:45-16:30' },
      { id: 'tpe-spot-2', name: 'Pokémon Center Taipei', lat: 25.0355, lng: 121.5660, remarks: '信義A11 3F', type: 'activity', time: '17:00-18:30' },
      { id: 'tpe-food-2', name: '立志壽司', lat: 25.0335, lng: 121.5645, remarks: '訂位 18:30', type: 'activity', time: '18:30' },
      { id: 'tpe-spot-3', name: '臨江街觀光夜市', lat: 25.0305, lng: 121.5540, remarks: '通化夜市', type: 'activity', time: '19:30-22:00' },
      { id: 'tpe-hotel-back-1', name: '回慕舍酒店', lat: 25.0485, lng: 121.5360, remarks: '休息', type: 'hotel', time: '22:30' }
    ]
  },
  {
    dayId: 'day-2',
    title: 'Day 2 12/19(五) 北投溫泉',
    date: '2024-12-19',
    places: [
      { id: 'tpe-food-3', name: '慕舍酒店早餐', lat: 25.0485, lng: 121.5360, remarks: '米其林早餐', type: 'activity', time: '08:00-10:30' },
      { id: 'tpe-transport-1', name: '前往新北投站', lat: 25.1369, lng: 121.5064, remarks: '捷運紅線 (約40分)', type: 'activity', time: '10:30-11:10' },
      { id: 'tpe-hotel-2', name: '麗禧溫泉酒店', lat: 25.1360, lng: 121.5150, remarks: 'Check-in / 寄行李', type: 'hotel', time: '11:15' },
      { id: 'tpe-spot-4', name: '地熱谷', lat: 25.1380, lng: 121.5115, remarks: '參觀', type: 'activity', time: '11:45' },
      { id: 'tpe-food-4', name: '北投炸蛋蔥油餅 & 高記茶莊', lat: 25.1325, lng: 121.5020, remarks: '北投中繼市場 (4.6⭐)', type: 'activity', time: '12:30-13:15' },
      { id: 'tpe-spot-5', name: '麗禧私人湯屋', lat: 25.1360, lng: 121.5150, remarks: '溫泉 3小時', type: 'activity', time: '14:00-17:30' },
      { id: 'tpe-food-5', name: '雍翠庭', lat: 25.1360, lng: 121.5150, remarks: '酒店晚餐 (4.5⭐)', type: 'activity', time: '18:00' }
    ]
  },
  {
    dayId: 'day-3',
    title: 'Day 3 12/20(六) 西門町火鍋',
    date: '2024-12-20',
    places: [
      { id: 'tpe-hotel-out-2', name: '麗禧酒店 Checkout', lat: 25.1360, lng: 121.5150, remarks: '接駁車去捷運', type: 'activity', time: '11:00' },
      { id: 'tpe-hotel-3', name: '路徒Plus主題館', lat: 25.0450, lng: 121.5120, remarks: '台北車站附近 (寄行李)', type: 'hotel', time: '11:45' },
      { id: 'tpe-food-6', name: '加分100%浜中特選昆布鍋物', lat: 25.0435, lng: 121.5070, remarks: '西門店 (義式白醬鍋 4.5⭐)', type: 'activity', time: '13:00' },
      { id: 'tpe-spot-6', name: '西門町商圈', lat: 25.0425, lng: 121.5080, remarks: 'Donki / 誠品', type: 'activity', time: '14:30-17:00' },
      { id: 'tpe-spot-7', name: '南機場夜市', lat: 25.0295, lng: 121.5050, remarks: '米其林推薦 (QQ球/花生捲冰淇淋)', type: 'activity', time: '17:30-21:00' },
      { id: 'tpe-spot-8', name: '熊嗨星樂園', lat: 25.0460, lng: 121.5160, remarks: '夾娃娃 (站前大亞B1)', type: 'activity', time: '21:30' },
      { id: 'tpe-hotel-back-3', name: '回路徒Plus', lat: 25.0450, lng: 121.5120, remarks: '休息', type: 'hotel', time: '22:30' }
    ]
  },
  {
    dayId: 'day-4',
    title: 'Day 4 12/21(日) 購物返程',
    date: '2024-12-21',
    places: [
      { id: 'tpe-food-7', name: '蜂大咖啡', lat: 25.0420, lng: 121.5060, remarks: '合桃酥 (4.6⭐)', type: 'activity', time: '10:00' },
      { id: 'tpe-food-8', name: '老山東牛肉麵', lat: 25.0440, lng: 121.5065, remarks: '萬年大樓B1', type: 'activity', time: '11:00' },
      { id: 'tpe-food-9', name: '如邑堂餅家', lat: 25.0465, lng: 121.5110, remarks: '開封店 (買手信)', type: 'activity', time: '12:00' },
      { id: 'tpe-spot-9', name: '赤峰街', lat: 25.0550, lng: 121.5200, remarks: '文青小店 (中山站)', type: 'activity', time: '13:00-14:30' },
      { id: 'tpe-spot-10', name: '大稻埕碼頭', lat: 25.0570, lng: 121.5070, remarks: '貨櫃市集 / 灑白甜麻糬', type: 'activity', time: '14:45-15:45' },
      { id: 'tpe-transport-2', name: '前往機場', lat: 25.0490, lng: 121.5130, remarks: '回飯店取行李 -> 機捷', type: 'activity', time: '16:00-17:00' },
      { id: 'tpe-flight-2', name: 'CX565 TPE→HKG', lat: 25.0797, lng: 121.2342, remarks: '19:30 TPE → 21:30 HKG', type: 'flight', time: '19:30' }
    ]
  }
];

export default function Home() {
  const [view, setView] = useState<'dashboard' | 'create' | 'planner'>('dashboard');
  
  // Mobile View Toggle State
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');

  const [activeDayId, setActiveDayId] = useState<string>('');
  const [activePlace, setActivePlace] = useState<Place | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  
  // Trip Data State
  const [days, setDays] = useState<DayItinerary[]>([]);
  const [tripInfo, setTripInfo] = useState<TripInfo>({
    destination: '',
    startDate: '',
    endDate: ''
  });
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [tripTitle, setTripTitle] = useState<string>('My Trip');

  // New Feature States
  const [history, setHistory] = useState<DayItinerary[][]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Dashboard State
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);

  // Import Mode State
  const [importMode, setImportMode] = useState<'manual' | 'ai'>('manual');
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Global Loading for Optimization/AI
  const [isProcessing, setIsProcessing] = useState(false);

  // Stopover Candidates
  const [stopoverCandidates, setStopoverCandidates] = useState<Place[]>([]);

  // Supabase Connection Status
  const isConnected = isSupabaseConfigured();

  // Load Trips on Mount
  const loadTrips = async () => {
    setIsLoadingTrips(true);
    const data = await fetchTrips();
    setTrips(data);
    setIsLoadingTrips(false);
  };

  useEffect(() => {
    loadTrips();
  }, []);

  // Auto-Save Logic
  useEffect(() => {
    if (view === 'planner' && currentTripId && days.length > 0) {
        setIsSaving(true);
        const timer = setTimeout(async () => {
            await updateTripItinerary(currentTripId, days);
            setIsSaving(false);
        }, 2000); // Debounce save
        return () => clearTimeout(timer);
    }
  }, [days, currentTripId, view]);

  // Debounced Travel Time Calculation
  useEffect(() => {
      if (view !== 'planner' || days.length === 0) return;

      const timer = setTimeout(async () => {
          if (activeDayId && activeDayId !== 'overview') {
              const dayIndex = days.findIndex(d => d.dayId === activeDayId);
              if (dayIndex === -1) return;
              
              const day = days[dayIndex];
              if (day.places.length > 1) {
                  const updatedPlaces = await calculateTravelTimes(day.places);
                  const isDifferent = JSON.stringify(updatedPlaces) !== JSON.stringify(day.places);
                  if (isDifferent) {
                    setDays(prev => {
                        const newDays = [...prev];
                        newDays[dayIndex] = { ...day, places: updatedPlaces };
                        return newDays;
                    });
                  }
              }
          }
      }, 2000);

      return () => clearTimeout(timer);
  }, [days, activeDayId, view]);


  // Sensors for DnD
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handlers

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (importMode === 'ai' && importText.trim()) {
        await handleImportFromText();
        return;
    }

    const start = new Date(tripInfo.startDate);
    const end = new Date(tripInfo.endDate);
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const newDays: DayItinerary[] = Array.from({ length: dayCount }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return {
        dayId: `day-${i + 1}`,
        title: `Day ${i + 1}`,
        date: date.toISOString().split('T')[0],
        places: []
      };
    });

    setDays(newDays);
    setActiveDayId(newDays[0].dayId);
    
    const newTrip = await createTrip(tripInfo.destination, tripInfo.startDate, tripInfo.endDate, newDays);
    if (newTrip) {
        setCurrentTripId(newTrip.id);
        setTripTitle(newTrip.title);
        setTrips([newTrip, ...trips]);
    }
    
    setView('planner');
    setMobileView('list');
  };

  const handleImportFromText = async () => {
    setIsImporting(true);
    try {
        const parsed = await parseItineraryFromText(importText);
        setDays(parsed.days);
        setTripInfo({
            destination: parsed.destination,
            startDate: parsed.startDate,
            endDate: parsed.endDate
        });
        setActiveDayId(parsed.days[0]?.dayId || '');
        
        const newTrip = await createTrip(parsed.destination, parsed.startDate, parsed.endDate, parsed.days);
        if (newTrip) {
            setCurrentTripId(newTrip.id);
            setTripTitle(newTrip.title);
            setTrips([newTrip, ...trips]);
        }
        setView('planner');
        setMobileView('list');
    } catch (e) {
        alert("Failed to parse itinerary. The AI couldn't understand the format. Please try rephrasing or use manual mode.");
    } finally {
        setIsImporting(false);
    }
  };

  const loadTaipeiDemo = async () => {
      setIsImporting(true);
      
      const newDays = TAIPEI_PRESET_ITINERARY;
      const destination = "Taipei";
      const start = "2024-12-18";
      const end = "2024-12-21";

      setDays(newDays);
      setTripInfo({ destination, startDate: start, endDate: end });
      setActiveDayId(newDays[0].dayId);

      const newTrip = await createTrip(destination, start, end, newDays);
      if (newTrip) {
          await updateTripTitle(newTrip.id, "🇹🇼 台北4日3夜美食之旅");
          newTrip.title = "🇹🇼 台北4日3夜美食之旅";
          
          setCurrentTripId(newTrip.id);
          setTripTitle(newTrip.title);
          setTrips([newTrip, ...trips]);
      }
      setIsImporting(false);
      setView('planner');
      setMobileView('list');
  };

  const handleSelectTrip = (trip: Trip) => {
      setDays(trip.itinerary);
      setTripInfo({
          destination: trip.destination,
          startDate: trip.start_date,
          endDate: trip.end_date
      });
      setCurrentTripId(trip.id);
      setTripTitle(trip.title);
      setActiveDayId(trip.itinerary[0]?.dayId || '');
      setView('planner');
      setMobileView('list');
  };

  const handleDeleteTrip = async (tripId: string) => {
      setTrips(prev => prev.filter(t => t.id !== tripId));
      try {
          await deleteTrip(tripId);
      } catch (error) {
          console.error("Failed to delete trip, reverting UI", error);
          alert("Failed to delete trip from database.");
          loadTrips();
      }
  };
  
  const handleUploadCover = async (tripId: string, file: File) => {
      const publicUrl = await uploadTripCover(tripId, file);
      if (publicUrl) {
          setTrips(prev => prev.map(t => t.id === tripId ? { ...t, cover_image_url: publicUrl } : t));
      }
  };

  const handlePlaceClick = (place: Place) => {
    setMapCenter([place.lat, place.lng]);
    setActivePlace(place);
    setMobileView('map');
  };

  const handleAddPlace = (newPlace: Place) => {
    setDays((prevDays) => {
      return prevDays.map((day) => {
        if (day.dayId === activeDayId) {
          return { ...day, places: [...day.places, newPlace] };
        }
        return day;
      });
    });
    setMapCenter([newPlace.lat, newPlace.lng]);
  };

  const handleUpdatePlace = (dayId: string, updatedPlace: Place) => {
      setDays(prev => prev.map(day => {
          if (day.dayId === dayId) {
              return {
                  ...day,
                  places: day.places.map(p => p.id === updatedPlace.id ? updatedPlace : p)
              };
          }
          return day;
      }));
  };

  const handleDeletePlace = (dayId: string, placeId: string) => {
    setDays((prevDays) => {
      return prevDays.map((day) => {
        if (day.dayId === dayId) {
          return { ...day, places: day.places.filter((p) => p.id !== placeId) };
        }
        return day;
      });
    });
  };

  const handleAIPlan = (newDays: DayItinerary[]) => {
    setDays(newDays);
    if (newDays.length > 0) {
      setActiveDayId(newDays[0].dayId);
      if (newDays[0].places.length > 0) {
        setMapCenter([newDays[0].places[0].lat, newDays[0].places[0].lng]);
      }
    }
  };

  const handleUpdateTitle = async (newTitle: string) => {
      setTripTitle(newTitle);
      if (currentTripId) {
          await updateTripTitle(currentTripId, newTitle);
          setTrips(prev => prev.map(t => t.id === currentTripId ? { ...t, title: newTitle } : t));
      }
  };
  
  const handleUpdateDayTitle = (dayId: string, newTitle: string) => {
      setDays(prev => prev.map(day => {
          if (day.dayId === dayId) {
              return { ...day, title: newTitle };
          }
          return day;
      }));
  };

  const handleMoveDay = (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= days.length) return;
      setDays(prev => {
          const newDays = [...prev];
          const [movedDay] = newDays.splice(fromIndex, 1);
          newDays.splice(toIndex, 0, movedDay);
          return newDays;
      });
  }

  const saveToHistory = () => {
      const currentDeepCopy = JSON.parse(JSON.stringify(days));
      setHistory(prev => [...prev.slice(-9), currentDeepCopy]);
  };

  const handleOptimizeTrip = async (scope: 'day' | 'trip', constraints: string) => {
      saveToHistory();
      setIsProcessing(true);
      try {
          const optimized = await optimizeItineraryWithAI(days, scope, activeDayId, constraints);
          setDays(optimized);
      } catch (e) {
          alert("Optimization failed. Please try again.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleUndo = () => {
      if (history.length === 0) return;
      const previousState = history[history.length - 1];
      setDays(previousState);
      setHistory(prev => prev.slice(0, -1));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActivePlaceId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePlaceId(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const findDayId = (placeId: string) => {
      return days.find((day) => day.places.some((p) => p.id === placeId))?.dayId;
    };

    const sourceDayId = findDayId(activeId);
    const destDayId = findDayId(overId) || (days.find(d => d.dayId === overId)?.dayId);

    if (!sourceDayId || !destDayId) return;

    if (sourceDayId === destDayId) {
       setDays((prev) => {
           return prev.map(day => {
               if (day.dayId === sourceDayId) {
                   const oldIndex = day.places.findIndex(p => p.id === activeId);
                   const newIndex = day.places.findIndex(p => p.id === overId);
                   return {
                       ...day,
                       places: arrayMove(day.places, oldIndex, newIndex)
                   };
               }
               return day;
           });
       });
    } 
    else {
        setDays((prev) => {
            const sourceDay = prev.find(d => d.dayId === sourceDayId)!;
            const destDay = prev.find(d => d.dayId === destDayId)!;
            const placeToMove = sourceDay.places.find(p => p.id === activeId)!;

            const newSourcePlaces = sourceDay.places.filter(p => p.id !== activeId);
            
            const overIndex = destDay.places.findIndex(p => p.id === overId);
            const newDestPlaces = [...destDay.places];
            
            if (overIndex >= 0) {
                newDestPlaces.splice(overIndex, 0, placeToMove);
            } else {
                newDestPlaces.push(placeToMove);
            }

            return prev.map(d => {
                if (d.dayId === sourceDayId) return { ...d, places: newSourcePlaces };
                if (d.dayId === destDayId) return { ...d, places: newDestPlaces };
                return d;
            });
        });
    }
  };

  // --- Render ---
  // The rest of the return statement from App.tsx needs to be adapted.
  // I will copy it here and adjust the component paths.
  // I'll also remove the createPortal for now.

  if (view === 'dashboard') {
    return (
      <>
        {/* Global Loading Overlay */}
        {isImporting && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex flex-col items-center justify-center text-white backdrop-blur-sm">
                <Loader2 className="animate-spin mb-3" size={48} />
                <h3 className="text-xl font-bold">Creating your Trip...</h3>
            </div>
        )}
        <Dashboard 
          trips={trips}
          onCreateNew={() => setView('create')}
          onSelectTrip={handleSelectTrip}
          onDeleteTrip={handleDeleteTrip}
          onImportDemo={loadTaipeiDemo}
          onUploadCover={handleUploadCover}
          isLoading={isLoadingTrips}
          isConnected={isConnected}
        />
      </>
    );
  }

  if (view === 'create') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Plan a New Trip</h2>
                <button onClick={() => setView('dashboard')} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Import Toggle Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-lg mb-6">
                <button 
                    onClick={() => setImportMode('manual')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${importMode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Manual Input
                </button>
                <button 
                    onClick={() => setImportMode('ai')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${importMode === 'ai' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Sparkles size={14} /> Import from Text
                </button>
            </div>

            {importMode === 'manual' ? (
                <form onSubmit={handleCreateTrip} className="space-y-5">
                    <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Destination</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input
                        type="text"
                        required
                        value={tripInfo.destination}
                        onChange={(e) => setTripInfo({ ...tripInfo, destination: e.target.value })}
                        className="w-full pl-10 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        placeholder="e.g. Tokyo, Paris"
                        />
                    </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                        <input
                        type="date"
                        required
                        value={tripInfo.startDate}
                        onChange={(e) => setTripInfo({ ...tripInfo, startDate: e.target.value })}
                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                        <input
                        type="date"
                        required
                        value={tripInfo.endDate}
                        onChange={(e) => setTripInfo({ ...tripInfo, endDate: e.target.value })}
                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>
                    </div>
                    
                    <div className="pt-2">
                        <button 
                            type="button" 
                            onClick={loadTaipeiDemo}
                            className="text-xs text-purple-600 font-medium hover:underline flex items-center gap-1"
                        >
                            <Sparkles size={12}/> Load "Taipei 4 Days" Example
                        </button>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <button
                            type="button"
                            onClick={() => setView('dashboard')}
                            className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
                        >
                            Start Planning
                        </button>
                    </div>
                </form>
            ) : (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Paste your itinerary</label>
                        <textarea
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            placeholder="Paste flight details, hotel info, or a full day-by-day plan here..."
                            className="w-full h-40 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none resize-none text-sm"
                        />
                         <p className="text-xs text-slate-500 mt-2">
                            The AI will extract dates, locations, and times automatically.
                        </p>
                    </div>
                    
                    <button 
                        onClick={() => {
                            setImportText(`🇹🇼 台北4日3夜美食之旅\n\n✈️航班：12/18 CX564 08:30 HKG→10:15 TPE / 12/21 CX565 19:30 TPE→21:30 HKG\n🏨住宿：D1慕舍酒店(D1) / D2麗禧溫泉(D2) / D3-4路徒Plus主題館\n\n📅 Day1 12/18(四) 中山→華山→信義\n•10:15-12:00 軟食力行天宮店\n•12:15-13:00 慕舍酒店寄行李\n•13:30-15:30 華山1914文創\n... (Click Generate to see full parsing)`);
                        }}
                        className="text-xs text-purple-600 font-medium hover:underline flex items-center gap-1"
                    >
                        <Sparkles size={12}/> Use Taipei Text Example
                    </button>

                    <button
                        onClick={handleCreateTrip}
                        disabled={isImporting || !importText}
                        className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 flex justify-center items-center gap-2"
                    >
                        {isImporting ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                        Generate from Text
                    </button>
                </div>
            )}
        </div>
      </div>
    );
  }

  const activeDay = days.find((d) => d.dayId === activeDayId);
  const placesForMap = activeDayId === 'overview' ? days.flatMap(d => d.places) : (activeDay ? activeDay.places : []);
  const allPlacesForOverview = activeDayId === 'overview' ? days.map((d, i) => ({ dayIndex: i, places: d.places })) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Global Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-sm">
            <Sparkles className="animate-spin mb-4 text-amber-400" size={48} />
            <h3 className="text-2xl font-bold">Optimizing Route...</h3>
            <p className="text-white/80 mt-2">The AI is finding the best path for you.</p>
        </div>
      )}

      <div className="flex h-screen w-screen overflow-hidden bg-white">
        {/* Mobile View Toggle */}
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex bg-white/90 backdrop-blur shadow-xl rounded-full p-1 border border-slate-200 gap-1 no-print">
           <button 
             className={`p-3 rounded-full transition-all ${mobileView === 'list' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
             onClick={() => setMobileView('list')}
           >
             <List size={20} />
           </button>
           <button 
             className={`p-3 rounded-full transition-all ${mobileView === 'map' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
             onClick={() => setMobileView('map')}
           >
             <MapIcon size={20} />
           </button>
        </div>

        {/* Left Sidebar */}
        <div className={`
            w-full md:w-[400px] lg:w-[450px] flex-shrink-0 h-full z-20 shadow-xl
            ${mobileView === 'map' ? 'hidden md:block' : 'block'}
        `}>
          <Sidebar
            days={days}
            activeDayId={activeDayId}
            setActiveDayId={setActiveDayId}
            onAddPlace={handleAddPlace}
            onUpdatePlace={handleUpdatePlace}
            onDeletePlace={handleDeletePlace}
            onPlaceClick={handlePlaceClick}
            onAIPlan={handleAIPlan}
            mapCenter={{ lat: mapCenter[0], lng: mapCenter[1] }}
            tripTitle={tripTitle}
            onUpdateTitle={handleUpdateTitle}
            isSaving={isSaving}
            onOptimize={handleOptimizeTrip}
            onUndo={handleUndo}
            canUndo={history.length > 0}
            isEditMode={isEditMode}
            onToggleEditMode={() => setIsEditMode(!isEditMode)}
            onUpdateDayTitle={handleUpdateDayTitle}
            onBack={() => {
                setView('dashboard');
                setMobileView('list');
            }}
            onMoveDay={handleMoveDay}
            onShowStopovers={(candidates) => setStopoverCandidates(candidates)} // Pass handler
          />
        </div>
        
        {/* Right Map */}
        <div className={`
            flex-1 h-full relative z-0 bg-slate-100 map-container
            ${mobileView === 'list' ? 'hidden md:block' : 'block'}
        `}>
            <MapComponent 
                places={placesForMap} 
                center={mapCenter}
                zoom={13}
                allPlaces={allPlacesForOverview}
                isOverview={activeDayId === 'overview'}
                stopoverCandidates={stopoverCandidates} // Pass candidates
            />
        </div>
      </div>

      <DragOverlay>
        {activePlaceId ? (
          <div className="opacity-90 scale-105">
             {/* Mock visual for dragging */}
             <div className="bg-white p-3 rounded shadow-xl border-l-4 border-brand-500 w-[350px]">
                Moving item...
             </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
