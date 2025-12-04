import React, { useState, useRef } from 'react';
import { Trip } from '../types';
import { Calendar, MapPin, Plus, Trash2, ArrowRight, Database, AlertCircle, CheckCircle, Sparkles, Camera, Loader2 } from 'lucide-react';

interface DashboardProps {
  trips: Trip[];
  onCreateNew: () => void;
  onSelectTrip: (trip: Trip) => void;
  onDeleteTrip: (tripId: string) => void;
  onImportDemo: () => void;
  onUploadCover: (tripId: string, file: File) => Promise<void>;
  isLoading: boolean;
  isConnected: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  trips, 
  onCreateNew, 
  onSelectTrip, 
  onDeleteTrip,
  onImportDemo,
  onUploadCover,
  isLoading,
  isConnected
}) => {
  // Track which trip is currently waiting for delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  // Track uploading state per trip
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  
  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTripIdForUpload, setSelectedTripIdForUpload] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && selectedTripIdForUpload) {
          setUploadingId(selectedTripIdForUpload);
          try {
            await onUploadCover(selectedTripIdForUpload, file);
          } catch (err) {
            alert("Failed to upload image");
          } finally {
            setUploadingId(null);
            setSelectedTripIdForUpload(null);
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
      }
  };

  const triggerFileUpload = (tripId: string) => {
      setSelectedTripIdForUpload(tripId);
      fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Hidden File Input */}
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
        />

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Trips</h1>
            <p className="text-slate-500 mt-1">Manage your travel itineraries</p>
          </div>
          <div className="flex gap-3">
             <button 
                onClick={onImportDemo}
                className="flex items-center gap-2 bg-purple-100 text-purple-700 px-5 py-2.5 rounded-xl font-medium hover:bg-purple-200 transition-colors"
                title="Instantly load the Taipei 4D3N plan"
              >
                <Sparkles size={18} />
                Load Taipei Demo
              </button>
            <button 
                onClick={onCreateNew}
                className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
            >
                <Plus size={18} />
                Create New Trip
            </button>
          </div>
        </div>

        {/* Connection Status Banner */}
        {!isConnected ? (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div>
                    <h4 className="font-semibold text-amber-800 text-sm">Supabase Not Connected</h4>
                    <p className="text-xs text-amber-700 mt-1">
                        Running in <strong>Memory Mode</strong>. Your trips will not be saved after you reload the page. 
                        To persist data, set <code>SUPABASE_URL</code> and <code>SUPABASE_KEY</code> in your environment variables.
                    </p>
                </div>
            </div>
        ) : (
             <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 max-w-fit">
                <CheckCircle className="text-emerald-600 shrink-0" size={16} />
                <span className="text-xs font-medium text-emerald-800">Connected to Database</span>
            </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="text-slate-400" size={32} />
            </div>
            <h3 className="text-lg font-medium text-slate-800">No trips yet</h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">Start by creating your first adventure plan.</p>
            <div className="flex justify-center gap-3">
                <button 
                onClick={onImportDemo}
                className="text-purple-600 font-medium hover:underline"
                >
                Load Demo
                </button>
                <span className="text-slate-300">|</span>
                <button 
                onClick={onCreateNew}
                className="text-brand-600 font-medium hover:underline"
                >
                Create New
                </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <div 
                key={trip.id}
                onClick={() => onSelectTrip(trip)}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all cursor-pointer relative flex flex-col h-full"
              >
                {/* Header Image Area */}
                <div className="h-40 relative overflow-hidden bg-slate-200 group-header">
                    {trip.cover_image_url ? (
                        <img 
                            src={trip.cover_image_url} 
                            alt={trip.title} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-r from-brand-500 to-purple-600"></div>
                    )}
                    
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors"></div>
                    
                    {/* Database Icon Indicator */}
                    {isConnected && (
                        <div className="absolute top-3 left-3 bg-black/30 backdrop-blur-md p-1.5 rounded-full z-10" title="Synced to Database">
                            <Database size={12} className="text-white/90" />
                        </div>
                    )}

                    {/* Upload Cover Button */}
                    <div 
                        className="absolute bottom-3 right-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            triggerFileUpload(trip.id);
                        }}
                    >
                        <button className="p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all">
                             {uploadingId === trip.id ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                        </button>
                    </div>

                    {/* Delete Button Area - Moved to Top Right for visibility */}
                    <div 
                        className="absolute top-3 right-3 z-30"
                        onClick={(e) => {
                            e.stopPropagation(); // prevent card click
                            e.preventDefault(); 
                        }}
                    >
                        {confirmDeleteId === trip.id ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteTrip(trip.id);
                                    setConfirmDeleteId(null);
                                }}
                                className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg shadow-lg hover:bg-red-700 transition-all pointer-events-auto"
                            >
                                Confirm?
                            </button>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(trip.id);
                                    // Auto-reset confirmation after 3 seconds
                                    setTimeout(() => setConfirmDeleteId(null), 3000);
                                }}
                                className="p-2 bg-black/20 hover:bg-red-500/80 backdrop-blur-md rounded-full text-white transition-all pointer-events-auto cursor-pointer"
                                title="Delete Trip"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="p-5 flex-1 flex flex-col">
                  {/* Title */}
                  <h3 className="text-lg font-bold text-slate-800 mb-2 truncate" title={trip.title}>
                    {trip.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                    <Calendar size={14} />
                    <span>
                      {new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="mt-auto flex justify-between items-center pt-4 border-t border-slate-50">
                     <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-1 rounded-md">
                        {trip.itinerary?.length || 0} Days
                     </span>
                     <div className="flex items-center gap-1 text-slate-400 text-sm group-hover:text-brand-600 transition-colors">
                        Open <ArrowRight size={14} />
                     </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};