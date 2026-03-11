import React, { useMemo, useState } from 'react';
import { Entry, DEPARTMENTS, Department } from '../types';
import {
  Activity,
  TrendingUp,
  Layers,
  FileSpreadsheet,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter,
  RefreshCw,
  Plus,
  Clock,
  LayoutDashboard,
  PieChart as PieChartIcon,
  BarChart3,
  Search,
  Zap
} from 'lucide-react';
import { format, subDays, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  entries: Entry[];
  compositionData: any[];
  onSelect: (dept: Department) => void;
  masterData: { campaigns: string[] };
}

export default function Dashboard({ entries, compositionData, onSelect, masterData }: Props) {
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [activeReportTab, setActiveReportTab] = useState<'production' | 'quality' | 'activity'>('production');

  const stats = useMemo(() => {
    const now = new Date();
    const filteredByDate = entries.filter(e => {
      try {
        const entryDate = new Date(e.timestamp);
        if (dateFilter === 'today') return isWithinInterval(entryDate, { start: startOfDay(now), end: endOfDay(now) });
        if (dateFilter === '7d') return isWithinInterval(entryDate, { start: startOfDay(subDays(now, 7)), end: endOfDay(now) });
        if (dateFilter === '30d') return isWithinInterval(entryDate, { start: startOfDay(subDays(now, 30)), end: endOfDay(now) });
      } catch (e) { return false; }
      return true;
    });

    const total = filteredByDate.length;
    const byDept = DEPARTMENTS.reduce((acc, dept) => {
      acc[dept.id] = filteredByDate.filter(e => e.departmentId === dept.id).length;
      return acc;
    }, {} as Record<string, number>);

    return { total, byDept };
  }, [entries, dateFilter]);

  // Chart Data Calculations with robust date handling
  const chartData = useMemo(() => {
    const last7DaysStrings = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), i);
      return format(d, 'yyyy-MM-dd');
    }).reverse();

    // Pre-calculate valid entries with dates for performance and safety
    const validEntriesWithDates = entries.map(e => {
      if (!e.timestamp) return null;
      try {
        const d = new Date(e.timestamp);
        if (isNaN(d.getTime())) return null;
        return { ...e, dateObj: d, isoDate: format(d, 'yyyy-MM-dd') };
      } catch (err) {
        return null; // Silently skip malformed entries
      }
    }).filter(Boolean) as (Entry & { dateObj: Date, isoDate: string })[];

    return last7DaysStrings.map(dateStr => {
      const dayEntries = validEntriesWithDates.filter(e => e.isoDate === dateStr);
      const prodEntries = dayEntries.filter(e => e.departmentId === 'product_house').length;
      const labEntries = dayEntries.filter(e => ['dgu', 'balling_disc', 'kiln'].includes(e.departmentId)).length;

      // Calculate avg Al2O3 for this day if available
      const al2o3Values = dayEntries
        .map(e => {
          const val = parseFloat(e.data.al2o3 || e.data.Al2O3);
          return isNaN(val) ? null : val;
        })
        .filter((v): v is number => v !== null);

      const avgAl2O3 = al2o3Values.length ? al2o3Values.reduce((a, b) => a + b, 0) / al2o3Values.length : 0;

      return {
        name: format(parseISO(dateStr), 'MMM dd'),
        production: prodEntries * 15, // Scale for visual
        lab: labEntries,
        quality: parseFloat(avgAl2O3.toFixed(2)),
        fullDate: dateStr
      };
    });
  }, [entries]);

  const qualityStats = useMemo(() => {
    const al2o3 = entries.map(e => parseFloat(e.data.al2o3 || e.data.Al2O3)).filter(v => !isNaN(v));
    const fe2o3 = entries.map(e => parseFloat(e.data.fe2o3 || e.data.Fe2O3)).filter(v => !isNaN(v));

    return {
      avgAl2O3: al2o3.length ? (al2o3.reduce((a, b) => a + b, 0) / al2o3.length).toFixed(2) : '0',
      avgFe2O3: fe2o3.length ? (fe2o3.reduce((a, b) => a + b, 0) / fe2o3.length).toFixed(2) : '0',
      totalSamples: al2o3.length
    };
  }, [entries]);

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const hasTime = dateStr.includes(':') || (date.getHours() !== 0 || date.getMinutes() !== 0);
        return format(date, hasTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy');
      }
      return dateStr;
    } catch (e) { return dateStr; }
  };

  const compositionHeaders = [
    "Timestamp", "Campaign No.", "Product Name", "Qty", "LOI (%)",
    "RM Required (MT)", "Al₂O₃", "Fe₂O₃", "SiO₂", "Total Cost"
  ];

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-6 pb-24 bg-white">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {(['7d', '30d', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f as any)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                dateFilter === f
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              {f === '7d' ? '7 Days' : f === '30d' ? '30 Days' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Entries', value: stats.total, color: 'blue', icon: Layers },
          { label: 'Avg Purity', value: qualityStats.avgAl2O3 + '%', color: 'emerald', icon: Zap },
          { label: 'Campaigns', value: masterData.campaigns.length, color: 'orange', icon: Activity },
          { label: 'Avg Fe₂O₃', value: qualityStats.avgFe2O3 + '%', color: 'blue', icon: Database }
        ].map((kpi, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={kpi.label}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center",
                `bg-${kpi.color}-50 text-${kpi.color}-600`
              )}>
                <kpi.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{kpi.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Analytics Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Primary Chart Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Production Trend</h3>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="production" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorProd)" name="Production" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6">Recent Activity</h3>
          <div className="space-y-5 flex-1">
            {entries.slice(0, 5).map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-700">
                    {DEPARTMENTS.find(d => d.id === entry.departmentId)?.name || 'System'}
                  </p>
                  <p className="text-[10px] text-slate-400">{formatDisplayDate(entry.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Department Module Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-blue-600 rounded-full" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Departments</h2>
          </div>
          <button className="px-4 py-2 bg-slate-900 text-white text-[10px] font-semibold uppercase tracking-wider rounded-xl hover:bg-slate-700 transition-all flex items-center gap-2 shadow-sm">
            <Plus className="w-3 h-3" />
            New Entry
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {DEPARTMENTS.slice(0, 8).map((dept, i) => (
            <motion.button
              whileHover={{ y: -4, scale: 1.01 }}
              key={dept.id}
              onClick={() => onSelect(dept)}
              className="group bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all duration-300 relative flex flex-col items-start text-left"
            >
              <div className="w-full flex justify-between items-start mb-8">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:bg-slate-900">
                  <PieChartIcon className="w-4 h-4 text-slate-400 group-hover:text-white" />
                </div>
                <div className="bg-slate-50 px-3 py-1 rounded-full group-hover:bg-blue-50 transition-colors">
                  <p className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-600 tracking-tight uppercase">{dept.category}</p>
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{dept.name}</h4>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-[10px] font-semibold text-slate-400 tracking-tight">
                    <span className="text-slate-900 font-bold">{stats.byDept[dept.id] || 0}</span> Entries Today
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Large Data Intelligence Table */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
              <FileSpreadsheet className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Composition Records</h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex relative mr-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter records..."
                className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500/20 outline-none w-48"
              />
            </div>
            <button className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all">
              <Download className="w-4 h-4" />
            </button>
            <button className="px-4 py-2 bg-slate-900 text-white text-[10px] font-semibold uppercase tracking-wider rounded-lg hover:bg-slate-700 transition-all flex items-center gap-2 shadow-sm">
              <RefreshCw className="w-3 h-3" />
              Sync
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50">
                {compositionHeaders.map((header, idx) => (
                  <th key={idx} className={cn(
                    "px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap sticky top-0 bg-slate-50 z-20 border-b border-slate-100",
                    idx === 0 ? "left-0 z-30" : ""
                  )}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {compositionData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-20 text-center text-slate-400 text-xs italic">No data found</td>
                </tr>
              ) : (
                compositionData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white group-hover:bg-slate-50 font-semibold text-slate-900 z-10 transition-colors">
                      {formatDisplayDate(row.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-orange-600">{row.campaign_no || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-slate-700">{row.product_name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold">{row.qty || '0'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">{row.loi_pct || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-slate-900">{row.rm_req || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-blue-600">{row.al2o3 || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">{row.fe2o3 || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">{row.sio2 || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-semibold">${row.total_cost || row.totalCost || '0.00'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-3">
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> Active Sync</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Data Verified</span>
          </p>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`w-2 h-2 rounded-full ${i === 1 ? 'bg-blue-600' : 'bg-slate-200'} transition-all hover:scale-150 cursor-pointer`} />
            ))}
          </div>
        </div>
      </motion.section>
    </div>
  );
}