import React, { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function CalendarModal({ isOpen, onClose, selectedDate, onSelectDate }: CalendarModalProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  
  if (!isOpen) return null;

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({
      start: startDate,
      end: endDate
  });

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1221]/80 backdrop-blur-sm animate-in fade-in transition-opacity" onClick={onClose}>
      <div 
        className="bg-[#0F172A] w-full max-w-sm shadow-2xl border border-white/10 p-6 flex flex-col gap-6 rounded-xl" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
            <h2 className="serif text-2xl font-bold tracking-tight text-white">날짜 선택</h2>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
              <X size={20} />
            </button>
        </div>

        <div className="flex justify-between items-center bg-white/5 p-2 border border-white/10 rounded-lg">
           <button onClick={prevMonth} className="p-2 hover:bg-white/10 transition-colors text-slate-300 rounded-full">
             <ChevronLeft size={16} />
           </button>
           <div className="font-serif font-semibold text-lg text-white">
             {format(currentMonth, 'yyyy년 M월', { locale: ko })}
           </div>
           <button onClick={nextMonth} className="p-2 hover:bg-white/10 transition-colors text-slate-300 rounded-full">
             <ChevronRight size={16} />
           </button>
        </div>

        <div>
            <div className="grid grid-cols-7 mb-2">
                {weekDays.map(day => (
                    <div key={day} className="text-center text-[10px] uppercase tracking-widest font-bold text-slate-500">
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                    const isSelected = isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, currentMonth);

                    return (
                        <button
                          key={day.toString()}
                          onClick={() => {
                              onSelectDate(day);
                              onClose();
                          }}
                          className={cn(
                              "aspect-square flex items-center justify-center text-sm transition-all border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                              isSelected 
                                ? "bg-blue-600 text-white font-bold border-blue-600 shadow-md shadow-blue-900/40" 
                                : "hover:bg-white/10 border-transparent text-slate-300",
                              !isCurrentMonth && !isSelected ? "opacity-20" : ""
                          )}
                        >
                            {format(day, 'd')}
                        </button>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
}

