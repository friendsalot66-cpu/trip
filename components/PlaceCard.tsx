

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, GripVertical, Plane, Hotel, Clock, Pencil, Car, MapPinPlus, Wallet } from 'lucide-react';
import { Place } from '../types';

interface PlaceCardProps {
  place: Place;
  index?: number;
  onDelete: (id: string) => void;
  onClick: () => void;
  onEdit: () => void;
  onFindStopover: () => void;
  isOverlay?: boolean;
  isDraggable?: boolean;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({ 
  place, 
  index, 
  onDelete, 
  onClick, 
  onEdit, 
  onFindStopover,
  isOverlay,
  isDraggable = false
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: place.id,
    data: {
      type: 'Place',
      place,
    },
    disabled: !isDraggable && !isOverlay // Disable dnd logic if not draggable
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const getIcon = () => {
    switch (place.type) {
      case 'flight': return <Plane size={16} className="text-purple-600" />;
      case 'hotel': return <Hotel size={16} className="text-amber-600" />;
      default: return <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-600 text-xs font-bold">{index ?? '•'}</span>;
    }
  };

  const getBorderColor = () => {
    switch (place.type) {
      case 'flight': return 'border-l-4 border-l-purple-400';
      case 'hotel': return 'border-l-4 border-l-amber-400';
      default: return 'border-l-4 border-l-brand-400';
    }
  };

  return (
    <div className="relative">
      {/* Travel Time Connector */}
      {place.travelTime && (
        <div className="flex items-center gap-2 pl-9 pb-2 -mt-1 text-xs text-slate-400 font-medium">
            <div className="w-0.5 h-3 bg-slate-200"></div>
            <Car size={10} />
            <span>{place.travelTime}</span>
        </div>
      )}

      <div
        ref={setNodeRef}
        style={style}
        className={`
          group relative flex items-start gap-3 p-3 mb-2 
          bg-white rounded-lg shadow-sm 
          hover:shadow-md transition-all duration-200
          border border-gray-100 ${getBorderColor()}
          ${isOverlay ? 'shadow-xl scale-105 cursor-grabbing z-50 rotate-1' : ''}
        `}
      >
        {/* Drag Handle - Only visible in Edit Mode */}
        {isDraggable && (
          <div 
            {...attributes} 
            {...listeners}
            className="mt-1 text-gray-300 cursor-grab active:cursor-grabbing hover:text-brand-500 touch-none transition-colors"
          >
            <GripVertical size={16} />
          </div>
        )}

        {/* Icon */}
        <div className="mt-1 flex-shrink-0">
          {getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 cursor-pointer min-w-0" onClick={onClick}>
          <div className="flex justify-between items-center gap-2">
            <h4 className="font-semibold text-gray-800 text-sm leading-tight truncate">{place.name}</h4>
            {place.time && (
              <span className="flex items-center gap-1 text-[10px] font-medium bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 whitespace-nowrap">
                <Clock size={10} /> {place.time}
              </span>
            )}
          </div>
          
          {place.address && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 truncate">
                  <span className="truncate">{place.address}</span>
              </p>
          )}

          {place.remarks && (
              <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">
              {place.remarks}
              </p>
          )}

          {/* Expense Display */}
          {place.expenses && (
              <div className="flex items-center gap-1 mt-1.5 text-xs text-emerald-600 font-medium">
                  <Wallet size={10} />
                  {place.expenses.currency} {place.expenses.amount}
              </div>
          )}
        </div>

        {/* Actions - Always Visible */}
        <div className="flex flex-col items-center gap-1 pl-1 border-l border-gray-50 ml-1">
          <button
              onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
              }}
              className="text-gray-400 hover:text-blue-500 transition-colors p-1.5 hover:bg-blue-50 rounded"
              title="Edit"
          >
              <Pencil size={14} />
          </button>
          <button
              onClick={(e) => {
                  e.stopPropagation();
                  onFindStopover();
              }}
              className="text-gray-400 hover:text-amber-500 transition-colors p-1.5 hover:bg-amber-50 rounded"
              title="Find Stopover After"
          >
              <MapPinPlus size={14} />
          </button>
          <button
              onClick={(e) => {
                  e.stopPropagation();
                  onDelete(place.id);
              }}
              className="text-gray-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded"
              title="Delete"
          >
              <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};