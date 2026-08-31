import React, { useState, useEffect } from 'react';
import { User, ShiftType, DailyShift, ShiftRequest, SwapRequest } from '../types';
import { api } from '../lib/api';
import { addDays, startOfWeek, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Calendar, AlertTriangle, Send, ArrowLeftRight, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { USERS } from '../lib/constants';

interface OldTeamDashboardProps {
  user: User;
  onLogout: () => void;
}

const SHIFT_OPTIONS: { value: ShiftType; label: string; subLabel?: string; color: string }[] = [
  { value: '08:00-17:00', label: '08:00 - 17:00', subLabel: 'Normal Mesai', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: '11:00-20:00', label: '11:00 - 20:00', subLabel: 'Geç Mesai', color: 'bg-sky-100 text-sky-800 border-sky-200 shadow-sm ring-2 ring-sky-400' },
  { value: '08:00-20:00', label: '08:00 - 20:00', subLabel: '+3 Saat Ekstra', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'off', label: 'İzinli', color: 'bg-rose-100 text-rose-800 border-rose-200' }
];

export function OldTeamDashboard({ user, onLogout }: OldTeamDashboardProps) {
  // Always start with next week for planning
  const nextWeekStart = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
  const weekId = `${format(nextWeekStart, 'yyyy')}-W${format(nextWeekStart, 'I')}`;
  
  const [shifts, setShifts] = useState<DailyShift[]>([]);
  const [allRequests, setAllRequests] = useState<ShiftRequest[]>([]);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapDate, setSwapDate] = useState<string | null>(null);
  const [swapReceiver, setSwapReceiver] = useState<string>('');

  // Weekdays (Mon-Fri) and Saturday
  const weekDays = Array.from({ length: 6 }).map((_, i) => addDays(nextWeekStart, i));

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqs, swpReqs] = await Promise.all([
        api.getShiftRequestsByWeek(weekId),
        api.getSwapRequests(user.id, weekId)
      ]);
      setAllRequests(reqs);
      setSwaps(swpReqs);
      
      const myRequest = reqs.find(r => r.userId === user.id);
      if (myRequest) {
        setShifts(myRequest.shifts);
      } else {
        // Initialize empty shifts
        setShifts(weekDays.map(date => ({
          date: format(date, 'yyyy-MM-dd'),
          shiftType: '08:00-17:00' // Default
        })));
      }
    } catch (err) {
      console.error(err);
      toast.error('Veriler yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [weekId, user.id]);

  const handleShiftChange = (date: Date, type: ShiftType) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setShifts(prev => {
      const idx = prev.findIndex(s => s.date === dateStr);
      if (idx >= 0) {
        const newShifts = [...prev];
        newShifts[idx] = { ...newShifts[idx], shiftType: type };
        return newShifts;
      }
      return [...prev, { date: dateStr, shiftType: type }];
    });
  };

  // Check 11:00-20:00 limit globally for this date
  const is11to20Full = (dateStr: string) => {
    // Count how many OTHER users requested this shift
    const count = allRequests
      .filter(r => r.userId !== user.id) // excluding current user's draft/previous
      .reduce((acc, req) => {
        const s = req.shifts.find(sh => sh.date === dateStr);
        return acc + (s?.shiftType === '11:00-20:00' ? 1 : 0);
      }, 0);
    return count >= 1;
  };

  const validateRequest = () => {
    let hasSaturdayWorking = false;
    let hasWeekdayOff = false;

    for (const shift of shifts) {
      const isSaturday = new Date(shift.date).getDay() === 6; // 0 is Sunday, 6 is Saturday
      
      if (shift.shiftType === '11:00-20:00' && is11to20Full(shift.date)) {
        return `${format(new Date(shift.date), 'dd MMMM', { locale: tr })} için '11:00 - 20:00' kontenjanı dolu. Lütfen başka bir saat seçin.`;
      }
      
      if (isSaturday && shift.shiftType !== 'off') {
        hasSaturdayWorking = true;
        // Saturday must be 08-17
        if (shift.shiftType !== '08:00-17:00') {
           return 'Cumartesi günü sadece 08:00 - 17:00 mesaisi seçilebilir.';
        }
      }

      if (!isSaturday && shift.shiftType === 'off') {
        hasWeekdayOff = true;
      }
    }

    if (hasSaturdayWorking && !hasWeekdayOff) {
      return 'Cumartesi çalıştığınız için hafta içi 1 gün izin kullanmalısınız.';
    }

    if (!hasSaturdayWorking && hasWeekdayOff) {
      // It's possible someone just takes an unpaid day off, but business rule says 
      // "her hafta 1 kişi Cumartesi çalışıp hafta içi 1 gün izin yapacaktır."
      // Let's assume if they don't work Saturday, they shouldn't take weekday off unless explicitly approved, 
      // but we will warn or allow it based on strictness. Let's strictly enforce 5 days of work.
      const workDays = shifts.filter(s => s.shiftType !== 'off').length;
      if (workDays !== 5) {
         return 'Toplamda 5 gün çalışmalı, 1 gün izin kullanmalısınız. (Pazar hariç)';
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateRequest();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setSaving(true);
      
      const existingReq = allRequests.find(r => r.userId === user.id);
      const reqId = existingReq?.id || `${weekId}-${user.id}-${Date.now()}`;
      
      await api.saveShiftRequest({
        id: reqId,
        weekId,
        userId: user.id,
        userName: user.name,
        status: existingReq ? existingReq.status : 'pending',
        shifts,
        submittedAt: Date.now()
      });
      
      toast.success('Talebiniz başarıyla kaydedildi!');
    } catch (err) {
      console.error(err);
      toast.error('Kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendSwapRequest = async () => {
    if (!swapDate || !swapReceiver) return;
    try {
      const newSwap: SwapRequest = {
        id: `swap-${Date.now()}`,
        weekId,
        date: swapDate,
        senderUserId: user.id,
        receiverUserId: swapReceiver,
        status: 'pending',
        createdAt: Date.now()
      };
      await api.createSwapRequest(newSwap);
      toast.success('Takas teklifi gönderildi!');
      setSwapModalOpen(false);
      setSwapReceiver('');
      setSwapDate(null);
      loadData();
    } catch (err) {
      toast.error('Takas teklifi gönderilemedi.');
    }
  };

  const handleRespondToSwap = async (swap: SwapRequest, response: 'accepted' | 'rejected') => {
    try {
      await api.respondToSwap(swap, response);
      toast.success(`Takas teklifi ${response === 'accepted' ? 'onaylandı' : 'reddedildi'}.`);
      loadData();
    } catch (err) {
      toast.error('İşlem başarısız oldu.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
  }

  const myRequest = allRequests.find(r => r.userId === user.id);
  const isApproved = myRequest?.status === 'approved';
  
  const incomingSwaps = swaps.filter(s => s.receiverUserId === user.id && s.status === 'pending');
  const otherMembers = USERS.filter(u => u.role === 'old_team' && u.id !== user.id);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Hoş geldin, {user.name}</h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">Haftalık Mesai Talep Ekranı</p>
        </div>
        <button 
          onClick={onLogout}
          className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          Çıkış Yap
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-lg text-slate-900 tracking-tight">
                {format(nextWeekStart, 'dd MMMM yyyy', { locale: tr })} Haftası
              </h2>
            </div>
            {isApproved && (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                Onaylandı
              </span>
            )}
          </div>
          
          <div className="p-6">
            {incomingSwaps.length > 0 && (
              <div className="mb-6 space-y-3">
                {incomingSwaps.map(swap => {
                  const sender = USERS.find(u => u.id === swap.senderUserId);
                  return (
                    <div key={swap.id} className="bg-sky-50 border border-sky-200 p-4 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ArrowLeftRight className="w-5 h-5 text-sky-600" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {sender?.name} size bir takas teklifi gönderdi!
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Tarih: <span className="font-bold">{format(new Date(swap.date), 'dd MMMM yyyy', { locale: tr })}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleRespondToSwap(swap, 'accepted')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition flex items-center gap-1">
                          <Check className="w-4 h-4" /> Kabul Et
                        </button>
                        <button onClick={() => handleRespondToSwap(swap, 'rejected')} className="px-3 py-1.5 bg-white text-rose-600 border border-rose-200 text-xs font-bold rounded-lg hover:bg-rose-50 transition flex items-center gap-1">
                          <X className="w-4 h-4" /> Reddet
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {isApproved ? (
              <div className="bg-indigo-50 text-indigo-800 p-4 rounded-lg mb-6 flex gap-3 border border-indigo-100">
                <AlertTriangle className="w-5 h-5 shrink-0 text-indigo-600" />
                <p className="text-sm font-medium">Bu haftaki talebiniz onaylanmıştır. Artık değişiklik yapamazsınız.</p>
              </div>
            ) : (
              <div className="bg-amber-50 text-amber-800 p-4 rounded-lg mb-6 text-xs font-semibold border border-amber-100">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Hafta içi saatlerinden sadece birini seçebilirsiniz.</li>
                  <li>Aynı gün içinde 11:00 - 20:00 vardiyasını sadece 1 kişi seçebilir.</li>
                  <li>Cumartesi (08:00-17:00) çalışıyorsanız, hafta içi 1 gün izin seçmelisiniz.</li>
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              {weekDays.map(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const isSaturday = date.getDay() === 6;
                const currentShift = shifts.find(s => s.date === dateStr)?.shiftType || '08:00-17:00';
                
                return (
                  <div key={dateStr} className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm transition-all hover:border-indigo-200 hover:shadow-md">
                    <div className="px-3 py-3 border-b border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center">
                      <p className="font-bold text-slate-900 tracking-tight text-sm uppercase">
                        {format(date, 'EEEE', { locale: tr })}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                        {format(date, 'dd MMM', { locale: tr })}
                      </p>
                    </div>
                    
                    <div className="p-3 flex-1 flex flex-col gap-2">
                      {isSaturday ? (
                        <>
                          <button
                            disabled={isApproved}
                            onClick={() => handleShiftChange(date, '08:00-17:00')}
                            className={cn(
                              "w-full px-2 py-3 rounded-lg border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1",
                              currentShift === '08:00-17:00' 
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm",
                              isApproved && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <span>08:00 - 17:00</span>
                            <span className="text-[10px] font-semibold opacity-70">Çalışacağım</span>
                          </button>
                          <button
                            disabled={isApproved}
                            onClick={() => handleShiftChange(date, 'off')}
                            className={cn(
                              "w-full px-2 py-3 rounded-lg border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1",
                              currentShift === 'off' 
                                ? "bg-rose-100 text-rose-800 border-rose-200" 
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm",
                              isApproved && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            İzinliyim
                          </button>
                        </>
                      ) : (
                        SHIFT_OPTIONS.map(opt => {
                          const isSelected = currentShift === opt.value;
                          const isFull = opt.value === '11:00-20:00' && is11to20Full(dateStr);
                          const isDisabled = isApproved || (isFull && !isSelected);

                          return (
                            <button
                              key={opt.value}
                              disabled={isDisabled}
                              onClick={() => handleShiftChange(date, opt.value)}
                              className={cn(
                                "w-full px-2 py-2.5 rounded-lg border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5",
                                isSelected ? opt.color : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm",
                                isDisabled && "opacity-50 cursor-not-allowed"
                              )}
                              title={isFull && !isSelected ? "Bu saat dilimi dolu" : undefined}
                            >
                              <span>{opt.label}</span>
                              {opt.subLabel && <span className="text-[9px] font-semibold opacity-70 uppercase tracking-tight">{opt.subLabel}</span>}
                            </button>
                          );
                        })
                      )}

                      {isApproved && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => { setSwapDate(dateStr); setSwapModalOpen(true); }}
                            className="w-full py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-200 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                          >
                            <ArrowLeftRight className="w-3 h-3" />
                            Takas Teklif Et
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {!isApproved && (
              <div className="mt-8 pt-6 border-t border-slate-200">
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="w-full bg-indigo-600 text-white rounded-lg px-4 py-3 text-xs font-bold shadow-md hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  <Send className="w-4 h-4" />
                  {saving ? 'Gönderiliyor...' : 'Talebi Gönder'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {swapModalOpen && swapDate && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Takas Teklifi Gönder</h3>
              <button onClick={() => setSwapModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 mb-4">
                <span className="font-bold text-slate-900">{format(new Date(swapDate), 'dd MMMM yyyy', { locale: tr })}</span> tarihindeki vardiyanızı kiminle takas etmek istiyorsunuz?
              </p>
              
              <div className="space-y-3">
                {otherMembers.map(m => {
                  const hasPendingSwap = swaps.some(s => s.date === swapDate && s.receiverUserId === m.id && s.status === 'pending');
                  return (
                    <label key={m.id} className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                      swapReceiver === m.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-indigo-300",
                      hasPendingSwap && "opacity-50 pointer-events-none"
                    )}>
                      <input 
                        type="radio" 
                        name="swapReceiver" 
                        value={m.id} 
                        checked={swapReceiver === m.id}
                        onChange={(e) => setSwapReceiver(e.target.value)}
                        disabled={hasPendingSwap}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-800">{m.name}</p>
                        {hasPendingSwap && <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Zaten bekleyen teklifiniz var</p>}
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-6">
                <button 
                  onClick={handleSendSwapRequest}
                  disabled={!swapReceiver}
                  className="w-full bg-indigo-600 text-white rounded-xl px-4 py-3 text-sm font-bold shadow-md hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  Teklifi Gönder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
