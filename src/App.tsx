/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { User } from './types';
import { Login } from './pages/Login';
import { TeamDashboard } from './pages/TeamDashboard';
import { ManagerDashboard } from './pages/ManagerDashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('cirpici_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('cirpici_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('cirpici_user');
  };

  return (
    <>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            fontSize: '14px',
            fontWeight: '600',
            borderRadius: '12px',
            color: '#1e293b',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
        }} 
      />
      {!user && <Login onLogin={handleLogin} />}
      {user?.role === 'manager' && <ManagerDashboard onLogout={handleLogout} />}
      {user?.role && user.role !== 'manager' && <TeamDashboard user={user} onLogout={handleLogout} />}
    </>
  );
}

