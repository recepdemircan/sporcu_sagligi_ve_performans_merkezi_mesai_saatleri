import React, { useState } from 'react';
import { USERS, MANAGER_PIN } from '../lib/constants';
import { User } from '../types';
import { LogIn, UserCircle2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedUserId) {
      setError('Lütfen bir kullanıcı seçin.');
      return;
    }

    const user = USERS.find(u => u.id === selectedUserId);
    if (!user) return;

    if (user.role === 'manager') {
      if (pin !== MANAGER_PIN) {
        setError('Hatalı şifre.');
        return;
      }
    }

    onLogin(user);
  };

  const selectedUser = USERS.find(u => u.id === selectedUserId);
  const isManager = selectedUser?.role === 'manager';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col items-center mb-8 text-center">
          <img src="/logo.png" alt="İBB Spor İstanbul Logo" className="h-16 object-contain mb-4" onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
          }} />
          <div className="hidden w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4 shadow-sm">
            <UserCircle2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Çırpıcı Sporcu Sağlığı Merkezi
          </h1>
          <p className="text-slate-500 mt-1 text-xs font-medium">
            Vardiya ve Mesai Planlama Sistemi
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Personel Seçimi
            </label>
            <select
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setPin('');
                setError('');
              }}
            >
              <option value="">-- Lütfen Seçiniz --</option>
              <optgroup label="Yönetim">
                {USERS.filter(u => u.role === 'manager').map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.title})</option>
                ))}
              </optgroup>
              <optgroup label="Kıdemli Uzmanlar">
                {USERS.filter(u => u.role === 'senior').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </optgroup>
              <optgroup label="Sabit Vardiya Uzmanları">
                {USERS.filter(u => u.role === 'fixed').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </optgroup>
              <optgroup label="Atletik Performans Departmanı">
                {USERS.filter(u => u.role === 'athletic').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </optgroup>
              <optgroup label="Sağlık ve Destek Departmanı">
                {USERS.filter(u => u.role === 'health').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {isManager && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Yönetici Şifresi
              </label>
              <input
                type="password"
                maxLength={4}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="****"
              />
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white rounded-lg px-4 py-3 font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 mt-6 shadow-md"
          >
            <LogIn className="w-4 h-4" />
            Sisteme Giriş Yap
          </button>
        </form>
      </div>
    </div>
  );
}
