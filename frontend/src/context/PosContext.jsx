import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { apiRequest } from '../services/api';

const PosContext = createContext();

export function PosProvider({ children }) {
  const [loggedInUser, setLoggedInUser] = useState(() => {
    const saved = localStorage.getItem('pos_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [masterItems, setMasterItems] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [salesTransactions, setSalesTransactions] = useState([]);
  const [registeredSuppliers, setRegisteredSuppliers] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);

  // Request Counter para sa Global Loading Spinner (Kapalit ng activeRequestsCount sa api.js)
  const [activeRequests, setActiveRequests] = useState(0);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Selective Fast Sync (Katumbas ng loadProductionDataFromBackend(options) sa Vanilla JS mo)
  const syncBackendData = useCallback(
    async (options = {}, userOverride = null) => {
      const activeUser = userOverride || loggedInUser;
      if (!activeUser) return;

      const role = activeUser.role || '';
      const {
        skipMasters = false,
        skipUsers = role !== 'ADMIN',
        skipSuppliers = role === 'CASHIER',
      } = options;

      setActiveRequests((c) => c + 1);
      try {
        const [mastersRes, variantsRes, salesRes, usersRes, suppliersRes] = await Promise.all([
          skipMasters ? Promise.resolve(null) : apiRequest('/masters', 'GET').catch(() => []),
          apiRequest('/variants', 'GET').catch(() => []),
          apiRequest('/sales', 'GET').catch(() => []),
          skipUsers ? Promise.resolve(null) : apiRequest('/users', 'GET').catch(() => []),
          skipSuppliers ? Promise.resolve(null) : apiRequest('/suppliers', 'GET').catch(() => []),
        ]);

        if (mastersRes !== null) {
          setMasterItems(Array.isArray(mastersRes) ? mastersRes : mastersRes.masters || []);
        }
        if (variantsRes) {
          setInventoryBatches(Array.isArray(variantsRes) ? variantsRes : variantsRes.variants || []);
        }
        if (salesRes) {
          setSalesTransactions(Array.isArray(salesRes) ? salesRes : salesRes.sales || []);
        }
        if (usersRes !== null) {
          setSystemUsers(Array.isArray(usersRes) ? usersRes : usersRes.users || []);
        }
        if (suppliersRes !== null) {
          setRegisteredSuppliers(Array.isArray(suppliersRes) ? suppliersRes : suppliersRes.suppliers || []);
        }
      } catch (err) {
        console.error('Sync error:', err);
        showToast('Nabigong makuha ang data mula sa server.', 'error');
      } finally {
        setActiveRequests((c) => Math.max(0, c - 1));
      }
    },
    [loggedInUser, showToast]
  );

  useEffect(() => {
    if (loggedInUser) {
      syncBackendData({}, loggedInUser);
    }
  }, [loggedInUser, syncBackendData]);

  async function login(username, password, rememberUsername) {
    setActiveRequests((c) => c + 1);
    try {
      const authRes = await apiRequest('/auth/login', 'POST', { username, password });
      const user = authRes?.user || authRes?.data;
      if (!user) throw new Error('Hindi wasto ang tugon mula sa server.');

      if (rememberUsername) {
        localStorage.setItem('pos_remembered_username', username);
      } else {
        localStorage.removeItem('pos_remembered_username');
      }

      localStorage.setItem('pos_user', JSON.stringify(user));
      if (authRes.token) localStorage.setItem('pos_token', authRes.token);

      setLoggedInUser(user);
      showToast(`Maligayang pagdating, ${user.fullName || user.username}!`, 'success');
      return user;
    } finally {
      setActiveRequests((c) => Math.max(0, c - 1));
    }
  }

  function logout() {
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_token');
    setLoggedInUser(null);
    setMasterItems([]);
    setInventoryBatches([]);
    setSalesTransactions([]);
    showToast('Matagumpay kang nag-logout.', 'info');
  }

  const alertCount = inventoryBatches.filter((b) => {
    const stock = Number(b.stock || 0);
    const limit = Number(b.lowStockLimit || b.low_stock_limit || 0);
    return stock === 0 || stock <= limit;
  }).length;

  return (
    <PosContext.Provider
      value={{
        loggedInUser,
        masterItems,
        setMasterItems,
        inventoryBatches,
        setInventoryBatches,
        salesTransactions,
        registeredSuppliers,
        systemUsers,
        isSyncing: activeRequests > 0,
        alertCount,
        login,
        logout,
        syncBackendData,
        showToast,
      }}
    >
      {children}

      {/* Global Loading Spinner Overlay (Matching your style.css .loading-overlay) */}
      {activeRequests > 0 && (
        <div className="fixed inset-0 bg-[#1A1A1A]/55 backdrop-blur-[1px] flex items-center justify-center z-[9999]">
          <div className="bg-white px-7 py-5 rounded-2xl text-center shadow-2xl border border-zinc-200">
            <div className="w-8 h-8 border-3 border-zinc-200 border-t-[#FF6600] rounded-full animate-spin mx-auto mb-2.5" />
            <div className="text-xs font-bold text-zinc-900">Synchronizing POS Data...</div>
          </div>
        </div>
      )}

      {/* Global Toast Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast pointer-events-auto bg-[#1A1A1A] text-white px-4 py-3.5 rounded-xl shadow-2xl border-l-4 flex items-center gap-3 ${
              t.type === 'error'
                ? 'border-red-600'
                : t.type === 'warning' || t.type === 'info'
                ? 'border-[#FF6600]'
                : 'border-green-600'
            }`}
          >
            {t.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            ) : t.type === 'warning' || t.type === 'info' ? (
              <Info className="w-5 h-5 text-[#FF6600] shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
            )}
            <span className="text-xs font-semibold flex-1">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </PosContext.Provider>
  );
}

export function usePos() {
  return useContext(PosContext);
}
