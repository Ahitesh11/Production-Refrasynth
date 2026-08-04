import React from 'react';
import { DepartmentId } from '../types';
import {
  LayoutDashboard,
  BarChart3,
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
  Globe,
  Users,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Department, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  activeId: DepartmentId | 'dashboard' | 'manage_users' | 'mis_report' | 'rm_entry' | 'lab_audit' | null;
  onSelect: (id: DepartmentId | 'dashboard' | 'manage_users' | 'mis_report' | 'rm_entry' | 'lab_audit') => void;
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
  id: DepartmentId | 'dashboard' | 'rm' | 'manage_users' | 'mis_report' | 'rm_entry' | 'lab_audit';
  name: string;
  icon: any;
  activeId: DepartmentId | 'dashboard' | 'manage_users' | 'mis_report' | 'rm_entry' | 'lab_audit' | null;
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
        "group relative flex items-center w-full transition-all duration-200 rounded-lg mb-0.5",
        isCollapsed ? "justify-center p-2.5" : "px-3 py-2",
        isActive
          ? "nav-item-active"
          : "text-slate-500 hover:bg-slate-50/80 hover:text-foreground"
      )}
    >
      {isActive && (
        <motion.div
          layoutId="activeBar"
          className="absolute left-0 w-1 h-5 bg-brand-600 rounded-full"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      <Icon className={cn(
        "transition-all duration-200 shrink-0",
        isCollapsed ? "w-[18px] h-[18px]" : "w-4 h-4 mr-2.5",
        isActive ? "text-brand-600" : "text-slate-400 group-hover:text-slate-700"
      )} />
      {!isCollapsed && (
        <span className={cn(
          "text-[13px] font-medium tracking-tight truncate transition-all",
          isActive ? "text-brand-700" : "text-slate-700"
        )}>{name}</span>
      )}
      {isActive && !isCollapsed && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-600"
        />
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
  const [expandedCategory, setExpandedCategory] = React.useState<string | null>(null);

  const categories = [
    {
      name: 'Main',
      icon: LayoutDashboard,
      items: [
        ...(user?.type === 'Admin' ? [{ id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard }] : []),
        ...(user?.type === 'Admin' ? [{ id: 'mis_report', name: 'MIS Report', icon: BarChart3 }] : []),
        ...(departments.some(d => d.id === 'rm') ? [{ id: 'rm_entry', name: 'RM Entry', icon: Zap }] : []),
        ...(departments.some(d => d.id === 'sb3_ground' || d.id === 'inventory') ? [{ id: 'inventory', name: 'Issue To SB3', icon: Database }] : []),
      ]
    },
    {
      name: 'Lab',
      items: [
        ...(user?.type === 'Admin' ? [{ id: 'lab_audit', name: 'Lab Audit', icon: ShieldCheck }] : []),
        ...(departments.some(d => d.id === 'rm') ? [{ id: 'rm', name: 'RM Workflow', icon: Activity }] : []),
      ],
      depts: departments.filter(d => d.category === 'Lab' && d.id !== 'rm' && d.id !== 'cooler'),
      icon: FlaskConical
    },
    {
      name: 'Stock',
      depts: departments.filter(d => d.category === 'Stock' && d.id !== 'inventory' && d.id !== 'sb3_ground'),
      icon: Package
    },
    {
      name: 'Operations',
      depts: departments.filter(d => d.category === 'Process' && d.id !== 'rm' && d.id !== 'cooler'),
      icon: Gauge
    },
    ...(user?.type === 'Admin' ? [{
      name: 'Admin',
      icon: ShieldCheck,
      items: [{ id: 'manage_users', name: 'Manage Users', icon: Users }]
    }] : []),
  ];

  // Auto-expand whichever category contains the active item; default to the first category.
  React.useEffect(() => {
    const activeCat = categories.find(cat =>
      cat.items?.some((i: any) => i.id === activeId) || cat.depts?.some((d: any) => d.id === activeId)
    );
    if (activeCat) {
      setExpandedCategory(activeCat.name);
    } else if (expandedCategory === null && categories.length > 0) {
      setExpandedCategory(categories[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const handleSelect = (id: DepartmentId | 'dashboard' | 'manage_users' | 'mis_report' | 'rm_entry' | 'lab_audit') => {
    onSelect(id);
    setIsOpen(false);
  };

  const toggleCategory = (name: string) => {
    setExpandedCategory(prev => (prev === name ? null : name));
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-8 right-8 z-[60] w-14 h-14 bg-brand-600 text-white rounded-2xl shadow-2xl shadow-brand-200/50 flex items-center justify-center transform transition-all hover:scale-105 active:scale-95 border border-white/20"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-brand-900/40 backdrop-blur-sm z-[55]"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-[56] h-screen bg-white flex flex-col transition-[width,transform] duration-300 ease-out border-r border-slate-200/80 shadow-2xl shadow-slate-200/20",
        isCollapsed ? "w-16" : "w-60",
        isOpen ? "translate-x-0" : "max-lg:-translate-x-full"
      )}>
        {/* Resize Handle */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-3 top-11 w-6 h-6 bg-white border border-slate-200/80 rounded-full items-center justify-center shadow-md hover:bg-brand-50 hover:border-brand-200 transition-all z-[60] group"
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 transition-colors" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 transition-colors" />
          )}
        </button>

        {/* Branding */}
        <div className={cn(
          "h-16 flex items-center border-b border-slate-200/80",
          isCollapsed ? "px-3 justify-center" : "px-5"
        )}>
          <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => handleSelect('dashboard')}>
            <div className={cn(
              "relative flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shrink-0",
              isCollapsed ? "w-9 h-9" : "w-9 h-9"
            )}>
              <div className="absolute inset-0 bg-brand-100/50 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
              <img
                src="/logo.png"
                alt="Logo"
                className="relative w-full h-full object-contain"
              />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <h1 className="text-lg font-bold tracking-tight text-brand-900 leading-tight">Refrasynth</h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase"></p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className={cn(
          "flex-1 overflow-y-auto py-3 custom-scrollbar",
          isCollapsed ? "px-2 space-y-3" : "px-3 space-y-1"
        )}>
          {categories.map((cat) => {
            const hasContent = (cat.items && cat.items.length > 0) || (cat.depts && cat.depts.length > 0);
            if (!hasContent) return null;
            const CategoryIcon = cat.icon;
            const isExpanded = isCollapsed || expandedCategory === cat.name;

            return (
              <div key={cat.name}>
                {!isCollapsed && (
                  <button
                    onClick={() => toggleCategory(cat.name)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50/80 transition-colors duration-200 group"
                  >
                    <div className="flex items-center gap-2">
                      {CategoryIcon && (
                        <CategoryIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors duration-200" />
                      )}
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors duration-200">
                        {cat.name}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 text-slate-400 transition-transform duration-200",
                        isExpanded ? "rotate-180" : ""
                      )}
                    />
                  </button>
                )}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className={cn("space-y-0.5", !isCollapsed && "pt-0.5 pb-1")}>
                        {cat.items?.map(item => (
                          <NavItem
                            key={item.id}
                            id={item.id as any}
                            name={item.name}
                            icon={item.icon}
                            activeId={activeId}
                            onSelect={handleSelect}
                            isCollapsed={isCollapsed}
                          />
                        ))}
                        {cat.depts?.map(dept => (
                          <NavItem
                            key={dept.id}
                            id={dept.id}
                            name={dept.name}
                            icon={cat.icon || Activity}
                            activeId={activeId}
                            onSelect={handleSelect}
                            isCollapsed={isCollapsed}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* User Module */}
        <div className={cn(
          "border-t border-slate-200/80 bg-white/80 backdrop-blur-sm",
          isCollapsed ? "p-2.5" : "p-3"
        )}>
          <div className={cn(
            "flex items-center rounded-xl transition-all",
            isCollapsed ? "flex-col gap-2.5" : "gap-2.5 p-2.5 bg-slate-50/80 border border-slate-200/60"
          )}>
            <div className={cn(
              "relative flex items-center justify-center shrink-0",
              isCollapsed ? "w-9 h-9" : "w-8 h-8"
            )}>
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg" />
              <div className="relative flex items-center justify-center w-full h-full rounded-lg text-white font-bold text-sm">
                {user?.type === 'Admin' ? (
                  <ShieldCheck className="w-4 h-4 text-brand-200" />
                ) : (
                  <UserIcon className="w-4 h-4" />
                )}
              </div>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{user?.username || 'User'}</p>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{user?.type || 'Role'}</p>
              </div>
            )}
            <div className={cn(
              "flex items-center gap-0.5",
              isCollapsed ? "flex-col" : ""
            )}>
              {user?.type === 'Admin' && (
                <button
                  onClick={() => { onOpenSettings(); setIsOpen(false); }}
                  className={cn(
                    "p-2 rounded-xl transition-all text-slate-400 hover:text-brand-600 hover:bg-brand-50",
                    isCollapsed ? "w-full flex justify-center" : ""
                  )}
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onLogout}
                className={cn(
                  "p-2 rounded-xl transition-all text-slate-400 hover:text-rose-600 hover:bg-rose-50",
                  isCollapsed ? "w-full flex justify-center" : ""
                )}
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status Bar */}
          <div className={cn(
            "mt-3 flex items-center",
            isCollapsed ? "justify-center" : "justify-between px-1"
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full transition-all duration-500",
                isRefreshing ? "bg-brand-500 animate-pulse" : "bg-emerald-500"
              )} />
              {!isCollapsed && (
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  {isRefreshing ? 'Syncing...' : 'Connected'}
                </span>
              )}
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className={cn(
                  "p-1.5 rounded-lg transition-all text-slate-400 hover:text-brand-600 hover:bg-brand-50",
                  isRefreshing && "animate-spin cursor-not-allowed"
                )}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Version */}
          {!isCollapsed && (
            <div className="mt-2 text-center">
              <p className="text-[9px] text-slate-300 font-medium tracking-wider">v2.0.1</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}