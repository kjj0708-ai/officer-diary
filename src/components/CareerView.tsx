import React, { useState } from 'react';
import { useCareerProfile, Promotion, Assignment } from '../hooks/useCareerProfile';
import { Plus, Trash2, Save, Calendar, Briefcase, GraduationCap, Building2, ScanSearch, Loader2, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { analyzeCareerImage } from '../services/geminiService';
import { compressImage } from '../lib/imageUtils';

export function CareerView() {
  const { data, loading, updateProfile } = useCareerProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [localData, setLocalData] = useState(data);

  // Sync local data when fetching finishes
  if (!localData && data) {
    setLocalData(data);
  }

  const handleSave = async () => {
    if (localData) {
      await updateProfile(localData);
      setIsEditing(false);
    }
  };

  const addPromotion = () => {
    if (!localData) return;
    setLocalData({
      ...localData,
      promotions: [...localData.promotions, { rank: '', date: '' }]
    });
  };

  const removePromotion = (index: number) => {
    if (!localData) return;
    const newPromotions = [...localData.promotions];
    newPromotions.splice(index, 1);
    setLocalData({ ...localData, promotions: newPromotions });
  };

  const addAssignment = () => {
    if (!localData) return;
    setLocalData({
      ...localData,
      assignments: [...localData.assignments, { department: '', date: '', role: '' }]
    });
  };

  const removeAssignment = (index: number) => {
    if (!localData) return;
    const newAssignments = [...localData.assignments];
    newAssignments.splice(index, 1);
    setLocalData({ ...localData, assignments: newAssignments });
  };

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !localData) return;

    setIsScanning(true);
    try {
      // 리사이징 (분석용이므로 800KB 정도)
      const compressedFile = await compressImage(file, 800);
      const buffer = await compressedFile.arrayBuffer();
      
      const analysis = await analyzeCareerImage(buffer, file.type);
      
      if (analysis) {
        // Merge analysis with localData
        setLocalData({
          ...localData,
          appointmentDate: analysis.appointmentDate || localData.appointmentDate,
          promotions: [
            ...localData.promotions,
            ...(analysis.promotions || [])
          ].filter((p, i, self) => 
            // Simple de-duplication based on date and rank
            i === self.findIndex((t) => t.date === p.date && t.rank === p.rank)
          ),
          assignments: [
            ...localData.assignments,
            ...(analysis.assignments || [])
          ].filter((a, i, self) => 
            // Simple de-duplication
            i === self.findIndex((t) => t.date === a.date && t.department === a.department)
          )
        });
        setIsEditing(true); // Switch to edit mode so user can review
        alert("문서 분석이 완료되었습니다. 내용을 확인 후 저장해주세요.");
      } else {
        alert("이미지에서 정보를 추출하지 못했습니다.");
      }
    } catch (error) {
      console.error("Career scan failed:", error);
      alert("문서 분석 중 오류가 발생했습니다.");
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  if (loading || !localData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-bold text-white">업무 이력 (Career)</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer border",
            isScanning 
              ? "bg-purple-600/20 text-purple-400 border-purple-500/30" 
              : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
          )}>
            {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4 text-purple-400" />}
            {isScanning ? "분석 중..." : "문서 스캔"}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleScan} 
              disabled={isScanning}
              className="hidden" 
            />
          </label>
          <button
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
              isEditing 
                ? "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-900/20" 
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20"
            )}
          >
            {isEditing ? <><Save className="w-4 h-4" /> 저장하기</> : "편집하기"}
          </button>
        </div>
      </div>

      {/* 신규 임용일 */}
      <section className="bg-white/5 rounded-xl p-6 border border-white/10 shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-6">
          <GraduationCap className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-white">신규 임용일</h3>
        </div>
        <div className="max-w-xs">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">임용 날짜</label>
          {isEditing ? (
            <input
              type="date"
              value={localData.appointmentDate}
              onChange={(e) => setLocalData({ ...localData, appointmentDate: e.target.value })}
              className="w-full bg-[#0B1221] border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          ) : (
            <div className="flex items-center gap-3 bg-[#0B1221] border border-white/10 rounded-lg px-4 py-3">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-lg font-medium text-white">{localData.appointmentDate || '기록 없음'}</span>
            </div>
          )}
        </div>
      </section>

      {/* 승진 이력 */}
      <section className="bg-white/5 rounded-xl p-6 border border-white/10 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">승진 이력</h3>
          </div>
          {isEditing && (
            <button
              onClick={addPromotion}
              className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-colors"
              title="추가"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          {localData.promotions.map((promo, idx) => (
            <motion.div 
              key={idx}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end bg-[#0B1221] p-4 rounded-lg border border-white/5"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">직급 (Rank)</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={promo.rank}
                    placeholder="예: 7급"
                    onChange={(e) => {
                      const newPromos = [...localData.promotions];
                      newPromos[idx].rank = e.target.value;
                      setLocalData({ ...localData, promotions: newPromos });
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <div className="text-white font-bold">{promo.rank}</div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">승진 날짜 (Date)</label>
                {isEditing ? (
                  <input
                    type="date"
                    value={promo.date}
                    onChange={(e) => {
                      const newPromos = [...localData.promotions];
                      newPromos[idx].date = e.target.value;
                      setLocalData({ ...localData, promotions: newPromos });
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <div className="text-slate-300 font-mono text-sm">{promo.date}</div>
                )}
              </div>
              {isEditing && (
                <button
                  onClick={() => removePromotion(idx)}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors mb-0.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))}
          {localData.promotions.length === 0 && (
            <div className="text-center py-8 text-slate-500 italic text-sm">
              기록된 승진 이력이 없습니다.
            </div>
          )}
        </div>
      </section>

      {/* 인사발령 (부서배치) */}
      <section className="bg-white/5 rounded-xl p-6 border border-white/10 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">인사발령 (부서배치)</h3>
          </div>
          {isEditing && (
            <button
              onClick={addAssignment}
              className="p-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/40 transition-colors"
              title="추가"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          {[...localData.assignments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((asgn, idx) => (
            <motion.div 
              key={idx}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1.5fr_auto] gap-4 items-end bg-[#0B1221] p-4 rounded-lg border border-white/5"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">부서 (Department)</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={asgn.department}
                    placeholder="예: 기획예산과"
                    onChange={(e) => {
                      const newAsgns = [...localData.assignments];
                      newAsgns[idx].department = e.target.value;
                      setLocalData({ ...localData, assignments: newAsgns });
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <div className="text-white font-bold">{asgn.department}</div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">발령 날짜</label>
                {isEditing ? (
                  <input
                    type="date"
                    value={asgn.date}
                    onChange={(e) => {
                      const newAsgns = [...localData.assignments];
                      newAsgns[idx].date = e.target.value;
                      setLocalData({ ...localData, assignments: newAsgns });
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <div className="text-slate-300 font-mono text-sm">{asgn.date}</div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">직무 (Role)</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={asgn.role}
                    placeholder="예: 홍보 담당"
                    onChange={(e) => {
                      const newAsgns = [...localData.assignments];
                      newAsgns[idx].role = e.target.value;
                      setLocalData({ ...localData, assignments: newAsgns });
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <div className="text-slate-400 text-sm">{asgn.role || '-'}</div>
                )}
              </div>
              {isEditing && (
                <button
                  onClick={() => removeAssignment(idx)}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors mb-0.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))}
          {localData.assignments.length === 0 && (
            <div className="text-center py-8 text-slate-500 italic text-sm">
              기록된 인사발령 이력이 없습니다.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
