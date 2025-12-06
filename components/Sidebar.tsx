import React, { useState, useEffect } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Plus, Map as MapIcon, Sparkles, Search, Loader2, Plane, X, Pencil, Cloud, CheckCircle, RotateCcw, Wand2, ArrowUpDown, MapPin, ArrowLeft, MoreHorizontal, FileDown, CalendarDays, ArrowRight, Printer, Wallet } from 'lucide-react';
import { DayItinerary, Place, PlaceType } from '../types';
import { PlaceCard } from './PlaceCard';
import { findPlacesWithAI, generateItineraryWithAI, getStopoverRecommendations, generateMarkdown } from '../services/geminiService';

interface SidebarProps {
  days: DayItinerary[];
  activeDayId: string;
  setActiveDayId: (id: string) => void;
  onAddPlace: (place: Place) => void;
  onUpdatePlace: (dayId: string, place: Place) => void;
  onDeletePlace: (dayId: string, placeId: string) => void;
  onPlaceClick: (place: Place) => void;
  onAIPlan: (days: DayItinerary[]) => void;
  mapCenter: { lat: number, lng: number };
  tripTitle?: string;
  onUpdateTitle: (newTitle: string) => void;
  isSaving?: boolean;
  onOptimize: (scope: 'day' | 'trip', constraints: string) => void;
  onUndo: () => void;
  canUndo: boolean;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onUpdateDayTitle: (dayId: string, newTitle: string) => void;
  onBack: () => void;
  onMoveDay: (fromIndex: number, toIndex: number) => void;
  // New props
  onShowStopovers: (candidates: Place[]) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  days,
  activeDayId,
  setActiveDayId,
  onAddPlace,
  onUpdatePlace,
  onDeletePlace,
  onPlaceClick,
  onAIPlan,
  mapCenter,
  tripTitle,
  onUpdateTitle,
  isSaving = false,
  onOptimize,
  onUndo,
  canUndo,
  isEditMode,
  onToggleEditMode,
  onUpdateDayTitle,
  onBack,
  onMoveDay,
  onShowStopovers
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Partial<Place>[]>([]);
  
  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(tripTitle || '');

  // Day Title Editing State
  const [isEditingDayTitle, setIsEditingDayTitle] = useState(false);
  const [editedDayTitle, setEditedDayTitle] = useState('');

  // Modals
  const [showAIModal, setShowAIModal] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [optimizeScope, setOptimizeScope] = useState<'day' | 'trip'>('day');
  const [optimizeConstraints, setOptimizeConstraints] = useState('');
  const [showManageDays, setShowManageDays] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Stopover Loading State
  const [isFindingStopover, setIsFindingStopover] = useState<string | null>(null); // holds place ID

  const [placeModal, setPlaceModal] = useState<{
    isOpen: boolean;
    data: Partial<Place>;
  }>({ isOpen: false, data: {} });

  const activeDayIndex = days.findIndex(d => d.dayId === activeDayId);
  const activeDay = activeDayIndex >= 0 ? days[activeDayIndex] : null;

  useEffect(() => {
    setEditedTitle(tripTitle || '');
  }, [tripTitle]);
  
  useEffect(() => {
    if (activeDay) {
        setEditedDayTitle(activeDay.title);
        setIsEditingDayTitle(false);
    }
  }, [activeDayId, days]);

  const { setNodeRef } = useDroppable({
    id: activeDayId,
    data: { type: 'Day', dayId: activeDayId }
  });

  // --- Handlers ---

  const handleTitleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editedTitle.trim()) {
      onUpdateTitle(editedTitle);
    } else {
      setEditedTitle(tripTitle || ''); 
    }
    setIsEditingTitle(false);
  };

  const handleDayTitleSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (editedDayTitle.trim() && activeDay) {
          onUpdateDayTitle(activeDayId, editedDayTitle);
      } else if (activeDay) {
          setEditedDayTitle(activeDay.title);
      }
      setIsEditingDayTitle(false);
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    
    const results = await findPlacesWithAI(searchQuery, mapCenter);
    setIsSearching(false);
    
    if (results.length > 0) setSearchResults(results);
  };

  const addPlaceDirectly = (partialPlace: Partial<Place>, type: PlaceType = 'activity') => {
    setSearchResults([]);
    setSearchQuery('');
    
    const newPlace: Place = {
        id: crypto.randomUUID(),
        name: partialPlace.name || 'New Place',
        lat: partialPlace.lat || mapCenter.lat,
        lng: partialPlace.lng || mapCenter.lng,
        remarks: partialPlace.remarks || '',
        address: partialPlace.address,
        type: type,
        time: partialPlace.time
    };
    onAddPlace(newPlace);
    // Clear stopovers from map when adding a new place to avoid clutter
    onShowStopovers([]);
  };

  const openEditModal = (place: Place) => {
    setPlaceModal({
        isOpen: true,
        data: { ...place }
    });
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeModal.data.name || !placeModal.data.id) return;

    const updatedData = { ...placeModal.data };
    if (updatedData.expenses && typeof updatedData.expenses.amount === 'string') {
        updatedData.expenses.amount = parseFloat(updatedData.expenses.amount);
    }

    onUpdatePlace(activeDayId, updatedData as Place);
    setPlaceModal({ isOpen: false, data: {} });
  };

  const handleAIPlanning = async () => {
    if (!aiPrompt.trim()) return;
    setIsPlanning(true);
    try {
      const newItinerary = await generateItineraryWithAI(aiPrompt, days.length);
      if (newItinerary.length > 0) {
        onAIPlan(newItinerary);
        setShowAIModal(false);
      }
    } catch (e) {
      alert("Failed to generate itinerary. Please try again.");
    } finally {
      setIsPlanning(false);
    }
  };

  const handleOptimizeSubmit = () => {
    onOptimize(optimizeScope, optimizeConstraints);
    setShowOptimizeModal(false);
    setOptimizeConstraints('');
  };

  const handleFindStopover = async (place: Place) => {
    const currentIndex = activeDay?.places.findIndex(p => p.id === place.id) ?? -1;
    if (currentIndex === -1 || !activeDay || currentIndex === activeDay.places.length - 1) {
        alert("Please select a place that is not the last one in the list to find a stopover.");
        return;
    }
    const nextPlace = activeDay.places[currentIndex + 1];
    
    setIsFindingStopover(place.id);
    try {
        // Requirement 2: Loading Status (handled by state)
        // Requirement 1: Show on map (handled by onShowStopovers)
        const recommendations = await getStopoverRecommendations(place, nextPlace);
        if (recommendations.length > 0) {
            const mappedRecommendations = recommendations.map(r => ({
                id: crypto.randomUUID(),
                name: r.name || 'Unknown',
                lat: r.lat || 0,
                lng: r.lng || 0,
                remarks: r.remarks || '',
                address: r.address,
                type: 'activity' as PlaceType
            }));
            onShowStopovers(mappedRecommendations);
        } else {
            alert("No recommendations found.");
        }
    } catch (e) {
        console.error(e);
        alert("Error finding stopovers");
    } finally {
        setIsFindingStopover(null);
    }
  };

  const handleExport = (format: 'json' | 'md' | 'print') => {
      if (format === 'json') {
          const blob = new Blob([JSON.stringify(days, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${tripTitle || 'trip'}.json`;
          a.click();
      } else if (format === 'md') {
          const md = generateMarkdown(tripTitle || 'Trip', days);
          const blob = new Blob([md], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${tripTitle || 'trip'}.md`;
          a.click();
      } else {
          // Requirement 4: Export PDF / Print Function
          // The CSS @media print handles the visibility of the .print-only section
          window.print();
      }
      setShowExportMenu(false);
  };

  const getPlaceIndex = (placeId: string) => {
    if (!activeDay) return undefined;
    const nonFlightPlaces = activeDay.places.filter(p => p.type !== 'flight');
    const index = nonFlightPlaces.findIndex(p => p.id === placeId);
    return index !== -1 ? index + 1 : undefined;
  };

  const isOverview = activeDayId === 'overview';

  return (
    <>
    {/* Hidden Print-Only View (Requirement 4) */}
    <div className="print-only p-10 bg-white">
        <h1 className="text-3xl font-bold mb-4">{tripTitle}</h1>
        {days.map((day, idx) => (
            <div key={day.dayId} className="mb-8 break-inside-avoid">
                <h2 className="text-xl font-bold border-b pb-2 mb-4 bg-gray-100 p-2 rounded">Day {idx + 1}: {day.title} ({day.date})</h2>
                <ul className="space-y-4">
                    {day.places.map((place, pIdx) => (
                        <li key={place.id} className="flex gap-4 border-l-4 border-gray-300 pl-4 py-1">
                            <div className="font-bold text-gray-500 w-16">{place.time || '--:--'}</div>
                            <div>
                                <div className="font-bold text-lg">{place.name} <span className="text-xs uppercase bg-gray-200 px-1 rounded">{place.type}</span></div>
                                <div className="text-gray-600">{place.remarks}</div>
                                {place.expenses && <div className="text-sm text-gray-800 font-mono">Cost: {place.expenses.currency} {place.expenses.amount}</div>}
                                {place.travelTime && <div className="text-xs text-gray-500 mt-1 italic">🚗 Travel: {place.travelTime}</div>}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        ))}
    </div>

    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200 print:hidden sidebar-container">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 sidebar-header">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-1 min-w-0 mr-4 items-center gap-2">
            <button onClick={onBack} className="p-1.5 -ml-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
                <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
                <h1 className="text-xs font-bold text-brand-600 flex items-center gap-1 uppercase tracking-wider mb-0.5">TripPlanner</h1>
                {isEditingTitle ? (
                <form onSubmit={handleTitleSubmit} className="flex items-center">
                    <input 
                    autoFocus
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={() => handleTitleSubmit()}
                    className="text-sm w-full border-b border-brand-500 outline-none pb-0.5 bg-transparent text-slate-900 font-bold"
                    />
                </form>
                ) : (
                <div onClick={() => setIsEditingTitle(true)} className="group flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded pl-1 py-0.5">
                    <p className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{tripTitle || 'My Trip'}</p>
                    <Pencil size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                        {isSaving ? (
                            <span className="text-[10px] text-brand-500 font-medium animate-pulse"><Cloud size={10} /></span>
                        ) : (
                            <span className="text-[10px] text-slate-300 font-medium"><CheckCircle size={10} /></span>
                        )}
                    </div>
                </div>
                )}
            </div>
          </div>
           
           <div className="flex items-center gap-2 flex-shrink-0">
             <button onClick={onToggleEditMode} title={isEditMode ? "Finish Reordering" : "Reorder List"} className={`p-1.5 rounded-full transition-colors ${isEditMode ? 'bg-brand-100 text-brand-600' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                <ArrowUpDown size={16} />
             </button>
             {canUndo && (
               <button onClick={onUndo} title="Undo last change" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
                 <RotateCcw size={16} />
               </button>
             )}
             
             {/* Export Menu Trigger */}
             <div className="relative">
                 <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
                    <MoreHorizontal size={16} />
                 </button>
                 {showExportMenu && (
                     <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-1">
                         <button onClick={() => handleExport('json')} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50">
                            <FileDown size={14} /> Export JSON
                         </button>
                         <button onClick={() => handleExport('md')} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50">
                            <FileDown size={14} /> Export Markdown
                         </button>
                         <button onClick={() => handleExport('print')} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50">
                            <Printer size={14} /> Print / PDF
                         </button>
                     </div>
                 )}
             </div>
           </div>
        </div>
        
        {/* Day Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide tabs-container">
            {/* Overview Tab */}
            <button
                onClick={() => setActiveDayId('overview')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-left min-w-[80px]
                    ${activeDayId === 'overview' ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}
                `}
            >
                 <div className="text-[10px] opacity-80 uppercase tracking-wide">Trip</div>
                 <div>Overview</div>
            </button>

            {days.map((day, idx) => (
                <button
                key={day.dayId}
                onClick={() => setActiveDayId(day.dayId)}
                className={`
                    flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-left min-w-[80px]
                    ${activeDayId === day.dayId 
                    ? 'bg-brand-600 text-white shadow-md' 
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}
                `}
                >
                <div className="text-[10px] opacity-80 uppercase tracking-wide">Day {idx + 1}</div>
                <div>{day.date}</div>
                </button>
            ))}
            
            <button 
                onClick={() => setShowManageDays(true)}
                className="flex-shrink-0 p-2 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                title="Manage Days"
            >
                <CalendarDays size={18} />
            </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 relative">
        {isOverview ? (
             <div className="text-center py-10">
                <h2 className="text-xl font-bold text-slate-800 mb-2">Trip Overview</h2>
                <p className="text-sm text-slate-500 mb-6">Showing all locations on the map.</p>
                <div className="space-y-4 max-w-sm mx-auto text-left">
                    {days.map((day, idx) => (
                        <div key={day.dayId} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-brand-200 hover:shadow-md transition-all" onClick={() => setActiveDayId(day.dayId)}>
                             <h4 className="font-bold text-slate-800">Day {idx+1}: {day.title}</h4>
                             <p className="text-xs text-slate-500 mt-1">{day.places.length} places • {day.date}</p>
                        </div>
                    ))}
                </div>
            </div>
        ) : (
            <>
                <div className="flex items-center justify-between mb-4">
                    {isEditingDayTitle ? (
                        <form onSubmit={handleDayTitleSubmit} className="flex-1 mr-2">
                            <input 
                                autoFocus
                                type="text"
                                value={editedDayTitle}
                                onChange={(e) => setEditedDayTitle(e.target.value)}
                                onBlur={() => handleDayTitleSubmit()}
                                className="w-full text-lg font-bold text-slate-800 border-b border-brand-500 outline-none bg-transparent"
                            />
                        </form>
                    ) : (
                        <h2 
                            onClick={() => setIsEditingDayTitle(true)}
                            className="text-lg font-bold text-slate-800 flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-1 -ml-1 rounded transition-colors group"
                        >
                            {activeDay?.title}
                            <Pencil size={12} className="text-slate-300 opacity-0 group-hover:opacity-100" />
                        </h2>
                    )}
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setShowOptimizeModal(true)}
                            className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded hover:bg-amber-100 transition-colors"
                            title="Reorder places for best route"
                        >
                            <Wand2 size={14} /> Optimize
                        </button>
                        <button 
                            onClick={() => addPlaceDirectly({ name: 'Flight', remarks: 'Flight details' }, 'flight')} 
                            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-600 bg-white border border-slate-200 px-2 py-1 rounded hover:bg-brand-50 transition-colors"
                        >
                            <Plane size={14} /> Flight
                        </button>
                    </div>
                </div>

                {/* Standard Place Search */}
                <form onSubmit={handleSearch} className="mb-6 relative">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Find activity, hotel, or place..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm shadow-sm bg-white text-gray-900"
                        />
                        <Search className="absolute left-3 top-3 text-slate-400" size={14} />
                        <button 
                            type="submit"
                            disabled={isSearching || !searchQuery}
                            className="absolute right-2 top-2 p-1 bg-brand-50 text-brand-600 rounded hover:bg-brand-100 disabled:opacity-50 transition-colors"
                        >
                            {isSearching ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                        </button>
                    </div>
                    
                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                            <div className="p-2 bg-slate-50 text-xs font-semibold text-slate-500 border-b flex justify-between">
                                <span>Select a location</span>
                                <button onClick={() => setSearchResults([])}><X size={12}/></button>
                            </div>
                            <ul className="max-h-60 overflow-y-auto">
                                {searchResults.map((result, idx) => (
                                    <li key={idx}>
                                        <button 
                                            onClick={() => addPlaceDirectly(result, 'activity')}
                                            className="w-full text-left p-3 hover:bg-brand-50 transition-colors border-b border-slate-50 last:border-0"
                                        >
                                            <div className="font-medium text-slate-800 text-sm">{result.name}</div>
                                            <div className="text-xs text-slate-500 truncate">{result.address}</div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </form>

                {/* Sortable List */}
                <div ref={setNodeRef} className="space-y-3 min-h-[200px] pb-20">
                <SortableContext 
                    items={activeDay?.places.map(p => p.id) || []} 
                    strategy={verticalListSortingStrategy}
                >
                    {activeDay?.places.map((place, index) => (
                    <div key={place.id} className="relative">
                        <PlaceCard
                            index={place.type !== 'flight' ? getPlaceIndex(place.id) : undefined}
                            place={place}
                            onDelete={(id) => onDeletePlace(activeDayId, id)}
                            onClick={() => onPlaceClick(place)}
                            onEdit={() => openEditModal(place)}
                            onFindStopover={() => handleFindStopover(place)}
                            isDraggable={isEditMode}
                        />
                         {/* Requirement 2: Loading Indicator for Stopover */}
                         {isFindingStopover === place.id && (
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                                 <Loader2 size={12} className="animate-spin" /> Finding stops...
                             </div>
                         )}
                    </div>
                    ))}
                    {activeDay?.places.length === 0 && (
                    <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                        <MapPin className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Plan your day here</p>
                    </div>
                    )}
                </SortableContext>
                </div>
            </>
        )}
      </div>

      {/* Place Edit Modal */}
      {placeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h3 className="font-bold text-gray-800">Edit Details</h3>
                    <button onClick={() => setPlaceModal({...placeModal, isOpen: false})}><X size={18} className="text-gray-400" /></button>
                </div>
                <form onSubmit={handleModalSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Place Name</label>
                        <input 
                            type="text" 
                            required
                            className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-brand-100 outline-none bg-white text-gray-900"
                            value={placeModal.data.name}
                            onChange={e => setPlaceModal(prev => ({...prev, data: {...prev.data, name: e.target.value}}))}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 mb-1">Type</label>
                             <select 
                                className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-brand-100 outline-none bg-white text-gray-900"
                                value={placeModal.data.type}
                                onChange={e => setPlaceModal(prev => ({...prev, data: {...prev.data, type: e.target.value as PlaceType}}))}
                             >
                                 <option value="activity">Activity</option>
                                 <option value="hotel">Hotel</option>
                                 <option value="flight">Flight</option>
                             </select>
                        </div>
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 mb-1">Time</label>
                             <input 
                                type="time" 
                                className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-brand-100 outline-none bg-white text-gray-900"
                                value={placeModal.data.time || ''}
                                onChange={e => setPlaceModal(prev => ({...prev, data: {...prev.data, time: e.target.value}}))}
                             />
                        </div>
                    </div>

                     <div className="grid grid-cols-2 gap-3">
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 mb-1">Currency</label>
                             <input 
                                type="text" 
                                placeholder="TWD"
                                className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-brand-100 outline-none bg-white text-gray-900"
                                value={placeModal.data.expenses?.currency || 'TWD'}
                                onChange={e => setPlaceModal(prev => ({
                                    ...prev, 
                                    data: {
                                        ...prev.data, 
                                        expenses: { amount: prev.data.expenses?.amount || 0, currency: e.target.value }
                                    }
                                }))}
                             />
                        </div>
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 mb-1">Cost</label>
                             <input 
                                type="number"
                                placeholder="0" 
                                className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-brand-100 outline-none bg-white text-gray-900"
                                value={placeModal.data.expenses?.amount || ''}
                                onChange={e => setPlaceModal(prev => ({
                                    ...prev, 
                                    data: {
                                        ...prev.data, 
                                        expenses: { currency: prev.data.expenses?.currency || 'TWD', amount: parseFloat(e.target.value) }
                                    }
                                }))}
                             />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Remarks</label>
                        <textarea 
                            className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-brand-100 outline-none h-20 resize-none bg-white text-gray-900"
                            placeholder="Add notes, booking ref, etc."
                            value={placeModal.data.remarks || ''}
                            onChange={e => setPlaceModal(prev => ({...prev, data: {...prev.data, remarks: e.target.value}}))}
                        />
                    </div>

                    <button type="submit" className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-black transition-colors">
                        Save Changes
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Manage Days Modal */}
      {showManageDays && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
             <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h3 className="text-lg font-bold text-slate-800">Manage Days</h3>
                    <button onClick={() => setShowManageDays(false)}><X size={18} className="text-gray-400" /></button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {days.map((day, idx) => (
                        <div key={day.dayId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                             {/* Requirement 5: Fix Font Color */}
                             <span className="font-medium text-sm text-slate-800">Day {idx + 1}: {day.date}</span>
                             <div className="flex gap-1">
                                 <button 
                                    disabled={idx === 0}
                                    onClick={() => onMoveDay(idx, idx - 1)}
                                    className="p-1 text-slate-400 hover:text-brand-600 disabled:opacity-30"
                                 >
                                     <ArrowUpDown size={16} />
                                 </button>
                             </div>
                        </div>
                    ))}
                </div>
             </div>
           </div>
      )}

       {/* AI Planner Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="text-purple-600" />
                AI Planner
              </h3>
              <button onClick={() => setShowAIModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Use Gemini Thinking Mode to generate a complete itinerary.
            </p>

            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="E.g., Plan a 3-day trip to Kyoto for a food lover focusing on traditional markets and temples."
              className="w-full h-32 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none text-sm mb-4 resize-none"
            />

            <button
              onClick={handleAIPlanning}
              disabled={isPlanning || !aiPrompt}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isPlanning ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Thinking...
                </>
              ) : (
                "Generate Itinerary"
              )}
            </button>
          </div>
        </div>
      )}

      {/* AI Optimization Modal */}
      {showOptimizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2 text-amber-600">
                <Wand2 size={20} />
                Optimize Route
              </h3>
              <button onClick={() => setShowOptimizeModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2">Scope</label>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setOptimizeScope('day')}
                            className={`flex-1 py-2 text-sm rounded-lg border transition-all ${optimizeScope === 'day' ? 'bg-amber-100 border-amber-300 text-amber-800 font-medium' : 'bg-white border-gray-200 text-gray-600'}`}
                        >
                            Current Day
                        </button>
                         <button 
                            onClick={() => setOptimizeScope('trip')}
                            className={`flex-1 py-2 text-sm rounded-lg border transition-all ${optimizeScope === 'trip' ? 'bg-amber-100 border-amber-300 text-amber-800 font-medium' : 'bg-white border-gray-200 text-gray-600'}`}
                        >
                            Whole Trip
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2">Constraints / Preferences</label>
                    <textarea 
                        className="w-full text-sm p-3 border rounded-xl focus:ring-2 focus:ring-amber-200 outline-none h-24 resize-none bg-slate-50 text-gray-900"
                        placeholder="E.g., 'Minimize walking', 'Start after 10am', 'Group museums together'"
                        value={optimizeConstraints}
                        onChange={e => setOptimizeConstraints(e.target.value)}
                    />
                </div>

                <button 
                    onClick={handleOptimizeSubmit}
                    className="w-full bg-amber-600 text-white py-2.5 rounded-xl font-bold hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
                >
                    <Wand2 size={16} /> Run Optimization
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};