import { useState } from 'react';
import { format, addDays, subDays, isToday, getYear, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Briefcase, ChevronLeft, ChevronRight, LogOut, BookHeart, Calendar as CalendarIcon, Search, RefreshCw, Sparkles, Pencil } from 'lucide-react';
import { useAuth } from './components/FirebaseProvider';
import { WeeklyView } from './components/WeeklyView';
import { SummaryView } from './components/SummaryView';
import { CareerView } from './components/CareerView';
import { CalendarModal } from './components/CalendarModal';
import { SearchModal } from './components/SearchModal';
import { cn } from './lib/utils';

type Tab = 'diary' | 'summary' | 'career';

function AuthScreen() {
  const { signInWithGoogle } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B1221] px-4 text-white">
      <div className="max-w-md w-full text-center space-y-12 animate-in fade-in zoom-in-95 duration-1000">
        <div className="space-y-6">
          <div className="relative inline-block">
            <BookHeart className="w-20 h-20 mx-auto text-blue-500 opacity-80" />
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-orange-400 rounded-full animate-pulse shadow-lg shadow-orange-900/50" />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-serif font-bold tracking-tight text-white">공무원 업무수첩</h1>
            <p className="text-slate-400 font-light italic text-lg">"기록이 당신의 경력이 됩니다."</p>
          </div>
        </div>
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-4 bg-blue-600 text-white hover:bg-blue-500 py-4 px-6 rounded shadow-2xl shadow-blue-900/30 transition-all text-sm font-bold tracking-widest uppercase group"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 brightness-200" />
          Google 계정으로 시작하기
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}

function MainApp() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('diary');
  const { user, signOut, accessToken, signInWithGoogle } = useAuth();

  const handlePrevWeek = () => setSelectedDate(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setSelectedDate(prev => addWeeks(prev, 1));
  const handleToday = () => setSelectedDate(new Date());

  const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekStr = `${format(start, 'M.d')} - ${format(end, 'M.d')}`;
  
  const isSelectedTodayVisible = isToday(selectedDate) || (selectedDate >= start && selectedDate <= end);

  return (
    <div className="flex flex-col min-h-screen w-full p-4 lg:p-8 gap-6 bg-[#0B1221] text-slate-100 selection:bg-blue-500/30 relative overflow-x-hidden">
      <header className="flex flex-col gap-4 w-full shrink-0 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                공무원 업무수첩
              </h1>
              <span className="text-[10px] lg:text-xs font-normal text-slate-500 tracking-tight">기록관리 서비스</span>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
                <button 
                  onClick={() => setIsSearchOpen(true)} 
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white" 
                  title="기록 검색"
                >
                  <Search size={20} />
                </button>
                <button 
                  onClick={() => setActiveTab('career')} 
                  className={cn(
                    "p-2 rounded-full transition-colors", 
                    activeTab === 'career' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "text-slate-400 hover:bg-white/10 hover:text-white"
                  )} 
                  title="인사정보 (Career)"
                >
                  <Briefcase size={20} />
                </button>
                {!isToday(selectedDate) && (
                    <button
                      onClick={handleToday}
                      className="ml-1 text-[10px] uppercase tracking-wider font-bold px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
                    >
                      오늘
                    </button>
                )}
            </div>
        </div>

        <div className="flex items-center justify-between w-full bg-white/5 rounded-lg shadow-sm p-1.5 lg:p-3 border border-white/10 backdrop-blur-sm">
          <div className="flex items-center">
             <button onClick={handlePrevWeek} className="p-2 lg:p-3 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white" title="이전 주">
               <ChevronLeft size={18} />
             </button>
             
             <span className="text-sm lg:text-xl font-bold whitespace-nowrap px-2 text-center text-white tabular-nums">
               {weekStr}
             </span>

             <button onClick={handleNextWeek} className="p-2 lg:p-3 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white" title="다음 주">
               <ChevronRight size={18} />
             </button>
          </div>

          <div className="flex items-center gap-1">
             <button 
               onClick={() => setActiveTab('diary')} 
               className={cn(
                 "p-2 rounded-full transition-colors", 
                 activeTab === 'diary' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "text-slate-400 hover:bg-white/10 hover:text-white"
               )} 
               title="업무수첩 보기"
             >
               <Pencil size={20} />
             </button>
             <button 
               onClick={() => setActiveTab('summary')} 
               className={cn(
                 "p-2 rounded-full transition-colors font-bold", 
                 activeTab === 'summary' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "text-slate-400 hover:bg-white/10 hover:text-white"
               )} 
               title="AI 주간 요약"
             >
               <Sparkles size={20} />
             </button>
             <button 
               onClick={() => setIsCalendarOpen(true)} 
               className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white" 
               title="달력 검색"
             >
               <CalendarIcon size={20} />
             </button>
          </div>
        </div>
      </header>
      
      <main className="w-full flex-1 max-w-7xl mx-auto flex flex-col pt-2">
        {activeTab === 'diary' ? (
          <WeeklyView selectedDate={selectedDate} />
        ) : activeTab === 'summary' ? (
          <SummaryView />
        ) : (
          <CareerView />
        )}
      </main>
      
      <footer className="w-full mt-auto pt-6 border-t border-white/10 flex items-center justify-between max-w-7xl mx-auto pb-4 lg:pb-0">
           <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-blue-600 flex items-center justify-center text-white serif italic text-lg shadow-lg shadow-blue-900/20">
                  {user?.email?.[0].toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase truncate max-w-[150px] text-white tracking-wider">{user?.email?.split('@')[0]}</p>
                  <p className="text-[9px] text-blue-400 uppercase tracking-[0.2em] font-semibold mt-0.5">PRO MEMBER</p>
                </div>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-2 h-2 rounded-full", accessToken ? "bg-green-500" : "bg-red-500 animate-pulse")} />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    {accessToken ? "캘린더 연동됨" : "캘린더 연동 필요"}
                  </span>
                </div>
                {!accessToken && (
                  <button 
                    onClick={signInWithGoogle}
                    className="text-[9px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw size={10} /> 연동 다시하기
                  </button>
                )}
              </div>
           </div>
           <button onClick={signOut} className="p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors" title="로그아웃">
             <LogOut size={18} />
           </button>
      </footer>

      <CalendarModal 
        isOpen={isCalendarOpen} 
        onClose={() => setIsCalendarOpen(false)} 
        selectedDate={selectedDate} 
        onSelectDate={setSelectedDate} 
      />
      
      <SearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onSelectDate={setSelectedDate} 
      />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1221] text-white">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <BookHeart className="w-12 h-12 animate-bounce text-blue-500/40" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-t-white border-white/10 rounded-full animate-spin"></div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.5em] font-bold text-slate-500">Chronicle is loading</div>
        </div>
      </div>
    );
  }
  
  return user ? <MainApp /> : <AuthScreen />;
}
