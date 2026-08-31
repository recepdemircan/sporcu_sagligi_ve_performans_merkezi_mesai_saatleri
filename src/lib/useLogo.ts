import { useState, useEffect } from 'react';
import { api } from './api';

let cachedLogo: string | null = null;
let hasFetched = false;
let listeners: ((logo: string | null) => void)[] = [];

export function useLogo() {
  const [logo, setLogo] = useState<string | null>(cachedLogo);

  useEffect(() => {
    if (hasFetched) return;
    
    const fetchLogo = async () => {
      const dbLogo = await api.getLogo();
      cachedLogo = dbLogo;
      hasFetched = true;
      setLogo(dbLogo);
      listeners.forEach(l => l(dbLogo));
    };
    
    fetchLogo();
  }, []);

  useEffect(() => {
    const listener = (newLogo: string | null) => setLogo(newLogo);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  const updateLogo = async (newLogo: string) => {
    await api.saveLogo(newLogo);
    cachedLogo = newLogo;
    listeners.forEach(l => l(newLogo));
  };

  return { logo, updateLogo };
}
