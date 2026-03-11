import React, { useMemo, useState } from 'react';
import { Entry, DEPARTMENTS, Department } from '../types';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
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
  Zap,
  AlertCircle
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
  parameterRanges?: Record<string, string>;
}

const parseRange = (rangeStr: string): { min: number, max: number } | null => {
  if (!rangeStr) return null;
  const getRepeatedValue = (s: string): number | null => {
    if (!s) return null;
    const val = parseFloat(s);
    return isNaN(val) ? null : val;
  };
  const clean = rangeStr.replace(/\s/g, '');
  if (clean.toLowerCase().includes('to')) {
    const parts = clean.toLowerCase().split('to');
    const min = getRepeatedValue(parts[0]);
    const max = getRepeatedValue(parts[1]);
    if (min !== null && max !== null) return { min, max };
  }
  const numbers = rangeStr.match(/-?\d+(\.\d+)?/g);
  if (numbers && numbers.length >= 2) {
    return { min: parseFloat(numbers[0]), max: parseFloat(numbers[1]) };
  }
  return null;
};

export default function Dashboard({ entries, compositionData, onSelect, masterData, parameterRanges = {} }: Props) {
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

  // Dynamic Chart Data with Multi-Period Support
  const chartData = useMemo(() => {
    const now = new Date();
    
    // 1. Prepare Valid Entries with parsed dates
    const validEntries = entries.map(e => {
      try {
        const d = new Date(e.timestamp);
        return isNaN(d.getTime()) ? null : { ...e, d };
      } catch { return null; }
    }).filter(Boolean) as (Entry & { d: Date })[];

    if (dateFilter === 'today') {
      // Group by 2-hour slots for today
      return Array.from({ length: 12 }, (_, i) => {
        const slotHour = i * 2;
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slotHour, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slotHour + 1, 59, 59);
        
        const slotEntries = validEntries.filter(e => e.d >= start && e.d <= end);
        const count = slotEntries.filter(e => e.departmentId === 'product_house').length;
        
        return {
          name: format(start, 'HH:mm'),
          production: count,
          fullDate: format(start, 'MMM dd, HH:mm')
        };
      });
    }

    if (dateFilter === '7d' || dateFilter === '30d') {
      const days = dateFilter === '7d' ? 7 : 30;
      return Array.from({ length: days }, (_, i) => {
        const targetDate = subDays(now, i);
        const dateStr = format(targetDate, 'yyyy-MM-dd');
        
        const dayEntries = validEntries.filter(e => format(e.d, 'yyyy-MM-dd') === dateStr);
        const count = dayEntries.filter(e => e.departmentId === 'product_house').length;
        
        return {
          name: format(targetDate, 'MMM dd'),
          production: count,
          fullDate: dateStr
        };
      }).reverse();
    }

    // 'all' - Group by Month
    if (dateFilter === 'all') {
      if (validEntries.length === 0) return [];
      
      const earliest = validEntries.reduce((p, c) => (c.d < p.d ? c : p), validEntries[0]).d;
      const months: any[] = [];
      let curr = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
      
      while (curr <= now) {
        const monthStr = format(curr, 'yyyy-MM');
        const monthEntries = validEntries.filter(e => format(e.d, 'yyyy-MM') === monthStr);
        const count = monthEntries.filter(e => e.departmentId === 'product_house').length;
        
        months.push({
          name: format(curr, 'MMM yy'),
          production: count,
          fullDate: format(curr, 'MMMM yyyy')
        });
        curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
      }
      return months;
    }

    return [];
  }, [entries, dateFilter]);

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

  const qualityDistribution = useMemo(() => {
    let inRange = 0;
    let outRange = 0;

    entries.forEach(entry => {
      let isRed = false;
      Object.entries(entry.data).forEach(([key, value]) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        
        // Standard quality thresholds
        if (entry.departmentId === 'product_house') {
          if (key === 'Al2O3' && (numValue < 87.5 || numValue > 89)) isRed = true;
          else if (key === 'Fe2O3' && (numValue > 2)) isRed = true;
        } else if (['dgu', 'balling_disc', 'kiln'].includes(entry.departmentId)) {
          if (key === 'Al2O3' && (numValue < 82.5 || numValue > 83.5)) isRed = true;
        }
      });
      if (isRed) outRange++;
      else inRange++;
    });

    return [
      { name: 'Compliant', value: inRange, color: '#2563eb' },
      { name: 'Anomalies', value: outRange, color: '#f43f5e' }
    ];
  }, [entries]);

  const departmentActivity = useMemo(() => {
    return DEPARTMENTS.map(d => ({
      name: d.name,
      count: stats.byDept[d.id] || 0
    })).sort((a,b) => b.count - a.count).slice(0, 5);
  }, [stats]);

  const misReportData = useMemo(() => {
    // Standard target: 3 entries per day (1 per shift: A, B, C)
    const getDaysInRange = () => {
       if (dateFilter === 'today') return 1;
       if (dateFilter === '7d') return 7;
       if (dateFilter === '30d') return 30;
       return 90; // Default for 'all' to show a sensible average
    };
    
    const days = getDaysInRange();
    
    return DEPARTMENTS.map(dept => {
      const actual = stats.byDept[dept.id] || 0;
      const target = days * 3; // 3 shifts per day
      const efficiency = target > 0 ? (actual / target) * 100 : 0;
      
      return {
        id: dept.id,
        name: dept.name,
        category: dept.category,
        target,
        actual,
        gap: Math.max(0, target - actual),
        efficiency: Math.min(100, efficiency).toFixed(1),
        status: efficiency >= 90 ? 'High' : efficiency >= 50 ? 'Moderate' : 'Critical'
      };
    });
  }, [stats, dateFilter]);

  const handleExportExcel = () => {
    const dataToExport = misReportData.map(item => ({
      'Department': item.name,
      'Category': item.category,
      'Total Target': item.target,
      'Actual (Shift)': item.actual,
      'Gap (Pending)': item.gap,
      'Efficiency (%)': item.efficiency,
      'Status': item.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "MIS_Report");
    
    // Auto-size columns
    const max_width = dataToExport.reduce((w, r) => Math.max(w, Object.keys(r).length), 10);
    worksheet["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(data, `MIS_Operational_Report_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
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
          {(['today', '7d', '30d', 'all'] as const).map((f) => (
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
              {f === 'today' ? 'Today' : f === '7d' ? 'Week' : f === '30d' ? 'Month' : 'All Data'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Entries', value: stats.total, color: 'blue', icon: Layers },
          { label: 'Avg Purity', value: qualityStats.avgAl2O3 + '%', color: 'blue', icon: Zap },
          { label: 'Campaigns', value: masterData.campaigns.length, color: 'slate', icon: Activity },
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
          className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Operational Throughput</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-lg text-blue-700 font-bold text-[10px] uppercase tracking-wider">
                <TrendingUp className="w-3 h-3" />
                Peak: {Math.max(...chartData.map(d => d.production))} Units
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                Live Hub
              </div>
            </div>
          </div>

          <div className="h-[300px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f8fafc" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                  dy={15}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                />
                <Tooltip
                  cursor={{ stroke: '#2563eb', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 700, color: '#2563eb' }}
                  labelStyle={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="production" 
                  stroke="#2563eb" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorProd)" 
                  name="Daily Throughput"
                  dot={{ r: 4, fill: '#fff', stroke: '#2563eb', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Operational Efficiency Tracker (Replaced Live Audit) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Operational Efficiency</h3>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
               <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest font-mono">Real-time Avg</span>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col justify-center items-center py-4">
             <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96" cy="96" r="80"
                    stroke="#f1f5f9" strokeWidth="12" fill="transparent"
                  />
                  <motion.circle
                    initial={{ strokeDasharray: "0, 502" }}
                    animate={{ strokeDasharray: `${(misReportData.reduce((a,c) => a + parseFloat(c.efficiency), 0) / DEPARTMENTS.length) * 5.02}, 502` }}
                    cx="96" cy="96" r="80"
                    stroke="#2563eb" strokeWidth="12" fill="transparent"
                    strokeLinecap="round"
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <span className="text-4xl font-black text-slate-900">{(misReportData.reduce((a,c) => a + parseFloat(c.efficiency), 0) / DEPARTMENTS.length).toFixed(0)}%</span>
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Efficiency</span>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4 w-full mt-8">
                <div className="bg-slate-50 p-3 rounded-xl">
                   <p className="text-[9px] font-bold text-slate-400 uppercase">Target Reached</p>
                   <p className="text-lg font-bold text-slate-900">{misReportData.filter(d => parseFloat(d.efficiency) >= 90).length} Depts</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                   <p className="text-[9px] font-bold text-slate-400 uppercase">At Risk</p>
                   <p className="text-lg font-bold text-red-600">{misReportData.filter(d => parseFloat(d.efficiency) < 50).length} Depts</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-1.5 h-6 bg-slate-900 rounded-full" />
             <h2 className="text-lg font-bold text-slate-900 tracking-tight">MIS Operational Report (Tab-wise)</h2>
          </div>
          <button 
            onClick={handleExportExcel}
            className="px-4 py-2 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-blue-100 transition-all flex items-center gap-2 border border-blue-100"
          >
            <Download className="w-3.5 h-3.5" />
            Download Report
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Department</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Target</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actual (Shift)</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gap</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Efficiency</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {misReportData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900">{item.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{item.category}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-600">{item.target}</td>
                  <td className="px-6 py-4 text-xs font-bold text-blue-600">{item.actual}</td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">{item.gap} <span className="text-[9px] font-medium ml-1">Pending</span></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 w-24">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", parseFloat(item.efficiency) > 80 ? "bg-emerald-500" : "bg-blue-500")}
                          style={{ width: `${item.efficiency}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-900">{item.efficiency}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider",
                      item.status === 'High' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                      item.status === 'Moderate' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                      "bg-red-50 text-red-600 border border-red-100"
                    )}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quality & Process Insight Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Distribution Card */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
             <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Quality Compliance</h3>
             <div className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase">Real-time Data</div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-8 h-[240px]">
            <div className="w-full h-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qualityDistribution} layout="vertical" margin={{ left: -20, right: 30 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600 }} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={32}>
                    {qualityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="space-y-4 w-full md:w-48 shrink-0">
               {qualityDistribution.map((item) => (
                 <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-semibold text-slate-500">{item.name}</span>
                   </div>
                   <span className="text-sm font-bold text-slate-900">{item.value}</span>
                 </div>
               ))}
               <p className="text-[10px] text-slate-400 font-medium italic">Based on {entries.length} recent audits</p>
            </div>
          </div>
        </section>

        {/* Operational Metrics Leaderboard */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
             <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Department Activity</h3>
             <Activity className="w-4 h-4 text-blue-600" />
          </div>

          <div className="space-y-4">
            {departmentActivity.map((dept, i) => (
              <div key={dept.name} className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-600">{dept.name}</span>
                  <span className="text-blue-600">{dept.count} Entries</span>
                </div>
                <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((dept.count / (stats.total || 1)) * 100 * 2, 100)}%` }}
                    className="h-full bg-blue-600 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="pt-2 flex items-center justify-between">
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Top Performing Areas</p>
             <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-bold rounded-full">
                <TrendingUp className="w-3 h-3" />
                Live
             </div>
          </div>
        </section>
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
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <FileSpreadsheet className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Composition Archives</h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex relative mr-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search archives..."
                className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500/20 outline-none w-48"
              />
            </div>
            <button className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all">
              <Download className="w-4 h-4" />
            </button>
            <button className="px-4 py-2 bg-slate-900 text-white text-[10px] font-semibold uppercase tracking-wider rounded-lg hover:bg-slate-700 transition-all flex items-center gap-2 shadow-sm">
              <RefreshCw className="w-3 h-3" />
              Sync Data
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