import React from 'react';
import { DepartmentId } from '../types';
import {
  LayoutDashboard,
  FlaskConical,
  Package,
  Database,
  Menu,
  X,
  Gauge,
  Activity,
  User as UserIcon,
  Settings,
  LogOut,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  Globe
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Department, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  activeId: DepartmentId | 'dashboard' | null;
  onSelect: (id: DepartmentId | 'dashboard') => void;
  departments: Department[];
  user: User | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItemProps {
  id: DepartmentId | 'dashboard' | 'rm';
  name: string;
  icon: any;
  activeId: DepartmentId | 'dashboard' | null;
  onSelect: (id: any) => void;
  isCollapsed: boolean;
  key?: React.Key;
}

const NavItem = ({ id, name, icon: Icon, activeId, onSelect, isCollapsed }: NavItemProps) => {
  const isActive = activeId === id;

  return (
    <button
      onClick={() => onSelect(id as any)}
      className={cn(
        "group relative flex items-center w-full transition-all duration-300 rounded-xl mb-1",
        isCollapsed ? "justify-center p-2.5" : "px-4 py-2",
        isActive
          ? "bg-blue-50 text-blue-700"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      {isActive && (
        <motion.div
          layoutId="activeBar"
          className="absolute left-0 w-0.5 h-4 bg-blue-600 rounded-full"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      <Icon className={cn(
        "transition-colors shrink-0",
        isCollapsed ? "w-5 h-5" : "w-4 h-4 mr-3",
        isActive ? "text-blue-600" : "group-hover:text-slate-900"
      )} />
      {!isCollapsed && (
        <span className="text-sm font-medium tracking-tight truncate">{name}</span>
      )}
    </button>
  );
};

export default function Sidebar({
  activeId,
  onSelect,
  departments,
  user,
  onLogout,
  onOpenSettings,
  onRefresh,
  isRefreshing,
  isCollapsed,
  onToggleCollapse
}: Props) {
  const [isOpen, setIsOpen] = React.useState(false);

  const categories = [
    { name: 'Main', depts: [], items: [{ id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard }, { id: 'rm', name: 'RM', icon: Zap }] },
    { name: 'Lab', depts: departments.filter(d => d.category === 'Lab' && d.id !== 'rm'), icon: FlaskConical },
    { name: 'Stock', depts: departments.filter(d => d.category === 'Stock'), icon: Package },
    { name: 'Operations', depts: departments.filter(d => d.category === 'Process' && d.id !== 'rm'), icon: Gauge }
  ];

  const handleSelect = (id: DepartmentId | 'dashboard') => {
    onSelect(id);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-8 right-8 z-[60] w-14 h-14 bg-slate-900 text-white rounded-3xl shadow-2xl flex items-center justify-center transform transition-transform hover:scale-105 active:scale-95 border border-white/10"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[55]"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-[56] h-screen bg-white flex flex-col transition-all duration-500 border-r border-slate-100 shadow-[1px_0_0_0_rgba(0,0,0,0.01)]",
        isCollapsed ? "w-20" : "w-64",
        isOpen ? "translate-x-0" : "max-lg:-translate-x-full"
      )}>
        {/* Resize Handle */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-3.5 top-12 w-7 h-7 bg-white border border-slate-100 rounded-lg items-center justify-center shadow-lg hover:bg-slate-50 transition-all z-[60] group/toggle group"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" /> : <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />}
        </button>

        {/* Branding */}
        <div className={cn("p-6", isCollapsed && "px-4")}>
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleSelect('dashboard')}>
            <div className={cn(
              "bg-slate-900 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-all duration-300 overflow-hidden shrink-0 border border-slate-800",
              isCollapsed ? "w-10 h-10" : "w-9 h-9"
            )}>
              <img
                src="https://lh3.googleusercontent.com/d/1JIgrmv3JkmGICyFT2vsi38n3hLW6H92Y"
                alt="Logo"
                className="w-full h-full object-cover scale-110"
              />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <h1 className="text-base font-bold tracking-tight text-slate-800 leading-tight">Refrasynth</h1>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Feed */}
        <div className={cn("flex-1 overflow-y-auto px-4 py-2 space-y-8 custom-scrollbar", isCollapsed && "px-2")}>
          {categories.map((cat, idx) => (
            cat.items || (cat.depts && cat.depts.length > 0) ? (
              <div key={cat.name}>
                {!isCollapsed && (
                  <div className="px-4 mb-2">
                    <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest">{cat.name}</p>
                  </div>
                )}
                <div className="space-y-0.5">
                  {cat.items?.map(item => (
                    <NavItem key={item.id} id={item.id as any} name={item.name} icon={item.icon} activeId={activeId} onSelect={handleSelect} isCollapsed={isCollapsed} />
                  ))}
                  {cat.depts?.map(dept => (
                    <NavItem
                      key={dept.id}
                      id={dept.id}
                      name={dept.name}
                      icon={cat.icon}
                      activeId={activeId}
                      onSelect={handleSelect}
                      isCollapsed={isCollapsed}
                    />
                  ))}
                </div>
              </div>
            ) : null
          ))}
        </div>

        {/* User Module */}
        <div className={cn("p-6 border-t border-slate-50", isCollapsed && "p-3")}>
          <div className={cn("flex items-center bg-slate-50 p-3 rounded-2xl border border-slate-100", isCollapsed ? "flex-col space-y-3 px-1" : "justify-between")}>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-900 rounded-lg flex items-center justify-center text-white shrink-0">
                {user?.type === 'Admin' ? <ShieldCheck className="w-4 h-4 text-blue-400" /> : <UserIcon className="w-4 h-4" />}
              </div>
              {!isCollapsed && (
                <div className="truncate max-w-[100px]">
                  <p className="text-xs font-semibold text-slate-700 truncate">{user?.username}</p>
                  <p className="text-[9px] text-slate-400 uppercase font-medium">{user?.type}</p>
                </div>
              )}
            </div>
            <div className={cn("flex items-center gap-0.5", isCollapsed && "flex-col")}>
              {user?.type === 'Admin' && (
                <button
                  onClick={() => { onOpenSettings(); setIsOpen(false); }}
                  className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-blue-600"
                  title="Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={onLogout}
                className="p-1.5 hover:bg-rose-50 rounded-lg transition-colors text-slate-400 hover:text-rose-600"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className={cn("mt-4 flex items-center px-1", isCollapsed ? "flex-col space-y-3" : "justify-between")}>
            <div className="flex items-center space-x-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                isRefreshing ? "bg-blue-500 animate-spin" : "bg-emerald-500"
              )} />
              {!isCollapsed && <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{isRefreshing ? 'Syncing...' : 'Connected'}</span>}
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className={cn(
                  "p-1.5 hover:bg-slate-50 rounded-lg transition-all text-slate-400 hover:text-blue-600",
                  isRefreshing && "animate-spin cursor-not-allowed"
                )}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
