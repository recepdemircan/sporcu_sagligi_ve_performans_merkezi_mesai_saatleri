import React, { useState, useEffect } from 'react';
import { User, ShiftRequest, SwapRequest, DailyShift, ShiftType } from '../types';
import { api } from '../lib/api';
import { addDays, startOfWeek, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Calendar, ArrowLeftRight, Check, X, Send, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { USERS } from '../lib/constants';
import toast from 'react-hot-toast';
import { useLogo } from '../lib/useLogo';

interface TeamDashboardProps {
  user: User;
  onLogout: () => void;
}

export function TeamDashboard({ user, onLogout }: TeamDashboardProps) {
  const nextWeekStart = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 6 }).map((_, i) => addDays(nextWeekStart, i));
  const weekId = `${format(nextWeekStart, 'yyyy')}-W${format(nextWeekStart, 'I')}`;

  const [shifts, setShifts] = useState<DailyShift[]>([]);
  const [allRequests, setAllRequests] = useState<ShiftRequest[]>([]);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapDate, setSwapDate] = useState<string | null>(null);
  const [swapReceiver, setSwapReceiver] = useState<string>('');
  const { logo } = useLogo();

  const isEren = user.name === 'Eren Çelik';

  const loadData = async () => {
    try {
      const [reqs, swps] = await Promise.all([
        api.getShiftRequests(weekId),
        api.getSwapRequests(user.id, weekId)
      ]);
      setAllRequests(reqs);
      setSwaps(swps);

      const existingReq = reqs.find(r => r.userId === user.id);
      if (existingReq && existingReq.shifts && existingReq.shifts.length > 0) {
        setShifts(existingReq.shifts);
      } else {
        if (isEren) {
          // Fixed Schedule for Eren
          setShifts(weekDays.map(date => {
            const day = date.getDay();
            if (day === 1) return { date: format(date, 'yyyy-MM-dd'), shiftType: 'off' };
            if (day === 6) return { date: format(date, 'yyyy-MM-dd'), shiftType: '08:00-17:00' };
            return { date: format(date, 'yyyy-MM-dd'), shiftType: '11:00-20:00' };
          }));
        } else {
          setShifts(weekDays.map(date => ({
            date: format(date, 'yyyy-MM-dd'),
            shiftType: date.getDay() === 6 ? 'off' : '08:00-17:00'
          })));
        }
      }
    } catch (err) {
      toast.error('Veriler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [weekId, user.id]);

  const myRequest = allRequests.find(r => r.userId === user.id);
  const isApproved = myRequest?.status === 'approved';
  const isRejected = myRequest?.status === 'rejected';
  
  const incomingSwaps = swaps.filter(s => s.receiverUserId === user.id && s.status === 'pending');
  // Swap targets: anyone not manager, not new_team/fixed, except self
  // Let's allow swap with same department for now, or all specialists.
  const otherMembers = USERS.filter(u => u.role !== 'manager' && u.role !== 'fixed' && u.id !== user.id);

  const is11to20Full = (dateStr: string) => {
    return allRequests.some(r => 
      r.userId !== user.id && 
      r.shifts.find(s => s.date === dateStr && s.shiftType === '11:00-20:00')
    );
  };

  const handleShiftChange = (date: Date, newShift: ShiftType) => {
    if (isApproved || isEren) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    setShifts(prev => prev.map(s => s.date === dateStr ? { ...s, shiftType: newShift } : s));
  };

  const validateShifts = () => {
    if (isEren) return true; // Fixed schedule doesn't need validation
    const hasSaturdayShift = shifts.find(s => {
      const d = new Date(s.date);
      return d.getDay() === 6 && s.shiftType !== 'off';
    });

    if (hasSaturdayShift) {
      const weekdayOffs = shifts.filter(s => {
        const d = new Date(s.date);
        return d.getDay() >= 1 && d.getDay() <= 5 && s.shiftType === 'off';
      });
      if (weekdayOffs.length === 0) {
        toast.error('Cumartesi çalışıyorsanız, hafta içi en az 1 gün izin seçmelisiniz!');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateShifts()) return;
    
    try {
      setSaving(true);
      
      const reqId = myRequest?.id || `${weekId}-${user.id}-${Date.now()}`;
      
      await api.saveShiftRequest({
        id: reqId,
        weekId,
        userId: user.id,
        userName: user.name,
        status: 'pending',
        shifts,
        submittedAt: Date.now()
      });
      
      toast.success('Talebiniz başarıyla kaydedildi!');
      loadData();
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
      const swapId = `${weekId}-${user.id}-${swapReceiver}-${Date.now()}`;
      await api.createSwapRequest({
        id: swapId,
        weekId,
        date: swapDate,
        senderUserId: user.id,
        receiverUserId: swapReceiver,
        status: 'pending',
        createdAt: Date.now()
      });
      toast.success('Takas teklifi gönderildi!');
      setSwapModalOpen(false);
      loadData();
    } catch (err) {
      toast.error('Teklif gönderilemedi');
    }
  };

  const handleRespondToSwap = async (swap: SwapRequest, status: 'accepted' | 'rejected') => {
    try {
      await api.respondToSwap(swap, status);
      toast.success(status === 'accepted' ? 'Takas kabul edildi!' : 'Takas reddedildi');
      loadData();
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
  }

  // Calculate Extra Overtime
  const extraOvertimeHours = shifts.filter(s => s.shiftType === '08:00-20:00').length * 3;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          {logo && <img src={logo} alt="İBB Spor İstanbul Logo" className="h-8 sm:h-10 object-contain hidden sm:block" />}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Hoş geldin, {user.name}</h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{user.title} | Haftalık Mesai Ekranı</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors self-end sm:self-auto"
        >
          Çıkış Yap
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-lg text-slate-900 tracking-tight">
                {format(nextWeekStart, 'dd MMMM yyyy', { locale: tr })} Haftası
              </h2>
            </div>
            {myRequest?.status && (
              <span className={cn(
                "px-3 py-1 rounded-full text-sm font-medium border",
                myRequest.status === 'approved' ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                myRequest.status === 'rejected' ? "bg-rose-100 text-rose-800 border-rose-200" :
                "bg-amber-100 text-amber-800 border-amber-200"
              )}>
                Durum: {myRequest.status === 'approved' ? 'Onaylandı' : myRequest.status === 'rejected' ? 'Reddedildi' : 'Beklemede'}
              </span>
            )}
          </div>
          
          <div className="p-4 sm:p-6">
            {incomingSwaps.length > 0 && (
              <div className="mb-6 space-y-3">
                {incomingSwaps.map(swap => {
                  const sender = USERS.find(u => u.id === swap.senderUserId);
                  return (
                    <div key={swap.id} className="bg-sky-50 border border-sky-200 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <ArrowLeftRight className="w-5 h-5 text-sky-600" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            <span className="text-indigo-600">{sender?.name}</span> size bir takas teklifi gönderdi.
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Tarih: <span className="font-bold">{format(new Date(swap.date), 'dd MMMM yyyy', { locale: tr })}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => handleRespondToSwap(swap, 'accepted')} className="flex-1 sm:flex-none justify-center px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition flex items-center gap-1">
                          <Check className="w-4 h-4" /> Kabul Et
                        </button>
                        <button onClick={() => handleRespondToSwap(swap, 'rejected')} className="flex-1 sm:flex-none justify-center px-3 py-1.5 bg-white text-rose-600 border border-rose-200 text-xs font-bold rounded-lg hover:bg-rose-50 transition flex items-center gap-1">
                          <X className="w-4 h-4" /> Reddet
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isApproved ? (
              <div className="bg-indigo-50 text-indigo-800 p-4 rounded-lg mb-6 flex gap-3 border border-indigo-100">
                <AlertTriangle className="w-5 h-5 shrink-0 text-indigo-600" />
                <p className="text-sm font-medium">Bu haftaki talebiniz onaylanmıştır. Artık değişiklik yapamazsınız.</p>
              </div>
            ) : isRejected ? (
              <div className="bg-rose-50 text-rose-800 p-4 rounded-lg mb-6 flex gap-3 border border-rose-100">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
                <p className="text-sm font-medium">Talebiniz yönetici tarafından reddedildi! Lütfen seçimlerinizi güncelleyerek tekrar gönderin.</p>
              </div>
            ) : isEren ? (
              <div className="bg-indigo-50 text-indigo-800 p-4 rounded-lg mb-6 flex gap-3 border border-indigo-100">
                <Clock className="w-5 h-5 shrink-0 text-indigo-600" />
                <p className="text-sm font-medium">Mesai saatleriniz sisteme sabitlenmiştir. Düzenleme yapamazsınız, sadece onay için gönderebilirsiniz.</p>
              </div>
            ) : (
              <div className="bg-amber-50 text-amber-800 p-4 rounded-lg mb-6 text-xs font-semibold border border-amber-100">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Hafta içi saatlerinden sadece birini seçebilirsiniz.</li>
                  <li>Aynı gün içinde 11:00 - 20:00 vardiyasını departmanlardan sadece 1 kişi seçebilir.</li>
                  <li>Cumartesi (08:00-17:00) çalışıyorsanız, hafta içi 1 gün izin seçmelisiniz.</li>
                  {user.role !== 'fixed' && <li><strong>+3 Saat Ekstra Mesai</strong> seçeneği ile mesai kazancı sağlayabilirsiniz.</li>}
                </ul>
              </div>
            )}

            {extraOvertimeHours > 0 && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                <span className="text-sm font-bold text-emerald-800">Bu Haftaki Toplam Ekstra Mesai:</span>
                <span className="px-3 py-1 bg-emerald-600 text-white rounded-md text-sm font-bold">+{extraOvertimeHours} Saat</span>
              </div>
            )}

            <div className="flex overflow-x-auto snap-x snap-mandatory sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 pb-4 sm:pb-0 scroll-smooth hide-scrollbar">
              {weekDays.map(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const isSaturday = date.getDay() === 6;
                const currentShift = shifts.find(s => s.date === dateStr)?.shiftType || '08:00-17:00';
                
                return (
                  <div key={dateStr} className="min-w-[85vw] sm:min-w-0 snap-center flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm transition-all hover:border-indigo-200 hover:shadow-md">
                    <div className="px-3 py-3 border-b border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center">
                      <p className="font-bold text-slate-900 tracking-tight text-sm uppercase">
                        {format(date, 'EEEE', { locale: tr })}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                        {format(date, 'dd MMM', { locale: tr })}
                      </p>
                    </div>
                    
                    <div className="p-3 flex-1 flex flex-col gap-2">
                      {isEren ? (
                         <div className={cn(
                           "w-full px-2 py-3 rounded-lg border text-xs font-bold text-center flex flex-col items-center justify-center gap-1",
                           currentShift === 'off' ? "bg-rose-100 text-rose-800 border-rose-200" : "bg-sky-100 text-sky-800 border-sky-200"
                         )}>
                           <span>{currentShift === 'off' ? 'İZİNLİ' : currentShift}</span>
                           <span className="text-[9px] font-semibold opacity-70">Sabit Vardiya</span>
                         </div>
                      ) : isSaturday ? (
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
                        <>
                          <button
                            disabled={isApproved}
                            onClick={() => handleShiftChange(date, '08:00-17:00')}
                            className={cn(
                              "w-full px-2 py-2.5 rounded-lg border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5",
                              currentShift === '08:00-17:00' ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm",
                              isApproved && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <span>08:00 - 17:00</span>
                            <span className="text-[9px] font-semibold opacity-70 uppercase tracking-tight">Normal Mesai</span>
                          </button>
                          
                          <button
                            disabled={isApproved || (is11to20Full(dateStr) && currentShift !== '11:00-20:00')}
                            onClick={() => handleShiftChange(date, '11:00-20:00')}
                            className={cn(
                              "w-full px-2 py-2.5 rounded-lg border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5",
                              currentShift === '11:00-20:00' ? "bg-sky-100 text-sky-800 border-sky-300" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm",
                              (isApproved || (is11to20Full(dateStr) && currentShift !== '11:00-20:00')) && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <span>11:00 - 20:00</span>
                            <span className="text-[9px] font-semibold opacity-70 uppercase tracking-tight">Geç Mesai</span>
                          </button>

                          {user.role !== 'fixed' && (
                            <button
                              disabled={isApproved}
                              onClick={() => handleShiftChange(date, '08:00-20:00')}
                              className={cn(
                                "w-full px-2 py-2.5 rounded-lg border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 relative overflow-hidden",
                                currentShift === '08:00-20:00' ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm",
                                isApproved && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <span>08:00 - 20:00</span>
                              <span className="text-[9px] font-semibold opacity-70 uppercase tracking-tight">+3 Saat Ekstra</span>
                            </button>
                          )}

                          <button
                            disabled={isApproved}
                            onClick={() => handleShiftChange(date, 'off')}
                            className={cn(
                              "w-full px-2 py-2.5 rounded-lg border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5",
                              currentShift === 'off' ? "bg-rose-100 text-rose-800 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm",
                              isApproved && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <span>İzinli (Off)</span>
                          </button>
                        </>
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
                  {saving ? 'Gönderiliyor...' : isEren ? 'Sabit Vardiyayı Onaya Gönder' : 'Talebi Gönder'}
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
              
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
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
                      <div className="flex-1 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm text-slate-800">{m.name}</p>
                          <p className="text-[10px] text-slate-500">{m.title}</p>
                        </div>
                        {hasPendingSwap && <p className="text-[10px] text-amber-600 font-semibold">Bekliyor</p>}
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
