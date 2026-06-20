import { createContext, useContext, useState } from 'react';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  return (
    <AdminContext.Provider value={{ isAdminUnlocked, setIsAdminUnlocked }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
