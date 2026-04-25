import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './FirebaseProvider';
import { Search, X, Loader2, Calendar } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
}

interface SearchResult {
  dateId: string;
  year: string;
  content: string;
}

export function SearchModal({ isOpen, onClose, onSelectDate }: SearchModalProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (isOpen && user) {
      const fetchAllEntries = async () => {
        setIsSearching(true);
        try {
          const snapshot = await getDocs(collection(db, 'users', user.uid, 'entries'));
          const data: any[] = [];
          snapshot.forEach(doc => {
             data.push({ id: doc.id, ...doc.data() });
          });
          setAllEntries(data);
        } catch (error) {
          console.error("Error fetching entries for search", error);
        } finally {
          setIsSearching(false);
        }
      };
      
      fetchAllEntries();
      setSearchQuery('');
      setResults([]);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const queryLower = searchQuery.toLowerCase();
    const matched: SearchResult[] = [];

    allEntries.forEach(entry => {
      if (entry.years) {
        Object.entries(entry.years).forEach(([year, content]) => {
          if (typeof content === 'string' && content.toLowerCase().includes(queryLower)) {
            matched.push({
              dateId: entry.dateId,
              year,
              content
            });
          }
        });
      }
    });

    // Sort by most recent year
    matched.sort((a, b) => Number(b.year) - Number(a.year));
    setResults(matched);
  }, [searchQuery, allEntries]);

  if (!isOpen) return null;

  const handleResultClick = (dateId: string) => {
    // Parse "MM-dd" back to a Date object in the current calendar year
    const currentYear = new Date().getFullYear();
    const targetDate = parse(`${currentYear}-${dateId}`, 'yyyy-MM-dd', new Date());
    onSelectDate(targetDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1221]/80 backdrop-blur-sm animate-in fade-in transition-opacity" onClick={onClose}>
      <div 
        className="bg-[#0F172A] w-full max-w-lg shadow-2xl border border-white/10 flex flex-col max-h-[85vh] overflow-hidden rounded-xl" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/5 flex flex-col gap-4 bg-[#1E293B]">
            <div className="flex justify-between items-center">
                <h2 className="serif text-xl font-bold tracking-tight text-white">기록 검색</h2>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
                  <X size={20} />
                </button>
            </div>
            
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text"
                  placeholder="키워드, 장소, 생각 등을 검색하세요..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#0B1221] border border-white/10 focus:outline-none focus:border-blue-500 transition-colors text-sm text-slate-100 rounded-lg"
                  autoFocus
                />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[#0F172A]">
            {isSearching ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <Loader2 className="animate-spin w-8 h-8 mb-4 opacity-50" />
                    <p className="text-xs uppercase tracking-widest font-semibold">기록을 불러오는 중...</p>
                </div>
            ) : searchQuery.trim() === '' ? (
               <div className="text-center py-12 text-slate-500 italic text-sm serif">
                   "당신의 소중한 추억들을 검색해 보세요."
               </div>
            ) : results.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                    검색 결과가 없습니다: "<span className="font-semibold text-slate-200">{searchQuery}</span>"
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                   <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-2">
                       {results.length}개의 검색 결과
                   </div>
                   {results.map((result, idx) => (
                       <button
                         key={`${result.dateId}-${result.year}-${idx}`}
                         onClick={() => handleResultClick(result.dateId)}
                         className="text-left bg-white/5 p-4 border border-white/10 hover:border-blue-500/50 transition-colors group rounded-lg"
                       >
                           <div className="flex justify-between items-center mb-2">
                               <div className="flex items-center gap-2">
                                  <Calendar className="w-3 h-3 text-slate-500" />
                                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                                      {format(parse(`2000-${result.dateId}`, 'yyyy-MM-dd', new Date()), 'M월 d일', { locale: ko })}
                                  </span>
                               </div>
                               <span className="serif italic text-slate-500 text-sm">{result.year}</span>
                           </div>
                           <p className="text-xs text-slate-300 font-light leading-relaxed line-clamp-2">
                               {result.content}
                           </p>
                       </button>
                   ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

