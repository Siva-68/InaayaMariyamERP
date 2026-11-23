import { useState } from 'react';
import type { ReactNode } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Receipt,
  ClipboardList,
  Package,
  LayoutDashboard,
  Menu,
  X,
  Leaf,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/bill/new',  label: 'New Bill',       icon: <Receipt size={20} /> },
  { to: '/invoices',  label: 'Past Invoices',  icon: <ClipboardList size={20} /> },
  { to: '/products',  label: 'Products',       icon: <Package size={20} /> },
  { to: '/dashboard', label: 'Dashboard',      icon: <LayoutDashboard size={20} /> },
];

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const closeDrawer = () => setDrawerOpen(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-dvh bg-background">
      {/* ── Desktop collapsible sidebar ─────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-primary-light shrink-0">
        <Brand />
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        {/* User profile & Logout area (Admin / Secondary navigation) */}
        {user && (
          <div className="p-3 border-t border-primary-light space-y-2">
            <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-primary-light/50">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs uppercase">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-800 truncate">{user.name}</div>
                <div className="text-xs text-primary font-medium capitalize">{user.role.replace('_', ' ')}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-touch"
            >
              <LogOut size={16} />
              <span>Log Out</span>
            </button>
          </div>
        )}

        <div className="p-3 border-t border-primary-light text-xs text-gray-400 text-center">
          HINAYA MARIYAM ERP v0.1
        </div>
      </aside>

      {/* ── Mobile overlay drawer ───────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary-light">
          <BrandInline />
          <button
            onClick={closeDrawer}
            className="p-2 rounded-lg text-gray-600 hover:bg-primary-light min-h-touch min-w-touch flex items-center justify-center"
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <DrawerLink key={item.to} item={item} onClick={closeDrawer} />
          ))}
        </nav>

        {user && (
          <div className="p-4 border-t border-primary-light space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm uppercase">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-800 truncate">{user.name}</div>
                <div className="text-xs text-primary font-medium capitalize">{user.role.replace('_', ' ')}</div>
              </div>
            </div>
            <button
              onClick={() => {
                closeDrawer();
                handleLogout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-base text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-touch"
            >
              <LogOut size={18} />
              <span>Log Out</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Main content ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-primary-light sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-lg text-primary hover:bg-primary-light min-h-touch min-w-touch flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>
            <BrandInline />
          </div>
          {user && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-primary-light/50 px-2.5 py-1.5 rounded-full">
              <UserIcon size={14} className="text-primary" />
              <span className="font-medium max-w-[80px] truncate">{user.name}</span>
            </div>
          )}
        </header>

        {/* Page title bar (derived from current route) */}
        <div className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-primary-light bg-white">
          <h1 className="text-lg font-semibold text-gray-800">
            {NAV_ITEMS.find((n) => location.pathname.startsWith(n.to))?.label ?? 'INAAYA ENTERPRISES ERP'}
          </h1>
          <div className="text-xs text-gray-400">
            Single-branch Retail ERP
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function Brand() {
  return (
    <div className="px-5 py-4 border-b border-primary-light">
      <div className="flex items-center gap-2">
        <Leaf className="text-primary" size={28} />
        <div>
          <div className="font-bold text-primary text-base leading-tight">INAAYA ENTERPRISES</div>
          <div className="text-xs text-gray-500 leading-tight">Retail ERP &amp; Billing</div>
        </div>
      </div>
    </div>
  );
}

function BrandInline() {
  return (
    <div className="flex items-center gap-2">
      <Leaf className="text-primary" size={22} />
      <span className="font-bold text-primary text-sm">INAAYA ENTERPRISES</span>
    </div>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-touch ${
          isActive
            ? 'bg-primary text-white shadow-sm'
            : 'text-gray-700 hover:bg-primary-light hover:text-primary'
        }`
      }
    >
      {item.icon}
      {item.label}
    </NavLink>
  );
}

function DrawerLink({ item, onClick }: { item: NavItem; onClick: () => void }) {
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-touch ${
          isActive
            ? 'bg-primary text-white shadow-sm'
            : 'text-gray-700 hover:bg-primary-light hover:text-primary'
        }`
      }
    >
      {item.icon}
      {item.label}
    </NavLink>
  );
}
