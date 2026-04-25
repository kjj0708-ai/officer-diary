import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./FirebaseProvider";
import { summarizeEntries } from "../services/geminiService";
import { fetchCalendarEventsRange } from "../services/calendarService";
import { format, subDays, isSameMonth, parse, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { ko } from "date-fns/locale";
import { Sparkles, Loader2, CalendarDays, CalendarRange, Calendar } from "lucide-react";
import { cn } from "../lib/utils";

export function SummaryView() {
  const { user, accessToken, handleAuthError } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [summaries, setSummaries] = useState<{ week?: string; month?: string; year?: string }>({});
  const [loading, setLoading] = useState<{ week: boolean; month: boolean; year: boolean }>({
    week: false,
    month: false,
    year: false,
  });
  const [allEntries, setAllEntries] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      const fetchEntries = async () => {
        const querySnapshot = await getDocs(collection(db, "users", user.uid, "entries"));
        const entries: any[] = [];
        querySnapshot.forEach((doc) => {
          entries.push({ id: doc.id, ...doc.data() });
        });
        setAllEntries(entries);
      };
      fetchEntries();
    }
  }, [user]);

  const getEntriesForPeriod = (period: "week" | "month" | "year") => {
    const today = new Date();
    const currentYear = parseInt(selectedYear);
    
    return allEntries.flatMap(entry => {
      const dateId = entry.dateId; // MM-dd
      const content = entry.years?.[selectedYear];
      if (!content) return [];

      // Create a date object for this entry in the selected year
      const [m, d] = dateId.split('-');
      const entryDate = new Date(currentYear, parseInt(m) - 1, parseInt(d));

      if (period === "week") {
        const lastWeek = subDays(today, 7);
        if (isWithinInterval(entryDate, { start: lastWeek, end: today })) {
          return [{ date: dateId, content }];
        }
      } else if (period === "month") {
        if (isSameMonth(entryDate, today)) {
          return [{ date: dateId, content }];
        }
      } else if (period === "year") {
        return [{ date: dateId, content }];
      }
      return [];
    }).sort((a, b) => a.date.localeCompare(b.date));
  };

  const handleSummarize = async (period: "week" | "month" | "year") => {
    setLoading(prev => ({ ...prev, [period]: true }));
    let filtered = getEntriesForPeriod(period);
    const koreanPeriod = period === "week" ? "주간" : period === "month" ? "월간" : "연간";
    
    if (filtered.length > 0 && accessToken) {
      try {
        const currentYearNum = parseInt(selectedYear);
        const [firstMonth, firstDay] = filtered[0].date.split("-");
        const [lastMonth, lastDay] = filtered[filtered.length - 1].date.split("-");
        
        const startDate = new Date(currentYearNum, parseInt(firstMonth) - 1, parseInt(firstDay));
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(currentYearNum, parseInt(lastMonth) - 1, parseInt(lastDay));
        endDate.setHours(23, 59, 59, 999);
        
        const events = await fetchCalendarEventsRange(accessToken, startDate, endDate);
        
        if (events.length > 0) {
          filtered = filtered.map(entry => {
            const [m, d] = entry.date.split("-");
            const entryDateStr = format(new Date(currentYearNum, parseInt(m) - 1, parseInt(d)), 'yyyy-MM-dd');
            
            const dayEvents = events.filter(e => {
              const start = e.start.date || e.start.dateTime;
              return start && start.startsWith(entryDateStr);
            });
            
            if (dayEvents.length > 0) {
              const calendarText = dayEvents.map(e => `[일정: ${e.summary}]`).join(" ");
              return { ...entry, content: `${entry.content}\n${calendarText}` };
            }
            return entry;
          });
        }
      } catch (error: any) {
        if (error.message === 'UNAUTHORIZED') handleAuthError();
        console.error("Failed to fetch calendar events for summary:", error);
      }
    }

    const summary = await summarizeEntries(filtered, koreanPeriod as any);
    setSummaries(prev => ({ ...prev, [period]: summary }));
    setLoading(prev => ({ ...prev, [period]: false }));
  };

  const years = Array.from({ length: 10 }).map((_, i) => (2025 + i).toString());

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="space-y-4 text-center mb-12">
        <h2 className="serif text-4xl lg:text-5xl font-bold text-[#2D2926]">기록 요약</h2>
        <p className="text-stone-500 font-light italic text-sm lg:text-base">"AI와 함께 당신의 소중한 시간들을 되돌아보세요."</p>
        
        <div className="flex justify-center flex-wrap gap-2 mt-6">
          {years.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={cn(
                "px-4 py-1 text-xs font-semibold tracking-widest rounded-full transition-all border",
                selectedYear === y 
                  ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-900/30" 
                  : "bg-white/5 text-slate-500 border-white/10 hover:border-slate-500"
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Weekly Summary */}
        <SummaryCard 
          title="최근 1주일" 
          icon={<CalendarDays className="w-5 h-5" />}
          content={summaries.week}
          loading={loading.week}
          onSummarize={() => handleSummarize("week")}
          entriesCount={getEntriesForPeriod("week").length}
        />

        {/* Monthly Summary */}
        <SummaryCard 
          title="이번 달" 
          icon={<CalendarRange className="w-5 h-5" />}
          content={summaries.month}
          loading={loading.month}
          onSummarize={() => handleSummarize("month")}
          entriesCount={getEntriesForPeriod("month").length}
        />

        {/* Yearly Summary */}
        <SummaryCard 
          title={`${selectedYear}년 전체`} 
          icon={<Calendar className="w-5 h-5" />}
          content={summaries.year}
          loading={loading.year}
          onSummarize={() => handleSummarize("year")}
          entriesCount={getEntriesForPeriod("year").length}
        />
      </div>
    </div>
  );
}

function SummaryCard({ title, icon, content, loading, onSummarize, entriesCount }: any) {
  return (
    <div className="year-card p-8 flex flex-col gap-6 relative group overflow-hidden">
      <div className="flex justify-between items-start">
        <div className="p-3 bg-white/5 rounded-lg text-slate-300 border border-white/5">
          {icon}
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 block mb-1">기록된 날짜</span>
          <span className="serif text-2xl font-bold text-white">{entriesCount}일</span>
        </div>
      </div>
      
      <h3 className="serif text-2xl font-bold text-white">{title}</h3>

      <div className="flex-1 min-h-[150px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin opacity-30" />
            <p className="text-[10px] uppercase tracking-widest font-bold">생각하는 중...</p>
          </div>
        ) : content ? (
          <div className="text-sm leading-relaxed font-light text-slate-300 whitespace-pre-wrap animate-in fade-in duration-500">
            {content}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <p className="text-xs text-slate-500 italic serif">기록들을 요약할 준비가 되었습니다.</p>
            <button
              onClick={onSummarize}
              disabled={entriesCount === 0}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                entriesCount === 0 
                  ? "bg-white/5 text-slate-700 cursor-not-allowed" 
                  : "bg-blue-600 text-white hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/40"
              )}
            >
              <Sparkles size={14} /> AI 요약 시작
            </button>
          </div>
        )}
      </div>
      
      {/* Decorative background element */}
      <div className="absolute -right-4 -bottom-4 opacity-[0.05] rotate-12 group-hover:rotate-6 transition-transform duration-700 text-white">
        <Sparkles className="w-24 h-24" />
      </div>
    </div>
  );
}
