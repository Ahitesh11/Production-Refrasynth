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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm ring-1 ring-slate-100/50">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-600/20 ring-4 ring-blue-50">
            <Database className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">IMS</h1>
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
          <div className="px-4 py-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200 border border-blue-500">
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
              ? "bg-white text-blue-600 shadow-sm border border-slate-200"
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
              ? "bg-white text-blue-600 shadow-sm border border-slate-200"
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
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden ring-1 ring-slate-100">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">S.No.</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Raw Material Name</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100">Opening Stock</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100">Purchase Qty</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100">Use Stock</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100">Issue Qty</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100 border-r border-slate-50">Actual Stock</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center border-b border-slate-100 bg-slate-50/30">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {inventoryData.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-8 py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Database className="w-10 h-10 text-slate-200" />
                            <p className="text-slate-400 italic text-sm">No inventory records found.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      inventoryData.map((item, idx) => {
                        const materialName = item['Raw Material Name'] || item['Material Name'] || '-';
                        const actualStock = Number(item['Actual Stock'] || 0);
                        return (
                          <tr key={idx} className="group hover:bg-slate-50/50 transition-all duration-300">
                            <td className="px-8 py-5 text-xs font-bold text-slate-400">{item['S. No.'] || idx + 1}</td>
                            <td className="px-6 py-5">
                              <span className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                                {materialName}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-sm font-bold text-slate-600 text-right font-mono">
                              {Number(item['Opening Stock'] || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-5 text-sm font-bold text-emerald-600 text-right font-mono">
                              + {Number(item['Purchase Qty'] || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-5 text-sm font-bold text-orange-600 text-right font-mono">
                              - {Number(item['Use Stock'] || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-5 text-sm font-bold text-rose-600 text-right font-mono">
                              - {Number(item['Issue Qty'] || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-5 text-right border-r border-slate-50">
                              <span className={cn(
                                "inline-block px-4 py-1.5 rounded-xl text-sm font-black shadow-sm border",
                                actualStock < 0
                                  ? 'bg-rose-50 text-rose-700 border-rose-100 ring-4 ring-rose-50/50'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-100 ring-4 ring-emerald-50/50'
                              )}>
                                {actualStock.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-center bg-slate-50/10 active:bg-blue-50/50 transition-colors">
                              <button
                                onClick={() => handleOpenForm(materialName)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-blue-200 border border-blue-500"
                              >
                                <PlusCircle className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Issue</span>
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100/50 mt-4">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-blue-900 font-medium">To update this inventory list, submit an entry using the "Issue" button. Your stock levels sync instantly.</p>
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
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden ring-1 ring-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-slate-50 bg-slate-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                    <HistoryIcon className="w-4 h-4 text-amber-600" />
                  </div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight">Issue Records (Material 1-6)</h2>
                </div>
                <div className="relative group max-w-sm w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0 min-w-[1600px]">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 sticky left-0 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.02)] z-10 w-[180px]">Timestamp</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 whitespace-nowrap">Campaign / Product</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Shift / Date</th>
                      <th className="px-4 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center bg-slate-50/20">Mat 1</th>
                      <th className="px-4 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center">Mat 2</th>
                      <th className="px-4 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center bg-slate-50/20">Mat 3</th>
                      <th className="px-4 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center">Mat 4</th>
                      <th className="px-4 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center bg-slate-50/20">Mat 5</th>
                      <th className="px-4 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center">Mat 6</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-8 py-16 text-center">
                          <p className="text-slate-400 italic text-sm">No activity records found.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-5 sticky left-0 bg-white group-hover:bg-blue-50/30 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.02)] z-10">
                            <div className="flex items-center gap-3">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[11px] font-bold text-slate-900">{entry.timestamp}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{entry.data['Campaign No.'] || entry.data.campaign_no || '-'}</span>
                              <span className="text-[10px] text-blue-600 font-bold uppercase truncate max-w-[200px]">{entry.data['Product Name'] || entry.data.product_name || '-'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">{entry.data.shift || 'General'}</span>
                              <span className="text-[10px] font-bold text-slate-900">{entry.data.date || '-'}</span>
                            </div>
                          </td>

                          {/* Material 1 */}
                          <td className="px-4 py-5 text-center bg-slate-50/20 border-r border-slate-100/50">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[80px]">{entry.data['Material 1'] || entry.data.mat1 || '-'}</span>
                              <span className="text-sm font-black text-slate-900">{entry.data.Qty1 || entry.data.qty1 || '-'}</span>
                            </div>
                          </td>
                          {/* Material 2 */}
                          <td className="px-4 py-5 text-center border-r border-slate-100/50">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[80px]">{entry.data['Material 2'] || entry.data.mat2 || '-'}</span>
                              <span className="text-sm font-black text-slate-700">{entry.data.Qty2 || entry.data.qty2 || '-'}</span>
                            </div>
                          </td>
                          {/* Material 3 */}
                          <td className="px-4 py-5 text-center bg-slate-50/20 border-r border-slate-100/50">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[80px]">{entry.data['Material 3'] || entry.data.mat3 || '-'}</span>
                              <span className="text-sm font-black text-slate-700">{entry.data.Qty3 || entry.data.qty3 || '-'}</span>
                            </div>
                          </td>
                          {/* Material 4 */}
                          <td className="px-4 py-5 text-center border-r border-slate-100/50">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[80px]">{entry.data['Material 4'] || entry.data.mat4 || '-'}</span>
                              <span className="text-sm font-black text-slate-700">{entry.data.Qty4 || entry.data.qty4 || '-'}</span>
                            </div>
                          </td>
                          {/* Material 5 */}
                          <td className="px-4 py-5 text-center bg-slate-50/20 border-r border-slate-100/50">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[80px]">{entry.data['Material 5'] || entry.data.mat5 || '-'}</span>
                              <span className="text-sm font-black text-slate-700">{entry.data.Qty5 || entry.data.qty5 || '-'}</span>
                            </div>
                          </td>
                          {/* Material 6 */}
                          <td className="px-4 py-5 text-center border-r border-slate-100/50">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[80px]">{entry.data['Material 6'] || entry.data.mat6 || '-'}</span>
                              <span className="text-sm font-black text-slate-700">{entry.data.Qty6 || entry.data.qty6 || '-'}</span>
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
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30 ring-4 ring-white/10">
                    <ClipboardList className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Issue Material</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Selected Material: {selectedMaterial}</p>
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-4 px-4 py-2 bg-slate-50 border-y border-slate-100">Material Entry (Up to 6 slots)</p>
                <DepartmentForm
                  department={sb3GroundDepartment}
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
