import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  BarChart3,
  PackagePlus,
  Boxes,
  Truck,
  Users,
  LogOut,
  Bell,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Search,
  ChevronRight,
} from 'lucide-react';
import { usePos } from '../context/PosContext';

export default function MainLayout({ children }) {
  const { loggedInUser, logout, alertCount, isSyncing, syncBackendData } = usePos();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [liveClock, setLiveClock] = useState('');
  const [globalQuery, setGlobalQuery] = useState('');

  const location = useLocation();
  const navigate = useNavigate();
  const role = loggedInUser?.role || 'STAFF';

  // Live Clock
  useEffect(() => {
    const update = () => {
      setLiveClock(
        new Date().toLocaleString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const displayName = loggedInUser?.fullName || loggedInUser?.full_name || loggedInUser?.username || 'User';
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const operationsNav = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER'] },
    { to: '/pos', label: 'Point of Sale', icon: ShoppingCart, roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
    { to: '/master-items', label: 'Master Item', icon: PackagePlus, roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
    { to: '/inventory', label: 'Inventory', icon: Boxes, roles: ['ADMIN', 'MANAGER'] },
  ].filter((item) => item.roles.includes(role));

  const adminNav = [
    { to: '/sales-log', label: 'Sales Log', icon: Receipt, roles: ['ADMIN', 'MANAGER'] },
    { to: '/reports', label: 'Financial Reports', icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
    { to: '/suppliers', label: 'Suppliers', icon: Truck, roles: ['ADMIN', 'MANAGER'] },
    { to: '/users', label: 'System Users', icon: Users, roles: ['ADMIN'] },
  ].filter((item) => item.roles.includes(role));

  const pageMeta = {
    '/dashboard': { title: 'Executive Overview Dashboard', crumb: 'Executive Overview' },
    '/pos': { title: 'Point of Sale / Checkout Module', crumb: 'Point of Sale (POS)' },
    '/master-items': { title: 'Master Item Management', crumb: 'Master Item Catalog' },
    '/inventory': { title: 'Central Inventory & Barcodes', crumb: 'Central Inventory' },
    '/sales-log': { title: 'Daily Sales & Receipts Log', crumb: 'Daily Sales Log' },
    '/reports': { title: 'Financial & Performance Reports', crumb: 'Financial Reports' },
    '/suppliers': { title: 'Supplier Management', crumb: 'Suppliers' },
    '/users': { title: 'User Management & Accounts', crumb: 'System Users' },
  };

  const currentMeta = pageMeta[location.pathname] || { title: 'Daiho POS Workspace', crumb: 'Workspace' };

  function handleGlobalSearch(e) {
    if (e.key !== 'Enter' || !globalQuery.trim()) return;
    const target = role === 'CASHIER' ? '/pos' : '/inventory';
    navigate(`${target}?q=${encodeURIComponent(globalQuery.trim())}`);
    setGlobalQuery('');
  }

  const navLinkClass = ({ isActive }) =>
    `relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
      isCollapsed ? 'justify-center' : ''
    } ${
      isActive
        ? 'bg-[#FF6600]/15 text-white font-semibold before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-[#FF6600] before:rounded-r'
        : 'text-zinc-300 hover:bg-[#292929] hover:text-white'
    }`;

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F4F4F5]">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
        />
      )}

      {/* MATTE BLACK SIDEBAR */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 bg-[#1A1A1A] text-white border-r border-[#292929] flex flex-col justify-between transition-all duration-200 shrink-0 ${
          isCollapsed ? 'w-[76px]' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="px-4 py-4 border-b border-[#292929] flex items-center justify-between min-h-[70px]">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-[#FF6600] text-white font-extrabold text-lg flex items-center justify-center shrink-0">
                D
              </div>
              {!isCollapsed && (
                <div className="truncate">
                  <div className="text-sm font-extrabold tracking-wider leading-tight">DAIHO</div>
                  <div className="text-[10px] font-semibold text-zinc-400 tracking-wider">AUTO PARTS SUPPLY</div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex w-7 h-7 rounded-lg border border-[#292929] text-zinc-400 hover:text-white hover:bg-[#292929] items-center justify-center cursor-pointer"
              title="Toggle Sidebar"
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {/* User Profile Card */}
          <div
            className={`mx-3 mt-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-2.5 ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-[#1F1F1F] border-[1.5px] border-[#FF6600] text-[#FF6600] text-xs font-extrabold flex items-center justify-center shrink-0">
              {initials}
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{displayName}</div>
                <div className="text-[10px] font-extrabold text-[#FF6600] tracking-wider uppercase mt-0.5">
                  {role}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Groups */}
          <nav className="p-3 space-y-4 flex-1">
            <div>
              {!isCollapsed && (
                <div className="text-[10px] font-bold tracking-widest text-zinc-500 px-3 pb-1.5 uppercase">
                  OPERATIONS
                </div>
              )}
              <div className="space-y-1">
                {operationsNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={navLinkClass}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-[#FF6600]' : ''}`} />
                          {!isCollapsed && <span className="truncate">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>

            {adminNav.length > 0 && (
              <div>
                {!isCollapsed && (
                  <div className="text-[10px] font-bold tracking-widest text-zinc-500 px-3 pb-1.5 uppercase">
                    RECORDS & ADMIN
                  </div>
                )}
                <div className="space-y-1">
                  {adminNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={navLinkClass}
                      >
                        {({ isActive }) => (
                          <>
                            <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-[#FF6600]' : ''}`} />
                            {!isCollapsed && <span className="truncate">{item.label}</span>}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>
        </div>

        {/* Logout Footer */}
        <div className="p-3 border-t border-[#292929]">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Sigurado ka bang gusto mong mag-logout?')) logout();
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#292929] hover:bg-red-950 border border-zinc-700 hover:border-red-800 text-white text-xs font-semibold transition cursor-pointer ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="w-4 h-4 text-[#FF6600] shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Topbar */}
                {/* Responsive Topbar (Mobile, Tablet & Desktop) */}
        <header className="sticky top-0 z-30 bg-white border-b border-zinc-300 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 min-h-[62px] sm:min-h-[70px]">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg bg-zinc-100 border border-zinc-300 flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-zinc-800" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-zinc-500 truncate">
                <span>DAIHO POS</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
                <span className="text-[#FF6600] truncate">{currentMeta.crumb}</span>
              </div>
              <h1 className="text-sm sm:text-lg font-extrabold text-zinc-900 truncate">
                {currentMeta.title}
              </h1>
            </div>
          </div>

          {/* Desktop/Tablet Quick Search Input */}
          <div className="hidden md:block relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              onKeyDown={handleGlobalSearch}
              placeholder="Quick search OEM / Part + Enter..."
              className="w-full h-9 pl-9 pr-3 bg-zinc-100 border border-zinc-300 rounded-lg text-xs focus:outline-none focus:bg-white focus:border-[#FF6600]"
            />
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div className="hidden xl:block text-xs font-semibold text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-300">
              {liveClock}
            </div>

            <button
              onClick={() => syncBackendData()}
              disabled={isSyncing}
              title="Sync Database"
              className="w-9 h-9 rounded-lg bg-white border border-zinc-300 hover:border-[#FF6600] text-zinc-700 hover:text-[#FF6600] flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#FF6600]' : ''}`} />
            </button>

            <button
              onClick={() => navigate('/pos')}
              title="Stock Alerts"
              className="relative w-9 h-9 rounded-lg bg-white border border-zinc-300 hover:border-[#FF6600] text-zinc-700 hover:text-[#FF6600] flex items-center justify-center cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {alertCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#FF6600] text-white text-[10px] font-extrabold px-1.5 rounded-full">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </button>
          </div>
        </header>


        {/* Main Workspace Container */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}