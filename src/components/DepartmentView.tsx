import React, { useState, useMemo } from 'react';
import { Department, Entry } from '../types';
import { Settings, Plus, Download, Filter, FileSpreadsheet, ListTodo, Search, History, TestTube2, AlertCircle, FileText, CheckCircle2, FlaskConical, Beaker, Check, Save, Loader2, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import DepartmentForm from './DepartmentForm';
import { motion, AnimatePresence } from 'motion/react';
import { cn, parseGlobalDate, exportToCSV } from '../lib/utils';

interface Props {
  department: Department;
  entries: Entry[];
  onAddEntry: (entry: Entry) => void;
  onUpdateEntry: (entry: Entry) => void;
  userType: 'Entry' | 'Mark Done' | 'Admin';
  parameterRanges?: Record<string, string>;
  scriptUrl?: string;
}

const parseRange = (rangeStr: string): { min: number, max: number } | null => {
  if (!rangeStr) return null;

  const getRepeatedValue = (s: string): number | null => {
    if (!s) return null;
    for (let i = 1; i <= s.length / 2; i++) {
      const p = s.substring(0, i);
      if (s === p.repeat(s.length / i)) {
        const val = parseFloat(p);
        if (!isNaN(val)) return val;
      }
    }
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

  for (let i = 1; i < clean.length; i++) {
    const left = clean.substring(0, i);
    const right = clean.substring(i);
    const min = getRepeatedValue(left);
    const max = getRepeatedValue(right);
    if (min !== null && max !== null) return { min, max };
  }

  const numbers = rangeStr.match(/-?\d+(\.\d+)?/g);
  if (numbers && numbers.length >= 2) {
    return { min: parseFloat(numbers[0]), max: parseFloat(numbers[1]) };
  }

  return null;
};

const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/.test(dateStr)) return dateStr;
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return format(date, 'MM/dd/yyyy HH:mm:ss');
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

export default function DepartmentView({ department, entries, onAddEntry, onUpdateEntry, userType, parameterRanges: initialRanges, scriptUrl }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminLimitOpen, setIsAdminLimitOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [localRanges, setLocalRanges] = useState<Record<string, string>>(initialRanges || {});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('All');
  const [protocolFilter, setProtocolFilter] = useState<string>('All');

  React.useEffect(() => {
    if (initialRanges) setLocalRanges(initialRanges);
  }, [initialRanges]);

  const safeEntries = Array.isArray(entries) ? entries : [];

  const sortedEntries = useMemo(() => {
    const entriesCopy = [...safeEntries];
    const dateField = department.fields.find(f => f.name.toLowerCase().includes('date') || f.label.toLowerCase().includes('date'));

    if (!dateField) return entriesCopy;

    return entriesCopy.sort((a, b) => {
      const valA = a.data[dateField.label] || a.data[dateField.name] || '';
      const valB = b.data[dateField.label] || b.data[dateField.name] || '';

      if (!valA && !valB) return 0;
      if (!valA) return 1;
      if (!valB) return -1;

      return parseGlobalDate(valB) - parseGlobalDate(valA);
    });
  }, [safeEntries, department.fields]);

  const hasProtocol = department.fields.some(f => f.name === 'entry_type');
  const protocolOptions = department.id === 'kiln' ? ['All', 'Shift', 'Composite'] : [];

  const [dguReport, setDguReport] = useState<'all' | 'fineness' | 'lab'>('all');
  const [ballingReport, setBallingReport] = useState<'all' | 'moisture' | 'lab'>('all');

  const visibleFields = useMemo(() => {
    const base = department.fields.filter(f => f.name !== 'entry_type');

    if (department.id === 'drop_test') {
      return base.filter(f =>
        ['campaign_no', 'product_name', 'shift', 'date', 'note', 'rm1_pct', 'rm2_pct', 'rm3_pct'].includes(f.name)
      );
    }

    if (department.id === 'balling_disc') {
      if (ballingReport === 'moisture') {
        return base.filter(f =>
          ['campaign', 'shift', 'date', 'name', 'drop_test', 'note'].includes(f.name) || f.name.startsWith('gbm_')
        );
      }
      if (ballingReport === 'lab') {
        return base.filter(f =>
          ['campaign', 'shift', 'date', 'name', 'al2o3', 'fe2o3', 'tio2', 'loi', 'note'].includes(f.name)
        );
      }
      return base;
    }

    if (department.id !== 'dgu') return base;
    if (dguReport === 'fineness') {
      return base.filter(f =>
        ['campaign_no', 'shift', 'date', 'name', 'note'].includes(f.name) || f.name.startsWith('fineness_')
      );
    }
    if (dguReport === 'lab') {
      return base.filter(f =>
        ['campaign_no', 'date', 'name', 'al2o3', 'fe2o3', 'tio2', 'loi', 'note'].includes(f.name)
      );
    }
    return base;
  }, [department.fields, department.id, dguReport, ballingReport]);

  const uniqueCampaigns = useMemo(() => {
    const campaigns = new Set<string>();
    sortedEntries.forEach(e => {
      const c = e.data['Campaign No.'] || e.data.campaign_no || e.data.campaign || e.data['Campaign'];
      if (c) campaigns.add(String(c).trim());
    });
    return Array.from(campaigns).sort();
  }, [sortedEntries]);

  const displayedEntries = useMemo(() => {
    let filtered = sortedEntries;

    if (department.id === 'dgu' && dguReport !== 'all') {
      filtered = filtered.filter(e => {
        const d = e.data;
        if (dguReport === 'fineness') {
          return ['Fineness %1','Fineness %2','Fineness %3','Fineness %4',
                  'Fineness %5','Fineness %6','Fineness %7','Fineness %8',
                  'fineness_1','fineness_2','fineness_3','fineness_4',
                  'fineness_5','fineness_6','fineness_7','fineness_8']
            .some(k => d[k] !== undefined && d[k] !== '' && d[k] !== null);
        } else {
          return ['Al2O3','Fe2O3','TiO2','Loi','al2o3','fe2o3','tio2','loi']
            .some(k => d[k] !== undefined && d[k] !== '' && d[k] !== null);
        }
      });
    }

    if (department.id !== 'dgu' && hasProtocol && protocolFilter !== 'All') {
      filtered = filtered.filter(e => {
        const proto = e.data['Entry Protocol'] || e.data['entry_type'] || e.data['Entry Type'] || 'Shift';
        return String(proto).toLowerCase() === protocolFilter.toLowerCase();
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(e => {
        const allValues = [e.timestamp, ...Object.values(e.data)].map(v => String(v).toLowerCase());
        return allValues.some(v => v.includes(term));
      });
    }

    if (selectedCampaign !== 'All') {
      filtered = filtered.filter(e => {
        const c = e.data['Campaign No.'] || e.data.campaign_no || e.data.campaign || e.data['Campaign'];
        return c && String(c).trim() === selectedCampaign;
      });
    }

    return filtered;
  }, [sortedEntries, searchTerm, selectedCampaign, protocolFilter, hasProtocol, dguReport, department.id]);

  const canAdd = userType === 'Entry' || userType === 'Admin';
  const canMarkDone = userType === 'Mark Done' || userType === 'Admin';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-brand-900">{department.displayName || department.name}</h2>
          <p className="text-sm text-slate-500 mt-1">Manage and track {department.category.toLowerCase()} entries.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">

          {canAdd && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              Add New Entry
            </button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="glass-card overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 px-4 py-3 border-b border-slate-200/80 bg-slate-50/30">
          <div className="flex items-center gap-3 w-full flex-1">
            {uniqueCampaigns.length > 0 && (
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="form-input w-[160px] shrink-0 py-2 text-xs font-bold"
              >
                <option value="All">All Campaigns</option>
                {uniqueCampaigns.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search entries..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="form-input w-full pl-10"
              />
            </div>
          </div>
          {hasProtocol && protocolOptions.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              {protocolOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => setProtocolFilter(opt)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                    protocolFilter === opt
                      ? "bg-surface shadow-sm text-primary-dark border border-primary-light"
                      : "text-slate-500 hover:text-foreground"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest shrink-0 whitespace-nowrap">
            {displayedEntries.length} result{displayedEntries.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => exportToCSV(displayedEntries.map(e => ({ Timestamp: e.timestamp, ...e.data })), department.name)}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-brand-700 hover:bg-brand-100 hover:text-brand-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-brand-200 shadow-sm shrink-0"
            title="Download CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>

        {/* DGU Report View Tabs */}
        {department.id === 'dgu' && (
          <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-slate-50/20 border-b border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">View:</span>
            {([
              { id: 'all', label: 'All Entries', color: 'bg-primary text-white shadow-md' },
              { id: 'fineness', label: 'Fineness', color: 'bg-emerald-600 text-white' },
              { id: 'lab', label: 'Lab', color: 'bg-brand-600 text-white' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setDguReport(tab.id)}
                className={cn(
                  'px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border',
                  dguReport === tab.id
                    ? tab.color + ' border-transparent shadow-md'
                    : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Balling Disc Report View Tabs */}
        {department.id === 'balling_disc' && (
          <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-slate-50/20 border-b border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">View:</span>
            {([
              { id: 'all', label: 'All Entries', color: 'bg-brand-800 text-white' },
              { id: 'moisture', label: 'Moisture', color: 'bg-cyan-600 text-white' },
              { id: 'lab', label: 'Lab', color: 'bg-brand-600 text-white' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setBallingReport(tab.id)}
                className={cn(
                  'px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border',
                  ballingReport === tab.id
                    ? tab.color + ' border-transparent shadow-md'
                    : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="premium-table-wrap">
          <div className="premium-table-scroll">
          <table className="premium-table">
            <thead>
              <tr>
                <th className="col-sticky-left" style={{minWidth:'140px'}}>
                  Timestamp
                </th>
                {visibleFields.map(field => {
                  let avgStr: string | null = null;
                  let sumStr: string | null = null;
                  
                  if (field.type === 'number' || ['Al2O3', 'Fe2O3', 'TiO2', 'Loi', 'SiO2', 'CaO', 'MgO', 'Fineness', 'Drop Test'].some(k => field.label.includes(k))) {
                    const nums = displayedEntries
                      .map(e => parseFloat(e.data[field.label] || e.data[field.name]))
                      .filter(v => !isNaN(v));
                    
                    if (nums.length > 0) {
                      const sumNum = nums.reduce((a, b) => a + b, 0);
                      const avgNum = sumNum / nums.length;
                      avgStr = avgNum.toFixed(2);
                      sumStr = sumNum.toFixed(2);
                    }
                  }

                  return (
                    <th key={field.name} style={{whiteSpace:'nowrap'}}>
                      {avgStr !== null && sumStr !== null && (
                        <div style={{marginBottom:'4px', display:'flex', gap:'8px'}}>
                          <div>
                            <span style={{fontSize:'11px', fontWeight:900, color:'oklch(0.55 0.2 260)', marginRight:'2px'}}>{sumStr}</span>
                            <span style={{fontSize:'8px', color:'oklch(0.65 0.1 260)', textTransform:'uppercase', opacity:0.8}}>Sum</span>
                          </div>
                          <div>
                            <span style={{fontSize:'11px', fontWeight:900, color:'oklch(0.44 0.14 145)', marginRight:'2px'}}>{avgStr}</span>
                            <span style={{fontSize:'8px', color:'oklch(0.62 0.04 240)', textTransform:'uppercase', opacity:0.8}}>Avg</span>
                          </div>
                        </div>
                      )}
                      {field.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayedEntries.length === 0 ? (
                <tr className="tbl-empty">
                  <td colSpan={visibleFields.length + 1}>
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="w-10 h-10" style={{color:'oklch(0.78 0.05 145)'}} />
                      <p>
                        {searchTerm || protocolFilter !== 'All' || dguReport !== 'all' ? 'No matching entries found.' : 'No entries found for this department.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="col-sticky-left tbl-ts">
                      {formatDisplayDate(entry.timestamp)}
                    </td>
                    {visibleFields.map(field => {
                      let value = entry.data[field.label] || entry.data[field.name];

                      if (field.type === 'date' && value) {
                        value = formatDisplayDate(value);
                      }

                      const rangeStr = localRanges?.[field.label] || localRanges?.[field.name];
                      const range = parseRange(rangeStr || '');

                      let cellClass = "text-sm text-slate-700 whitespace-nowrap";
                      let statusIcon = null;

                      let hasColored = false;

                      if (department.id === 'kiln' && value !== undefined && value !== null && value !== '') {
                        const targetMinStr = `${field.label.toLowerCase()} min`;
                        const targetMaxStr = `${field.label.toLowerCase()} max`;
                        let minVal, maxVal;

                        for (const key in entry.data) {
                          const kLower = key.toLowerCase().trim();
                          if (kLower === targetMinStr) minVal = entry.data[key];
                          if (kLower === targetMaxStr) maxVal = entry.data[key];
                        }

                        if (minVal === undefined || maxVal === undefined) {
                          const tMin2 = targetMinStr.replace(/\s+/g, '');
                          const tMax2 = targetMaxStr.replace(/\s+/g, '');
                          for (const key in entry.data) {
                            const kClean = key.toLowerCase().replace(/\s+/g, '');
                            if (kClean === tMin2) minVal = entry.data[key];
                            if (kClean === tMax2) maxVal = entry.data[key];
                          }
                        }
                        
                        if (minVal !== undefined && maxVal !== undefined && minVal !== '' && maxVal !== '') {
                          const min = parseFloat(minVal);
                          const max = parseFloat(maxVal);
                          const numValue = parseFloat(value);
                          
                          if (!isNaN(numValue) && !isNaN(min) && !isNaN(max)) {
                            hasColored = true;
                            if (numValue >= min && numValue <= max) {
                              cellClass = cn(cellClass, "text-emerald-700 font-bold bg-emerald-50/70 rounded-lg px-3 py-1.5 inline-block");
                              statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline ml-1" />;
                            } else {
                              cellClass = cn(cellClass, "text-rose-700 font-bold bg-rose-50/70 rounded-lg px-3 py-1.5 inline-block");
                              statusIcon = <AlertCircle className="w-3.5 h-3.5 text-rose-500 inline ml-1" />;
                            }
                          }
                        }
                      } 
                      
                      if (!hasColored && (department.id === 'dgu' || department.id === 'balling_disc' || department.id === 'product_house')) {
                        const label = field.label.trim();
                        let min: number | null = null;
                        let max: number | null = null;
                        let reverseLogic = false;

                        if (department.id === 'product_house') {
                          if (label === 'Al2O3') { min = 87.5; max = 89; }
                          else if (label === 'Fe2O3') { min = 1.6; max = 2; }
                          else if (label === 'SiO2') { min = 5; max = 6; }
                          else if (label === 'TiO2') { min = 1.35; max = 1.55; }
                          else if (label === 'CaO') { min = 0.25; max = 0.4; }
                          else if (label === 'MgO') { min = 0.3; max = 0.4; }
                        } else {
                          if (label === 'Al2O3') { min = 82.5; max = 83.5; }
                          else if (label === 'Fe2O3') { min = 1.55; max = 1.7; }
                          else if (label === 'TiO2') { min = 1.25; max = 1.35; }
                          else if (label === 'Loi') { min = 5; max = 6; }
                        }

                        if (label.startsWith('Fineness')) {
                          min = localRanges[label] ? parseFloat(localRanges[label]) : (localRanges['Fineness'] ? parseFloat(localRanges['Fineness']) : 95);
                          max = 1000;
                        }
                        else if (label.includes('Drop Test')) {
                          min = localRanges[label] ? parseFloat(localRanges[label]) : (localRanges['Drop Test'] ? parseFloat(localRanges['Drop Test']) : 2.5);
                          max = 1000;
                        }
                        else if (label.includes('Moisture') || label.includes('GBM')) {
                          max = label.includes('GBM') ? 25 : (localRanges[label] ? parseFloat(localRanges[label]) : (localRanges['Moisture'] ? parseFloat(localRanges['Moisture']) : 15));
                          reverseLogic = true;
                        }

                        if (value !== undefined && value !== null && value !== '') {
                          const numValue = parseFloat(value);
                          if (!isNaN(numValue)) {
                            if (reverseLogic) {
                              if (numValue <= (max || 0)) {
                                cellClass = cn(cellClass, "text-emerald-700 font-bold bg-emerald-50/70 rounded-lg px-3 py-1.5 inline-block");
                                statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline ml-1" />;
                              } else {
                                cellClass = cn(cellClass, "text-rose-700 font-bold bg-rose-50/70 rounded-lg px-3 py-1.5 inline-block");
                                statusIcon = <AlertCircle className="w-3.5 h-3.5 text-rose-500 inline ml-1" />;
                              }
                            } else if (min !== null && max !== null) {
                              if (numValue >= min && numValue <= max) {
                                cellClass = cn(cellClass, "text-emerald-700 font-bold bg-emerald-50/70 rounded-lg px-3 py-1.5 inline-block");
                                statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline ml-1" />;
                              } else {
                                cellClass = cn(cellClass, "text-rose-700 font-bold bg-rose-50/70 rounded-lg px-3 py-1.5 inline-block");
                                statusIcon = <AlertCircle className="w-3.5 h-3.5 text-rose-500 inline ml-1" />;
                              }
                            }
                          }
                        }
                      } else if (!hasColored && department.id === 'drop_test') {
                        const label = field.label.trim();
                        if (label.includes('%')) {
                          const num = label.match(/\d/)?.[0];
                          if (num) {
                            const minVal = entry.data[`Rm ${num} Min`];
                            const maxVal = entry.data[`Rm ${num} Max`];
                            const min = parseFloat(minVal);
                            const max = parseFloat(maxVal);
                            const val = parseFloat(value);

                            if (!isNaN(min) && !isNaN(max) && !isNaN(val)) {
                              if (val >= min && val <= max) {
                                cellClass = cn(cellClass, "text-emerald-700 font-bold bg-emerald-50/70 rounded-lg px-3 py-1.5 inline-block");
                                statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline ml-1" />;
                              } else {
                                cellClass = cn(cellClass, "text-rose-700 font-bold bg-rose-50/70 rounded-lg px-3 py-1.5 inline-block");
                                statusIcon = <AlertCircle className="w-3.5 h-3.5 text-rose-500 inline ml-1" />;
                              }
                              hasColored = true;
                            }
                          }
                        }
                      } 
                      
                      if (!hasColored && range && value !== undefined && value !== null && value !== '') {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                          if (numValue >= range.min && numValue <= range.max) {
                            cellClass = cn(cellClass, "text-emerald-600 font-bold bg-emerald-50/30 rounded-lg px-3 py-1.5 inline-block");
                          } else {
                            cellClass = cn(cellClass, "text-rose-600 font-bold bg-rose-50/30 rounded-lg px-3 py-1.5 inline-block");
                          }
                        }
                      }

                      if (field.name.toLowerCase().includes('shift') && typeof value === 'string') {
                        if (value === 'Shift A') cellClass = cn(cellClass, "badge-shift-a");
                        else if (value === 'Shift B') cellClass = cn(cellClass, "badge-shift-b");
                        else if (value === 'Shift C') cellClass = cn(cellClass, "badge-shift-c");
                      }

                      return (
                        <td key={field.name} className="px-4 py-2.5">
                          <span className={cellClass}>
                            {value || '-'}
                            {statusIcon}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Add Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false) }}>
          <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden modal-container">
            <DepartmentForm
              department={department}
              onClose={() => setIsModalOpen(false)}
              onSuccess={async (data) => {
                const timestamp = format(new Date(), 'MM/dd/yyyy HH:mm:ss');
                const formattedData = { ...data };
                department.fields.forEach(f => {
                  if (f.type === 'date' && formattedData[f.name]) {
                    try {
                      formattedData[f.name] = format(new Date(formattedData[f.name]), 'MM/dd/yyyy');
                    } catch (e) { }
                  }
                });

                const uid = `ID_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                const newEntry: Entry = {
                  id: uid,
                  departmentId: department.id,
                  timestamp,
                  data: formattedData
                };

                {
                  setSyncingId(newEntry.id);
                  const partialData: Record<string, any> = { 'Timestamp': newEntry.timestamp };
                  department.fields.forEach(f => {
                    if (f.name !== 'entry_type') {
                      let val = formattedData[f.name] || '';
                      if (f.type === 'date' && val && !/^\d{2}\/\d{2}\/\d{4}/.test(val)) {
                        try { val = format(new Date(val), 'MM/dd/yyyy'); } catch (e) { }
                      }
                      partialData[f.label] = val;
                    }
                  });

                  try {
                    const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl)}`;
                    const response = await fetch(proxyUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                      body: JSON.stringify({
                        sheetName: department.name,
                        entryId: newEntry.timestamp,
                        values: [],
                        partialData: partialData
                      }),
                    });
                    const resData = await response.json().catch(() => ({}));
                    if (response.ok && resData.result === 'success') {
                      alert('✅ Data saved successfully to Google Sheets!');
                    } else {
                      throw new Error(resData.error || 'Failed to sync with Google Sheets');
                    }
                  } catch (error: any) {
                    console.error('Live sync failed:', error);
                    alert(`❌ Sync Failed: ${error.message}\n\nData is saved locally but not in Google Sheets.`);
                  } finally {
                    setSyncingId(null);
                  }
                }

                onAddEntry(newEntry);
                setIsModalOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Admin Limit Modal */}
      {isAdminLimitOpen && (
        <AdminLimitModal
          ranges={localRanges}
          onClose={() => setIsAdminLimitOpen(false)}
          onSave={async (newRanges) => {
            setLocalRanges(newRanges);
            try {
              const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl || '')}`;
              const keys = ['Al2O3', 'Fe2O3', 'SiO2', 'TiO2', 'CaO', 'MgO', 'Loi', 'Fineness', 'Drop Test 1', 'Drop Test 2', 'Drop Test 3', 'Drop Test', 'Moisture'];
              for (const key of keys) {
                if (newRanges[key]) {
                  await fetch(proxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sheetName: 'Parameter_Range',
                      uniqueId: key,
                      partialData: { "Parameter Name": key, "Range": newRanges[key] }
                    })
                  });
                }
              }
              alert('✅ All Limits Updated Successfully!');
            } catch (e) {
              console.error('Limit Update Failed:', e);
              alert('❌ Failed to sync limits to Google Sheets.');
            }
          }}
        />
      )}
    </div>
  );
}

function AdminLimitModal({ ranges, onClose, onSave }: {
  ranges: Record<string, string>,
  onClose: () => void,
  onSave: (ranges: Record<string, string>) => Promise<void>
}) {
  const [localRanges, setLocalRanges] = useState({ ...ranges });
  const [isSaving, setIsSaving] = useState(false);

  const keys = ['Al2O3', 'Fe2O3', 'SiO2', 'TiO2', 'CaO', 'MgO', 'Loi', 'Fineness', 'Drop Test 1', 'Drop Test 2', 'Drop Test 3', 'Drop Test', 'Moisture'];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        <div className="px-8 py-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div>
            <p className="text-brand-300 text-[10px] font-bold uppercase tracking-widest mb-1">Quality Control</p>
            <h2 className="text-xl font-bold tracking-tight">Limit Configuration</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="p-8 space-y-5 overflow-y-auto max-h-[70vh] custom-scrollbar">
          <div className="grid grid-cols-1 gap-4">
            {keys.map(key => (
              <div key={key} className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{key}</label>
                <input
                  type="text"
                  value={localRanges[key] || ''}
                  placeholder={['Fineness', 'Drop Test', 'Moisture'].includes(key) ? 'e.g. 95' : 'e.g. 82.5 to 83.5'}
                  onChange={(e) => setLocalRanges({ ...localRanges, [key]: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 outline-none text-sm font-medium text-slate-700 transition-all"
                />
                <p className="text-[9px] text-slate-400 italic ml-1">
                  {['Drop Test', 'Drop Test 1', 'Drop Test 2', 'Drop Test 3', 'Fineness'].includes(key) 
                    ? 'Value BELOW this will be RED, above will be GREEN.' 
                    : ['Moisture'].includes(key) 
                      ? 'Value ABOVE this will be RED, below will be GREEN.' 
                      : 'Standard Min to Max format.'}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
            <button 
              onClick={onClose} 
              className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:text-brand-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                setIsSaving(true);
                await onSave(localRanges);
                setIsSaving(false);
                onClose();
              }}
              disabled={isSaving}
              className="px-8 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-brand-200/50 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Apply & Sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}