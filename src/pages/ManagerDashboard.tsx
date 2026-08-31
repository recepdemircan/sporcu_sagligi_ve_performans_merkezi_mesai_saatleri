import React, { useState, useEffect, useRef } from 'react';
import { User, ShiftRequest } from '../types';
import { USERS } from '../lib/constants';
import { api } from '../lib/api';
import { addDays, startOfWeek, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Calendar, CheckCircle, XCircle, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { backupService } from '../lib/backupService';
import { DatabaseBackup } from 'lucide-react';

interface ManagerDashboardProps {
  onLogout: () => void;
}

export function ManagerDashboard({ onLogout }: ManagerDashboardProps) {
  const nextWeekStart = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
  const weekId = `${format(nextWeekStart, 'yyyy')}-W${format(nextWeekStart, 'I')}`;
  
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const printRef = useRef<HTMLDivElement>(null);

  // Weekdays (Mon-Fri) and Saturday
  const weekDays = Array.from({ length: 6 }).map((_, i) => addDays(nextWeekStart, i));

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const reqs = await api.getShiftRequestsByWeek(weekId);
      setRequests(reqs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Otomatik haftalık uyumluluk kontrolünü çalıştır (arkaplanda)
    backupService.checkAndRunComplianceBackup().then((wasRun) => {
      if (wasRun) {
        toast.success("Haftalık otomatik uyumluluk kontrolü ve Firestore yedeği tamamlandı.", { duration: 5000 });
      }
    });
  }, [weekId]);

  const handleManualBackup = async () => {
    const toastId = toast.loading('Sistem yedeği hazırlanıyor...');
    const success = await backupService.forceManualBackup();
    if (success) {
      toast.success('Sistem yedeği başarıyla indirildi!', { id: toastId });
    } else {
      toast.error('Yedekleme işlemi başarısız oldu.', { id: toastId });
    }
  };

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await api.updateShiftRequestStatus(id, status, weekId);
      await fetchRequests(); // Refresh
      if (status === 'approved') {
        toast.success('Talep onaylandı!');
      } else {
        toast.success('Talep reddedildi.');
      }
    } catch (err) {
      console.error(err);
      toast.error('İşlem başarısız oldu.');
    }
  };

  const getShiftColor = (shiftType: string) => {
    switch (shiftType) {
      case '08:00-17:00': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case '11:00-20:00': return 'bg-sky-100 text-sky-800 border-sky-200 shadow-sm ring-1 ring-sky-300';
      case '08:00-20:00': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'off': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Haftalik_Plan_${weekId}`,
    pageStyle: `
      @page { size: landscape; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm print:hidden">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Yönetici Paneli</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Mahsum Akikol</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handleManualBackup}
            className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-sm hover:bg-indigo-100 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <DatabaseBackup className="w-4 h-4" />
            Yedek Al
          </button>
          <button 
            onClick={() => handlePrint()}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Download className="w-4 h-4" />
            PDF İndir
          </button>
          <button 
            onClick={onLogout}
            className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            Çıkış Yap
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6" ref={printRef}>
        {/* Print Header (Visible mostly on print or top of page) */}
        <div className="mb-6 flex items-center gap-3">
          <Calendar className="w-6 h-6 text-slate-900" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {format(nextWeekStart, 'dd MMMM yyyy', { locale: tr })} Haftası Çalışma Planı
          </h2>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-slate-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-4 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-r border-slate-200 w-48">Personel</th>
                  {weekDays.map(date => (
                    <th key={date.toString()} className="px-2 py-4 text-[11px] uppercase tracking-wider text-slate-500 font-bold text-center min-w-[100px]">
                      {format(date, 'EEEE', { locale: tr })}<br/>
                      <span className="text-[9px] font-medium text-slate-400">{format(date, 'dd MMM')}</span>
                    </th>
                  ))}
                  <th className="px-4 py-4 text-[11px] uppercase tracking-wider text-slate-500 font-bold text-center w-32 print:hidden">Durum / İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {USERS.filter(u => u.role === 'old_team').map(user => {
                  const req = requests.find(r => r.userId === user.id);
                  return (
                    <tr key={user.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 border-r border-slate-200">
                        <div className="text-sm font-bold text-slate-900">{user.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Eski Ekip</div>
                      </td>
                      {weekDays.map(date => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const shift = req?.shifts.find(s => s.date === dateStr);
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
                      <td className="p-4 print:hidden">
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
                          <div className="flex justify-center">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-bold",
                              req.status === 'approved' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            )}>
                              {req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                            </span>
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

        <div className="mt-8 mb-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-4">Yeni Ekip (Sabit Mesai)</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-slate-300">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-4 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-r border-slate-200 w-48">Personel</th>
                  {weekDays.map(date => (
                    <th key={date.toString()} className="px-2 py-4 text-[11px] uppercase tracking-wider text-slate-500 font-bold text-center min-w-[100px]">
                      {format(date, 'EEEE', { locale: tr })}
                    </th>
                  ))}
                  <th className="w-32 print:hidden"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {USERS.filter(u => u.role === 'new_team').map((user, index) => (
                  <tr key={user.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 border-r border-slate-200">
                      <div className="text-sm font-bold text-slate-900">{user.name}</div>
                      <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-tight">Yeni Ekip</div>
                    </td>
                    {weekDays.map((date, dateIndex) => {
                      const isSaturday = date.getDay() === 6;
                      const isOffDay = dateIndex === index && !isSaturday;
                      return (
                        <td key={date.toString()} className="p-1">
                           {isSaturday ? (
                             <div className="h-10 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold rounded flex items-center justify-center opacity-70">08:00-17:00</div>
                           ) : isOffDay ? (
                             <div className="h-10 bg-rose-50 text-rose-400 border border-rose-100 text-[10px] font-bold rounded flex items-center justify-center opacity-70">İZİN</div>
                           ) : (
                             <div className="h-10 bg-sky-50 text-sky-600 border border-sky-100 text-[10px] font-bold rounded flex items-center justify-center opacity-70">11:00-20:00</div>
                           )}
                        </td>
                      );
                    })}
                    <td className="print:hidden"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
