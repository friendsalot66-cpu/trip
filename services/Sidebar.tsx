
import React, { useState, useEffect } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Plus, Map as MapIcon, Sparkles, Search, Loader2, Plane, X, Pencil, Cloud, CheckCircle, RotateCcw, Wand2, ArrowUpDown, MapPin, ArrowLeft } from 'lucide-react';
import { DayItinerary, Place, PlaceType } from '../types';
import { PlaceCard } from './PlaceCard';
import { findPlacesWithAI, generateItineraryWithAI } from '../services/geminiService';

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
  onBack
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

  // Update local title state if prop changes
  useEffect(() => {
    setEditedTitle(tripTitle || '');
  }, [tripTitle]);
  
  // When active day changes, reset editable day title
  useEffect(() => {
    if (activeDay) {
        setEditedDayTitle(activeDay.title);
        setIsEditingDayTitle(false);
    }
  }, [activeDayId, days]); // Trigger when ID changes or days update

  // --- Modals State ---
  const [showAIModal, setShowAIModal] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  // Optimization Modal State
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [optimizeScope, setOptimizeScope] = useState<'day' | 'trip'>('day');
  const [optimizeConstraints, setOptimizeConstraints] = useState('');

  const [placeModal, setPlaceModal] = useState<{
    isOpen: boolean;
    data: Partial<Place>;
  }>({ isOpen: false, data: {} });

  const activeDayIndex = days.findIndex(d => d.dayId === activeDayId);
  const activeDay = days[activeDayIndex];

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
      setEditedTitle(tripTitle || ''); // Revert if empty
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
    
    // Show results dropdown
    if (results.length > 0) {
        setSearchResults(results);
    }
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

    onUpdatePlace(activeDayId, placeModal.data as Place);
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

  // Calculate generic index (excluding flights)
  const getPlaceIndex = (placeId: string) => {
    if (!activeDay) return undefined;
    const nonFlightPlaces = activeDay.places.filter(p => p.type !== 'flight');
    const index = nonFlightPlaces.findIndex(p => p.id === placeId);
    return index !== -1 ? index + 1 : undefined;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-1 min-w-0 mr-4 items-center gap-2">
            <button 
                onClick={onBack}
                className="p-1.5 -ml-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                title="Back to Dashboard"
            >
                <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
                <h1 className="text-xs font-bold text-brand-600 flex items-center gap-1 uppercase tracking-wider mb-0.5">
                    TripPlanner
                </h1>
                
                {/* Editable Title */}
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
                <div 
                    onClick={() => setIsEditingTitle(true)}
                    className="group flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded pl-1 py-0.5"
                >
                    <p className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{tripTitle || 'My Trip'}</p>
                    <Pencil size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    
                    {/* Save Status Indicator - Inline with title */}
                    <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                        {isSaving ? (
                            <span className="flex items-center gap-1 text-[10px] text-brand-500 font-medium animate-pulse">
                                <Cloud size={10} />
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[10px] text-slate-300 font-medium">
                                <CheckCircle size={10} />
                            </span>
                        )}
                    </div>
                </div>
                )}
            </div>
          </div>
           
           <div className="flex items-center gap-2 flex-shrink-0">
             {/* Reorder/Edit Toggle */}
             <button
                onClick={onToggleEditMode}
                title={isEditMode ? "Finish Reordering" : "Reorder List"}
                className={`p-1.5 rounded-full transition-colors ${
                  isEditMode 
                    ? 'bg-brand-100 text-brand-600' 
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
             >
                <ArrowUpDown size={16} />
             </button>

             {canUndo && (
               <button 
                 onClick={onUndo}
                 title="Undo last change"
                 className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
               >
                 <RotateCcw size={16} />
               </button>
             )}
             <button 
              onClick={() => setShowAIModal(true)}
              className="flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-2.5 py-1.5 rounded-full border border-purple-100 hover:bg-purple-100 transition-colors"
            >
              <Sparkles size={12} />
              New
            </button>
           </div>
        </div>
        
        {/* Day Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 relative">
        <div className="flex items-center justify-between mb-4">
            {/* Editable Day Title */}
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
            
            {/* Search Results Dropdown */}
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
              <PlaceCard
                key={place.id}
                index={place.type !== 'flight' ? getPlaceIndex(place.id) : undefined}
                place={place}
                onDelete={(id) => onDeletePlace(activeDayId, id)}
                onClick={() => onPlaceClick(place)}
                onEdit={() => openEditModal(place)}
                isDraggable={isEditMode}
              />
            ))}
            {activeDay?.places.length === 0 && (
              <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <MapPin className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Plan your day here</p>
              </div>
            )}
          </SortableContext>
        </div>
      </div>

      {/* Place Edit Modal */}
      {placeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h3 className="font-bold text-gray-800">
                        Edit Details
                    </h3>
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
  );
};
