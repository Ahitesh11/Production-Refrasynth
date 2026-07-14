import React, { useState, useMemo } from 'react';
import { Department, Entry } from '../types';
import { Package, ClipboardList, Database, ArrowRight, PlusCircle, X, Search, History as HistoryIcon, User, List, Calendar, Box } from 'lucide-react';
import DepartmentForm from './DepartmentForm';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Props {
  inventoryData: any[];
  sb3GroundDepartment: Department;
  entries: Entry[];
  onSuccess: (data: Record<string, any>) => void | Promise<void>;
}

type Tab = 'overview' | 'history';

export default function InventoryView({ inventoryData, sb3GroundDepartment, entries, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Normalize department entries
  const sb3Entries = useMemo(() => {
    // Some might be tagged as 'inventory' due to previous logic, mostly 'sb3_ground'
    return entries.filter(e =>
      e.departmentId === 'sb3_ground' ||
      e.departmentId === 'inventory' ||
      e.departmentId.includes('sb3')
    );
  }, [entries]);

  const handleOpenForm = (material: string) => {
    setSelectedMaterial(material);
    setIsModalOpen(true);
  };

  const handleSuccess = async (data: Record<string, any>) => {
    await onSuccess(data);
    setIsModalOpen(false);
  };

  const filteredHistory = useMemo(() => {
    let sorted = [...sb3Entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      sorted = sorted.filter(e =>
        Object.values(e.data).some(v => String(v).toLowerCase().includes(term)) ||
        String(e.timestamp).toLowerCase().includes(term)
      );
    }
    return sorted;
  }, [sb3Entries, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/20">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">IMS</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em]">Live Material Stock Tracking</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
          <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Materials</p>
            <p className="text-lg font-black text-slate-900">{inventoryData.length}</p>
          </div>
          <div className="px-4 py-2 bg-brand-600 rounded-xl shadow-lg shadow-brand-200 border border-brand-500">
            <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest">History Count</p>
            <p className="text-lg font-black text-white">{entries.length}</p>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-2xl border border-slate-200/50 w-fit mx-auto sm:mx-0">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'overview'
              ? "bg-white text-brand-600 shadow-sm border border-slate-200"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          )}
        >
          <Package className="w-4 h-4" />
          Inventory Overview
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'history'
              ? "bg-white text-brand-600 shadow-sm border border-slate-200"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          )}
        >
          <HistoryIcon className="w-4 h-4" />
          Activity History
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="premium-table-wrap">
              <div className="premium-table-scroll">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th style={{width:'48px'}}>#</th>
                      <th>Raw Material Name</th>
                      <th className="text-right">Opening Stock</th>
                      <th className="text-right">Purchase Qty</th>
                      <th className="text-right">Use Stock</th>
                      <th className="text-right">Issue Qty</th>
                      <th className="text-right">Actual Stock</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const rows = inventoryData.filter(item => {
                        const name = item['Raw Material Name'] || item['Material Name'];
                        return name && String(name).trim() && String(name).trim() !== '-';
                      });
                      if (rows.length === 0) {
                        return (
                          <tr className="tbl-empty">
                            <td colSpan={8}>
                              <div className="flex flex-col items-center gap-3">
                                <Database className="w-10 h-10" style={{color:'oklch(0.78 0.05 145)'}} />
                                <p>No inventory records found.</p>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return rows.map((item, idx) => {
                        const materialName = item['Raw Material Name'] || item['Material Name'];
                        const opening = Number(item['Opening Stock'] || 0);
                        const purchase = Number(item['Purchase Qty'] || 0);
                        const used = Number(item['Use Stock'] || 0);
                        const issued = Number(item['Issue Qty'] || 0);
                        const actualStock = Number(item['Actual Stock'] || 0);
                        return (
                          <tr key={idx}>
                            <td className="tbl-ts" style={{textAlign:'center'}}>{item['S. No.'] || idx + 1}</td>
                            <td>
                              <span className="text-sm font-bold text-slate-800 uppercase tracking-tight" style={{fontSize:'12px'}}>
                                {materialName}
                              </span>
                            </td>
                            <td className="tbl-num">{opening.toLocaleString()}</td>
                            <td className="tbl-num">
                              {purchase > 0
                                ? <span className="tbl-num tbl-num-pos">+{purchase.toLocaleString()}</span>
                                : <span style={{color:'oklch(0.75 0.02 240)'}}>—</span>}
                            </td>
                            <td className="tbl-num">
                              {used > 0
                                ? <span className="tbl-num tbl-num-warn">−{used.toLocaleString()}</span>
                                : <span style={{color:'oklch(0.75 0.02 240)'}}>—</span>}
                            </td>
                            <td className="tbl-num">
                              {issued > 0
                                ? <span className="tbl-num tbl-num-neg">−{issued.toLocaleString()}</span>
                                : <span style={{color:'oklch(0.75 0.02 240)'}}>—</span>}
                            </td>
                            <td className="text-right">
                              <span className={cn('tbl-pill', actualStock < 0 ? 'tbl-pill-bad' : 'tbl-pill-ok')}>
                                {actualStock.toLocaleString()}
                              </span>
                            </td>
                            <td className="text-right">
                              <button onClick={() => handleOpenForm(materialName)} className="tbl-action-btn">
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Issue</span>
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-brand-50/50 p-6 rounded-[2rem] border border-brand-100/50 mt-4">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-brand-600" />
                <p className="text-sm text-brand-900 font-medium">To update this inventory list, submit an entry using the "Issue" button. Your stock levels sync instantly.</p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-slate-200/80 bg-slate-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                    <HistoryIcon className="w-4 h-4 text-amber-600" />
                  </div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight">Issue Records (Material 1-6)</h2>
                </div>
                <div className="relative group max-w-sm w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="premium-table-scroll" style={{maxHeight:'500px'}}>
                <table className="premium-table" style={{minWidth:'1400px'}}>
                  <thead>
                    <tr>
                      <th className="col-sticky-left" style={{minWidth:'160px'}}>Timestamp</th>
                      <th>Campaign / Product</th>
                      <th className="text-center">Shift / Date</th>
                      <th className="text-center">Mat 1</th>
                      <th className="text-center">Mat 2</th>
                      <th className="text-center">Mat 3</th>
                      <th className="text-center">Mat 4</th>
                      <th className="text-center">Mat 5</th>
                      <th className="text-center">Mat 6</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr className="tbl-empty">
                        <td colSpan={9}>
                          <div className="flex flex-col items-center gap-3">
                            <HistoryIcon className="w-10 h-10" style={{color:'oklch(0.78 0.05 145)'}} />
                            <p>No activity records found.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((entry) => (
                        <tr key={entry.id}>
                          <td className="col-sticky-left">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3 h-3 flex-shrink-0" style={{color:'oklch(0.62 0.08 145)'}} />
                              <span className="tbl-ts">{entry.timestamp}</span>
                            </div>
                          </td>
                          <td>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-black text-slate-700 uppercase tracking-tight" style={{fontSize:'11px'}}>{entry.data['Campaign No.'] || entry.data.campaign_no || '—'}</span>
                              <span style={{fontSize:'10px', color:'oklch(0.44 0.14 145)', fontWeight:700, textTransform:'uppercase', maxWidth:'160px', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{entry.data['Product Name'] || entry.data.product_name || '—'}</span>
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="tbl-badge tbl-badge-slate">{entry.data.shift || 'General'}</span>
                              <span style={{fontSize:'10px', fontWeight:700, color:'oklch(0.28 0.04 240)'}}>{entry.data.date || '—'}</span>
                            </div>
                          </td>

                          {/* Material 1 */}
                          <td className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span style={{fontSize:'9px', fontWeight:800, color:'oklch(0.55 0.04 240)', textTransform:'uppercase', maxWidth:'70px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{entry.data['Material 1'] || entry.data.mat1 || '—'}</span>
                              <span style={{fontSize:'13px', fontWeight:900, color:'oklch(0.25 0.04 145)', fontFamily:'var(--font-mono)'}}>{entry.data.Qty1 || entry.data.qty1 || '—'}</span>
                            </div>
                          </td>
                          {/* Material 2 */}
                          <td className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span style={{fontSize:'9px', fontWeight:800, color:'oklch(0.55 0.04 240)', textTransform:'uppercase', maxWidth:'70px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{entry.data['Material 2'] || entry.data.mat2 || '—'}</span>
                              <span style={{fontSize:'13px', fontWeight:900, color:'oklch(0.30 0.04 145)', fontFamily:'var(--font-mono)'}}>{entry.data.Qty2 || entry.data.qty2 || '—'}</span>
                            </div>
                          </td>
                          {/* Material 3 */}
                          <td className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span style={{fontSize:'9px', fontWeight:800, color:'oklch(0.55 0.04 240)', textTransform:'uppercase', maxWidth:'70px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{entry.data['Material 3'] || entry.data.mat3 || '—'}</span>
                              <span style={{fontSize:'13px', fontWeight:900, color:'oklch(0.30 0.04 145)', fontFamily:'var(--font-mono)'}}>{entry.data.Qty3 || entry.data.qty3 || '—'}</span>
                            </div>
                          </td>
                          {/* Material 4 */}
                          <td className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span style={{fontSize:'9px', fontWeight:800, color:'oklch(0.55 0.04 240)', textTransform:'uppercase', maxWidth:'70px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{entry.data['Material 4'] || entry.data.mat4 || '—'}</span>
                              <span style={{fontSize:'13px', fontWeight:900, color:'oklch(0.30 0.04 145)', fontFamily:'var(--font-mono)'}}>{entry.data.Qty4 || entry.data.qty4 || '—'}</span>
                            </div>
                          </td>
                          {/* Material 5 */}
                          <td className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span style={{fontSize:'9px', fontWeight:800, color:'oklch(0.55 0.04 240)', textTransform:'uppercase', maxWidth:'70px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{entry.data['Material 5'] || entry.data.mat5 || '—'}</span>
                              <span style={{fontSize:'13px', fontWeight:900, color:'oklch(0.30 0.04 145)', fontFamily:'var(--font-mono)'}}>{entry.data.Qty5 || entry.data.qty5 || '—'}</span>
                            </div>
                          </td>
                          {/* Material 6 */}
                          <td className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span style={{fontSize:'9px', fontWeight:800, color:'oklch(0.55 0.04 240)', textTransform:'uppercase', maxWidth:'70px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{entry.data['Material 6'] || entry.data.mat6 || '—'}</span>
                              <span style={{fontSize:'13px', fontWeight:900, color:'oklch(0.30 0.04 145)', fontFamily:'var(--font-mono)'}}>{entry.data.Qty6 || entry.data.qty6 || '—'}</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pop-up Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white/20"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-8 py-7 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-600/30 ring-4 ring-white/10">
                    <ClipboardList className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Issue Material</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-brand-400 font-black uppercase tracking-widest">Selected Material: {selectedMaterial}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white/70 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[75vh] custom-scrollbar">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-4 px-4 py-2 bg-slate-50 border-y border-slate-100">Material Entry</p>
                <DepartmentForm
                  department={{
                    ...sb3GroundDepartment,
                    fields: sb3GroundDepartment.fields.filter(f => ['campaign_no', 'product_name', 'shift', 'date', 'mat1', 'qty1'].includes(f.name))
                  }}
                  onClose={() => setIsModalOpen(false)}
                  onSuccess={handleSuccess}
                  initialData={{
                    mat1: selectedMaterial
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
