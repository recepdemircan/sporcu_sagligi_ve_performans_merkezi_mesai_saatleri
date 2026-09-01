import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ShiftRequest, UserRole } from '../types';
import { USERS } from '../lib/constants';
import { api } from '../lib/api';
import { addDays, startOfWeek, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Calendar, CheckCircle, XCircle, Download, RotateCcw, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { useLogo } from '../lib/useLogo';

interface ManagerDashboardProps {
  onLogout: () => void;
}

const DEPARTMENTS: { role: UserRole; name: string }[] = [
  { role: 'athletic', name: 'Atletik Performans Departmanı' },
  { role: 'health', name: 'Sağlık ve Destek Departmanı' },
  { role: 'senior', name: 'Kıdemli Uzmanlar' },
  { role: 'fixed', name: 'Fizyoterapi (Sabah / Akşam Ekibi)' }
];

export function ManagerDashboard({ onLogout }: ManagerDashboardProps) {
  const nextWeekStart = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
  const weekId = `${format(nextWeekStart, 'yyyy')}-W${format(nextWeekStart, 'I')}`;
  
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { logo, updateLogo } = useLogo();
  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${format(nextWeekStart, 'dd-MMM-yyyy')}-calisma-plani`,
    pageStyle: `
      @page { size: landscape; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; }
      }
    `
  });

  const loadData = async () => {
    try {
      const data = await api.getShiftRequests(weekId);
      setRequests(data);
    } catch (error) {
      toast.error('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [weekId]);

  const handleAction = async (id: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      await api.updateShiftRequestStatus(id, status as 'approved' | 'rejected', weekId);
      toast.success(status === 'approved' ? 'Talep onaylandı' : status === 'rejected' ? 'Talep reddedildi' : 'Durum geri alındı');
      loadData();
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  const handleManualBackup = () => {
    const dataStr = JSON.stringify(requests, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `mesai-yedek-${weekId}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    toast.success('Yedek indirildi');
  };

  const weekDays = Array.from({ length: 6 }).map((_, i) => addDays(nextWeekStart, i));

  const getShiftColor = (shift: string) => {
    switch (shift) {
      case '08:00-17:00': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case '11:00-20:00': return 'bg-sky-100 text-sky-700 border-sky-200';
      case '08:00-20:00': return 'bg-amber-100 text-amber-700 border-amber-300 shadow-inner';
      case 'off': return 'bg-rose-100 text-rose-700 border-rose-200 opacity-60';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const requestsMap = useMemo(() => {
    const map = new Map<string, ShiftRequest>();
    requests.forEach(r => map.set(r.userId, r));
    return map;
  }, [requests]);

  const checkMondayRule = () => {
    const mondayStr = format(weekDays[0], 'yyyy-MM-dd');
    
    // Recep Demircan ID or just search in requests
    const recepReq = requests.find(r => r.userName === 'Recep Demircan');
    const ademcanReq = requests.find(r => r.userName === 'Ademcan Salep');

    const recepShift = recepReq?.shifts.find(s => s.date === mondayStr)?.shiftType;
    const ademcanShift = ademcanReq?.shifts.find(s => s.date === mondayStr)?.shiftType;

    const recepValid = recepShift === '11:00-20:00' || recepShift === '08:00-20:00';
    const ademcanValid = ademcanShift === '11:00-20:00' || ademcanShift === '08:00-20:00';

    return recepValid || ademcanValid;
  };

  const isMondayRuleSatisfied = checkMondayRule();
  // We only show warning if there are pending requests, or if approved but missing the rule.
  const showMondayWarning = !isMondayRuleSatisfied;

  const approveAll = async () => {
    if (!isMondayRuleSatisfied) {
      toast.error('Pazartesi kuralı sağlanmadan tümünü onaylayamazsınız!');
      return;
    }
    if (window.confirm('Tüm bekleyen talepler onaylanacak. Emin misiniz?')) {
      const pendingReqs = requests.filter(r => r.status === 'pending');
      for (const req of pendingReqs) {
        await api.updateShiftRequestStatus(req.id, 'approved', weekId);
      }
      toast.success('Tüm talepler onaylandı');
      loadData();
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for firestore
        toast.error('Logo boyutu 1MB\'dan küçük olmalıdır.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          await updateLogo(reader.result as string);
          toast.success('Kurum logosu başarıyla güncellendi!');
        } catch(err) {
          toast.error('Logo güncellenirken hata oluştu');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-10 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          {logo && <img src={logo} alt="İBB Spor İstanbul Logo" className="h-8 sm:h-10 object-contain" />}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Yönetici Paneli</h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Mahsum Akikol</p>
          </div>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-4 w-full sm:w-auto">
          <label className="flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-100 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer w-full sm:w-auto text-center">
            Logo Yükle
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </label>
          <button 
            onClick={handleManualBackup}
            className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-sm hover:bg-indigo-100 px-4 py-2 rounded-lg text-sm font-semibold transition-colors w-full sm:w-auto justify-center"
          >
            <Download className="w-4 h-4" />
            <span>Yedek Al</span>
          </button>
          
          <button 
            onClick={handlePrint}
            className="bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            Çıktı Al
          </button>
          <button 
            onClick={onLogout}
            className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors self-end sm:self-auto"
          >
            Çıkış Yap
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6" ref={printRef}>
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-slate-900" />
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {format(nextWeekStart, 'dd MMMM yyyy', { locale: tr })} Haftası Çalışma Planı
            </h2>
          </div>
          <button onClick={approveAll} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg shadow hover:bg-emerald-700 print:hidden">
            Tümünü Onayla
          </button>
        </div>

        {showMondayWarning && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl mb-6 flex items-start gap-3 shadow-sm print:hidden">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm">Kritik Kural İhlali: Pazartesi Akşamı (Eren Çelik İzinli)</h3>
              <p className="text-xs mt-1">Eren Çelik Pazartesi günleri izinli olduğu için, Atletik Performans departmanından <strong>Recep Demircan</strong> veya <strong>Ademcan Salep</strong>'in Pazartesi günü için mutlaka <strong>11:00-20:00</strong> veya <strong>08:00-20:00</strong> vardiyasını seçip onaylanması zorunludur.</p>
            </div>
          </div>
        )}

        {DEPARTMENTS.map((dept) => {
          const deptUsers = USERS.filter(u => u.role === dept.role);
          if (deptUsers.length === 0) return null;

          return (
            <div key={dept.role} className="mb-8">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-4">{dept.name}</h2>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-slate-300">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-4 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-r border-slate-200 min-w-[150px] sticky left-0 bg-slate-50 z-10">Personel</th>
                        {weekDays.map(date => (
                          <th key={date.toString()} className="px-2 py-4 text-[11px] uppercase tracking-wider text-slate-500 font-bold text-center min-w-[100px]">
                            {format(date, 'EEEE', { locale: tr })}<br/>
                            <span className="text-[9px] font-medium text-slate-400">{format(date, 'dd MMM')}</span>
                          </th>
                        ))}
                        <th className="px-4 py-4 text-[11px] uppercase tracking-wider text-slate-500 font-bold text-center min-w-[80px]">Ekstra<br/>Mesai</th>
                        <th className="px-4 py-4 text-[11px] uppercase tracking-wider text-slate-500 font-bold text-center w-32 print:hidden">Durum / İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {deptUsers.map(user => {
                        const req = requestsMap.get(user.id);
                        
                        let overtimeHours = 0;
                        let userShiftMap = new Map();
                        if (req) {
                          overtimeHours = req.shifts.filter(s => s.shiftType === '08:00-20:00').length * 3;
                          req.shifts.forEach(s => userShiftMap.set(s.date, s));
                        }

                        return (
                          <tr key={user.id} className="group hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 border-r border-slate-200 min-w-[150px] sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                              <div className="text-sm font-bold text-slate-900">{user.name}</div>
                              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{user.title}</div>
                            </td>
                            {weekDays.map(date => {
                              const dateStr = format(date, 'yyyy-MM-dd');
                              const shift = userShiftMap.get(dateStr);
                              return (
                                <td key={dateStr} className="p-1">
                                  {shift ? (
                                    <div className={cn("h-10 text-[10px] font-bold rounded flex items-center justify-center border", getShiftColor(shift.shiftType))}>
                                      {shift.shiftType === 'off' ? 'İZİN' : shift.shiftType}
                                    </div>
                                  ) : (
                                    <div className="h-10 bg-slate-50 text-slate-300 text-[10px] font-bold rounded flex items-center justify-center border border-transparent">-</div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-center border-l border-slate-200 bg-amber-50/30">
                              <div className="text-sm font-bold text-amber-700">{overtimeHours > 0 ? `+${overtimeHours} Saat` : '-'}</div>
                            </td>
                            <td className="p-4 print:hidden border-l border-slate-200">
                              {!req ? (
                                <span className="text-slate-400 text-sm">Girilmedi</span>
                              ) : req.status === 'pending' ? (
                                <div className="flex gap-2 justify-center">
                                  <button onClick={() => handleAction(req.id, 'approved')} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded" title="Onayla">
                                    <CheckCircle className="w-5 h-5" />
                                  </button>
                                  <button onClick={() => handleAction(req.id, 'rejected')} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded" title="Reddet">
                                    <XCircle className="w-5 h-5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-center items-center gap-2">
                                  <span className={cn(
                                    "px-2.5 py-1 rounded-full text-[10px] font-bold",
                                    req.status === 'approved' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                  )}>
                                    {req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                                  </span>
                                  <button onClick={() => handleAction(req.id, 'pending')} className="text-slate-400 hover:text-slate-600 p-1" title="Kararı Geri Al">
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
