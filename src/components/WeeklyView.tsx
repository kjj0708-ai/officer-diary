import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useDiaryEntry } from '../hooks/useDiaryEntry';
import { useAuth } from './FirebaseProvider';
import { fetchCalendarEvents, fetchCalendarEventsRange, CalendarEvent } from '../services/calendarService';
import { polishRecord, analyzeDocumentImage } from '../services/geminiService';
import { Save, History, Sparkles, Calendar as CalendarIcon, Loader2, FileText, Check, Image as ImageIcon, Camera, X, ScanSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, VerticalAlign } from 'docx';
import { saveAs } from 'file-saver';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { compressImage } from '../lib/imageUtils';

const PastRecordsModal = ({ date, onClose, data }: { date: Date; onClose: () => void; data: any }) => {
  const dateStr = format(date, 'M월 d일', { locale: ko });
  const records = data?.years ? Object.entries(data.years)
    .filter(([year]) => year !== date.getFullYear().toString())
    .sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA)) : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-[#0B1221] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
      >
        <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-orange-400" />
            <h2 className="text-xl font-bold text-white">과거의 {dateStr} 기록</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">닫기</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {records.length > 0 ? (
            records.map(([year, text]) => (
              <div key={year} className="relative pl-8 border-l-2 border-white/5">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-orange-500 shadow-lg shadow-orange-900/50" />
                <div className="flex flex-col gap-3">
                  <span className="text-2xl font-serif italic text-white opacity-40">{year}년</span>
                  <p className="text-slate-300 leading-relaxed font-serif whitespace-pre-wrap">{text as string}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20">
              <History className="w-16 h-16 text-slate-800 mx-auto mb-4" />
              <p className="text-slate-500 italic">복원할 과거 기록이 없습니다.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const DayCard: React.FC<{ 
  day: Date; 
  onContentChange?: (date: string, content: string) => void;
  events: CalendarEvent[];
  loadingEvents: boolean;
}> = ({ day, onContentChange, events, loadingEvents }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [showPastModal, setShowPastModal] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const currentYear = day.getFullYear();
  const dateId = format(day, 'MM-dd');
  const { data, loading, updateEntry } = useDiaryEntry(dateId);

  useEffect(() => {
    if (data) {
      const yearStr = currentYear.toString();
      if (data.years) {
        const yearContent = data.years[yearStr] || '';
        setContent(yearContent);
        onContentChange?.(format(day, 'yyyy-MM-dd'), yearContent);
      }
      if (data.images) {
        setImages(data.images[yearStr] || []);
      }
    }
  }, [data, currentYear, day, onContentChange]);

  const handleSave = async () => {
    setIsSaving(true);
    await updateEntry(currentYear.toString(), content, images);
    setIsSaving(false);
    setLastSaved(new Date());
    setTimeout(() => setLastSaved(null), 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    onContentChange?.(format(day, 'yyyy-MM-dd'), newContent);
  };

  const handlePolish = async () => {
    if (!content.trim()) return;
    setIsPolishing(true);
    const polished = await polishRecord(content);
    setContent(polished);
    onContentChange?.(format(day, 'yyyy-MM-dd'), polished);
    setIsPolishing(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      // 300KB 리사이징
      const compressedFile = await compressImage(file, 300);
      
      const storageRef = ref(storage, `users/${user.uid}/images/${dateId}/${currentYear}/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, compressedFile);
      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      const newImages = [...images, downloadURL];
      setImages(newImages);
      // Auto-save images update
      await updateEntry(currentYear.toString(), content, newImages);
    } catch (error) {
      console.error("Image upload failed:", error);
      alert("이미지 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDocumentScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsScanning(true);
    try {
      // 1MB 정도로 리사이징 (AI 분석용이므로 너무 낮추면 텍스트 인식률 저하)
      const compressedFile = await compressImage(file, 800);
      const buffer = await compressedFile.arrayBuffer();
      
      const analysis = await analyzeDocumentImage(buffer, file.type);
      
      const newContent = content ? `${content}\n\n[사진 분석 결과]\n${analysis}` : `[사진 분석 결과]\n${analysis}`;
      setContent(newContent);
      onContentChange?.(format(day, 'yyyy-MM-dd'), newContent);
      
      // Also upload the original/compressed image to the gallery
      const storageRef = ref(storage, `users/${user.uid}/images/${dateId}/${currentYear}/scan_${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, compressedFile);
      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      const newImages = [...images, downloadURL];
      setImages(newImages);
      await updateEntry(currentYear.toString(), newContent, newImages);
    } catch (error) {
      console.error("Document scan failed:", error);
      alert("문서 분석에 실패했습니다.");
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  const removeImage = async (index: number) => {
    const imageUrl = images[index];
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    
    // Try to delete from storage if it's a firebase URL
    if (imageUrl.includes('firebasestorage.googleapis.com')) {
      try {
        const imageRef = ref(storage, imageUrl);
        await deleteObject(imageRef);
      } catch (error) {
        console.error("Image deletion from storage failed:", error);
      }
    }
    
    await updateEntry(currentYear.toString(), content, newImages);
  };

  const handleImportEvents = () => {
    if (events.length === 0) return;
    const eventsText = events.map(e => {
      const timeStr = e.start?.dateTime ? `[${format(new Date(e.start.dateTime), 'HH:mm')}] ` : '';
      return `• ${timeStr}${e.summary}`;
    }).join('\n');
    const newContent = content ? content + '\n' + eventsText : eventsText;
    setContent(newContent);
    onContentChange?.(format(day, 'yyyy-MM-dd'), newContent);
  };

  const isTodayDate = isSameDay(day, new Date());

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={cn(
        "year-card rounded-xl shadow-xl overflow-hidden flex flex-col group min-h-[350px]",
        isTodayDate ? "ring-2 ring-blue-500/50" : ""
      )}
      id={`day-${format(day, 'yyyyMMdd')}`}
    >
      <div className="p-5 flex justify-between items-start">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-800 tracking-tighter">{format(day, 'M월 d일')}</span>
          <span className="text-xs font-medium text-slate-400">{format(day, 'EEEE', { locale: ko })}</span>
          {isTodayDate && (
             <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-600 text-[10px] font-bold text-white uppercase tracking-wider">오늘</span>
          )}
        </div>
      </div>

      <div className="px-5 mb-4">
        <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-orange-600 font-bold text-[10px] uppercase tracking-wider">
              <CalendarIcon size={12} />
              GOOGLE 업무 일정
            </div>
            {events.length > 0 && (
              <button 
                onClick={handleImportEvents}
                className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-500 hover:bg-slate-50 transition-colors shadow-sm"
              >
                📥 일기로 가져오기
              </button>
            )}
          </div>
          
          <div className="space-y-1.5 min-h-[60px] max-h-[100px] overflow-y-auto custom-scrollbar">
            {loadingEvents ? (
              <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-slate-300" /></div>
            ) : events.length > 0 ? (
              events.map(event => {
                const timeStr = event.start?.dateTime ? format(new Date(event.start.dateTime), 'HH:mm') : null;
                return (
                  <div key={event.id} className="text-[11px] text-slate-700 leading-snug truncate group/event relative flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                    <span className="truncate">
                      {timeStr && <span className="font-bold text-blue-600 mr-1">[{timeStr}]</span>}
                      {event.summary}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-[11px] text-slate-400 italic py-2">기록된 일정이 없습니다.</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 pb-5 flex flex-col gap-3">
        {/* Image Display Section */}
        {images.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-2 custom-scrollbar">
            {images.map((url, idx) => (
              <div key={idx} className="relative flex-shrink-0 group/img">
                <img 
                  src={url} 
                  alt={`Upload ${idx}`} 
                  className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                />
                <button 
                  onClick={() => removeImage(idx)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={content}
          onChange={handleChange}
          placeholder={isTodayDate ? "오늘의 업무를 기록하세요..." : "기록 없음"}
          className="flex-1 w-full bg-transparent text-sm text-slate-700 leading-relaxed resize-none focus:outline-none placeholder:text-slate-300 font-serif"
        />

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handlePolish}
              disabled={isPolishing || !content.trim()}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold transition-all border",
                isPolishing ? "bg-orange-50 text-orange-400 border-orange-100" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600"
              )}
              title="AI 다듬기"
            >
              {isPolishing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            </button>
            <button 
              onClick={() => setShowPastModal(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold transition-all border bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300 transition-colors shadow-sm"
              title="과거의 오늘"
            >
              <History size={12} />
            </button>
            
            <label 
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold transition-all border cursor-pointer",
                isScanning ? "bg-purple-50 text-purple-400 border-purple-100" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600"
              )}
              title="문서 스캔 & 분석"
            >
              {isScanning ? <Loader2 size={12} className="animate-spin" /> : <ScanSearch size={12} />}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleDocumentScan} 
                disabled={isScanning}
                className="hidden" 
              />
            </label>

            <label 
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold transition-all border cursor-pointer",
                isUploading ? "bg-blue-50 text-blue-400 border-blue-100" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600"
              )}
              title="사진 추가"
            >
              {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                disabled={isUploading}
                className="hidden" 
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            {lastSaved && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-green-600 font-medium">저장완료</motion.span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || loading}
              className={cn(
                "p-2 rounded-full transition-all bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50",
              )}
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPastModal && (
          <PastRecordsModal 
            date={day} 
            onClose={() => setShowPastModal(false)}
            data={data}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export function WeeklyView({ selectedDate }: { selectedDate: Date }) {
  const { accessToken } = useAuth();
  const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [weeklyContents, setWeeklyContents] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const handleContentSync = useCallback((date: string, content: string) => {
    setWeeklyContents(prev => {
      if (prev[date] === content) return prev;
      return { ...prev, [date]: content };
    });
  }, []);

  useEffect(() => {
    const getEvents = async () => {
      if (!accessToken) return;
      setLoadingEvents(true);
      try {
        const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const end = addDays(start, 7);
        const results = await fetchCalendarEventsRange(accessToken, start, end);
        setAllEvents(results);
      } catch (error) {
        console.error("Failed to fetch weekly events:", error);
      } finally {
        setLoadingEvents(false);
      }
    };
    getEvents();
  }, [accessToken, selectedDate]);

  const handleExportWord = async () => {
    setIsExporting(true);
    try {
      // Filter only Mon-Fri
      const workDays = weekDays.slice(0, 5);

      const tableRows = [
        // Header Row
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: "날짜/요일", alignment: AlignmentType.CENTER, style: "headerCell" })],
              width: { size: 15, type: WidthType.PERCENTAGE },
              shading: { fill: "F3F4F6" },
              verticalAlign: VerticalAlign.CENTER,
            }),
            new TableCell({
              children: [new Paragraph({ text: "일정 (Calendar)", alignment: AlignmentType.CENTER, style: "headerCell" })],
              width: { size: 35, type: WidthType.PERCENTAGE },
              shading: { fill: "F3F4F6" },
              verticalAlign: VerticalAlign.CENTER,
            }),
            new TableCell({
              children: [new Paragraph({ text: "업무 기록 (Journal)", alignment: AlignmentType.CENTER, style: "headerCell" })],
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { fill: "F3F4F6" },
              verticalAlign: VerticalAlign.CENTER,
            }),
          ],
        }),
        // Data Rows
        ...workDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayJournalContent = weeklyContents[dateKey] || "";

          // Filter events for this day
          const dayEvents = allEvents.filter((event) => {
            const startStr = event.start?.dateTime || event.start?.date;
            if (!startStr) return false;
            try {
              if (event.start?.date) {
                const [year, month, dayNum] = event.start.date.split("-").map(Number);
                const eventDate = new Date(year, month - 1, dayNum);
                return isSameDay(eventDate, day);
              }
              const start = new Date(startStr);
              return isSameDay(start, day);
            } catch (e) {
              return false;
            }
          });

          const eventsParagraphs =
            dayEvents.length > 0
              ? dayEvents.map((e) => {
                  const timeStr = e.start?.dateTime ? format(new Date(e.start.dateTime), "HH:mm") : "종일";
                  return new Paragraph({
                    children: [
                      new TextRun({ text: `[${timeStr}] `, bold: true, size: 20 }),
                      new TextRun({ text: e.summary, size: 20 }),
                    ],
                    spacing: { after: 120 },
                  });
                })
              : [new Paragraph({ text: "-", alignment: AlignmentType.CENTER })];

          return new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: format(day, "M/d", { locale: ko }), bold: true, size: 22 }),
                      new TextRun({ text: `\n(${format(day, "E", { locale: ko })})`, size: 20 }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
                verticalAlign: VerticalAlign.CENTER,
              }),
              new TableCell({
                children: eventsParagraphs,
                verticalAlign: VerticalAlign.TOP,
                margins: { top: 120, bottom: 120, left: 120, right: 120 },
              }),
              new TableCell({
                children: dayJournalContent.split("\n").map(
                  (line) =>
                    new Paragraph({
                      children: [new TextRun({ text: line, size: 20 })],
                      spacing: { after: 120 },
                    })
                ),
                verticalAlign: VerticalAlign.TOP,
                margins: { top: 120, bottom: 120, left: 120, right: 120 },
              }),
            ],
          });
        }),
      ];

      const doc = new Document({
        styles: {
          paragraphStyles: [
            {
              id: "headerCell",
              name: "Header Cell",
              basedOn: "Normal",
              next: "Normal",
              run: { bold: true, size: 22, color: "111827" },
            },
          ],
        },
        sections: [
          {
            properties: {
              page: {
                margin: { top: 720, bottom: 720, left: 720, right: 720 },
              },
            },
            children: [
              new Paragraph({
                text: "주간 업무일지",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${format(monday, "yyyy년 M월 d일", { locale: ko })} ~ ${format(workDays[4], "M월 d일", { locale: ko })}`,
                    bold: true,
                    size: 24,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 600 },
              }),
              new Table({
                rows: tableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4 },
                  bottom: { style: BorderStyle.SINGLE, size: 4 },
                  left: { style: BorderStyle.SINGLE, size: 4 },
                  right: { style: BorderStyle.SINGLE, size: 4 },
                  insideHorizontal: { style: BorderStyle.SINGLE, size: 2 },
                  insideVertical: { style: BorderStyle.SINGLE, size: 2 },
                },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `작성일: ${format(new Date(), "yyyy-MM-dd HH:mm")}`,
                    size: 18,
                    italics: true,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { before: 800 },
              }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `주간업무일지_${format(monday, "yyyyMMdd")}.docx`);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Word 파일 생성 중 오류가 발생했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500 max-w-7xl mx-auto w-full pb-32">
      <div className="hidden items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white font-serif">주간 업무 보고</h2>
          <div className="text-sm text-slate-400 mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-2">
              <CalendarIcon size={14} className="text-blue-500" />
              <span>{format(monday, 'yyyy년 M월 d일', { locale: ko })}</span>
            </div>
            <span className="hidden sm:inline text-slate-600">~</span>
            <span className="ml-5 sm:ml-0">{format(weekDays[6], 'M월 d일', { locale: ko })}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {weekDays.map((day) => {
          const dayEvents = allEvents.filter(event => {
            const startStr = event.start?.dateTime || event.start?.date;
            if (!startStr) return false;
            
            try {
              // Google calendar date only string 'YYYY-MM-DD' needs special handling to avoid timezone shifts
              if (event.start?.date) {
                const [year, month, dayNum] = event.start.date.split('-').map(Number);
                const eventDate = new Date(year, month - 1, dayNum);
                return isSameDay(eventDate, day);
              }
              
              const start = new Date(startStr);
              return isSameDay(start, day);
            } catch (e) {
              return false;
            }
          });
          
          return (
            <DayCard 
              key={day.toString()} 
              day={day} 
              onContentChange={handleContentSync}
              events={dayEvents}
              loadingEvents={loadingEvents}
            />
          );
        })}
      </div>

      <div className="mt-12 flex justify-center">
        <button
          onClick={handleExportWord}
          disabled={isExporting}
          className="flex items-center gap-3 px-8 py-4 bg-white text-blue-600 rounded-2xl font-bold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all border border-blue-100 group"
        >
          {isExporting ? <Loader2 size={24} className="animate-spin" /> : <FileText size={24} className="group-hover:scale-110 transition-transform" />}
          <div className="flex flex-col items-start leading-tight">
            <span className="text-lg">주간일지 저장</span>
          </div>
        </button>
      </div>
    </div>
  );
}
