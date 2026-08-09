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
import { cn, getDepartmentAverage, parseRange } from '../lib/utils';
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
    Active: 'bg-brand-50 text-brand-700 border-brand-100',
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
  masterData: any;
  parameterRanges?: Record<string, string>;
}


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
      if (rangeKey === 'Fineness') activeRange = { min: 95, max: 1000 };
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

// Matches the default QC bands baked into DepartmentView's live cell coloring, so the
// Dashboard's fail-count agrees with what the actual entry table shows when nobody has
// configured a custom limit via "Configure Limits" for this parameter yet.
const CHEM_DEFAULT_RANGES: Record<string, { min: number; max: number }> = {
  'Alumina (%)': { min: 82.5, max: 83.5 },
  'Iron (%)': { min: 1.55, max: 1.7 },
  'Titania (%)': { min: 1.25, max: 1.35 },
  'LOI (%)': { min: 5, max: 6 },
};

const makeChemStat = (rows: any[], keys: string[], rangeKey: string, parameterRanges: Record<string, string>) => {
  let nums: number[] = [];
  let outOfLimit = 0;
  // Configured limits are saved under the plain chemical symbol (e.g. "Al2O3"), not the
  // descriptive rangeKey (e.g. "Alumina (%)") — check both, then fall back to the same
  // default band the entry table uses.
  const range = parseRange(parameterRanges[rangeKey] || parameterRanges[keys[0]] || '', rangeKey)
    || CHEM_DEFAULT_RANGES[rangeKey]
    || null;
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
  // Fallback: case/whitespace-insensitive match, since rows added locally (field names,
  // e.g. "al2o3") and rows synced from the sheet (column headers, e.g. "Al2O3") don't always
  // share identical casing, and hand-edited sheet headers can carry stray whitespace.
  const dataKeys = Object.keys(d);
  for (const k of keys) {
    const target = k.toLowerCase().trim();
    const found = dataKeys.find(dk => dk.toLowerCase().trim() === target);
    if (found) {
      const v = parseFloat(d[found]);
      if (!isNaN(v)) return v;
    }
  }
  return NaN;
};

export default function Dashboard({ entries, compositionData, onSelect, masterData, parameterRanges = {} }: Props) {
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | 'all' | 'custom'>('today');
  const [customDateRange, setCustomDateRange] = useState({ start: '', startShift: 'All', end: '', endShift: 'All' });
  const [appliedCustomDateRange, setAppliedCustomDateRange] = useState({ start: '', startShift: 'All', end: '', endShift: 'All' });
  const [activeRmTab, setActiveRmTab] = useState<string>('');
  const [campaignFilter, setCampaignFilter] = useState<string>('All');
  const [productFilter, setProductFilter] = useState<string>('All');
  const [compositionSearch, setCompositionSearch] = useState('');

  const allCampaigns = useMemo(() => {
    const caps = new Set<string>();
    entries.forEach(entry => {
      const c = entry.data.campaign_no || entry.data.campaign || entry.data['Campaign No.'] || entry.data['Campaign'];
      if (c) caps.add(String(c).trim());
    });
    return Array.from(caps).sort();
  }, [entries]);

  const allProducts = useMemo(() => {
    const prods = new Set<string>();
    entries.forEach(entry => {
      const p = entry.data.product_name || entry.data['Product Name'] || entry.data.product || entry.data.Product;
      if (p) prods.add(String(p).trim());
    });
    return Array.from(prods).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (campaignFilter !== 'All') {
      result = result.filter(entry => {
        const campaign = entry.data.campaign_no || entry.data.campaign || entry.data['Campaign No.'] || entry.data['Campaign'];
        return String(campaign).trim() === String(campaignFilter).trim();
      });
    }
    if (productFilter !== 'All') {
      result = result.filter(entry => {
        const p = entry.data.product_name || entry.data['Product Name'] || entry.data.product || entry.data.Product;
        return String(p).trim() === String(productFilter).trim();
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
            const hasStart = !!appliedCustomDateRange.start;
            const hasEnd = !!appliedCustomDateRange.end;
            if (!hasStart && !hasEnd) return true;

            const startD = hasStart ? startOfDay(new Date(appliedCustomDateRange.start)) : new Date(0);
            const endD = hasEnd ? endOfDay(new Date(appliedCustomDateRange.end)) : new Date(8640000000000000);
            const eD_start = startOfDay(entryDate);
            if (eD_start < startD || eD_start > endD) return false;

            const eShift = e.data.shift || e.data.Shift || 'All';
            const sShift = appliedCustomDateRange.startShift || 'All';
            const eDShift = appliedCustomDateRange.endShift || 'All';
            const weights: Record<string, number> = { 'Shift A': 1, 'Shift B': 2, 'Shift C': 3, 'All': 0 };

            if (hasStart && eD_start.getTime() === startD.getTime() && sShift !== 'All') {
              if (weights[eShift] && weights[eShift] < weights[sShift]) return false;
            }
            if (hasEnd && eD_start.getTime() === endD.getTime() && eDShift !== 'All') {
              if (weights[eShift] && weights[eShift] > weights[eDShift]) return false;
            }
            return true;
          }
        } catch (err) { return false; }
        return true;
      });
    }
    return result;
  }, [entries, campaignFilter, productFilter, dateFilter, appliedCustomDateRange]);

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
            const hasStart = !!appliedCustomDateRange.start;
            const hasEnd = !!appliedCustomDateRange.end;
            if (!hasStart && !hasEnd) return true;

            const startD = hasStart ? startOfDay(new Date(appliedCustomDateRange.start)) : new Date(0);
            const endD = hasEnd ? endOfDay(new Date(appliedCustomDateRange.end)) : new Date(8640000000000000);
            const d_start = startOfDay(d);
            if (d_start < startD || d_start > endD) return false;

            const rShift = row.shift || row.Shift || 'All';
            const sShift = appliedCustomDateRange.startShift || 'All';
            const eDShift = appliedCustomDateRange.endShift || 'All';
            const weights: Record<string, number> = { 'Shift A': 1, 'Shift B': 2, 'Shift C': 3, 'All': 0 };

            if (hasStart && d_start.getTime() === startD.getTime() && sShift !== 'All') {
              if (weights[rShift] && weights[rShift] < weights[sShift]) return false;
            }
            if (hasEnd && d_start.getTime() === endD.getTime() && eDShift !== 'All') {
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
    const summary: Record<string, { 
      ground_total: number; 
      inputs: Record<string, number>; 
      products: Record<string, number>; 
      status: 'Active' | 'Closed';
      opening_stock: number;
      closing_stock: number;
      production_flow_consumption: number;
    }> = {};
    
    filteredEntries.forEach(entry => {
      const campaign = entry.data.campaign_no || entry.data.campaign || entry.data['Campaign No.'] || entry.data['Campaign'];
      if (!campaign || typeof campaign !== 'string') return;
      if (!summary[campaign]) summary[campaign] = { ground_total: 0, inputs: {}, products: {}, status: 'Active', opening_stock: 0, closing_stock: 0, production_flow_consumption: 0 };
      
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
      } else if (entry.departmentId === 'campaign_opening') {
        const stockFields = ['sb3_hopper3', 'sb3_hopper4', 'sb3_hopper5', 'ppt_qty', 'sb4_qty', 'ball_mill', 'bc_10', 'bc_11', 'bc_12', 'bc_13', 'mixture_balling_dics', 'balling_disc_4nos', 'tg_beg', 'kiln', 'cooler'];
        let total = 0;
        stockFields.forEach(f => {
          total += parseFloat(d[f] || d[f.toUpperCase()] || '0') || 0;
        });
        summary[campaign].opening_stock = total;
      } else if (entry.departmentId === 'campaign_closing') {
        summary[campaign].status = 'Closed';
        const stockFields = ['sb3_hopper3', 'sb3_hopper4', 'sb3_hopper5', 'ppt_qty', 'sb4_qty', 'ball_mill', 'bc_10', 'bc_11', 'bc_12', 'bc_13', 'mixture_balling_dics', 'balling_disc_4nos', 'tg_beg', 'kiln', 'cooler'];
        let total = 0;
        stockFields.forEach(f => {
          total += parseFloat(d[f] || d[f.toUpperCase()] || '0') || 0;
        });
        summary[campaign].closing_stock = total;
      } else if (entry.departmentId === 'production_flow') {
        const consumptionFields = ['wf3', 'wf4', 'wf5', 'liw1', 'liw2', 'liw3', 'liw4', 'liw5'];
        let total = 0;
        consumptionFields.forEach(f => {
          total += parseFloat(d[f] || d[f.toUpperCase()] || '0') || 0;
        });
        summary[campaign].production_flow_consumption += total;
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
        { name: d.rm1 || d.RM1 || 'RM1', qty: parseFloat(d['Used RM1'] || d.hopper3 || d['Hopper 3'] || 0) },
        { name: d.rm2 || d.RM2 || 'RM2', qty: parseFloat(d['Used RM2'] || d.hopper4 || d['Hopper 4'] || 0) },
        { name: d.rm3 || d.RM3 || 'RM3', qty: parseFloat(d['Used RM3'] || d.hopper5 || d['Hopper 5'] || 0) },
        { name: d.rm4 || d.RM4 || 'RM4', qty: parseFloat(d['Used RM4'] || d.hopper6 || d['Hopper 6'] || 0) },
        { name: d.rm5 || d.RM5 || 'RM5', qty: parseFloat(d['Used RM5'] || d.hopper7 || d['Hopper 7'] || 0) },
        { name: d.rm6 || d.RM6 || 'RM6', qty: parseFloat(d['Used RM6'] || d.hopper8 || d['Hopper 8'] || 0) }
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

    const uniqueDays = new Set(filteredEntries.map(e => {
      let dateVal = String(e.data.date_of_production || e.data['Date Of Production'] || e.data.date || e.data.Date || e.timestamp);
      if (dateVal.includes(' ')) dateVal = dateVal.split(' ')[0];
      return dateVal.trim();
    })).size || 1;
    const dailyTarget = 40.0;
    let periodTarget = dailyTarget;
    if (dateFilter === '7d') periodTarget = dailyTarget * 7;
    else if (dateFilter === '30d') periodTarget = dailyTarget * 30;
    else if (dateFilter === 'all') periodTarget = dailyTarget * uniqueDays;
    else if (dateFilter === 'custom') {
      const hasStart = !!appliedCustomDateRange.start;
      const hasEnd = !!appliedCustomDateRange.end;
      if (hasStart && hasEnd) {
        const diffMs = new Date(appliedCustomDateRange.end).getTime() - new Date(appliedCustomDateRange.start).getTime();
        const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
        periodTarget = dailyTarget * diffDays;
      } else {
        periodTarget = dailyTarget * uniqueDays;
      }
    }

    const progressPct = Math.min((totalProduction / periodTarget) * 100, 100).toFixed(1);
    const dailyAvg = (totalProduction / uniqueDays).toFixed(1);

    const wipStatsOutput = wipStats.totalWIP;

    const consumptionRows = filteredEntries.filter(e => (e.departmentId as string) === 'consumption');
    const totalConsumption = consumptionRows.reduce((sum, e) => sum + (parseFloat(e.data.Total || e.data.total) || 0), 0);

    const prodFlowRows = filteredEntries.filter(e => e.departmentId === 'production_flow');
    const totalWF = prodFlowRows.reduce((sum, e) => {
      const wf3 = parseFloat(e.data['WF3'] || e.data['wf3']) || 0;
      const wf4 = parseFloat(e.data['WF4'] || e.data['wf4']) || 0;
      const wf5 = parseFloat(e.data['WF5'] || e.data['wf5']) || 0;
      return sum + wf3 + wf4 + wf5;
    }, 0);

    const totalInput = totalWF > 0 ? totalWF : (totalConsumption > 0 ? totalConsumption : totalHopper);
    const consumptionLogic = totalWF > 0
      ? `Sum of WF3-WF5 from Production Flow (${prodFlowRows.length} entries)`
      : (totalConsumption > 0
        ? `Sum of "Total" column from Consumption sheet (${consumptionRows.length} entries)`
        : `Sum of Used RM1-RM6 cols (${hopperStats.count} entries)`);

    const netSpillage = totalSpillage - totalPPT;

    // FIXED: Enhanced function to extract Ground Loss and LOI from composition records
    const getCampaignKyc = () => {
      // Only compositionData holds real row objects (campaign_no, Ground Loss, LOI columns).
      // masterData is just flat string[] lookups (campaigns/products/materials), so it can
      // never contribute anything here — including it as a "source" was dead weight.
      const sources: any[][] = Array.isArray(compositionData) ? [compositionData] : [];

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

    const productionFlowEntriesForHours = filteredEntries.filter(e => e.departmentId === 'production_flow');
    const prodFlowDates = new Set(productionFlowEntriesForHours.map(e => {
      let dateVal = String(e.data.date || e.data.Date || e.timestamp);
      if (dateVal.includes(' ')) dateVal = dateVal.split(' ')[0];
      return dateVal.trim();
    }));
    const totalHours = prodFlowDates.size * 24;

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

    const productionFlowEntries = filteredEntries.filter(e => e.departmentId === 'production_flow');
    const totalLIW = productionFlowEntries.reduce((sum, e) => {
      const d = e.data;
      const liw1 = parseFloat(d.liw1 || d.LIW1) || 0;
      const liw2 = parseFloat(d.liw2 || d.LIW2) || 0;
      const liw3 = parseFloat(d.liw3 || d.LIW3) || 0;
      const liw4 = parseFloat(d.liw4 || d.LIW4) || 0;
      const liw5 = parseFloat(d.liw5 || d.LIW5) || 0;
      return sum + liw1 + liw2 + liw3 + liw4 + liw5;
    }, 0);

    const totalWF = productionFlowEntries.reduce((sum, e) => {
      const d = e.data;
      const wf3 = parseFloat(d.wf3 || d.WF3) || 0;
      const wf4 = parseFloat(d.wf4 || d.WF4) || 0;
      const wf5 = parseFloat(d.wf5 || d.WF5) || 0;
      return sum + wf3 + wf4 + wf5;
    }, 0);

    return {
      totalFuel, totalElec, totalQty, totalHours, count: prodEntries.length,
      fuelPerMT: totalQty > 0 ? (totalFuel / totalQty).toFixed(2) : '0',
      elecPerMT: totalQty > 0 ? (totalElec / totalQty).toFixed(2) : '0',
      totalStopDuration: totalStopDuration.toFixed(1),
      totalLIW,
      totalWF
    };
  }, [filteredEntries]);

  const productionCost = useMemo(() => {
    const totalProd = accountingSummary.totalProduction || 0;
    const totalFuel = energyStats.totalFuel || 0;
    const totalElec = energyStats.totalElec || 0;

    let fuelRate = COST_FACTORS.FUEL_RATE;
    let elecRate = COST_FACTORS.ELECTRIC_RATE;
    let procCost = COST_FACTORS.PROCESSING_COST_PER_MT;

    if (masterData.kycRates) {
      for (const key in masterData.kycRates) {
        if (masterData.kycRates[key].fuel_rate) fuelRate = masterData.kycRates[key].fuel_rate;
        if (masterData.kycRates[key].electric_rate) elecRate = masterData.kycRates[key].electric_rate;
        if (masterData.kycRates[key].hr_cost_per_mt) procCost = masterData.kycRates[key].hr_cost_per_mt;
      }
    }

    let totalRmCost = 0;
    const breakdown = hopperStats.totals.map(([name, qty]) => {
      let rate = RM_RATES[name] || RM_RATES[name.toUpperCase()] || 0;
      if (masterData.kycRates) {
        // Find matching key case-insensitively
        const matchedKey = Object.keys(masterData.kycRates).find(k => k.toLowerCase() === name.toLowerCase());
        if (matchedKey && masterData.kycRates[matchedKey].rate) {
          rate = masterData.kycRates[matchedKey].rate;
        }
      }
      
      const cost = qty * rate;
      totalRmCost += cost;
      return { name, qty, rate, cost, type: 'rm' };
    });

    const totalFuelCost = totalFuel * fuelRate;
    const totalElecCost = totalElec * elecRate;
    const totalProcessingCost = totalProd * procCost;
    const totalOperatingCost = totalRmCost + totalFuelCost + totalElecCost + totalProcessingCost;

    if (totalFuelCost > 0 || totalFuel > 0) breakdown.push({ name: 'Total Fuel', qty: totalFuel, rate: fuelRate, cost: totalFuelCost, type: 'fuel' });
    if (totalElecCost > 0 || totalElec > 0) breakdown.push({ name: 'Total Electricity', qty: totalElec, rate: elecRate, cost: totalElecCost, type: 'elec' });
    if (totalProcessingCost > 0) breakdown.push({ name: 'Processing (Hr Cost)', qty: totalProd, rate: procCost, cost: totalProcessingCost, type: 'proc' });

    return {
      totalRmCost,
      totalFuelCost,
      totalElecCost,
      totalProcessingCost,
      totalOperatingCost,
      costPerMt: totalProd > 0 ? (totalOperatingCost / totalProd) : 0,
      breakdown
    };
  }, [hopperStats, accountingSummary.totalProduction, energyStats, masterData]);

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
      // Matches DepartmentView's live cell rule: GBM defaults to a max of 25 regardless of the
      // generic Moisture limit, unless a specific GBM/Moisture range has been configured.
      const range = parseRange(parameterRanges['GBM (%)'] || parameterRanges['Moisture (%)'] || parameterRanges['Moisture'] || '', 'Moisture')
        || { min: 0, max: 25 };

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
    // Group by a normalized (trimmed, case-folded) key so the same material spelled with
    // different casing in the sheet (e.g. "RBX" vs "Rbx") doesn't get split into separate rows.
    const groups = new Map<string, { display: string; rows: typeof rows }>();
    rows.forEach(e => {
      const raw = e.data.rm_name || e.data['Raw Material Name'];
      if (!raw || typeof raw !== 'string' || !raw.trim()) return;
      const norm = raw.trim().toLowerCase();
      if (!groups.has(norm)) groups.set(norm, { display: raw.trim(), rows: [] });
      groups.get(norm)!.rows.push(e);
    });
    if (groups.size === 0) return [];

    const getParamRange = (mat: string, label: string) => {
      if (!parameterRanges) return null;
      let rangeName = label === 'Al2O3' ? 'Alumina (%)' : label === 'Fe2O3' ? 'Iron (%)' : label === 'SiO2' ? 'Silica (%)' : label === 'TiO2' ? 'Titania (%)' : label === 'MgO' ? 'Magnesia (%)' : label === 'CaO' ? 'Lime (%)' : label === 'Loi' ? 'LOI (%)' : label === 'Moisture' ? 'Moisture (%)' : label;
      // "Configure Limits" saves under the plain label (e.g. "Al2O3"); check that first.
      return parseRange(parameterRanges[label] || parameterRanges[rangeName]);
    };

    const sortedGroups = Array.from(groups.values()).sort((a, b) => a.display.localeCompare(b.display));

    return sortedGroups.map(({ display: rmName, rows: matRows }) => {
      const makeStat = (k1: string, k2: string, label: string) => {
        const nums = matRows.map(e => getNum(e.data, k1, k2)).filter(v => !isNaN(v));
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
      const configured = parameterRanges ? parseRange(parameterRanges[name] || parameterRanges['Drop Test']) : null;
      // Matches DepartmentView's live cell default when no limit has been configured.
      return configured || { min: 2.5, max: 1000 };
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

  const productionFlowSb3Avg = useMemo(() => {
    const rows = filteredEntries.filter(e => e.departmentId === 'production_flow' && (e.data.type === 'SB3' || e.data.Type === 'SB3' || e.data.type === 'sb3' || !e.data.type));
    
    const getRmName = (k1: string, k2: string) => {
      const row = [...rows].reverse().find(e => e.data[k1] || e.data[k2]);
      return row ? String(row.data[k1] || row.data[k2]) : null;
    };
    
    const makeStat = (key: string, altKey: string, rmName: string) => {
      let entriesWithData = 0;
      let totalPctSum = 0;
      let totalMT = 0;
      let outOfLimit = 0;

      rows.forEach(e => {
        const wf3 = parseFloat(e.data['wf3'] || e.data['WF3']) || 0;
        const wf4 = parseFloat(e.data['wf4'] || e.data['WF4']) || 0;
        const wf5 = parseFloat(e.data['wf5'] || e.data['WF5']) || 0;
        const rowTotal = wf3 + wf4 + wf5;

        const valMT = parseFloat(e.data[key] || e.data[altKey]);

        if (!isNaN(valMT) && valMT > 0) {
          totalMT += valMT;
        }

        if (rowTotal > 0 && !isNaN(valMT)) {
          const valPct = (valMT / rowTotal) * 100;
          
          if (valPct > 0) {
            entriesWithData++;
            totalPctSum += valPct;

            const rowMin = parseFloat(e.data[`${rmName} Min`] || e.data[`${key} Min`]);
            const rowMax = parseFloat(e.data[`${rmName} Max`] || e.data[`${key} Max`]);
            
            if (!isNaN(rowMin) && !isNaN(rowMax)) {
              if (valPct < rowMin || valPct > rowMax) outOfLimit++;
            } else {
              const configured = parameterRanges ? parseRange(parameterRanges[rmName] || parameterRanges[key.toUpperCase()]) : null;
              if (configured && (valPct < configured.min || valPct > configured.max)) outOfLimit++;
            }
          }
        }
      });

      const avgPct = entriesWithData ? (totalPctSum / entriesWithData).toFixed(1) : '-';
      const efficiency = entriesWithData ? (((entriesWithData - outOfLimit) / entriesWithData) * 100).toFixed(1) : '0.0';

      return { avg: avgPct, total: totalMT.toFixed(1), count: entriesWithData, outOfLimit, efficiency };
    };

    const rm1 = getRmName('rm1', 'RM1') || 'RM1';
    const rm2 = getRmName('rm2', 'RM2') || 'RM2';
    const rm3 = getRmName('rm3', 'RM3') || 'RM3';

    return {
      rm1Name: rm1,
      rm2Name: rm2,
      rm3Name: rm3,
      wf3: makeStat('wf3', 'WF3', rm1),
      wf4: makeStat('wf4', 'WF4', rm2),
      wf5: makeStat('wf5', 'WF5', rm3),
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
      // "Configure Limits" saves under the plain label (e.g. "Al2O3"); check that first,
      // then the descriptive name (e.g. "Alumina (%)") in case it was set that way instead.
      return parseRange(parameterRanges[label] || parameterRanges[keyMap[label]] || '');
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
            const cleanLabel = label.replace(/₂/g, '2').replace(/₃/g, '3').replace(/[(%)]/g, '').trim();
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

    const phRows = filteredEntries.filter(e => e.departmentId === 'product_house');
    const kilnRows = filteredEntries.filter(e => e.departmentId === 'kiln');

    return {
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

  const productionFlowAvg = useMemo(() => {
    const rows = filteredEntries.filter(e => e.departmentId === 'production_flow');
    const getStat = (key: string) => {
      const nums = rows.map(e => parseFloat(e.data[key] || e.data[key.toUpperCase()] || e.data[key.toLowerCase()])).filter(v => !isNaN(v));
      const count = nums.length;
      const sum = nums.reduce((a, b) => a + b, 0);
      const avg = count ? (sum / count) : 0;
      return { sum: sum.toFixed(2), avg: avg.toFixed(2), count };
    };
    return {
      wf3: getStat('WF3'), wf4: getStat('WF4'), wf5: getStat('WF5'),
      liw1: getStat('LIW1'), liw2: getStat('LIW2'), liw3: getStat('LIW3'), liw4: getStat('LIW4'), liw5: getStat('LIW5')
    };
  }, [filteredEntries]);

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
        <div className="bg-brand-800 border border-slate-700 rounded-xl px-4 py-3 shadow-xl">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{label}</p>
          <p className="text-white font-black text-lg">{payload[0].value} <span className="text-slate-400 text-xs font-normal">MT</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-6 -mt-12 pb-32 space-y-6" style={{ background: '#f8f9fb' }}>

      {/* -- TOP BAR (pinned: no scroll-through gap before it sticks) */}
      <div className="sticky top-0 z-50 bg-[#f8f9fb]/95 backdrop-blur-md -mx-4 md:-mx-6 px-4 md:px-6 pt-6 pb-4 mb-2 border-b border-transparent transition-all duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/20">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-brand-900 leading-none">Dashboard</h1>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">{filterLabel} • {stats.total} entries</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={campaignFilter}
                onChange={(e) => {
                  setCampaignFilter(e.target.value);
                  if (e.target.value !== 'All') {
                    setDateFilter('all');
                  }
                }}
                className="w-[160px] bg-transparent text-slate-700 text-xs font-semibold outline-none cursor-pointer pr-1"
              >
                <option value="All">All Campaigns</option>
                {allCampaigns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-[140px] bg-transparent text-slate-700 text-xs font-semibold outline-none cursor-pointer pr-1"
              >
                <option value="All">All Products</option>
                {allProducts.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {selectedProducts.length > 0 && (
              <div className="flex items-center gap-2 bg-brand-50/50 border border-brand-100 px-3 py-2 rounded-xl">
                <Package className="w-3.5 h-3.5 text-brand-500" />
                <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest mr-1">Produced:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {selectedProducts.map(p => (
                    <span key={p} className="text-[11px] font-black text-brand-700 bg-brand-100/50 px-2.5 py-0.5 rounded-lg border border-brand-200">
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
                    dateFilter === f ? "bg-brand-600 text-white shadow-md shadow-brand-600/20" : "text-slate-500 hover:text-brand-600 hover:bg-slate-50"
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
                  className="ml-1 px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm"
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
      <div className="bg-surface rounded-2xl shadow-xl p-6 mb-6 group overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-20 group-hover:opacity-60 transition-all duration-700 z-0" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-brand-900 tracking-tight">Production Report</h2>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Production', val: energyStats.totalQty.toFixed(1), unit: 'MT', accent: 'bg-slate-400', text: 'text-slate-700', logic: '' },
              { label: 'Total Fuel', val: energyStats.totalFuel.toFixed(1), unit: 'units', accent: 'bg-amber-500', text: 'text-amber-600', logic: '' },
              { label: 'Total Electric', val: energyStats.totalElec.toFixed(1), unit: 'units', accent: 'bg-yellow-500', text: 'text-yellow-600', logic: '' },
              { label: 'Fuel / MT', val: energyStats.fuelPerMT, unit: 'u/MT', accent: 'bg-brand-500', text: 'text-brand-600', logic: '' },
              { label: 'Electric / MT', val: energyStats.elecPerMT, unit: 'u/MT', accent: 'bg-rose-500', text: 'text-rose-600', logic: '' },
              { label: 'Running Hours', val: String(energyStats.totalHours.toFixed(1)), unit: 'hours', accent: 'bg-brand-500', text: 'text-brand-600', logic: '' },
              { label: 'Total Stop Dur.', val: String(energyStats.totalStopDuration), unit: 'hours', accent: 'bg-emerald-500', text: 'text-emerald-600', logic: '' },
              { label: 'Total LIW (PPT)', val: energyStats.totalLIW.toFixed(1), unit: 'MT', accent: 'bg-indigo-500', text: 'text-indigo-600', logic: 'LIW 1-5' },
              { label: 'Total WF (SB3)', val: energyStats.totalWF.toFixed(1), unit: 'MT', accent: 'bg-violet-500', text: 'text-violet-600', logic: 'WF 3-5' },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:border-slate-200 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex flex-col group">
                <div className={`absolute top-0 left-0 w-full h-1.5 ${card.accent} opacity-80 group-hover:opacity-100 transition-opacity`}></div>
                <div className="flex-1 mt-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">{card.label}</p>
                  <p className={`text-3xl font-black tracking-tighter ${card.text}`}>{card.val}</p>
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
      <div className="flex flex-col gap-4 mb-6">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: dropTestAvg.rm1Name, stat: dropTestAvg.rm1, color: 'text-red-600' },
                  { label: dropTestAvg.rm2Name, stat: dropTestAvg.rm2, color: 'text-brand-600' },
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
            title: 'Production Flow (WF SB3)',
            icon: Layers,
            color: 'violet',
            component: (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { dtLabel: dropTestAvg.rm1Name, color: 'text-red-600' },
                  { dtLabel: dropTestAvg.rm2Name, color: 'text-brand-600' },
                  { dtLabel: dropTestAvg.rm3Name, color: 'text-yellow-600' },
                ].map((dt, i) => {
                  const pfItems = [
                    { label: productionFlowSb3Avg.rm1Name, stat: productionFlowSb3Avg.wf3 },
                    { label: productionFlowSb3Avg.rm2Name, stat: productionFlowSb3Avg.wf4 },
                    { label: productionFlowSb3Avg.rm3Name, stat: productionFlowSb3Avg.wf5 },
                  ];
                  const match = pfItems.find(p => p.label === dt.dtLabel);
                  const emptyStat = { avg: '-', total: '0.0', count: 0, outOfLimit: 0, efficiency: '0.0' };
                  return { label: dt.dtLabel, stat: match ? match.stat : emptyStat, color: dt.color };
                }).map((row, i) => (
                  <div key={`${row.label}-${i}`} className="bg-slate-50 rounded-2xl p-5 border border-slate-100/50 flex items-center justify-between">
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
                      <span className={`text-2xl font-black tracking-tight ${item.data.avg === '-' ? 'text-slate-300' : 'text-emerald-700'}`}>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <span className={`text-2xl font-black tracking-tight ${item.data.avg === '-' ? 'text-slate-300' : 'text-cyan-900'}`}>
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
            title: 'Production Flow (Sums & Avgs)',
            icon: Box,
            color: 'purple',
            component: (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                {[
                  { label: 'WF3', stat: productionFlowAvg.wf3 },
                  { label: 'WF4', stat: productionFlowAvg.wf4 },
                  { label: 'WF5', stat: productionFlowAvg.wf5 },
                  { label: 'LIW1', stat: productionFlowAvg.liw1 },
                  { label: 'LIW2', stat: productionFlowAvg.liw2 },
                  { label: 'LIW3', stat: productionFlowAvg.liw3 },
                  { label: 'LIW4', stat: productionFlowAvg.liw4 },
                  { label: 'LIW5', stat: productionFlowAvg.liw5 },
                ].map(item => (
                  <div key={item.label} className="bg-purple-50/50 border border-purple-100/50 rounded-2xl p-4 hover:border-purple-200 transition-all">
                    <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-2">{item.label}</p>
                    <div className="flex flex-col gap-1 mb-2">
                      <div className="flex justify-between items-end">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Sum</span>
                        <span className="text-lg font-black text-purple-700 leading-none">{item.stat.sum}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Avg</span>
                        <span className="text-sm font-bold text-slate-600 leading-none">{item.stat.avg}</span>
                      </div>
                    </div>
                    <div className="text-right border-t border-purple-100 pt-2 mt-2">
                      <span className="text-[9px] font-bold text-slate-500">{item.stat.count} Entries</span>
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
                  <div key={row.label} className="bg-brand-50/50 border border-brand-100/50 rounded-2xl p-5 hover:border-brand-200 transition-all">
                    <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-3">{row.label}</p>
                    <div className="flex items-baseline gap-2 mb-4 justify-center">
                      <span className={`text-2xl font-black tracking-tight ${row.avg === '-' ? 'text-slate-300' : 'text-brand-700'}`}>
                        {row.avg}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Total</p>
                        <p className="text-[10px] font-bold text-slate-700">{row.count}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-brand-400 uppercase tracking-tighter">Out</p>
                        <p className="text-[10px] font-bold text-brand-600">{row.outOfLimit}</p>
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
                  <div key={row.label} className="bg-brand-50/50 border border-brand-100/50 rounded-2xl p-5 hover:border-brand-200 transition-all">
                    <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-3">{row.label}</p>
                    <div className="flex items-baseline gap-2 mb-4 justify-center">
                      <span className={`text-2xl font-black tracking-tight ${row.avg === '-' ? 'text-slate-300' : 'text-brand-700'}`}>
                        {row.avg}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Total</p>
                        <p className="text-[10px] font-bold text-slate-700">{row.count}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-brand-400 uppercase tracking-tighter">Fail</p>
                        <p className="text-[10px] font-bold text-brand-600">{row.outOfLimit}</p>
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
          <div key={idx} className="bg-surface rounded-2xl shadow-xl p-6 group transition-all hover:shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-10 h-10 bg-${section.color}-50 rounded-xl flex items-center justify-center shadow-sm`}>
                <section.icon className={`w-5 h-5 text-${section.color}-600`} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-brand-900 tracking-tight">{section.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full bg-${section.color}-500 animate-pulse`} />
                </div>
              </div>
            </div>
            {section.component}
          </div>
        ))}
      </div>

      {/* -- CAMPAIGN LEDGER (PURA HISAB) */}
      {campaignSummary.length > 0 && (
        <div className="glass-card overflow-hidden mb-6">
          <div className="px-5 sm:px-7 py-5 bg-gradient-to-r from-brand-50 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-100">
            <div>
              <h2 className="text-xl font-black text-brand-900 tracking-tight">Campaign Ledger (Stock Account)</h2>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Real-time material consumption per campaign</p>
            </div>
          </div>
          <div className="p-4 sm:p-6 overflow-x-auto custom-scrollbar">
            <div className="flex gap-4 pb-2" style={{ minWidth: '800px' }}>
              {campaignSummary.map((campaign, idx) => {
                const theoreticalClosing = campaign.opening_stock + campaign.ground_total - campaign.production_flow_consumption;
                const variance = campaign.closing_stock > 0 ? (theoreticalClosing - campaign.closing_stock) : 0;
                
                return (
                  <div key={idx} className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm min-w-[300px]">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                      <h3 className="text-lg font-black text-brand-800">{campaign.id}</h3>
                      <StatusBadge status={campaign.status === 'Active' ? 'Active' : 'Moderate'} />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Opening Stock</span>
                        <span className="text-sm font-black text-slate-700">{campaign.opening_stock.toFixed(2)} MT</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">+ Receipts (Ground)</span>
                        <span className="text-sm font-black text-emerald-600">+{campaign.ground_total.toFixed(2)} MT</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">- Consumption (Prod. Flow)</span>
                        <span className="text-sm font-black text-amber-500">-{campaign.production_flow_consumption.toFixed(2)} MT</span>
                      </div>
                      
                      {campaign.closing_stock > 0 ? (
                        <>
                          <div className="pt-2 flex justify-between items-center">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Theoretical Stock</span>
                            <span className="text-sm font-black text-slate-500">{theoreticalClosing.toFixed(2)} MT</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">- Actual Closing Stock</span>
                            <span className="text-sm font-black text-red-500">-{campaign.closing_stock.toFixed(2)} MT</span>
                          </div>
                          <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-[11px] font-black text-brand-600 uppercase tracking-wider">Variance (Loss/Gain)</span>
                            <span className={cn("text-lg font-black", variance > 0 ? "text-red-600" : "text-emerald-600")}>
                              {variance > 0 ? '-' : '+'}{Math.abs(variance).toFixed(2)} MT
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[11px] font-black text-brand-600 uppercase tracking-wider">Current Stock (Theo.)</span>
                          <span className="text-lg font-black text-brand-700">{theoreticalClosing.toFixed(2)} MT</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* -- PRODUCTION ACCOUNTING */}
      <div className="glass-card overflow-hidden mb-6">
        <div className="px-5 sm:px-7 py-5 bg-gradient-to-r from-brand-50 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-100">
          <div>
            <h2 className="text-xl font-black text-brand-900 tracking-tight">Consumption Report</h2>
          </div>
          <span className="text-[10px] text-brand-600 font-bold bg-white border border-brand-200 px-3 py-1.5 rounded-lg shadow-sm self-start sm:self-auto">{filterLabel}</span>
        </div>

        <div className="p-4 sm:p-6 overflow-x-auto">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-[600px] lg:min-w-0">
            {[
              { step: 1, label: 'SB3 Hopper', sub: 'Used for Production', val: accountingSummary.totalInput.toFixed(1), unit: 'MT Used', accent: 'border-brand-200 bg-brand-50', num: 'bg-brand-500', text: 'text-brand-700', cap: 'text-brand-500', logic: accountingSummary.consumptionLogic },
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
          <div className="premium-table-wrap">
            <div className="premium-table-scroll" style={{maxHeight:'none'}}>
            <table className="premium-table" style={{minWidth:'600px'}}>
              <thead>
                <tr>
                  <th style={{paddingLeft:'24px'}}>Actual</th>
                  <th className="text-right">Qty (MT)</th>
                  <th className="text-right" style={{paddingRight:'24px'}}>%</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Total Input (RM Used for Prod.)', qty: accountingSummary.totalInput.toFixed(1), pct: '100%', color: 'oklch(0.44 0.14 145)', dot: 'oklch(0.60 0.14 145)', sign: '', bg: 'oklch(0.97 0.015 145 / 0.4)', logic: accountingSummary.consumptionLogic },
                  { label: `LOI (${accountingSummary.avgLOI.toFixed(2)}%)`, qty: accountingSummary.loiLossMT.toFixed(1), pct: `${accountingSummary.totalInput > 0 ? ((accountingSummary.loiLossMT / accountingSummary.totalInput) * 100).toFixed(1) : '0'}%`, color: 'oklch(0.40 0.03 240)', dot: 'oklch(0.62 0.03 240)', sign: '– ', bg: '', logic: 'From Composition Records LOI (%) x Total Input' },
                  { label: 'Balance ', qty: accountingSummary.balance1.toFixed(1), pct: '', color: 'oklch(0.45 0.02 240)', dot: 'oklch(0.75 0.02 240)', sign: '= ', bg: 'oklch(0.97 0.01 240 / 0.3)', logic: 'Input - LOI' },
                  { label: 'Net Operational Spillage (Spillage - PPT)', qty: accountingSummary.netSpillage.toFixed(1), pct: `${accountingSummary.balance2 > 0 ? ((accountingSummary.netSpillage / accountingSummary.balance2) * 100).toFixed(1) : '0'}%`, color: 'oklch(0.40 0.17 22)', dot: 'oklch(0.55 0.18 22)', sign: '– ', bg: '', logic: `Accounted Spillage (${accountingSummary.totalSpillage.toFixed(1)}) - Recycled (${accountingSummary.totalPPT.toFixed(1)})` },
                  { label: 'Balance (Operational)', qty: accountingSummary.balance3.toFixed(1), pct: '', color: 'oklch(0.45 0.02 240)', dot: 'oklch(0.75 0.02 240)', sign: '= ', bg: 'oklch(0.97 0.01 240 / 0.3)', logic: 'Prev Balance - Net Spillage' },
                  { label: 'In-Process Material (Campaign Closing)', qty: accountingSummary.wipStatsOutput.toFixed(1), pct: `${accountingSummary.balance3 > 0 ? ((accountingSummary.wipStatsOutput / accountingSummary.balance3) * 100).toFixed(1) : '0'}%`, color: 'oklch(0.42 0.13 75)', dot: 'oklch(0.60 0.15 75)', sign: '– ', bg: '', logic: wipStats.logicStr },
                  { label: 'Theoretical Production (Final Balance)', qty: accountingSummary.balance4.toFixed(1), pct: '', color: 'oklch(0.25 0.04 145)', dot: 'oklch(0.40 0.06 240)', sign: '= ', bg: 'oklch(0.94 0.02 240 / 0.4)', logic: 'Final calculated target based on process and chemical losses' },
                  { label: 'Actual Production (Output)', qty: accountingSummary.totalProduction.toFixed(1), pct: `${accountingSummary.balance4 > 0 ? ((accountingSummary.totalProduction / accountingSummary.balance4) * 100).toFixed(1) : '0'}%`, color: 'oklch(0.35 0.13 145)', dot: 'oklch(0.52 0.155 145)', sign: '– ', bg: '', logic: 'Actual output weighed by production site' },
                  { label: 'Difference Qty (Actual vs Theoretical)', qty: Math.abs(accountingSummary.differenceQty).toFixed(1), pct: '–', color: accountingSummary.differenceQty > 0 ? 'oklch(0.40 0.17 22)' : 'oklch(0.35 0.13 145)', dot: accountingSummary.differenceQty > 0 ? 'oklch(0.55 0.18 22)' : 'oklch(0.52 0.155 145)', sign: accountingSummary.differenceQty > 0 ? '+ ' : '– ', bg: accountingSummary.differenceQty > 0 ? 'oklch(0.96 0.05 22 / 0.3)' : 'oklch(0.95 0.07 145 / 0.3)', logic: 'Variance = Theoretical Target - Actual Production' },
                ].map((row, i) => (
                  <tr key={i} style={{background: row.bg || undefined}}>
                    <td style={{paddingLeft:'24px'}}>
                      <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                        <div style={{width:'9px', height:'9px', borderRadius:'50%', background:row.dot, flexShrink:0, boxShadow:`0 0 0 2px ${row.dot}30`}} />
                        <div>
                          <span style={{fontSize:'13px', fontWeight:700, color:row.color, whiteSpace:'normal'}}>{row.sign}{row.label}</span>
                          <p style={{fontSize:'9px', color:'oklch(0.62 0.03 240)', fontStyle:'italic', fontWeight:500, marginTop:'2px'}}>Logic: {row.logic}</p>
                        </div>
                      </div>
                    </td>
                    <td className="tbl-num" style={{fontSize:'15px', fontWeight:900, color:'oklch(0.18 0.04 145)'}}>{row.qty}</td>
                    <td className="tbl-num" style={{paddingRight:'24px', fontSize:'12px', fontWeight:700, color:'oklch(0.52 0.04 240)'}}>{row.pct}</td>
                  </tr>
                ))}
                <tr className="tbl-footer-row">
                  <td style={{paddingLeft:'24px', fontSize:'12px', fontWeight:900, color:'oklch(0.28 0.09 145)', textTransform:'uppercase', letterSpacing:'0.1em'}}>Plant Efficiency</td>
                  <td className="tbl-num" style={{fontSize:'22px', fontWeight:900, color:'oklch(0.35 0.12 145)'}}>{accountingSummary.totalProduction.toFixed(1)} MT</td>
                  <td className="tbl-num" style={{paddingRight:'24px', fontWeight:900, color:'oklch(0.44 0.14 145)'}}>{accountingSummary.totalHopper > 0 ? ((accountingSummary.totalProduction / accountingSummary.totalHopper) * 100).toFixed(1) : '0'}% true yield</td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>

      {/* -- MATERIAL INTELLIGENCE */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-5 mb-6">
        {/* SB3 Ground */}
        <div className="glass-card p-6 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-50 z-0"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[9px] font-black text-brand-400 uppercase tracking-widest">Material Total Input</p>
                <h3 className="text-sm font-black text-brand-900 mt-0.5">SB3 Ground</h3>
                <p className="text-[9px] text-slate-500 italic font-medium mt-1">Logic: Input minus hopper usage</p>
              </div>
              <div className="w-7 h-7 bg-brand-50 rounded-lg flex items-center justify-center shadow-sm">
                <Layers className="w-3.5 h-3.5 text-brand-500" />
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
                        <span className="text-slate-700 font-black truncate max-w-[140px] uppercase text-[10px] tracking-wider">{name}</span>
                        <span className="text-brand-600 font-black text-[11px]">{qty.toFixed(1)} MT In</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] mb-2 pl-2 border-l-2 border-slate-100">
                        <span className="text-slate-500 font-bold">
                          <span className="text-red-400 mr-1">↓</span>To Hopper: {hopperQty.toFixed(1)} MT
                        </span>
                        <span className="text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/50 shadow-sm">
                          Stock: {stock.toFixed(1)} MT
                        </span>
                      </div>
                      <ProgressBar pct={pct} color="bg-brand-400" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* SB3 Hopper */}
        <div className="glass-card p-6 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-50 z-0"></div>
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border border-slate-100 flex items-center justify-center shadow-sm z-20 hidden xl:flex text-slate-300">
            <span className="text-[10px] font-black tracking-tighter">▶</span>
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest">Raw Material Hopper</p>
                <h3 className="text-sm font-black text-brand-900 mt-0.5">SB3 Hopper</h3>
                <p className="text-[9px] text-slate-500 italic font-medium mt-1">Logic: Sum of RM fed to hopper</p>
              </div>
              <div className="w-7 h-7 bg-sky-50 rounded-lg flex items-center justify-center shadow-sm">
                <Box className="w-3.5 h-3.5 text-sky-500" />
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
                        <span className="text-slate-700 font-black truncate max-w-[140px]">{name}</span>
                        <span className="text-sky-600 font-black text-[11px]">{qty.toFixed(1)} MT</span>
                      </div>
                      <ProgressBar pct={pct} color="bg-sky-400" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Total WF (SB3) */}
        <div className="glass-card p-6 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-50 z-0"></div>
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border border-slate-100 flex items-center justify-center shadow-sm z-20 hidden xl:flex text-slate-300">
            <span className="text-[10px] font-black tracking-tighter">▶</span>
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[9px] font-black text-violet-500 uppercase tracking-widest">Weight Feeders</p>
                <h3 className="text-sm font-black text-brand-900 mt-0.5">Total WF (SB3)</h3>
                <p className="text-[9px] text-slate-500 italic font-medium mt-1">Logic: Sum of WF3-WF5</p>
              </div>
              <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center shadow-sm">
                <Activity className="w-3.5 h-3.5 text-violet-500" />
              </div>
            </div>
            <div className="space-y-4">
              {[
                { name: productionFlowSb3Avg.rm1Name || 'WF3', qty: parseFloat(productionFlowAvg.wf3.sum) },
                { name: productionFlowSb3Avg.rm2Name || 'WF4', qty: parseFloat(productionFlowAvg.wf4.sum) },
                { name: productionFlowSb3Avg.rm3Name || 'WF5', qty: parseFloat(productionFlowAvg.wf5.sum) }
              ].map((item, idx, arr) => {
                const total = arr.reduce((acc, curr) => acc + curr.qty, 0);
                const pct = total > 0 ? Math.round((item.qty / total) * 100) : 0;
                return (
                  <div key={item.name}>
                    <div className="flex justify-between text-[10px] tracking-wider uppercase font-semibold mb-1.5">
                      <span className="text-slate-700 font-black truncate max-w-[140px]">{item.name}</span>
                      <span className="text-violet-600 font-black text-[11px]">{item.qty.toFixed(1)} MT</span>
                    </div>
                    <ProgressBar pct={pct} color="bg-violet-400" />
                  </div>
                );
              })}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total WF Output</span>
                <span className="text-sm font-black text-violet-900">
                  {(parseFloat(productionFlowAvg.wf3.sum) + parseFloat(productionFlowAvg.wf4.sum) + parseFloat(productionFlowAvg.wf5.sum)).toFixed(1)} MT
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Total LIW (PPT) */}
        <div className="glass-card p-6 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-50 z-0"></div>
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border border-slate-100 flex items-center justify-center shadow-sm z-20 hidden xl:flex text-slate-300">
            <span className="text-[10px] font-black tracking-tighter">▶</span>
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Loss In Weight</p>
                <h3 className="text-sm font-black text-brand-900 mt-0.5">Total LIW (PPT)</h3>
                <p className="text-[9px] text-slate-500 italic font-medium mt-1">Logic: Sum of LIW1-LIW5</p>
              </div>
              <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center shadow-sm">
                <Database className="w-3.5 h-3.5 text-indigo-500" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'LIW 1', qty: parseFloat(productionFlowAvg.liw1.sum) },
                  { name: 'LIW 2', qty: parseFloat(productionFlowAvg.liw2.sum) },
                  { name: 'LIW 3', qty: parseFloat(productionFlowAvg.liw3.sum) },
                  { name: 'LIW 4', qty: parseFloat(productionFlowAvg.liw4.sum) },
                  { name: 'LIW 5', qty: parseFloat(productionFlowAvg.liw5.sum) }
                ].map((item) => (
                  <div key={item.name} className="bg-indigo-50/30 rounded-lg p-2.5 border border-indigo-100/50 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">{item.name}</p>
                    <p className="text-[11px] font-black text-indigo-700">{item.qty.toFixed(1)} MT</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total LIW Output</span>
                <span className="text-sm font-black text-indigo-900">
                  {(parseFloat(productionFlowAvg.liw1.sum) + parseFloat(productionFlowAvg.liw2.sum) + parseFloat(productionFlowAvg.liw3.sum) + parseFloat(productionFlowAvg.liw4.sum) + parseFloat(productionFlowAvg.liw5.sum)).toFixed(1)} MT
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Output */}
        <div className="glass-card p-6 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-50 z-0"></div>
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border border-slate-100 flex items-center justify-center shadow-sm z-20 hidden xl:flex text-slate-300">
            <span className="text-[10px] font-black tracking-tighter">▶</span>
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Actual Production</p>
                <h3 className="text-sm font-black text-brand-900 mt-0.5">Product Output</h3>
                <p className="text-[9px] text-slate-500 italic font-medium mt-1">Logic: Sum of all finished product</p>
              </div>
              <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center shadow-sm">
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
                        <span className="text-slate-700 font-black uppercase text-[10px] tracking-wider truncate max-w-[140px]">{name}</span>
                        <span className="text-emerald-600 font-black text-[11px]">{qty.toFixed(1)} MT</span>
                      </div>
                      <ProgressBar pct={pct} color="bg-emerald-500" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Spillage */}
        <div className="glass-card p-6 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-50 z-0"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">{spillageStats.count} entries</p>
                <h3 className="text-sm font-black text-brand-900 mt-0.5">Spillage</h3>
                <p className="text-[9px] text-slate-500 italic font-medium mt-1">Logic: Sum of all spillage streams</p>
              </div>
              <div className="w-7 h-7 bg-rose-50 rounded-lg flex items-center justify-center shadow-sm">
                <Droplets className="w-3.5 h-3.5 text-rose-500" />
              </div>
            </div>
            {spillageStats.count === 0 ? (
              <p className="text-center text-xs text-slate-300 italic py-8">No spillage data</p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-amber-50/50 border border-amber-100/50 p-4">
                  <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Hot Screen</p>
                  <p className="text-2xl font-black text-amber-700 tracking-tight">{spillageStats.hotScreen.toFixed(1)}</p>
                  <p className="text-[9px] text-amber-400 font-bold mt-0.5">Total MT</p>
                </div>
                <div className="rounded-xl bg-rose-50/50 border border-rose-100/50 p-4">
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Multi Cyclone</p>
                  <p className="text-2xl font-black text-rose-700 tracking-tight">{spillageStats.multiCyclone.toFixed(1)}</p>
                  <p className="text-[9px] text-rose-400 font-bold mt-0.5">Total MT</p>
                </div>
                <div className="rounded-xl bg-brand-50/50 border border-brand-100/50 p-4">
                  <p className="text-[9px] font-black text-brand-500 uppercase tracking-widest mb-1">House Keeping</p>
                  <p className="text-2xl font-black text-brand-700 tracking-tight">{spillageStats.houseKeeping.toFixed(1)}</p>
                  <p className="text-[9px] text-brand-400 font-bold mt-0.5">Total MT</p>
                </div>
                <div className="rounded-xl bg-brand-50/50 border border-brand-100/50 p-4">
                  <p className="text-[9px] font-black text-brand-500 uppercase tracking-widest mb-1">Road Side</p>
                  <p className="text-2xl font-black text-brand-700 tracking-tight">{spillageStats.roadSide.toFixed(1)}</p>
                  <p className="text-[9px] text-brand-400 font-bold mt-0.5">Total MT</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Spillage</span>
                  <span className="text-sm font-black text-rose-900">{spillageStats.total.toFixed(1)} MT</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* -- MATERIAL CONSUMPTION ANALYSIS */}
      <div className="bg-surface rounded-[2rem] border border-border shadow-sm overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-brand-50 to-white border-b border-brand-100 px-8 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center border border-brand-200">
              <PieChartIcon className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-brand-900 uppercase tracking-widest">RM Consumption per 1 MT Production</h3>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[9px] font-black text-brand-500 uppercase tracking-wider">Total Output</p>
            <p className="text-base font-black text-brand-900 leading-none">{accountingSummary.totalProduction.toFixed(1)} <span className="text-[9px] text-brand-400 ml-0.5">MT</span></p>
          </div>
        </div>

        <div className="p-6">
          {consumptionStats.length === 0 ? (
            <div className="py-12 text-center text-slate-300 text-sm italic">
              Awaiting production data for analysis...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const totalRatio = consumptionStats.reduce((sum, item) => sum + parseFloat(item.consumption || '0'), 0).toFixed(3);
                const totalUsedOverall = consumptionStats.reduce((sum, item) => sum + parseFloat(item.totalUsed || '0'), 0).toFixed(1);

                return (
                  <>
                    {consumptionStats.map((item, idx) => (
                      <div key={idx} className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 group hover:border-brand-200 transition-all duration-300">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{item.name}</span>
                            <h4 className="text-2xl font-black text-brand-900 tracking-tight">{item.consumption} <span className="text-[10px] text-brand-500 uppercase">MT</span></h4>
                          </div>
                          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 group-hover:bg-brand-600 transition-colors duration-300">
                            <Activity className="w-3.5 h-3.5 text-brand-500 group-hover:text-white" />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <ProgressBar pct={Math.min(parseFloat(item.consumption) * 100, 100)} color="bg-brand-500" />
                          <div className="flex items-center justify-between">
                            <p className="text-[8px] font-bold text-slate-400 uppercase">Ratio per 1 MT</p>
                            <p className="text-[10px] font-black text-brand-900">Total: {item.totalUsed} MT</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* TOTAL CARD */}
                    <div className="bg-brand-50/50 rounded-2xl p-6 border border-brand-200 group hover:border-brand-300 transition-all duration-300 shadow-sm">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] mb-1">TOTAL RM RATIO</span>
                          <h4 className="text-2xl font-black text-brand-900 tracking-tight">{totalRatio} <span className="text-[10px] text-brand-500 uppercase">MT</span></h4>
                        </div>
                        <div className="bg-brand-600 p-2 rounded-xl shadow-sm border border-brand-500 transition-colors duration-300">
                          <PieChartIcon className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <ProgressBar pct={100} color="bg-brand-600" />
                        <div className="flex items-center justify-between">
                          <p className="text-[8px] font-bold text-brand-600 uppercase">Total RM Consumed</p>
                          <p className="text-[10px] font-black text-brand-900">Total: {totalUsedOverall} MT</p>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* -- PRODUCTION COST ANALYSIS */}
      <div className="bg-surface rounded-[2rem] border border-border shadow-sm overflow-hidden mb-6">
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

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 bg-emerald-50/50 rounded-3xl p-6 border border-emerald-100 flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 transform translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-500">
                <div className="w-20 h-20 bg-emerald-500/5 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-10 h-10 text-emerald-500/20" />
                </div>
              </div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-2">Total Production Cost</p>
              <h2 className="text-3xl font-black text-brand-900 tracking-tighter mb-2">
                {productionCost.totalOperatingCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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
                <div key={idx} className={`bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-all duration-300 ${item.type !== 'rm' ? 'bg-slate-50/50' : 'hover:border-emerald-200'}`}>
                  <div className="grid grid-cols-4 gap-4 w-full items-center">
                    <span className={`text-xs font-black uppercase tracking-wider ${item.type === 'rm' ? 'text-brand-900' : 'text-slate-700'}`}>{item.name}</span>
                    <span className="text-sm font-bold text-slate-600 text-right">{item.qty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Activity',
            value: stats.total,
            suffix: ' entries',
            icon: Layers,
            color: 'blue',
            trend: 'Active',
            trendColor: 'text-brand-500',
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
            className="group relative bg-white border border-slate-100/80 rounded-[1.75rem] p-5 shadow-sm hover:shadow-2xl hover:border-brand-100 transition-all duration-500 overflow-hidden"
          >
            {/* Background Glow */}
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-12 -mt-12 rounded-full opacity-[0.03] group-hover:scale-[2.5] transition-all duration-1000 bg-${kpi.color}-500`} />

            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${kpi.color}-50 text-${kpi.color}-600 group-hover:bg-${kpi.color}-600 group-hover:text-white transition-all duration-500 shadow-sm`}>
                <kpi.icon className="w-5 h-5" />
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
              <h3 className="text-3xl font-black text-brand-900 tracking-tighter leading-none tabular-nums flex items-baseline gap-1">
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Yield Performance (Donut Chart) */}
        <div className="bg-surface rounded-2xl shadow-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
          <div className="absolute top-6 left-8 text-center sm:text-left">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Process Yield</p>
            <h3 className="text-lg font-black text-brand-900 tracking-tight leading-none">Yield Efficiency</h3>
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
              <p className="text-3xl font-black text-brand-900 tracking-tighter">
                {accountingSummary.totalGround > 0 ? ((accountingSummary.netOutput / accountingSummary.totalGround) * 100).toFixed(0) : '0'}%
              </p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Efficiency</p>
            </div>
          </div>
        </div>

        {/* Plant Health Summary */}
        <div className="lg:col-span-3 bg-surface rounded-2xl shadow-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4 hover:shadow-2xl transition-all duration-500 relative">
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
                <h3 className="text-base font-black text-brand-900 tracking-tight">Plant Status: Optimal</h3>
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
                <span className="text-[11px] font-black text-brand-900 leading-none">{accountingSummary.dailyAvg} MT</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight"></span>
              </div>
            </div>
          </div>

          <div className="space-y-6 md:border-l md:border-slate-50 md:pl-10">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-brand-50 rounded-2xl flex items-center justify-center border border-brand-100">
                <Flame className="w-5 h-5 text-brand-500" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Efficiency Metrics</p>
                <h3 className="text-base font-black text-brand-900 tracking-tight">Resource Utilization</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-brand-50/20 rounded-2xl border border-brand-100/50">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Fuel / MT</p>
                <p className="text-2xl font-black text-brand-900 leading-none">{energyStats.fuelPerMT}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">U/MT</p>
              </div>
              <div className="p-4 bg-rose-50/20 rounded-2xl border border-rose-100/50">
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Elec. / MT</p>
                <p className="text-2xl font-black text-brand-900 leading-none">{energyStats.elecPerMT}</p>
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
                <h3 className="text-base font-black text-brand-900 tracking-tight">Compliance Summary</h3>
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
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-sm">
              <FileSpreadsheet className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest"></p>
              <h3 className="text-base font-black text-brand-900">Composition Archives</h3>
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
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-300 outline-none w-52 transition-all"
              />
            </div>
            <button
              onClick={handleExportComposition}
              className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-600 text-[11px] font-bold uppercase tracking-wider rounded-xl hover:bg-violet-100 border border-violet-100 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-brand-800 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl hover:bg-slate-700 transition-all">
              <RefreshCw className="w-3 h-3" />
              Sync
            </button>
          </div>
        </div>

        <div className="premium-table-scroll" style={{maxHeight:'500px'}}>
          <table className="premium-table">
            <thead>
              <tr>
                {compositionHeaders.map((header, idx) => (
                  <th key={idx}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCompositionData.length === 0 ? (
                <tr className="tbl-empty">
                  <td colSpan={10}>No historical data found</td>
                </tr>
              ) : (
                filteredCompositionData.slice(0, 50).map((row, idx) => (
                  <tr key={idx}>
                    <td className="tbl-ts">{formatDisplayDate(row.timestamp)}</td>
                    <td>
                      <span className="tbl-badge tbl-badge-blue">{row.campaign_no || '—'}</span>
                    </td>
                    <td style={{fontSize:'13px', fontWeight:700, color:'oklch(0.30 0.05 145)'}}>{row.product_name || '—'}</td>
                    <td className="tbl-num" style={{fontSize:'14px', fontWeight:900, color:'oklch(0.25 0.04 145)'}}>{row.qty || '0'}</td>
                    <td style={{fontSize:'12px', color:'oklch(0.45 0.03 240)'}}>{row.loi_pct || '—'}</td>
                    <td style={{fontSize:'13px', fontWeight:700, color:'oklch(0.30 0.04 240)'}}>{row.rm_req || '—'}</td>
                    <td style={{fontSize:'13px', fontWeight:900, color:'oklch(0.44 0.14 145)'}}>{row.al2o3 || '—'}</td>
                    <td style={{fontSize:'12px', color:'oklch(0.40 0.04 240)'}}>{row.fe2o3 || '—'}</td>
                    <td style={{fontSize:'12px', color:'oklch(0.40 0.04 240)'}}>{row.sio2 || '—'}</td>
                    <td>
                      <span style={{fontSize:'11px', fontWeight:900, background:'oklch(0.18 0.04 145)', color:'#fff', padding:'3px 10px', borderRadius:'8px', display:'inline-block'}}>${row.total_cost || row.totalCost || '0.00'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2.5 bg-slate-50/40 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
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
