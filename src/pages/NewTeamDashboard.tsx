import React from 'react';
import { User } from '../types';
import { LogOut, Calendar } from 'lucide-react';
import { addDays, startOfWeek, format } from 'date-fns';
import { tr } from 'date-fns/locale';

export function NewTeamDashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
  const nextWeekStart = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
  
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 font-sans text-slate-800">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="w-12 h-12 bg-indigo-600 text-white rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Calendar className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-2">Hoş geldin, {user.name}</h1>
        <p className="text-xs font-medium text-slate-500 mb-6">
          Sisteme sadece görüntüleme yetkisi ile giriş yaptınız. Çalışma saatleriniz sabittir.
        </p>
        
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6 text-left text-xs font-semibold text-slate-700">
          <p className="font-medium mb-2 border-b pb-2">Çalışma Saatleriniz:</p>
          <ul className="space-y-1">
            <li>• Hafta içi 4 gün: 11:00 - 20:00</li>
            <li>• Hafta içi 1 gün: Dönüşümlü İzin</li>
            <li>• Cumartesi: 08:00 - 17:00</li>
            <li>• Pazar: İzinli</li>
          </ul>
        </div>
        
        <p className="text-xs text-slate-500 mb-6">
          Onaylanmış haftalık çizelgeleri yöneticinizden edinebilirsiniz.
        </p>

        <button 
          onClick={onLogout}
          className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white shadow-md hover:bg-indigo-700 py-3 rounded-lg text-sm font-bold transition-all"
        >
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}
