import { createContext, useContext, useState, useCallback } from 'react';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [syncTick, setSyncTick] = useState(0);
  const incrementSyncTick = useCallback(() => setSyncTick(t => t + 1), []);
  return (
    <AdminContext.Provider value={{ isAdminUnlocked, setIsAdminUnlocked, syncTick, incrementSyncTick }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
