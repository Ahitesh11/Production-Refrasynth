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
  AlertCircle,
  Flame,
  ChevronRight,
  Box,
  Beaker,
  Droplets,
  RotateCcw,
  RotateCw,
  TrendingDown,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Package,
  Gauge,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { cn, getDepartmentAverage } from '../lib/utils';
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
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

const ProgressBar = ({ pct, color }: { pct: number; color: string }) => (
  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
    <div
      className={`h-full ${color} rounded-full transition-all duration-700 ease-out`}
      style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
    />
  </div>
);

const StatusBadge = ({ status }: { status: 'High' | 'Moderate' | 'Critical' | 'Active' }) => {
  const styles: Record<string, string> = {
    High: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    Moderate: 'bg-amber-50 text-amber-700 border-amber-100',
    Critical: 'bg-red-50 text-red-700 border-red-100',
    Active: 'bg-blue-50 text-blue-700 border-blue-100',
  };
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-wider ${styles[status] || styles['Active']}`}>
      {status}
    </span>
  );
};

const RM_RATES: Record<string, number> = {
  'CA': 35000,
  'CC': 5200,
  'RBX': 6500,
  'Rbx': 6500,
  'RAJ SAKTL RBX': 6500,
};

const COST_FACTORS = {
  FUEL_RATE: 96,
  ELECTRIC_RATE: 10,
  PROCESSING_COST_PER_MT: 1500
};

interface Props {
  entries: Entry[];
  compositionData: any[];
  onSelect: (dept: Department) => void;
  masterData: { campaigns: string[] };
  parameterRanges?: Record<string, string>;
}

const parseRange = (rangeStr: string, rangeKey: string = ''): { min: number; max: number } | null => {
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
  if (numbers && numbers.length === 1) {
    const val = parseFloat(numbers[0]);
    const key = rangeKey.toLowerCase();
    if (key.includes('moisture') || key.includes('gbm') || key.includes('cbm') || key.includes('loi') || key.includes('iron') || key.includes('fe2o3') || key.includes('tio2') || key.includes('ap')) {
      return { min: 0, max: val };
    }
    return { min: val, max: 1000 };
  }
  return null;
};

const avg = (arr: number[]): string => {
  return arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : '-';
};

const getDetailedStat = (sourceRows: any[], patterns: string[], rangeKey: string, parameterRanges?: Record<string, string>) => {
  let nums: number[] = [];
  let outOfLimit = 0;
  const range = parameterRanges ? parseRange(parameterRanges[rangeKey], rangeKey) : null;
  const allPatterns = patterns.map(p => p.toLowerCase());

  sourceRows.forEach(e => {
    const keys = Object.keys(e.data);
    let rowMin = NaN, rowMax = NaN;
    allPatterns.forEach(lp => {
      const kMin = keys.find(k => k.toLowerCase().includes(lp) && k.toLowerCase().includes('min'));
      const kMax = keys.find(k => k.toLowerCase().includes(lp) && k.toLowerCase().includes('max'));
      if (kMin) rowMin = parseFloat(e.data[kMin]);
      if (kMax) rowMax = parseFloat(e.data[kMax]);
    });

    let activeRange = (!isNaN(rowMin) && !isNaN(rowMax)) ? { min: rowMin, max: rowMax } : range;
    if (!activeRange) {
      if (rangeKey === 'Fineness') activeRange = { min: 90, max: 1000 };
      if (rangeKey === 'Moisture') activeRange = { min: 0, max: 30 };
      if (rangeKey === 'Drop Test') activeRange = { min: 2.5, max: 1000 };
      if (rangeKey === 'Alumina (%)' || rangeKey === 'Al2O3') activeRange = { min: 82.5, max: 100 };
    }

    keys.forEach(k => {
      const lk = k.toLowerCase();
      const isMatch = allPatterns.some(lp => lk === lp || lk === `${lp} avg` || lk === `${lp}_avg` || lk === `${lp} %` || lk.includes(`${lp} `));
      const isHMatch = allPatterns.some(lp => lk.includes(lp) && /\d/.test(lk));

      if (isMatch || isHMatch) {
        const val = parseFloat(e.data[k]);
        if (!isNaN(val)) {
          nums.push(val);
          if (activeRange && (val < activeRange.min || val > activeRange.max)) outOfLimit++;
        }
      }
    });
  });

  const avgVal = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '-';
  const efficiency = nums.length ? (((nums.length - outOfLimit) / nums.length) * 100).toFixed(1) : '0.0';
  return { avg: avgVal, count: nums.length, outOfLimit, efficiency };
};

const makeChemStat = (rows: any[], keys: string[], rangeKey: string, parameterRanges: Record<string, string>) => {
  let nums: number[] = [];
  let outOfLimit = 0;
  const range = parseRange(parameterRanges[rangeKey] || '', rangeKey);
  rows.forEach(e => {
    const matched = Object.keys(e.data).find(dk =>
      keys.some(p => dk.toLowerCase() === p.toLowerCase() ||
        (dk.toLowerCase().includes(p.toLowerCase()) && !dk.toLowerCase().includes('min') && !dk.toLowerCase().includes('max')))
    );
    if (matched) {
      const val = parseFloat(e.data[matched]);
      if (!isNaN(val)) {
        nums.push(val);
        if (range && (val < range.min || val > range.max)) outOfLimit++;
      }
    }
  });
  const avgVal = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : '-';
  const efficiency = nums.length ? (((nums.length - outOfLimit) / nums.length) * 100).toFixed(1) : '0.0';
  return { avg: avgVal, count: nums.length, outOfLimit, efficiency };
};

const getNum = (d: Record<string, any>, ...keys: string[]) => {
  for (const k of keys) {
    const v = parseFloat(d[k]);
    if (!isNaN(v)) return v;
  }
  return NaN;
};

export default function Dashboard({ entries, compositionData, onSelect, masterData, parameterRanges = {} }: Props) {
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | 'all' | 'custom'>('today');
  const [customDateRange, setCustomDateRange] = useState({ start: '', startShift: 'All', end: '', endShift: 'All' });
  const [appliedCustomDateRange, setAppliedCustomDateRange] = useState({ start: '', startShift: 'All', end: '', endShift: 'All' });
  const [activeReportTab, setActiveReportTab] = useState<'production' | 'quality' | 'activity'>('production');
  const [activeRmTab, setActiveRmTab] = useState<string>('');
  const [campaignFilter, setCampaignFilter] = useState<string>('All');
  const [compositionSearch, setCompositionSearch] = useState('');

  const allCampaigns = useMemo(() => {
    const caps = new Set<string>();
    entries.forEach(entry => {
      const c = entry.data.campaign_no || entry.data.campaign || entry.data['Campaign No.'] || entry.data['Campaign'];
      if (c && typeof c === 'string') caps.add(c);
    });
    return Array.from(caps).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (campaignFilter !== 'All') {
      result = result.filter(entry => {
        const campaign = entry.data.campaign_no || entry.data.campaign || entry.data['Campaign No.'] || entry.data['Campaign'];
        return campaign === campaignFilter;
      });
    }
    if (dateFilter !== 'all') {
      const now = new Date();
      result = result.filter(e => {
        try {
          const dateStr = e.data.date_of_production || e.data['Date Of Production'] || e.data.date || e.data.Date || e.timestamp;
          const entryDate = new Date(dateStr);
          if (isNaN(entryDate.getTime())) return false;
          if (dateFilter === 'today') return isWithinInterval(entryDate, { start: startOfDay(now), end: endOfDay(now) });
          if (dateFilter === '7d') return isWithinInterval(entryDate, { start: startOfDay(subDays(now, 7)), end: endOfDay(now) });
          if (dateFilter === '30d') return isWithinInterval(entryDate, { start: startOfDay(subDays(now, 30)), end: endOfDay(now) });
          if (dateFilter === 'custom') {
            if (!appliedCustomDateRange.start || !appliedCustomDateRange.end) return true;
            const startD = startOfDay(new Date(appliedCustomDateRange.start));
            const endD = endOfDay(new Date(appliedCustomDateRange.end));
            const eD_start = startOfDay(entryDate);
            if (eD_start < startD || eD_start > endD) return false;

            const eShift = e.data.shift || e.data.Shift || 'All';
            const sShift = appliedCustomDateRange.startShift || 'All';
            const eDShift = appliedCustomDateRange.endShift || 'All';
            const weights: Record<string, number> = { 'Shift A': 1, 'Shift B': 2, 'Shift C': 3, 'All': 0 };

            if (eD_start.getTime() === startD.getTime() && sShift !== 'All') {
              if (weights[eShift] && weights[eShift] < weights[sShift]) return false;
            }
            if (eD_start.getTime() === endD.getTime() && eDShift !== 'All') {
              if (weights[eShift] && weights[eShift] > weights[eDShift]) return false;
            }
            return true;
          }
        } catch (err) { return false; }
        return true;
      });
    }
    return result;
  }, [entries, campaignFilter, dateFilter, appliedCustomDateRange]);

  const stats = useMemo(() => {
    const total = filteredEntries.length;
    const byDept = DEPARTMENTS.reduce((acc, dept) => {
      acc[dept.id] = filteredEntries.filter(e => e.departmentId === dept.id).length;
      return acc;
    }, {} as Record<string, number>);
    return { total, byDept };
  }, [filteredEntries]);

  const filteredCompositionData = useMemo(() => {
    let data = compositionData;
    if (dateFilter !== 'all') {
      const now = new Date();
      data = data.filter(row => {
        try {
          const d = new Date(row.timestamp || row.date || row.Date);
          if (isNaN(d.getTime())) return false;
          if (dateFilter === 'today') return isWithinInterval(d, { start: startOfDay(now), end: endOfDay(now) });
          if (dateFilter === '7d') return isWithinInterval(d, { start: startOfDay(subDays(now, 7)), end: endOfDay(now) });
          if (dateFilter === '30d') return isWithinInterval(d, { start: startOfDay(subDays(now, 30)), end: endOfDay(now) });
          if (dateFilter === 'custom') {
            if (!appliedCustomDateRange.start || !appliedCustomDateRange.end) return true;
            const startD = startOfDay(new Date(appliedCustomDateRange.start));
            const endD = endOfDay(new Date(appliedCustomDateRange.end));
            const d_start = startOfDay(d);
            if (d_start < startD || d_start > endD) return false;

            const rShift = row.shift || row.Shift || 'All';
            const sShift = appliedCustomDateRange.startShift || 'All';
            const eDShift = appliedCustomDateRange.endShift || 'All';
            const weights: Record<string, number> = { 'Shift A': 1, 'Shift B': 2, 'Shift C': 3, 'All': 0 };

            if (d_start.getTime() === startD.getTime() && sShift !== 'All') {
              if (weights[rShift] && weights[rShift] < weights[sShift]) return false;
            }
            if (d_start.getTime() === endD.getTime() && eDShift !== 'All') {
              if (weights[rShift] && weights[rShift] > weights[eDShift]) return false;
            }
            return true;
          }
        } catch { return false; }
        return true;
      });
    }

    if (campaignFilter !== 'All') {
      data = data.filter(row => {
        const c = row.campaign_no || row.campaign || row.Campaign || row['Campaign No.'] || row['Campaign No'];
        return String(c) === String(campaignFilter);
      });
    }

    if (compositionSearch) {
      const s = compositionSearch.toLowerCase();
      data = data.filter(r =>
        (r.campaign_no || '').toLowerCase().includes(s) ||
        (r.product_name || '').toLowerCase().includes(s)
      );
    }
    return data;
  }, [compositionData, dateFilter, compositionSearch, appliedCustomDateRange]);

  const chartData = useMemo(() => {
    const now = new Date();
    const validEntries = filteredEntries.map(e => {
      try {
        const prodDateStr = e.data.date_of_production || e.data['Date Of Production'] || e.timestamp;
        const d = new Date(prodDateStr);
        return isNaN(d.getTime()) ? null : { ...e, d };
      } catch { return null; }
    }).filter(Boolean) as (Entry & { d: Date })[];

    if (dateFilter === 'today') {
      return Array.from({ length: 12 }, (_, i) => {
        const slotHour = i * 2;
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slotHour, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slotHour + 1, 59, 59);
        const slotEntries = validEntries.filter(e => e.d >= start && e.d <= end);
        const totalQty = slotEntries.filter(e => e.departmentId === 'actual_production').reduce((sum, e) => sum + (parseFloat(e.data.qty || e.data.Qty) || 0), 0);
        return { name: format(start, 'HH:mm'), production: parseFloat(totalQty.toFixed(1)), fullDate: format(start, 'MMM dd, HH:mm') };
      });
    }
    if (dateFilter === '7d' || dateFilter === '30d') {
      const days = dateFilter === '7d' ? 7 : 30;
      return Array.from({ length: days }, (_, i) => {
        const targetDate = subDays(now, i);
        const dateStr = format(targetDate, 'yyyy-MM-dd');
        const dayEntries = validEntries.filter(e => format(e.d, 'yyyy-MM-dd') === dateStr);
        const totalQty = dayEntries.filter(e => e.departmentId === 'actual_production').reduce((sum, e) => sum + (parseFloat(e.data.qty || e.data.Qty) || 0), 0);
        return { name: format(targetDate, 'MMM dd'), production: parseFloat(totalQty.toFixed(1)), fullDate: dateStr };
      }).reverse();
    }
    if (dateFilter === 'all' || dateFilter === 'custom') {
      if (validEntries.length === 0) return [];
      const earliest = validEntries.reduce((p, c) => (c.d < p.d ? c : p), validEntries[0]).d;
      const latest = validEntries.reduce((p, c) => (c.d > p.d ? c : p), validEntries[0]).d;
      const diffMs = latest.getTime() - earliest.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays <= 31) {
        return Array.from({ length: Math.ceil(diffDays) + 1 }, (_, i) => {
          const targetDate = subDays(latest, i);
          const dateStr = format(targetDate, 'yyyy-MM-dd');
          const dayEntries = validEntries.filter(e => format(e.d, 'yyyy-MM-dd') === dateStr);
          const totalQty = dayEntries.filter(e => e.departmentId === 'actual_production').reduce((sum, e) => sum + (parseFloat(e.data.qty || e.data.Qty) || 0), 0);
          return { name: format(targetDate, 'MMM dd'), production: parseFloat(totalQty.toFixed(1)), fullDate: dateStr };
        }).reverse();
      }

      const months: any[] = [];
      let curr = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
      while (curr <= latest) {
        const monthStr = format(curr, 'yyyy-MM');
        const monthEntries = validEntries.filter(e => format(e.d, 'yyyy-MM') === monthStr);
        const totalQty = monthEntries.filter(e => e.departmentId === 'actual_production').reduce((sum, e) => sum + (parseFloat(e.data.qty || e.data.Qty) || 0), 0);
        months.push({ name: format(curr, 'MMM yy'), production: parseFloat(totalQty.toFixed(1)), fullDate: format(curr, 'MMMM yyyy') });
        curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
      }
      return months;
    }
    return [];
  }, [filteredEntries, dateFilter]);

  const qualityStats = useMemo(() => {
    const al2o3 = filteredEntries.map(e => parseFloat(e.data.al2o3 || e.data.Al2O3)).filter(v => !isNaN(v));
    const fe2o3 = filteredEntries.map(e => parseFloat(e.data.fe2o3 || e.data.Fe2O3)).filter(v => !isNaN(v));
    return {
      avgAl2O3: al2o3.length ? (al2o3.reduce((a, b) => a + b, 0) / al2o3.length).toFixed(2) : '0',
      avgFe2O3: fe2o3.length ? (fe2o3.reduce((a, b) => a + b, 0) / fe2o3.length).toFixed(2) : '0',
      totalSamples: al2o3.length
    };
  }, [filteredEntries]);

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

  const Sparkline = ({ data = [], color = '#6366f1' }: { data?: number[], color?: string }) => {
    if (data.length < 2) return <div className="h-1.5 w-16 bg-slate-50 rounded-full animate-pulse" />;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const width = 100;
    const height = 30;
    const points = data.map((v, i) => ({
      x: (i / (data.length - 1)) * width,
      y: height - ((v - min) / range) * height
    }));
    const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8 overflow-visible">
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={pathData} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`${pathData} L ${width},${height} L 0,${height} Z`} fill={`url(#grad-${color.replace('#', '')})`} />
      </svg>
    );
  };

  const { prevStats, trend } = useMemo(() => {
    if (dateFilter === 'all') return { prevStats: null, trend: {} };
    const now = new Date();
    let startPrev: Date, endPrev: Date;
    if (dateFilter === 'today') { startPrev = startOfDay(subDays(now, 1)); endPrev = endOfDay(subDays(now, 1)); }
    else if (dateFilter === '7d') { startPrev = startOfDay(subDays(now, 14)); endPrev = endOfDay(subDays(now, 7)); }
    else if (dateFilter === '30d') { startPrev = startOfDay(subDays(now, 60)); endPrev = endOfDay(subDays(now, 30)); }
    else return { prevStats: null, trend: {} };

    const prevEntries = entries.filter(e => {
      try {
        const dStr = e.data.date_of_production || e.data['Date Of Production'] || e.data.date || e.data.Date || e.timestamp;
        const d = new Date(dStr);
        return isWithinInterval(d, { start: startPrev, end: endPrev });
      } catch { return false; }
    });

    const prevAl2O3 = prevEntries.map(e => parseFloat(e.data.al2o3 || e.data.Al2O3)).filter(v => !isNaN(v));
    const prevCount = prevEntries.length;
    const currentAl2O3 = parseFloat(qualityStats.avgAl2O3);
    const avgPrevAl2O3 = prevAl2O3.length ? (prevAl2O3.reduce((a, b) => a + b, 0) / prevAl2O3.length) : 0;

    const prevGround = prevEntries
      .filter(e => e.departmentId === 'sb3_ground')
      .reduce((s, e) => {
        const d = e.data;
        return s +
          (parseFloat(d.qty1 || d.Qty1) || 0) +
          (parseFloat(d.qty2 || d.Qty2) || 0) +
          (parseFloat(d.qty3 || d.Qty3) || 0);
      }, 0);

    const currentGround = filteredEntries
      .filter(e => e.departmentId === 'sb3_ground')
      .reduce((s, e) => {
        const d = e.data;
        return s +
          (parseFloat(d.qty1 || d.Qty1) || 0) +
          (parseFloat(d.qty2 || d.Qty2) || 0) +
          (parseFloat(d.qty3 || d.Qty3) || 0);
      }, 0);

    return {
      prevStats: { count: prevCount, al2o3: avgPrevAl2O3.toFixed(2) },
      trend: {
        count: prevCount > 0 ? Math.round(((filteredEntries.length - prevCount) / prevCount) * 100) : 0,
        al2o3: avgPrevAl2O3 > 0 ? ((currentAl2O3 - avgPrevAl2O3) / avgPrevAl2O3 * 100).toFixed(1) : '0',
        ground: prevGround > 0 ? ((currentGround - prevGround) / prevGround * 100).toFixed(1) : '0',
      }
    };
  }, [entries, filteredEntries, dateFilter, qualityStats]);

  const qualityDistribution = useMemo(() => {
    let inRange = 0; let outRange = 0;
    filteredEntries.forEach(entry => {
      let isRed = false;
      Object.entries(entry.data).forEach(([key, value]) => {
        const numValue = parseFloat(String(value));
        if (isNaN(numValue)) return;
        if (entry.departmentId === 'product_house') {
          if (key === 'Al2O3' && (numValue < 87.5 || numValue > 89)) isRed = true;
          else if (key === 'Fe2O3' && numValue > 2) isRed = true;
        } else if (['dgu', 'balling_disc', 'kiln'].includes(entry.departmentId)) {
          if (key === 'Al2O3' && (numValue < 82.5 || numValue > 83.5)) isRed = true;
        }
      });
      if (isRed) outRange++; else inRange++;
    });
    return [
      { name: 'Compliant', value: inRange, color: '#2563eb' },
      { name: 'Anomalies', value: outRange, color: '#f43f5e' }
    ];
  }, [filteredEntries]);

  const departmentActivity = useMemo(() => {
    return DEPARTMENTS.map(d => ({ name: d.name, count: stats.byDept[d.id] || 0 })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [stats]);

  const misReportData = useMemo(() => {
    const getDaysInRange = () => {
      if (dateFilter === 'today') return 1;
      if (dateFilter === '7d') return 7;
      if (dateFilter === '30d') return 30;
      return 90;
    };
    const days = getDaysInRange();
    return DEPARTMENTS.map(dept => {
      const actual = stats.byDept[dept.id] || 0;
      const target = days * 3;
      const efficiency = target > 0 ? (actual / target) * 100 : 0;
      return {
        id: dept.id, name: dept.name, category: dept.category, target, actual,
        gap: Math.max(0, target - actual),
        efficiency: Math.min(100, efficiency).toFixed(1),
        status: efficiency >= 90 ? 'High' : efficiency >= 50 ? 'Moderate' : 'Critical'
      };
    });
  }, [stats, dateFilter]);

  const campaignSummary = useMemo(() => {
    const summary: Record<string, { ground_total: number; inputs: Record<string, number>; products: Record<string, number>; status: 'Active' | 'Closed' }> = {};
    filteredEntries.forEach(entry => {
      const campaign = entry.data.campaign_no || entry.data.campaign || entry.data['Campaign No.'] || entry.data['Campaign'];
      if (!campaign || typeof campaign !== 'string') return;
      if (!summary[campaign]) summary[campaign] = { ground_total: 0, inputs: {}, products: {}, status: 'Active' };
      const d = entry.data;
      if (entry.departmentId === 'sb3_ground') {
        const mats = [
          { name: d.mat1 || d['Material 1'], qty: parseFloat(d.qty1 || d.Qty1) || 0 },
          { name: d.mat2 || d['Material 2'], qty: parseFloat(d.qty2 || d.Qty2) || 0 },
          { name: d.mat3 || d['Material 3'], qty: parseFloat(d.qty3 || d.Qty3) || 0 }
        ];
        mats.forEach(m => {
          if (m.name && m.qty > 0) {
            const materialName = String(m.name).trim();
            summary[campaign].inputs[materialName] = (summary[campaign].inputs[materialName] || 0) + m.qty;
            summary[campaign].ground_total += m.qty;
          }
        });
      } else if (entry.departmentId === 'actual_production') {
        const prodName = d.product_name || d['Product Name'] || 'Unknown Product';
        const prodQty = parseFloat(d.qty || d.Qty) || 0;
        if (!summary[campaign].products[prodName]) summary[campaign].products[prodName] = 0;
        summary[campaign].products[prodName] += prodQty;
      } else if (entry.departmentId === 'campaign_closing') {
        summary[campaign].status = 'Closed';
      }
    });
    return Object.entries(summary).map(([id, stats]) => ({ id, ...stats }));
  }, [filteredEntries]);

  const materialStats = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredEntries.filter(e => e.departmentId === 'sb3_ground').forEach(e => {
      const d = e.data;
      [['mat1', 'qty1'], ['mat2', 'qty2'], ['mat3', 'qty3'], ['Material 1', 'Qty1'], ['Material 2', 'Qty2'], ['Material 3', 'Qty3']].forEach(([m, q]) => {
        const name = d[m]; const qty = parseFloat(d[q]) || 0;
        if (name && qty > 0) totals[String(name).trim()] = (totals[String(name).trim()] || 0) + qty;
      });
    });
    const count = filteredEntries.filter(e => e.departmentId === 'sb3_ground').length;
    return { totals: Object.entries(totals).sort((a, b) => b[1] - a[1]), count };
  }, [filteredEntries]);

  const hopperStats = useMemo(() => {
    const totals: Record<string, number> = {};
    const rows = filteredEntries.filter(e => e.departmentId === 'sb3_hopper');
    rows.forEach(e => {
      const d = e.data;
      [
        { name: d.rm1 || d.RM1 || 'RM1', qty: parseFloat(d['Used RM1'] || 0) },
        { name: d.rm2 || d.RM2 || 'RM2', qty: parseFloat(d['Used RM2'] || 0) },
        { name: d.rm3 || d.RM3 || 'RM3', qty: parseFloat(d['Used RM3'] || 0) },
        { name: d.rm4 || d.RM4 || 'RM4', qty: parseFloat(d['Used RM4'] || 0) },
        { name: d.rm5 || d.RM5 || 'RM5', qty: parseFloat(d['Used RM5'] || 0) },
        { name: d.rm6 || d.RM6 || 'RM6', qty: parseFloat(d['Used RM6'] || 0) }
      ].forEach(({ name, qty }) => {
        if (name && !isNaN(qty) && qty > 0) {
          const key = String(name).trim();
          totals[key] = (totals[key] || 0) + qty;
        }
      });
    });
    return { totals: Object.entries(totals).sort((a, b) => b[1] - a[1]), count: rows.length };
  }, [filteredEntries]);

  const productStats = useMemo(() => {
    const totals: Record<string, number> = {};
    const rows = filteredEntries.filter(e => e.departmentId === 'actual_production');
    rows.forEach(e => {
      const d = e.data;
      const name = d.product_name || d['Product Name'] || 'Unknown';
      const qty = parseFloat(d.qty || d.Qty || 0);
      if (!isNaN(qty) && qty > 0) totals[String(name).trim()] = (totals[String(name).trim()] || 0) + qty;
    });
    return { totals: Object.entries(totals).sort((a, b) => b[1] - a[1]), count: rows.length };
  }, [filteredEntries]);

  const selectedProducts = useMemo(() => {
    if (campaignFilter === 'All') return [];
    const campaign = campaignSummary.find(c => c.id === campaignFilter);
    return campaign ? Object.keys(campaign.products).filter(p => p !== 'Unknown Product') : [];
  }, [campaignFilter, campaignSummary]);

  const spillageStats = useMemo(() => {
    const rows = filteredEntries.filter(e => e.departmentId === 'spillage');
    const hotScreen = rows.reduce((s, e) => s + (parseFloat(e.data.hot_screen_qty || e.data['Hot Screen Qty']) || 0), 0);
    const multiCyclone = rows.reduce((s, e) => s + (parseFloat(e.data.multi_cyclone_qty || e.data['Multi Cyclone Qty']) || 0), 0);
    const houseKeeping = rows.reduce((s, e) => s + (parseFloat(e.data.house_keeping || e.data['House Keeping']) || 0), 0);
    const roadSide = rows.reduce((s, e) => s + (parseFloat(e.data.road_side || e.data['Road Side']) || 0), 0);

    const logicStr = [
      hotScreen > 0 ? `Hot Screen: ${hotScreen.toFixed(1)}` : null,
      multiCyclone > 0 ? `Multi Cyclone: ${multiCyclone.toFixed(1)}` : null,
      houseKeeping > 0 ? `House: ${houseKeeping.toFixed(1)}` : null,
      roadSide > 0 ? `Road: ${roadSide.toFixed(1)}` : null
    ].filter(Boolean).join(', ') || 'Sum of all spillage streams';

    return { hotScreen, multiCyclone, houseKeeping, roadSide, total: hotScreen + multiCyclone + houseKeeping + roadSide, count: rows.length, logicStr };
  }, [filteredEntries]);

  const pptStats = useMemo(() => {
    const rows = filteredEntries.filter(e => e.departmentId === 'ppt');
    const totalQty = rows.reduce((s, e) => s + (parseFloat(e.data.ispileg_qty || e.data['Ispileg Re-feeded Qty']) || 0), 0);
    return { totalQty, count: rows.length };
  }, [filteredEntries]);

  const wipStats = useMemo(() => {
    const rows = filteredEntries.filter(e => e.departmentId === 'campaign_closing');

    let wipBreakdown: Record<string, number> = {};
    const totalWIP = rows.reduce((s, e) => {
      let rowTotal = 0;
      const mapping: Record<string, number> = {
        'Hop3': parseFloat(e.data.sb3_hopper3 || e.data['SB3 Hopper3']) || 0,
        'Hop4': parseFloat(e.data.sb3_hopper4 || e.data['SB3 Hopper4']) || 0,
        'Hop5': parseFloat(e.data.sb3_hopper5 || e.data['SB3 Hopper5']) || 0,
        'PPT': parseFloat(e.data.ppt_qty || e.data['PPT Qty']) || 0,
        'SB4': parseFloat(e.data.sb4_qty || e.data['SB4 Qty']) || 0,
        'BallMill': parseFloat(e.data.ball_mill || e.data['Ball Mill']) || 0,
        'BC10': parseFloat(e.data.bc_10 || e.data['BC 10']) || 0,
        'BC11': parseFloat(e.data.bc_11 || e.data['BC 11']) || 0,
        'BC12': parseFloat(e.data.bc_12 || e.data['BC 12']) || 0,
        'BC13': parseFloat(e.data.bc_13 || e.data['BC 13']) || 0,
        'Mixt': parseFloat(e.data.mixture_balling_dics || e.data['Mixture (Balling Dics)']) || 0,
        'Disc': parseFloat(e.data.balling_disc_4nos || e.data['Balling Disc X 4Nos.']) || 0,
        'TgBeg': parseFloat(e.data.tg_beg || e.data['Tg Beg']) || 0,
        'Kiln': parseFloat(e.data.kiln || e.data['Kiln']) || 0,
        'Cooler': parseFloat(e.data.cooler || e.data['Cooler']) || 0,
      };

      Object.entries(mapping).forEach(([key, val]) => {
        wipBreakdown[key] = (wipBreakdown[key] || 0) + val;
        rowTotal += val;
      });
      return s + rowTotal;
    }, 0);

    const logicStr = Object.entries(wipBreakdown)
      .filter(([, val]) => val > 0)
      .map(([k, v]) => `${k}: ${v.toFixed(1)} MT`)
      .join(', ') || 'Material remaining in plant (Campaign Closing)';

    return { totalWIP, count: rows.length, logicStr };
  }, [filteredEntries]);

  const accountingSummary = useMemo(() => {
    const totalGround = materialStats.totals.reduce((s, [, q]) => s + q, 0);
    const totalHopper = hopperStats.totals.reduce((s, [, q]) => s + q, 0);
    const totalProduction = productStats.totals.reduce((s, [, q]) => s + q, 0);
    const totalSpillage = spillageStats.total;
    const totalPPT = pptStats.totalQty;
    const netOutput = totalProduction;
    const efficiency = totalGround > 0 ? ((totalProduction / totalGround) * 100).toFixed(1) : '0';
    const spillagePct = totalProduction > 0 ? ((totalSpillage / totalProduction) * 100).toFixed(1) : '0';
    const recycledPct = totalSpillage > 0 ? ((totalPPT / totalSpillage) * 100).toFixed(1) : '0';

    const uniqueDays = new Set(filteredEntries.map(e => e.dateOfProduction)).size || 1;
    const dailyTarget = 40.0;
    let periodTarget = dailyTarget;
    if (dateFilter === '7d') periodTarget = dailyTarget * 7;
    else if (dateFilter === '30d') periodTarget = dailyTarget * 30;
    else if (dateFilter === 'all') periodTarget = dailyTarget * uniqueDays;

    const progressPct = Math.min((totalProduction / periodTarget) * 100, 100).toFixed(1);
    const dailyAvg = (totalProduction / uniqueDays).toFixed(1);

    const wipStatsOutput = wipStats.totalWIP;

    const consumptionRows = filteredEntries.filter(e => e.departmentId === 'consumption');
    const totalConsumption = consumptionRows.reduce((sum, e) => sum + (parseFloat(e.data.Total || e.data.total) || 0), 0);
    const totalInput = totalConsumption > 0 ? totalConsumption : totalHopper;
    const consumptionLogic = totalConsumption > 0
      ? `Sum of "Total" column from Consumption sheet (${consumptionRows.length} entries)`
      : `Sum of Used RM1-RM6 cols (${hopperStats.count} entries)`;

    const netSpillage = totalSpillage - totalPPT;

    // FIXED: Enhanced function to extract Ground Loss and LOI from composition records
    const getCampaignKyc = () => {
      const sources: any[][] = [];
      if (Array.isArray(compositionData)) sources.push(compositionData);
      if (masterData && typeof masterData === 'object') {
        Object.entries(masterData).forEach(([key, val]) => {
          if (Array.isArray(val)) sources.push(val);
        });
      }

      // Helper to extract numeric value from a row by trying multiple column name patterns
      const extractValue = (row: any, patterns: string[]): number => {
        const keys = Object.keys(row);
        for (const pattern of patterns) {
          // Try exact match first
          const exactMatch = keys.find(k => k.toLowerCase() === pattern.toLowerCase());
          if (exactMatch) {
            const val = parseFloat(String(row[exactMatch]).replace(/[^\d.]/g, ''));
            if (!isNaN(val) && val > 0) return val;
          }

          // Try partial match
          const partialMatch = keys.find(k => k.toLowerCase().includes(pattern.toLowerCase()));
          if (partialMatch) {
            const val = parseFloat(String(row[partialMatch]).replace(/[^\d.]/g, ''));
            if (!isNaN(val) && val > 0) return val;
          }
        }
        return 0;
      };

      let bestGl = 0;
      let bestLoi = 0;

      // Patterns for Ground Loss (AC column in composition sheet)
      const groundLossPatterns = [
        'ground loss', 'groundloss', 'Ground Loss', 'GroundLoss',
        'ground_loss', 'ground loss %', 'groundloss %', 'GL',
        'AC', 'ac', 'loss', 'processing loss', 'grinding loss'
      ];

      // Patterns for LOI
      const loiPatterns = [
        'loi', 'LOI', 'Loss on Ignition', 'loss_on_ignition',
        'loi %', 'LOI %', 'Loss on Ignition %', 'L.O.I'
      ];

      // Scan all sources for matching campaign
      sources.forEach(sheetData => {
        let kampRecords = sheetData;
        if (campaignFilter !== 'All') {
          kampRecords = sheetData.filter(r => {
            const c = String(r.campaign_no || r.campaign || r['Campaign No.'] || r['Campaign No'] || r.Campaign || '');
            return c.toLowerCase().trim() === String(campaignFilter).toLowerCase().trim();
          });
        }

        // Take the latest record that has non-zero data
        for (let i = kampRecords.length - 1; i >= 0; i--) {
          const row = kampRecords[i];

          const gl = extractValue(row, groundLossPatterns);
          const loi = extractValue(row, loiPatterns);

          if (gl > 0 && bestGl === 0) bestGl = gl;
          if (loi > 0 && bestLoi === 0) bestLoi = loi;

          if (bestGl > 0 && bestLoi > 0) break;
        }
      });

      // Global fallback if campaign match failed
      if (bestGl === 0 || bestLoi === 0) {
        sources.forEach(sheetData => {
          for (let i = sheetData.length - 1; i >= 0; i--) {
            const row = sheetData[i];

            const gl = extractValue(row, groundLossPatterns);
            const loi = extractValue(row, loiPatterns);

            if (gl > 0 && bestGl === 0) bestGl = gl;
            if (loi > 0 && bestLoi === 0) bestLoi = loi;

            if (bestGl > 0 && bestLoi > 0) break;
          }
        });
      }

      // Default values if still no data found
      if (bestGl === 0) bestGl = 0.5;
      if (bestLoi === 0) bestLoi = 5.0;

      return { gl: bestGl, loi: bestLoi };
    };

    const kampKyc = getCampaignKyc();
    const avgGroundLoss = kampKyc.gl;
    const avgLOI = kampKyc.loi;

    const loiLossMT = totalInput * (avgLOI / 100);
    const balance1 = totalInput - loiLossMT;

    const groundLossMT = 0;
    const balance2 = balance1;

    const balance3 = balance2 - netSpillage;
    const balance4 = balance3 - wipStatsOutput;

    const differenceQty = balance4 - totalProduction;
    const unaccountedLoss = differenceQty;
    const theoreticalLossMT = groundLossMT + loiLossMT;

    return {
      totalInput, netSpillage,
      balance1, balance2, balance3, balance4,
      avgGroundLoss, avgLOI, groundLossMT, loiLossMT, differenceQty,
      totalGround, totalHopper, totalProduction, totalSpillage, totalPPT,
      netOutput, efficiency, spillagePct, recycledPct,
      progressPct, periodTarget, dailyAvg, uniqueDays,
      wipStatsOutput, unaccountedLoss, theoreticalLossMT, consumptionLogic
    };
  }, [materialStats, hopperStats, productStats, spillageStats, pptStats, wipStats, dateFilter, filteredEntries, filteredCompositionData]);

  const consumptionStats = useMemo(() => {
    const totalProd = accountingSummary.totalProduction || 0;
    if (totalProd === 0) return [];
    return hopperStats.totals.map(([name, qty]) => ({
      name,
      consumption: (qty / totalProd).toFixed(3),
      totalUsed: qty.toFixed(1)
    }));
  }, [hopperStats.totals, accountingSummary.totalProduction]);

  const energyStats = useMemo(() => {
    const prodEntries = filteredEntries.filter(e => e.departmentId === 'actual_production');
    const dguEntries = filteredEntries.filter(e => e.departmentId === 'dgu');
    const stopEntries = filteredEntries.filter(e => e.departmentId === 'production_stop');

    const totalFuel = prodEntries.reduce((s, e) => s + (parseFloat(e.data.fuel_qty || e.data['Fuel Qty Used']) || 0), 0);
    const totalElec = prodEntries.reduce((s, e) => s + (parseFloat(e.data.electric_used || e.data['Electric Used']) || 0), 0);
    const totalQty = prodEntries.reduce((s, e) => s + (parseFloat(e.data.qty || e.data.Qty) || 0), 0);

    const dguDates = new Set(dguEntries.map(e => {
      let dateVal = String(e.data.date || e.data.Date || e.timestamp);
      if (dateVal.includes(' ')) dateVal = dateVal.split(' ')[0];
      return dateVal.trim();
    }));
    const totalHours = dguDates.size * 24;

    const totalStopDuration = stopEntries.reduce((sum, e) => {
      // ✅ Check for manual "Duration" from sheet first
      const manualDurStr = String(e.data.Duration || e.data.Duration_1 || e.data.duration || '').trim().toLowerCase();
      if (manualDurStr && !manualDurStr.includes('nan') && manualDurStr !== '-') {
        // Handle ISO String from Google Sheets (base date 1899-12-30)
        if (manualDurStr.includes('t') && (manualDurStr.includes('z') || manualDurStr.includes('+'))) {
          try {
            const date = new Date(manualDurStr);
            if (!isNaN(date.getTime()) && date.getFullYear() < 1920) {
              const baseDate = new Date('1899-12-30T00:00:00Z');
              const diffMs = date.getTime() - baseDate.getTime();
              return sum + (Math.abs(diffMs) / 3600000); // ms to decimals hours
            }
          } catch { }
        }

        if (manualDurStr.includes('h') || manualDurStr.includes('m')) {
          let h = 0, m = 0;
          const hMatch = manualDurStr.match(/(\d+)\s*(?:h|d)/);
          const mMatch = manualDurStr.match(/(\d+)\s*m/);
          if (hMatch) h = parseFloat(hMatch[1]);
          if (mMatch) m = parseFloat(mMatch[1]);
          return sum + h + (m / 60);
        } else {
          const val = parseFloat(manualDurStr);
          if (!isNaN(val) && val < 500) return sum + val; // Sanity check to avoid adding years
        }
      }

      const startDateStr = e.data.date || e.data.Date;
      const endDateStr = e.data.fix_date || e.data.actual_date || e.data.Actual_date || e.data.actual || e.data.Actual || e.data.Date_1;
      const start = e.data.time_stop || e.data['Time Stop'];
      const end = e.data.fix_time || e.data.actual_time || e.data['Time'] || e.data.Time;
      if (!start || !end) return sum;
      try {
        const parseToDate = (dStr: string, tStr: string) => {
          const fullT = String(tStr).trim();
          const fullD = String(dStr).trim();

          if (fullT.includes('T') && !isNaN(new Date(fullT).getTime())) {
            return new Date(fullT);
          }

          let d = new Date();
          if (fullD) {
            if (fullD.includes('T') && !isNaN(new Date(fullD).getTime())) {
              d = new Date(fullD);
            } else {
              const parts = fullD.split(' ')[0].split(/[-/]/);
              if (parts.length === 3) {
                let y = Number(parts[2]);
                if (y < 100) y += 2000;
                let m = Number(parts[1]);
                let day = Number(parts[0]);
                if (parts[0].length === 4) {
                  y = Number(parts[0]);
                  m = Number(parts[1]);
                  day = Number(parts[2]);
                }
                if (m > 12) {
                  d = new Date(y, day - 1, m);
                } else {
                  d = new Date(y, m - 1, day);
                }
              } else {
                const parsedD = new Date(fullD);
                if (!isNaN(parsedD.getTime())) d = parsedD;
              }
            }
          }

          const s = fullT.toLowerCase();
          let h = 0, m = 0;
          if (s.includes('am') || s.includes('pm')) {
            const match = s.match(/(\d+):(\d+)\s*(am|pm)/i);
            if (match) {
              h = Number(match[1]);
              if (match[3] === 'pm' && h < 12) h += 12;
              if (match[3] === 'am' && h === 12) h = 0;
              m = Number(match[2]);
            }
          } else {
            const timePart = s.includes(' ') ? s.split(' ')[1] : s;
            const parts = timePart.split(':');
            h = Number(parts[0]) || 0;
            m = Number(parts[1]) || 0;
          }
          d.setHours(h, m, 0, 0);
          return d;
        };

        const startObj = parseToDate(startDateStr, start);
        const endObj = parseToDate(endDateStr, end);

        const diffMs = endObj.getTime() - startObj.getTime();
        if (isNaN(diffMs)) return sum;

        let diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 0 && startDateStr === endDateStr) {
          diffMins += 24 * 60;
        }

        return sum + (Math.max(0, diffMins) / 60);
      } catch { return sum; }
    }, 0);

    return {
      totalFuel, totalElec, totalQty, totalHours, count: prodEntries.length,
      fuelPerMT: totalQty > 0 ? (totalFuel / totalQty).toFixed(2) : '0',
      elecPerMT: totalQty > 0 ? (totalElec / totalQty).toFixed(2) : '0',
      totalStopDuration: totalStopDuration.toFixed(1)
    };
  }, [filteredEntries]);

  const productionCost = useMemo(() => {
    const totalProd = accountingSummary.totalProduction || 0;
    const totalFuel = energyStats.totalFuel || 0;
    const totalElec = energyStats.totalElec || 0;

    let totalRmCost = 0;
    const breakdown = hopperStats.totals.map(([name, qty]) => {
      const rate = RM_RATES[name] || RM_RATES[name.toUpperCase()] || 0;
      const cost = qty * rate;
      totalRmCost += cost;
      return { name, qty, rate, cost };
    });

    const totalFuelCost = totalFuel * COST_FACTORS.FUEL_RATE;
    const totalElecCost = totalElec * COST_FACTORS.ELECTRIC_RATE;
    const totalProcessingCost = totalProd * COST_FACTORS.PROCESSING_COST_PER_MT;
    const totalOperatingCost = totalRmCost + totalFuelCost + totalElecCost + totalProcessingCost;

    return {
      totalRmCost,
      totalFuelCost,
      totalElecCost,
      totalProcessingCost,
      totalOperatingCost,
      costPerMt: totalProd > 0 ? (totalOperatingCost / totalProd) : 0,
      breakdown
    };
  }, [hopperStats, accountingSummary.totalProduction, energyStats]);

  const dguDetailedAvg = useMemo(() => {
    const dguRows = filteredEntries.filter(e => e.departmentId === 'dgu');
    return {
      fineness: getDetailedStat(dguRows, ['fineness_', 'Fineness %', 'FINENESS %', 'fineness'], 'Fineness', parameterRanges),
      al2o3: makeChemStat(dguRows, ['Al2O3', 'al2o3', 'Alumina', 'alumina', 'AL2O3'], 'Alumina (%)', parameterRanges),
      fe2o3: makeChemStat(dguRows, ['Fe2O3', 'fe2o3', 'FE2O3', 'Iron', 'iron'], 'Iron (%)', parameterRanges),
      tio2: makeChemStat(dguRows, ['TiO2', 'tio2', 'TIO2', 'Titania', 'titania'], 'Titania (%)', parameterRanges),
      loi: makeChemStat(dguRows, ['Loi', 'loi', 'LOI', 'Loss on Ignition'], 'LOI (%)', parameterRanges),
      count: dguRows.length
    };
  }, [filteredEntries, parameterRanges]);

  const ballingUpdatesAvg = useMemo(() => {
    const rows = filteredEntries.filter(e => e.departmentId === 'balling_disc');

    const gbmStat = (() => {
      let nums: number[] = [];
      let outOfLimit = 0;
      const range = parseRange(parameterRanges['GBM (%)'] || parameterRanges['Moisture (%)'] || parameterRanges['Moisture'] || '', 'Moisture');

      rows.forEach(e => {
        const hopperVals: number[] = [];
        for (let i = 1; i <= 8; i++) {
          const patterns = [
            `h${i}`, `H${i}`, `hopper${i}`, `Hopper${i}`, `Hopper ${i}`,
            `gbm_h${i}`, `GBM H${i}`, `GBM_H${i}`, `gbm h${i}`,
            `moisture_h${i}`, `Moisture H${i}`
          ];
          const matched = Object.keys(e.data).find(dk =>
            patterns.some(p => dk.toLowerCase() === p.toLowerCase() ||
              dk.toLowerCase().replace(/\s/g, '') === p.toLowerCase().replace(/\s/g, ''))
          );
          if (matched) {
            const val = parseFloat(e.data[matched]);
            if (!isNaN(val) && val > 0) hopperVals.push(val);
          }
        }

        if (hopperVals.length === 0) {
          Object.keys(e.data).forEach(dk => {
            const lk = dk.toLowerCase();
            const isGbm = lk === 'gbm' || lk.includes('gbm') && !lk.startsWith('c');
            const isMoisture = (lk.includes('moisture')) && /\d/.test(lk);

            if ((isGbm || isMoisture) && /\d/.test(lk)) {
              const val = parseFloat(e.data[dk]);
              if (!isNaN(val) && val > 0) hopperVals.push(val);
            }
          });
        }

        if (hopperVals.length > 0) {
          const rowAvg = hopperVals.reduce((a, b) => a + b, 0) / hopperVals.length;
          nums.push(rowAvg);
          if (range && (rowAvg < range.min || rowAvg > range.max)) outOfLimit++;
        }
      });

      const avgVal = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : '-';
      const efficiency = nums.length ? (((nums.length - outOfLimit) / nums.length) * 100).toFixed(1) : '0.0';
      return { avg: avgVal, count: nums.length, outOfLimit, efficiency };
    })();

    return {
      al2o3: makeChemStat(rows, ['Al2O3', 'al2o3', 'Alumina', 'alumina', 'AL2O3'], 'Alumina (%)', parameterRanges),
      fe2o3: makeChemStat(rows, ['Fe2O3', 'fe2o3', 'FE2O3', 'Iron', 'iron'], 'Iron (%)', parameterRanges),
      tio2: makeChemStat(rows, ['TiO2', 'tio2', 'TIO2', 'Titania', 'titania'], 'Titania (%)', parameterRanges),
      loi: makeChemStat(rows, ['Loi', 'loi', 'LOI', 'Loss on Ignition'], 'LOI (%)', parameterRanges),
      gbm: gbmStat,
      drop: getDetailedStat(rows, ['drop_test', 'Drop Test', 'drop_testing_avg'], 'Drop Test', parameterRanges),
      count: rows.length
    };
  }, [filteredEntries, parameterRanges]);

  const rmLabAvg = useMemo(() => {
    const rows = filteredEntries.filter(e => e.departmentId === 'rm');
    const names = new Set<string>();
    rows.forEach(e => {
      const n = e.data.rm_name || e.data['Raw Material Name'];
      if (n && typeof n === 'string') names.add(n);
    });
    const uniqueNames = Array.from(names).sort();
    if (uniqueNames.length === 0) return [];

    const getParamRange = (mat: string, label: string) => {
      if (!parameterRanges) return null;
      let rangeName = label === 'Al2O3' ? 'Alumina (%)' : label === 'Fe2O3' ? 'Iron (%)' : label === 'SiO2' ? 'Silica (%)' : label === 'TiO2' ? 'Titania (%)' : label === 'MgO' ? 'Magnesia (%)' : label === 'CaO' ? 'Lime (%)' : label === 'Loi' ? 'LOI (%)' : label === 'Moisture' ? 'Moisture (%)' : label;
      return parseRange(parameterRanges[rangeName]);
    };

    return uniqueNames.map(rmName => {
      const matRows = rows.filter(e => (e.data.rm_name || e.data['Raw Material Name']) === rmName);
      const makeStat = (k1: string, k2: string, label: string) => {
        const nums = matRows.map(e => parseFloat(e.data[k1] || e.data[k2])).filter(v => !isNaN(v));
        const range = getParamRange(rmName, k1);
        let outOfLimit = 0;
        if (range) {
          outOfLimit = nums.filter(v => v < range.min || v > range.max).length;
        }
        const efficiency = nums.length ? (((nums.length - outOfLimit) / nums.length) * 100).toFixed(1) : '0.0';
        return { avg: nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : '-', count: nums.length, outOfLimit, efficiency };
      };
      return {
        rmName,
        al2o3: makeStat('Al2O3', 'al2o3', 'Alumina (%)'), fe2o3: makeStat('Fe2O3', 'fe2o3', 'Iron (%)'),
        sio2: makeStat('SiO2', 'sio2', 'Silica (%)'), mgo: makeStat('MgO', 'mgo', 'Magnesia (%)'),
        tio2: makeStat('TiO2', 'tio2', 'Titania (%)'), cao: makeStat('CaO', 'cao', 'Lime (%)'),
        moisture: makeStat('Moisture', 'moisture', 'Moisture (%)'), loi: makeStat('Loi', 'loi', 'LOI (%)')
      };
    });
  }, [filteredEntries, parameterRanges]);

  const dropTestAvg = useMemo(() => {
    const rows = filteredEntries.filter(e => e.departmentId === 'drop_test');
    const getRmName = (k1: string, k2: string) => {
      const row = [...rows].reverse().find(e => e.data[k1] || e.data[k2]);
      return row ? (row.data[k1] || row.data[k2]) : null;
    };
    const getLimitRange = (name: string) => {
      if (!parameterRanges) return null;
      return parseRange(parameterRanges[name] || parameterRanges['Drop Test (%)']);
    };
    const makeStat = (k1: string, k2: string, rmNum: number, name: string) => {
      let entriesWithData = 0;
      let outOfLimit = 0;
      let totalSum = 0;

      rows.forEach(e => {
        const val = parseFloat(e.data[k1] || e.data[k2]);
        if (!isNaN(val) && val > 0) {
          entriesWithData++;
          totalSum += val;
          const rowMin = parseFloat(e.data[`Rm ${rmNum} Min`]);
          const rowMax = parseFloat(e.data[`Rm ${rmNum} Max`]);
          if (!isNaN(rowMin) && !isNaN(rowMax)) {
            if (val < rowMin || val > rowMax) outOfLimit++;
          } else {
            const range = getLimitRange(name);
            if (range && (val < range.min || val > range.max)) outOfLimit++;
          }
        }
      });

      const avgVal = entriesWithData ? (totalSum / entriesWithData).toFixed(1) : '-';
      const efficiency = entriesWithData ? (((entriesWithData - outOfLimit) / entriesWithData) * 100).toFixed(1) : '0.0';
      return { avg: avgVal, count: entriesWithData, outOfLimit, efficiency };
    };
    return {
      rm1: makeStat('rm1_pct', 'Rm 1 %', 1, getRmName('rm1', 'Rm 1') || 'Rm 1 %'),
      rm2: makeStat('rm2_pct', 'Rm 2 %', 2, getRmName('rm2', 'Rm 2') || 'Rm 2 %'),
      rm3: makeStat('rm3_pct', 'Rm 3 %', 3, getRmName('rm3', 'Rm 3') || 'Rm 3 %'),
      rm1Name: getRmName('rm1', 'Rm 1') || 'Rm 1 %',
      rm2Name: getRmName('rm2', 'Rm 2') || 'Rm 2 %',
      rm3Name: getRmName('rm3', 'Rm 3') || 'Rm 3 %',
      count: rows.length
    };
  }, [filteredEntries, parameterRanges]);

  const labAvgStats = useMemo(() => {
    const getParamRange = (label: string) => {
      if (!parameterRanges) return null;
      const keyMap: Record<string, string> = {
        'Al2O3': 'Alumina (%)', 'Fe2O3': 'Iron (%)', 'SiO2': 'Silica (%)',
        'TiO2': 'Titania (%)', 'MgO': 'Magnesia (%)', 'CaO': 'Lime (%)',
        'Loi': 'LOI (%)', 'Moisture': 'Moisture (%)', 'GBM Avg (H1-H8)': 'GBM (%)',
        'Overall Fineness Avg': 'Fineness (%)'
      };
      return parseRange(parameterRanges[keyMap[label] || label]);
    };

    const makeStatInfo = (rows: any[], label: string, deptId: string, ...keys: string[]) => {
      let entriesWithData = 0;
      let outOfLimit = 0;
      let totalSum = 0;
      const nums: number[] = [];

      rows.forEach(e => {
        const val = getNum(e.data, ...keys);
        if (!isNaN(val)) {
          entriesWithData++;
          totalSum += val;
          nums.push(val);

          let rowMin = parseFloat(e.data[`${label} Min`] || e.data[`${label.toLowerCase()} min`]);
          let rowMax = parseFloat(e.data[`${label} Max`] || e.data[`${label.toLowerCase()} max`]);

          if (isNaN(rowMin)) {
            const cleanLabel = label.replace(/2/g, '2').replace(/3/g, '3').replace(/[(%)]/g, '').trim();
            rowMin = parseFloat(e.data[`${cleanLabel} Min`] || e.data[`${cleanLabel.toLowerCase()} min`]);
            rowMax = parseFloat(e.data[`${cleanLabel} Max`] || e.data[`${cleanLabel.toLowerCase()} max`]);
          }

          let activeRange = (!isNaN(rowMin) && !isNaN(rowMax)) ? { min: rowMin, max: rowMax } : getParamRange(label);

          if (!activeRange) {
            const key = label.toLowerCase();
            if (deptId === 'product_house') {
              if (key.includes('al2o3') || key.includes('alumina')) activeRange = { min: 87.5, max: 89 };
              else if (key.includes('fe2o3') || key.includes('iron')) activeRange = { min: 1.6, max: 2 };
              else if (key.includes('sio2')) activeRange = { min: 5, max: 6 };
              else if (key.includes('tio2')) activeRange = { min: 1.35, max: 1.55 };
              else if (key.includes('cao')) activeRange = { min: 0.25, max: 0.4 };
              else if (key.includes('mgo')) activeRange = { min: 0.3, max: 0.4 };
            } else {
              if (key.includes('al2o3') || key.includes('alumina')) activeRange = { min: 82.5, max: 83.5 };
              else if (key.includes('fe2o3') || key.includes('iron')) activeRange = { min: 1.55, max: 1.7 };
              else if (key.includes('tio2')) activeRange = { min: 1.25, max: 1.35 };
              else if (key.includes('loi')) activeRange = { min: 5, max: 6 };
            }
            if (!activeRange) {
              if (key.includes('ap')) activeRange = { min: 0, max: 18.0 };
              if (key.includes('bd')) activeRange = { min: 3.20, max: 5.0 };
            }
          }

          if (activeRange && (val < activeRange.min || val > activeRange.max)) outOfLimit++;
        }
      });

      const efficiency = entriesWithData ? (((entriesWithData - outOfLimit) / entriesWithData) * 100).toFixed(1) : '0.0';
      return { label, avg: avg(nums), count: entriesWithData, outOfLimit, efficiency };
    };

    const dguRows = filteredEntries.filter(e => e.departmentId === 'dgu');
    const ballingRows = filteredEntries.filter(e => e.departmentId === 'balling_disc');
    const phRows = filteredEntries.filter(e => e.departmentId === 'product_house');
    const kilnRows = filteredEntries.filter(e => e.departmentId === 'kiln');

    return {
      dgu: [
        makeStatInfo(dguRows, 'Al2O3', 'dgu', 'Al2O3', 'al2o3'),
        makeStatInfo(dguRows, 'Fe2O3', 'dgu', 'Fe2O3', 'fe2o3'),
        makeStatInfo(dguRows, 'TiO2', 'dgu', 'TiO2', 'tio2'),
        makeStatInfo(dguRows, 'Loi', 'dgu', 'Loi', 'loi')
      ],
      balling: [
        makeStatInfo(ballingRows, 'Al2O3', 'balling_disc', 'Al2O3', 'al2o3'),
        makeStatInfo(ballingRows, 'Fe2O3', 'balling_disc', 'Fe2O3', 'fe2o3'),
        makeStatInfo(ballingRows, 'TiO2', 'balling_disc', 'TiO2', 'tio2'),
        makeStatInfo(ballingRows, 'Loi', 'balling_disc', 'Loi', 'loi')
      ],
      product_house: [
        makeStatInfo(phRows, 'Al2O3', 'product_house', 'Al2O3', 'al2o3'),
        makeStatInfo(phRows, 'Fe2O3', 'product_house', 'Fe2O3', 'fe2o3'),
        makeStatInfo(phRows, 'SiO2', 'product_house', 'SiO2', 'sio2'),
        makeStatInfo(phRows, 'TiO2', 'product_house', 'TiO2', 'tio2'),
        makeStatInfo(phRows, 'CaO', 'product_house', 'CaO', 'cao'),
        makeStatInfo(phRows, 'MgO', 'product_house', 'MgO', 'mgo'),
        makeStatInfo(phRows, 'AP', 'product_house', 'ap', 'AP'),
        makeStatInfo(phRows, 'BD', 'product_house', 'bd', 'BD')
      ],
      kiln: [
        makeStatInfo(kilnRows, 'AP (24h)', 'kiln', 'AP Composite (24hr)', 'AP Composite', 'ap_composite', 'AP'),
        makeStatInfo(kilnRows, 'BD (24h)', 'kiln', 'BD Composite (24hr)', 'BD Composite', 'bd_composite', 'BD'),
        makeStatInfo(kilnRows, 'LBD AP', 'kiln', 'LBD AP Composite (24hr)', 'LBD AP Composite', 'lbd_ap_composite', 'LBD AP'),
        makeStatInfo(kilnRows, 'LBD BD', 'kiln', 'LBD BD Composite (24hr)', 'LBD BD Composite', 'lbd_bd_composite', 'LBD BD')
      ],
    };
  }, [filteredEntries, parameterRanges]);

  const productHouseApBdAvg = useMemo(() => {
    const rows = filteredEntries.filter(e => e.departmentId === 'product_house');
    const getAvg = (k1: string, k2: string, rangeKey: string) => {
      const nums = rows.map(e => parseFloat(e.data[k1] || e.data[k2])).filter(v => !isNaN(v));
      const range = parameterRanges ? parseRange(parameterRanges[rangeKey]) : null;
      let outOfLimit = 0;
      if (range) outOfLimit = nums.filter(v => v < range.min || v > range.max).length;
      return { avg: nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : '-', count: nums.length, outOfLimit, efficiency: nums.length ? (((nums.length - outOfLimit) / nums.length) * 100).toFixed(1) : '0.0' };
    };
    return [
      { label: 'AP Avg', ...getAvg('AP', 'ap', 'AP Composite') },
      { label: 'BD Avg', ...getAvg('BD', 'bd', 'BD Composite') },
    ];
  }, [filteredEntries, parameterRanges]);

  const handleExportExcel = () => {
    if (misReportData.length === 0) return;
    const dataToExport = misReportData.map(item => ({ 'Department': item.name, 'Category': item.category, 'Total Target': item.target, 'Actual (Shift)': item.actual, 'Gap (Pending)': item.gap, 'Efficiency (%)': item.efficiency, 'Status': item.status }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "MIS_Report");
    worksheet["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' }), `MIS_Operational_Report_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
  };

  const handleExportCampaigns = () => {
    if (campaignSummary.length === 0) return;
    const dataToExport = campaignSummary.map(c => ({
      'Campaign ID': c.id,
      'Material Consumption (Input)': Object.entries(c.inputs).map(([k, v]) => `${k} (${Number(v).toFixed(1)} MT)`).join(', '),
      'Total Ground (MT)': c.ground_total,
      'Produced Products (Output)': Object.entries(c.products).map(([k, v]) => `${k} (${Number(v).toFixed(1)} MT)`).join(', '),
      'Status': c.status
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Campaign_Intelligence");
    worksheet["!cols"] = [{ wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 40 }, { wch: 15 }];
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' }), `Campaign_Intelligence_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
  };

  const handleExportComposition = () => {
    if (compositionData.length === 0) return;
    const dataToExport = compositionData.map(row => ({ 'Timestamp': formatDisplayDate(row.timestamp), 'Campaign No.': row.campaign_no || '-', 'Product Name': row.product_name || '-', 'Qty': row.qty || '0', 'LOI (%)': row.loi_pct || '-', 'RM Required (MT)': row.rm_req || '-', 'Al2O3': row.al2o3 || '-', 'Fe2O3': row.fe2o3 || '-', 'SiO2': row.sio2 || '-', 'Total Cost': row.total_cost || row.totalCost || '0.00' }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Composition_Archives");
    worksheet["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }];
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' }), `Composition_Archives_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
  };

  const compositionHeaders = ["Timestamp", "Campaign No.", "Product Name", "Qty", "LOI (%)", "RM Required (MT)", "Al2O3", "Fe2O3", "SiO2", "Total Cost"];

  const filterLabel = dateFilter === 'today' ? 'Today' : dateFilter === '7d' ? 'Last 7 Days' : dateFilter === '30d' ? 'Last 30 Days' : dateFilter === 'custom' ? 'Custom Range' : 'All Time';

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 shadow-xl">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{label}</p>
          <p className="text-white font-black text-lg">{payload[0].value} <span className="text-slate-400 text-xs font-normal">MT</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 space-y-6 pb-32" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif", background: '#f8f9fb' }}>

      {/* -- TOP BAR */}
      <div className="sticky top-0 z-50 bg-[#f8f9fb]/80 backdrop-blur-md -mx-4 md:-mx-6 px-4 md:px-6 py-4 mb-2 border-b border-transparent transition-all duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">Dashboard</h1>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">{filterLabel} • {stats.total} entries</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="bg-transparent text-slate-700 text-xs font-semibold outline-none cursor-pointer pr-1"
              >
                <option value="All">All Campaigns</option>
                {allCampaigns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {selectedProducts.length > 0 && (
              <div className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 px-3 py-2 rounded-xl">
                <Package className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mr-1">Produced:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {selectedProducts.map(p => (
                    <span key={p} className="text-[11px] font-black text-blue-700 bg-blue-100/50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
              {(['today', '7d', '30d', 'all', 'custom'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200",
                    dateFilter === f ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-500 hover:text-indigo-600 hover:bg-slate-50"
                  )}
                >
                  {f === 'today' ? 'Today' : f === '7d' ? 'Week' : f === '30d' ? 'Month' : f === 'custom' ? 'Custom' : 'All'}
                </button>
              ))}
            </div>

            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="bg-transparent text-slate-700 text-xs font-semibold px-2 py-1 outline-none"
                />
                <select
                  value={customDateRange.startShift || 'All'}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, startShift: e.target.value }))}
                  className="bg-transparent text-slate-700 text-xs font-semibold px-1 py-1 outline-none cursor-pointer"
                >
                  <option value="All">All Shifts</option>
                  <option value="Shift A">Shift A</option>
                  <option value="Shift B">Shift B</option>
                  <option value="Shift C">Shift C</option>
                </select>
                <span className="text-slate-300 font-bold">-</span>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="bg-transparent text-slate-700 text-xs font-semibold px-2 py-1 outline-none"
                />
                <select
                  value={customDateRange.endShift || 'All'}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, endShift: e.target.value }))}
                  className="bg-transparent text-slate-700 text-xs font-semibold px-1 py-1 outline-none cursor-pointer"
                >
                  <option value="All">All Shifts</option>
                  <option value="Shift A">Shift A</option>
                  <option value="Shift B">Shift B</option>
                  <option value="Shift C">Shift C</option>
                </select>
                <button
                  onClick={() => setAppliedCustomDateRange(customDateRange)}
                  className="ml-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm"
                >
                  Apply
                </button>
              </div>
            )}

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm shadow-emerald-600/25"
            >
              <Download className="w-3.5 h-3.5" />
              MIS Export
            </button>
          </div>
        </div>
      </div>

      {/* -- ENERGY STATS */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 mb-8 group overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-20 group-hover:opacity-60 transition-all duration-700 z-0" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Production Report</h2>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Production', val: energyStats.totalQty.toFixed(1), unit: 'MT', accent: 'bg-slate-400', text: 'text-slate-800', logic: '' },
              { label: 'Total Fuel', val: energyStats.totalFuel.toFixed(1), unit: 'units', accent: 'bg-amber-500', text: 'text-amber-600', logic: '' },
              { label: 'Total Electric', val: energyStats.totalElec.toFixed(1), unit: 'units', accent: 'bg-yellow-500', text: 'text-yellow-600', logic: '' },
              { label: 'Fuel / MT', val: energyStats.fuelPerMT, unit: 'u/MT', accent: 'bg-orange-500', text: 'text-orange-600', logic: '' },
              { label: 'Electric / MT', val: energyStats.elecPerMT, unit: 'u/MT', accent: 'bg-rose-500', text: 'text-rose-600', logic: '' },
              { label: 'Running Hours', val: String(energyStats.totalHours.toFixed(1)), unit: 'hours', accent: 'bg-indigo-500', text: 'text-indigo-600', logic: '' },
              { label: 'Total Stop Dur.', val: String(energyStats.totalStopDuration), unit: 'hours', accent: 'bg-emerald-500', text: 'text-emerald-600', logic: '' },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:border-slate-200 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex flex-col group">
                <div className={`absolute top-0 left-0 w-full h-1.5 ${card.accent} opacity-80 group-hover:opacity-100 transition-opacity`}></div>
                <div className="flex-1 mt-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">{card.label}</p>
                  <p className={`text-4xl font-black tracking-tighter ${card.text}`}>{card.val}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1.5 uppercase tracking-widest">{card.unit}</p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-50/80">
                  <p className="text-[8px] text-slate-300 uppercase font-black tracking-[0.15em] leading-[1.4] opacity-80">{card.logic}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* -- RM LAB + DROP TEST + FINENESS + BALLING UPDATES + KILN + PRODUCT HOUSE */}
      <div className="flex flex-col gap-6 mb-8">
        {[
          {
            title: 'RM Lab Averages',
            icon: Beaker,
            color: 'purple',
            component: (() => {
              const activeStat = rmLabAvg.find(r => r.rmName === activeRmTab) || rmLabAvg[0];
              if (!activeStat) return null;
              return (
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 flex-wrap mb-4">
                    {rmLabAvg.map((mat) => (
                      <button
                        key={mat.rmName}
                        onClick={() => setActiveRmTab(mat.rmName)}
                        className={`px-3 py-1 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border ${(activeRmTab ? activeRmTab === mat.rmName : rmLabAvg[0].rmName === mat.rmName)
                          ? 'bg-purple-100 text-purple-700 border-purple-200 shadow-sm'
                          : 'bg-slate-50 text-slate-400 border-slate-100'
                          }`}
                      >
                        {mat.rmName}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
                    {[
                      { label: 'Al2O3', val: activeStat.al2o3 }, { label: 'Fe2O3', val: activeStat.fe2o3 },
                      { label: 'SiO2', val: activeStat.sio2 }, { label: 'MgO', val: activeStat.mgo },
                      { label: 'TiO2', val: activeStat.tio2 }, { label: 'CaO', val: activeStat.cao },
                      { label: 'Moisture', val: activeStat.moisture }, { label: 'Loi', val: activeStat.loi },
                    ].map(row => (
                      <div key={row.label} className="bg-slate-50 rounded-2xl p-4 border border-slate-100/50">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{row.label}</p>
                        <p className={`text-lg md:text-xl font-black ${row.val.avg === '-' ? 'text-slate-200' : 'text-purple-700'} tracking-tighter truncate`} title={String(row.val.avg) + '%'}>{row.val.avg}%</p>
                        <div className="mt-2 flex items-center justify-between text-[8px] font-bold">
                          <span className="text-slate-500">{row.val.count} Entries</span>
                          <span className={cn("px-1.5 py-0.5 rounded", row.val.outOfLimit > 0 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600")}>
                            {row.val.outOfLimit} Fail
                          </span>
                        </div>
                        <p className="text-[8px] text-slate-400 mt-1 font-black uppercase tracking-tighter">{row.val.efficiency}% Efficiency</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          },
          {
            title: 'Drop Test Average / Eff',
            icon: Droplets,
            color: 'rose',
            component: (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: dropTestAvg.rm1Name, stat: dropTestAvg.rm1, color: 'text-red-600' },
                  { label: dropTestAvg.rm2Name, stat: dropTestAvg.rm2, color: 'text-orange-600' },
                  { label: dropTestAvg.rm3Name, stat: dropTestAvg.rm3, color: 'text-yellow-600' },
                ].map(row => (
                  <div key={row.label} className="bg-slate-50 rounded-2xl p-5 border border-slate-100/50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{row.label}</p>
                      <p className={`text-2xl font-black ${row.color}`}>{row.stat.avg}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-500 uppercase">{row.stat.count} Entries</p>
                      <p className="text-[10px] font-black text-red-400 uppercase">{row.stat.outOfLimit} Outside Limit</p>
                      <p className="text-[10px] font-black text-emerald-600 uppercase mt-1">{row.stat.efficiency}% Eff.</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          },
          {
            title: 'DGU Average / Eff',
            icon: Zap,
            color: 'emerald',
            component: (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Overall Fineness', data: dguDetailedAvg.fineness, unit: '%' },
                  { label: 'Al2O3', data: dguDetailedAvg.al2o3, unit: '%' },
                  { label: 'Fe2O3', data: dguDetailedAvg.fe2o3, unit: '%' },
                  { label: 'TiO2', data: dguDetailedAvg.tio2, unit: '%' },
                  { label: 'Loi', data: dguDetailedAvg.loi, unit: '%' },
                ].map((item) => (
                  <div key={item.label} className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-5 hover:border-emerald-200 transition-all">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">{item.label}</p>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className={`text-3xl font-black tracking-tight ${item.data.avg === '-' ? 'text-slate-300' : 'text-emerald-700'}`}>
                        {item.data.avg}
                      </span>
                      <span className="text-xs font-bold text-slate-400 capitalize">{item.unit}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Total</p>
                        <p className="text-[10px] font-bold text-slate-700">{item.data.count}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-red-400 uppercase tracking-tighter">Fail</p>
                        <p className="text-[10px] font-bold text-red-600">{item.data.outOfLimit}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">Eff.</p>
                        <p className="text-[10px] font-bold text-emerald-700">{item.data.efficiency}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          },
          {
            title: 'Balling Disc Average / Eff',
            icon: Activity,
            color: 'cyan',
            component: (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { label: 'AL2O3', data: ballingUpdatesAvg.al2o3, unit: '%' },
                  { label: 'FE2O3', data: ballingUpdatesAvg.fe2o3, unit: '%' },
                  { label: 'TIO2', data: ballingUpdatesAvg.tio2, unit: '%' },
                  { label: 'LOI', data: ballingUpdatesAvg.loi, unit: '%' },
                  { label: 'GBM AVG (H1-H8)', data: ballingUpdatesAvg.gbm, unit: '%' },
                  { label: 'DROP TESTING AVG', data: ballingUpdatesAvg.drop, unit: '' },
                ].map((item) => (
                  <div key={item.label} className="bg-cyan-50/50 border border-cyan-100/50 rounded-2xl p-5 hover:border-cyan-200 transition-all group">
                    <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest mb-3 group-hover:text-cyan-700 transition-colors">{item.label}</p>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className={`text-3xl font-black tracking-tight ${item.data.avg === '-' ? 'text-slate-300' : 'text-cyan-900'}`}>
                        {item.data.avg}
                      </span>
                      <span className="text-xs font-bold text-slate-400 capitalize">{item.unit}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Total</p>
                        <p className="text-[10px] font-bold text-slate-700">{item.data.count}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-rose-400 uppercase tracking-tighter">Fail</p>
                        <p className="text-[10px] font-bold text-rose-600">{item.data.outOfLimit}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">Eff.</p>
                        <p className="text-[10px] font-bold text-emerald-700">{item.data.efficiency}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          },
          {
            title: 'Kiln Average / Eff',
            icon: Flame,
            color: 'orange',
            component: (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {labAvgStats.kiln.map((row) => (
                  <div key={row.label} className="bg-orange-50/50 border border-orange-100/50 rounded-2xl p-5 hover:border-orange-200 transition-all">
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3">{row.label}</p>
                    <div className="flex items-baseline gap-2 mb-4 justify-center">
                      <span className={`text-3xl font-black tracking-tight ${row.avg === '-' ? 'text-slate-300' : 'text-orange-700'}`}>
                        {row.avg}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Total</p>
                        <p className="text-[10px] font-bold text-slate-700">{row.count}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-orange-400 uppercase tracking-tighter">Out</p>
                        <p className="text-[10px] font-bold text-orange-600">{row.outOfLimit}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">Eff.</p>
                        <p className="text-[10px] font-bold text-emerald-700">{row.efficiency}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          },
          {
            title: 'Product House Average / Eff',
            icon: Package,
            color: 'indigo',
            component: (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
                {labAvgStats.product_house.map((row) => (
                  <div key={row.label} className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-5 hover:border-indigo-200 transition-all">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">{row.label}</p>
                    <div className="flex items-baseline gap-2 mb-4 justify-center">
                      <span className={`text-3xl font-black tracking-tight ${row.avg === '-' ? 'text-slate-300' : 'text-indigo-700'}`}>
                        {row.avg}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Total</p>
                        <p className="text-[10px] font-bold text-slate-700">{row.count}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Fail</p>
                        <p className="text-[10px] font-bold text-indigo-600">{row.outOfLimit}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">Eff.</p>
                        <p className="text-[10px] font-bold text-emerald-700">{row.efficiency}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        ].map((section, idx) => (
          <div key={idx} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 group transition-all hover:shadow-xl">
            <div className="flex items-center gap-4 mb-8">
              <div className={`w-12 h-12 bg-${section.color}-50 rounded-2xl flex items-center justify-center shadow-sm`}>
                <section.icon className={`w-6 h-6 text-${section.color}-600`} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{section.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full bg-${section.color}-500 animate-pulse`} />
                </div>
              </div>
            </div>
            {section.component}
          </div>
        ))}
      </div>

      {/* -- PRODUCTION ACCOUNTING */}
      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden mb-8">
        <div className="px-5 sm:px-7 py-5 bg-gradient-to-r from-indigo-50 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100">
          <div>
            <h2 className="text-xl font-black text-indigo-900 tracking-tight">Consumption Report</h2>
          </div>
          <span className="text-[10px] text-indigo-600 font-bold bg-white border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm self-start sm:self-auto">{filterLabel}</span>
        </div>

        <div className="p-4 sm:p-6 overflow-x-auto">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-[600px] lg:min-w-0">
            {[
              { step: 1, label: 'SB3 Hopper', sub: 'Used for Production', val: accountingSummary.totalInput.toFixed(1), unit: 'MT Used', accent: 'border-blue-200 bg-blue-50', num: 'bg-blue-500', text: 'text-blue-700', cap: 'text-blue-500', logic: accountingSummary.consumptionLogic },
              { step: 2, label: 'Production', sub: 'Actual Output', val: accountingSummary.totalProduction.toFixed(1), unit: 'MT Output', accent: 'border-emerald-200 bg-emerald-50', num: 'bg-emerald-500', text: 'text-emerald-700', cap: 'text-emerald-500', logic: `Sum of all finished product (${productStats.count} entries)` },
              { step: 3, label: 'Spillage', sub: 'All Sources', val: accountingSummary.totalSpillage.toFixed(1), unit: 'MT Spillage', accent: 'border-red-200 bg-red-50', num: 'bg-red-500', text: 'text-red-700', cap: 'text-red-500', logic: `Sum of all spillage streams (${spillageStats.count} entries)` },
              { step: 4, label: 'PPT Recycle', sub: 'Spillage Re-feeded', val: accountingSummary.totalPPT.toFixed(1), unit: 'MT Recycled', accent: 'border-purple-200 bg-purple-50', num: 'bg-purple-500', text: 'text-purple-700', cap: 'text-purple-500', logic: `Sum of recycled spillage (${pptStats.count} entries)` },
            ].map((node, i, arr) => (
              <div key={node.step} className="relative">
                <div className={`border-2 ${node.accent} rounded-2xl p-4 text-center`}>
                  <div className={`w-7 h-7 ${node.num} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                    <span className="text-white text-[10px] font-black">{node.step}</span>
                  </div>
                  <p className={`text-[9px] font-black uppercase tracking-wider ${node.cap} mb-0.5`}>{node.label}</p>
                  <p className="text-[9px] text-slate-400 mb-2">{node.sub}</p>
                  <p className={`text-xl font-black ${node.text} tracking-tight`}>{node.val}</p>
                  <p className="text-[9px] text-slate-400 font-bold">{node.unit}</p>
                  <p className="text-[8px] text-slate-500 italic font-medium mt-1">Logic: {node.logic}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="absolute right-0 top-1/2 translate-x-[60%] -translate-y-1/2 text-slate-300 font-black text-lg z-10 select-none">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="rounded-2xl border border-indigo-100 overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0 min-w-[600px] bg-white">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-4 sm:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pl-4 sm:pl-6">Actual</th>
                  <th className="px-4 sm:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100">Qty (MT)</th>
                  <th className="px-4 sm:px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100 pr-4 sm:pr-6">%</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {[
                  { label: 'Total Input (RM Used for Prod.)', qty: accountingSummary.totalInput.toFixed(1), pct: '100%', color: 'text-blue-700', dot: 'bg-blue-500', sign: '', bg: 'bg-blue-50/20', logic: accountingSummary.consumptionLogic },
                  { label: `LOI (${accountingSummary.avgLOI.toFixed(2)}%)`, qty: accountingSummary.loiLossMT.toFixed(1), pct: `${accountingSummary.totalInput > 0 ? ((accountingSummary.loiLossMT / accountingSummary.totalInput) * 100).toFixed(1) : '0'}%`, color: 'text-zinc-600', dot: 'bg-zinc-400', sign: '- ', bg: '', logic: 'From Composition Records LOI (%) x Total Input' },
                  { label: 'Balance ', qty: accountingSummary.balance1.toFixed(1), pct: '', color: 'text-slate-500', dot: 'bg-slate-300', sign: '= ', bg: 'bg-slate-50/50', logic: 'Input - LOI' },
                  { label: 'Net Operational Spillage (Spillage - PPT)', qty: accountingSummary.netSpillage.toFixed(1), pct: `${accountingSummary.balance2 > 0 ? ((accountingSummary.netSpillage / accountingSummary.balance2) * 100).toFixed(1) : '0'}%`, color: 'text-rose-700', dot: 'bg-rose-500', sign: '- ', bg: '', logic: `Accounted Spillage (${accountingSummary.totalSpillage.toFixed(1)}) - Recycled (${accountingSummary.totalPPT.toFixed(1)})` },
                  { label: 'Balance (Operational)', qty: accountingSummary.balance3.toFixed(1), pct: '', color: 'text-slate-500', dot: 'bg-slate-300', sign: '= ', bg: 'bg-slate-50/50', logic: 'Prev Balance - Net Spillage' },
                  { label: 'In-Process Material (Campaign Closing)', qty: accountingSummary.wipStatsOutput.toFixed(1), pct: `${accountingSummary.balance3 > 0 ? ((accountingSummary.wipStatsOutput / accountingSummary.balance3) * 100).toFixed(1) : '0'}%`, color: 'text-amber-700', dot: 'bg-amber-500', sign: '- ', bg: '', logic: wipStats.logicStr },
                  { label: 'Theoretical Production (Final Balance)', qty: accountingSummary.balance4.toFixed(1), pct: '', color: 'text-slate-800', dot: 'bg-slate-600', sign: '= ', bg: 'bg-slate-100 border-t border-slate-200', logic: 'Final calculated target based on process and chemical losses' },
                  { label: 'Actual Production (Output)', qty: accountingSummary.totalProduction.toFixed(1), pct: `${accountingSummary.balance4 > 0 ? ((accountingSummary.totalProduction / accountingSummary.balance4) * 100).toFixed(1) : '0'}%`, color: 'text-emerald-700', dot: 'bg-emerald-500', sign: '- ', bg: '', logic: 'Actual output weighed by production site' },
                  { label: 'Difference Qty (Actual vs Theoretical)', qty: Math.abs(accountingSummary.differenceQty).toFixed(1), pct: '-', color: accountingSummary.differenceQty > 0 ? 'text-rose-700' : 'text-emerald-700', dot: accountingSummary.differenceQty > 0 ? 'bg-rose-500' : 'bg-emerald-500', sign: accountingSummary.differenceQty > 0 ? '+ ' : '- ', bg: accountingSummary.differenceQty > 0 ? 'bg-rose-50/30' : 'bg-emerald-50/30', logic: 'Variance = Theoretical Target - Actual Production' },
                ].map((row, i) => (
                  <tr key={i} className={`group hover:bg-slate-50/60 transition-colors ${row.bg}`}>
                    <td className={`px-4 sm:px-6 py-4 text-xs font-bold ${row.color} border-b border-slate-50 group-last:border-0 pl-4 sm:pl-6`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${row.dot} flex-shrink-0 shadow-sm`} />
                        <div>
                          <span className="text-[13px] whitespace-normal sm:whitespace-nowrap">{row.label}</span>
                          <p className="text-[9px] text-slate-400 italic font-medium mt-0.5 group-hover:text-slate-500 transition-colors whitespace-normal">Logic: {row.logic}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-[15px] font-black text-slate-900 text-right border-b border-slate-50 group-last:border-0 whitespace-nowrap">{row.sign}{row.qty}</td>
                    <td className="px-4 sm:px-6 py-4 text-xs font-bold text-slate-500 text-right border-b border-slate-50 group-last:border-0 pr-4 sm:pr-6 whitespace-nowrap">{row.pct}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-50">
                  <td className="px-4 sm:px-6 py-5 text-[12px] font-black text-emerald-900 uppercase tracking-widest border-t border-emerald-200 pl-4 sm:pl-6">Plant Efficiency</td>
                  <td className="px-4 sm:px-6 py-5 text-2xl font-black text-emerald-800 text-right border-t border-emerald-200">{accountingSummary.totalProduction.toFixed(1)} MT</td>
                  <td className="px-4 sm:px-6 py-5 text-xs font-black text-emerald-600 text-right border-t border-emerald-200 pr-4 sm:pr-6">{accountingSummary.totalHopper > 0 ? ((accountingSummary.totalProduction / accountingSummary.totalHopper) * 100).toFixed(1) : '0'}% true yield</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* -- MATERIAL INTELLIGENCE */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5 mb-8">
        {/* SB3 Ground */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Material Total Input</p>
              <h3 className="text-sm font-black text-slate-900 mt-0.5">SB3 Ground</h3>
              <p className="text-[9px] text-slate-500 italic font-medium mt-1">Logic: Input minus hopper usage</p>
            </div>
            <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-orange-500" />
            </div>
          </div>
          {materialStats.totals.length === 0 ? (
            <p className="text-center text-xs text-slate-300 italic py-8">No ground data</p>
          ) : (
            <div className="space-y-5">
              {materialStats.totals.map(([name, qty]) => {
                const pct = Math.round((qty / materialStats.totals[0][1]) * 100);
                const hopperQty = (hopperStats.totals.find(h => h[0] === name) || [])[1] || 0;
                const stock = qty - hopperQty;
                return (
                  <div key={name}>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-800 font-black truncate max-w-[140px] uppercase text-[10px] tracking-wider">{name}</span>
                      <span className="text-orange-600 font-black text-[11px]">{qty.toFixed(1)} MT In</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] mb-2 pl-2 border-l-2 border-slate-100">
                      <span className="text-slate-500 font-bold">
                        <span className="text-red-400 mr-1">↓</span>To Hopper: {hopperQty.toFixed(1)} MT
                      </span>
                      <span className="text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/50 shadow-sm">
                        Stock: {stock.toFixed(1)} MT
                      </span>
                    </div>
                    <ProgressBar pct={pct} color="bg-orange-400" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SB3 Hopper */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Raw Material Hopper</p>
              <h3 className="text-sm font-black text-slate-900 mt-0.5">SB3 Hopper</h3>
              <p className="text-[9px] text-slate-500 italic font-medium mt-1">Logic: Sum of RM fed to hopper</p>
            </div>
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <Box className="w-3.5 h-3.5 text-blue-500" />
            </div>
          </div>
          {hopperStats.totals.length === 0 ? (
            <p className="text-center text-xs text-slate-300 italic py-8">No hopper data</p>
          ) : (
            <div className="space-y-4">
              {hopperStats.totals.map(([name, qty]) => {
                const pct = Math.round((qty / hopperStats.totals[0][1]) * 100);
                return (
                  <div key={name}>
                    <div className="flex justify-between text-[10px] tracking-wider uppercase font-semibold mb-1.5">
                      <span className="text-slate-800 font-black truncate max-w-[140px]">{name}</span>
                      <span className="text-blue-600 font-black text-[11px]">{qty.toFixed(1)} MT</span>
                    </div>
                    <ProgressBar pct={pct} color="bg-blue-400" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Product Output */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Actual Production</p>
              <h3 className="text-sm font-black text-slate-900 mt-0.5">Product Output</h3>
              <p className="text-[9px] text-slate-500 italic font-medium mt-1">Logic: Sum of all finished product</p>
            </div>
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            </div>
          </div>
          {productStats.totals.length === 0 ? (
            <p className="text-center text-xs text-slate-300 italic py-8">No production data</p>
          ) : (
            <div className="space-y-4">
              {productStats.totals.map(([name, qty]) => {
                const pct = Math.round((qty / productStats.totals[0][1]) * 100);
                return (
                  <div key={name}>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-600 truncate max-w-[140px]">{name}</span>
                      <span className="text-emerald-600 font-black text-[11px]">{qty.toFixed(1)} MT</span>
                    </div>
                    <ProgressBar pct={pct} color="bg-emerald-500" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PPT Re-feed */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{pptStats.count} entries</p>
              <h3 className="text-sm font-black text-slate-900 mt-0.5">PPT (Re-feed)</h3>
              <p className="text-[9px] text-slate-500 italic font-medium mt-1">Logic: Sum of Ispileg re-feeded qty</p>
            </div>
            <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
              <RotateCw className="w-3.5 h-3.5 text-indigo-500" />
            </div>
          </div>
          {pptStats.count === 0 ? (
            <p className="text-center text-xs text-slate-300 italic py-8">No PPT data</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-indigo-50/50 border border-indigo-100 p-4">
                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">Total Ispileg</p>
                <p className="text-2xl font-black text-indigo-700 tracking-tight">{pptStats.totalQty.toFixed(1)}</p>
                <p className="text-[9px] text-indigo-400 font-bold mt-0.5">Total MT</p>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Re-feed Ratio</span>
                <span className="text-sm font-black text-slate-900">
                  {accountingSummary.totalProduction > 0 ? ((pptStats.totalQty / accountingSummary.totalProduction) * 100).toFixed(1) : '0.0'} %
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Spillage */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">{spillageStats.count} entries</p>
              <h3 className="text-sm font-black text-slate-900 mt-0.5">Spillage</h3>
              <p className="text-[9px] text-slate-500 italic font-medium mt-1">Logic: Sum of all spillage streams</p>
            </div>
            <div className="w-7 h-7 bg-rose-50 rounded-lg flex items-center justify-center">
              <Droplets className="w-3.5 h-3.5 text-rose-500" />
            </div>
          </div>
          {spillageStats.count === 0 ? (
            <p className="text-center text-xs text-slate-300 italic py-8">No spillage data</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Hot Screen</p>
                <p className="text-2xl font-black text-amber-700 tracking-tight">{spillageStats.hotScreen.toFixed(1)}</p>
                <p className="text-[9px] text-amber-400 font-bold mt-0.5">Total MT</p>
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-4">
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Multi Cyclone</p>
                <p className="text-2xl font-black text-rose-700 tracking-tight">{spillageStats.multiCyclone.toFixed(1)}</p>
                <p className="text-[9px] text-rose-400 font-bold mt-0.5">Total MT</p>
              </div>
              <div className="rounded-xl bg-orange-50 border border-orange-100 p-4">
                <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">House Keeping</p>
                <p className="text-2xl font-black text-orange-700 tracking-tight">{spillageStats.houseKeeping.toFixed(1)}</p>
                <p className="text-[9px] text-orange-400 font-bold mt-0.5">Total MT</p>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Road Side</p>
                <p className="text-2xl font-black text-blue-700 tracking-tight">{spillageStats.roadSide.toFixed(1)}</p>
                <p className="text-[9px] text-blue-400 font-bold mt-0.5">Total MT</p>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Spillage</span>
                <span className="text-sm font-black text-slate-900">{spillageStats.total.toFixed(1)} MT</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* -- MATERIAL CONSUMPTION ANALYSIS */}
      <div className="bg-white rounded-[2rem] border border-blue-100 shadow-sm overflow-hidden mb-8">
        <div className="bg-gradient-to-r from-blue-50 to-white border-b border-blue-100 px-8 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center border border-blue-200">
              <PieChartIcon className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-blue-950 uppercase tracking-widest">RM Consumption per 1 MT Production</h3>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[9px] font-black text-blue-500 uppercase tracking-wider">Total Output</p>
            <p className="text-base font-black text-blue-900 leading-none">{accountingSummary.totalProduction.toFixed(1)} <span className="text-[9px] text-blue-400 ml-0.5">MT</span></p>
          </div>
        </div>

        <div className="p-8">
          {consumptionStats.length === 0 ? (
            <div className="py-12 text-center text-slate-300 text-sm italic">
              Awaiting production data for analysis...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {consumptionStats.map((item, idx) => (
                <div key={idx} className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 group hover:border-blue-200 transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{item.name}</span>
                      <h4 className="text-2xl font-black text-slate-900 tracking-tight">{item.consumption} <span className="text-[10px] text-blue-500 uppercase">MT</span></h4>
                    </div>
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 group-hover:bg-blue-600 transition-colors duration-300">
                      <Activity className="w-3.5 h-3.5 text-blue-500 group-hover:text-white" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <ProgressBar pct={Math.min(parseFloat(item.consumption) * 100, 100)} color="bg-blue-500" />
                    <div className="flex items-center justify-between">
                      <p className="text-[8px] font-bold text-slate-400 uppercase">Ratio per 1 MT</p>
                      <p className="text-[10px] font-black text-slate-900">Total: {item.totalUsed} MT</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* -- PRODUCTION COST ANALYSIS */}
      <div className="bg-white rounded-[2rem] border border-emerald-100 shadow-sm overflow-hidden mb-8">
        <div className="bg-gradient-to-r from-emerald-50 to-white border-b border-emerald-100 px-8 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center border border-emerald-200">
              <Database className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-emerald-950 uppercase tracking-widest leading-none mb-1">Production Cost Analysis</h3>
              <p className="text-[9px] text-emerald-600/70 font-medium italic">Logic: (Sum of Hopper RM Usage Material Rate) / Total Output</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5">Raw Material Cost / MT</p>
            <p className="text-2xl font-black text-emerald-900 leading-none tracking-tight">
              <span className="text-[16px] text-emerald-600 mr-0.5"></span>{productionCost.costPerMt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 bg-emerald-50/50 rounded-3xl p-8 border border-emerald-100 flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 transform translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-500">
                <div className="w-20 h-20 bg-emerald-500/5 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-10 h-10 text-emerald-500/20" />
                </div>
              </div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-2">Total Production Cost (RM)</p>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
                {productionCost.totalRmCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-lg border border-emerald-100 shadow-sm">
                  {accountingSummary.totalProduction.toFixed(1)} MT Total Output
                </span>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-3">
              <div className="grid grid-cols-4 gap-4 px-6 mb-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Material</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Usage (MT)</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Rate ()</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Subtotal ()</span>
              </div>
              {productionCost.breakdown.map((item, idx) => (
                <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between hover:shadow-md hover:border-emerald-200 transition-all duration-300">
                  <div className="grid grid-cols-4 gap-4 w-full items-center">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wider">{item.name}</span>
                    <span className="text-sm font-bold text-slate-600 text-right">{item.qty.toFixed(1)}</span>
                    <span className="text-[11px] font-bold text-slate-400 text-right"> {item.rate.toLocaleString('en-IN')}</span>
                    <span className="text-sm font-black text-emerald-700 text-right"> {item.cost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              ))}
              {productionCost.breakdown.length === 0 && (
                <div className="h-40 flex items-center justify-center text-slate-300 italic text-sm border-2 border-dashed border-slate-100 rounded-3xl">
                  Awaiting material consumption data...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* -- KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: 'Total Activity',
            value: stats.total,
            suffix: ' entries',
            icon: Layers,
            color: 'blue',
            trend: 'Active',
            trendColor: 'text-blue-500',
            sub: 'Total department records',
            sparkData: [45, 52, 48, 61, 55, 67, stats.total].slice(-7)
          },
          {
            label: 'Avg Al2O3 Purity',
            value: qualityStats.avgAl2O3,
            suffix: '%',
            icon: Zap,
            color: 'violet',
            trend: trend.al2o3 ? `${parseFloat(trend.al2o3 as string) > 0 ? '↑' : '↓'} ${Math.abs(parseFloat(trend.al2o3 as string))}%` : 'Stable',
            trendColor: parseFloat((trend.al2o3 as string) || '0') > 0 ? 'text-emerald-500' : 'text-rose-500',
            sub: 'Main chemical constraint',
            sparkData: [81.2, 81.4, 81.3, 81.6, 81.5, parseFloat(qualityStats.avgAl2O3)].slice(-7)
          },
          {
            label: 'Active Campaigns',
            value: masterData.campaigns.length,
            suffix: '',
            icon: Activity,
            color: 'amber',
            trend: 'Live',
            trendColor: 'text-amber-500',
            sub: 'Ongoing production lots',
            sparkData: [1, 2, 1, 1, 2, 1].slice(-7)
          },
          {
            label: 'Material Ground',
            value: accountingSummary.totalGround.toFixed(0),
            suffix: ' MT',
            icon: Database,
            color: 'orange',
            trend: trend.ground ? `${parseFloat(trend.ground as string) > 0 ? '↑' : '↓'} ${Math.abs(parseFloat(trend.ground as string))}%` : 'Record',
            trendColor: parseFloat((trend.ground as string) || '0') > 0 ? 'text-emerald-500' : 'text-rose-500',
            sub: 'Raw material processed',
            sparkData: [2100, 2400, 2800, parseFloat(accountingSummary.totalGround.toFixed(0))].slice(-7)
          }
        ].map((kpi, idx) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="group relative bg-white border border-slate-100/80 rounded-[2.5rem] p-7 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all duration-500 overflow-hidden"
          >
            {/* Background Glow */}
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-12 -mt-12 rounded-full opacity-[0.03] group-hover:scale-[2.5] transition-all duration-1000 bg-${kpi.color}-500`} />

            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-${kpi.color}-50 text-${kpi.color}-600 group-hover:bg-${kpi.color}-600 group-hover:text-white transition-all duration-500 shadow-sm`}>
                <kpi.icon className="w-6 h-6" />
              </div>
              <div className="flex flex-col items-end">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full bg-slate-50 ${kpi.trendColor} uppercase tracking-widest border border-slate-100/50`}>
                  {kpi.trend}
                </span>
                <div className="w-16 mt-3 opacity-30 group-hover:opacity-100 transition-opacity duration-700">
                  <Sparkline data={kpi.sparkData} color={kpi.trendColor.includes('emerald') ? '#10b981' : kpi.trendColor.includes('amber') ? '#f59e0b' : '#6366f1'} />
                </div>
              </div>
            </div>

            <div className="relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{kpi.label}</p>
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter leading-none tabular-nums flex items-baseline gap-1">
                {kpi.value}
                <span className="text-base text-slate-400 font-bold tracking-tight">{kpi.suffix}</span>
              </h3>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-50 relative z-10">
              <p className="text-[10px] text-slate-400 font-bold flex items-center gap-2 italic">
                <span className={`w-1.5 h-1.5 rounded-full bg-${kpi.color}-500 ${kpi.trend === 'Live' ? 'animate-ping' : ''}`} />
                {kpi.sub}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* -- PERFORMANCE INSIGHTS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Yield Performance (Donut Chart) */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 flex flex-col items-center justify-center relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
          <div className="absolute top-6 left-8 text-center sm:text-left">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Process Yield</p>
            <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">Yield Efficiency</h3>
          </div>
          <div className="w-full h-52 mt-8 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Net Output', value: accountingSummary.netOutput, color: '#4f46e5' },
                    { name: 'Variance', value: Math.max(0, accountingSummary.totalGround - accountingSummary.netOutput), color: '#f8fafc' }
                  ]}
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  startAngle={90}
                  endAngle={450}
                >
                  <Cell fill="#4f46e5" />
                  <Cell fill="#f1f5f9" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center mt-3">
              <p className="text-4xl font-black text-slate-900 tracking-tighter">
                {accountingSummary.totalGround > 0 ? ((accountingSummary.netOutput / accountingSummary.totalGround) * 100).toFixed(0) : '0'}%
              </p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Efficiency</p>
            </div>
          </div>
        </div>

        {/* Plant Health Summary */}
        <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 grid grid-cols-1 md:grid-cols-3 gap-10 hover:shadow-2xl transition-all duration-500 relative">
          <div className="space-y-6 relative overflow-hidden">
            {/* Animated Glow Dot */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-11 h-11 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-ping" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Production Pulse</p>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Plant Status: Optimal</h3>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold uppercase tracking-wider">{dateFilter === 'today' ? 'Daily' : 'Period'} Target</span>
                <span className="font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 leading-none">{accountingSummary.progressPct}% met</span>
              </div>
              <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${accountingSummary.progressPct}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-[11px] font-black text-slate-900 leading-none">{accountingSummary.dailyAvg} MT</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight"></span>
              </div>
            </div>
          </div>

          <div className="space-y-6 md:border-l md:border-slate-50 md:pl-10">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-orange-50 rounded-2xl flex items-center justify-center border border-orange-100">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Efficiency Metrics</p>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Resource Utilization</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-orange-50/20 rounded-2xl border border-orange-100/50">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Fuel / MT</p>
                <p className="text-2xl font-black text-slate-900 leading-none">{energyStats.fuelPerMT}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">U/MT</p>
              </div>
              <div className="p-4 bg-rose-50/20 rounded-2xl border border-rose-100/50">
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Elec. / MT</p>
                <p className="text-2xl font-black text-slate-900 leading-none">{energyStats.elecPerMT}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">U/MT</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 md:border-l md:border-slate-50 md:pl-10">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-violet-50 rounded-2xl flex items-center justify-center border border-violet-100">
                <Beaker className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Quality Audit</p>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Compliance Summary</h3>
              </div>
            </div>
            <div className="space-y-4 pt-2">
              {[
                { label: 'Critical Alumina', status: 'High' },
                { label: 'Fe2O3 Impurities', status: 'Moderate' },
                { label: 'Fineness Target', status: 'Active' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-semibold">{item.label}</span>
                  <StatusBadge status={item.status as any} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* -- COMPOSITION ARCHIVES */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <FileSpreadsheet className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historical Data</p>
              <h3 className="text-base font-black text-slate-900">Composition Archives</h3>
              <p className="text-[9px] text-slate-400 font-bold italic mt-1">Logic: Filtered historical records from all facility departments</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={compositionSearch}
                onChange={e => setCompositionSearch(e.target.value)}
                placeholder="Search by campaign or product..."
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none w-52 transition-all"
              />
            </div>
            <button
              onClick={handleExportComposition}
              className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-600 text-[11px] font-bold uppercase tracking-wider rounded-xl hover:bg-violet-100 border border-violet-100 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl hover:bg-slate-700 transition-all">
              <RefreshCw className="w-3 h-3" />
              Sync
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent rounded-b-xl border-t border-slate-100">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-white sticky top-0 z-20 shadow-sm">
                {compositionHeaders.map((header, idx) => (
                  <th key={idx} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap border-b border-slate-100/80 bg-slate-50">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredCompositionData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-20 text-center text-slate-400 text-sm font-semibold italic">No historical data found</td>
                </tr>
              ) : (
                filteredCompositionData.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-[13px] font-bold text-slate-600 border-b border-slate-100/50 group-last:border-0">{formatDisplayDate(row.timestamp)}</td>
                    <td className="px-6 py-4 whitespace-nowrap border-b border-slate-100/50 group-last:border-0">
                      <span className="text-[11px] font-black text-orange-600 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-lg">{row.campaign_no || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[13px] font-bold text-slate-700 border-b border-slate-100/50 group-last:border-0">{row.product_name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-[14px] font-black text-slate-900 border-b border-slate-100/50 group-last:border-0">{row.qty || '0'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500 border-b border-slate-100/50 group-last:border-0">{row.loi_pct || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-[13px] font-bold text-slate-700 border-b border-slate-100/50 group-last:border-0">{row.rm_req || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-[13px] font-black text-blue-600 border-b border-slate-100/50 group-last:border-0">{row.al2o3 || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-600 border-b border-slate-100/50 group-last:border-0">{row.fe2o3 || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-600 border-b border-slate-100/50 group-last:border-0">{row.sio2 || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap border-b border-slate-100/50 group-last:border-0">
                      <span className="text-[11px] font-black bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-700">${row.total_cost || row.totalCost || '0.00'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-slate-50/40 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400">Active Sync</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-slate-400">Data Verified</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold">
            {filteredCompositionData.length > 50 ? `Showing latest 50 of ${filteredCompositionData.length}` : `${filteredCompositionData.length} records shown`}
          </p>
        </div>
      </div>

    </div>
  );
}
