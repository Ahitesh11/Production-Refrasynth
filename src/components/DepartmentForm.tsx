import React, { useState } from 'react';
import { Department } from '../types';
import { X, Loader2, Database, Activity, Settings, FileText, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { getCurrentShift, cn } from '../lib/utils';

interface Props {
  department: Department;
  onClose: () => void;
  onSuccess: (data: Record<string, any>) => void | Promise<void>;
  initialData?: Record<string, any>;
}

export default function DepartmentForm({ department, onClose, onSuccess, initialData = {} }: Props) {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    department.fields.forEach(f => {
      if (f.name === 'shift') initial[f.name] = getCurrentShift();
      if (f.name === 'date') initial[f.name] = format(new Date(), 'yyyy-MM-dd');
      if (f.name === 'entry_type') initial[f.name] = 'Shift';
      // Merge initialData for things like pre-selected products/materials
      if (initialData[f.name] !== undefined) initial[f.name] = initialData[f.name];
    });
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await onSuccess(formData);
    } catch (err) {
      console.error('Submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const finenessFields = department.fields.filter(f => f.name.startsWith('fineness_'));
  const gbmFields = department.fields.filter(f => f.name.startsWith('gbm_'));
  const dropFields = department.fields.filter(f => f.name.startsWith('drop_'));
  const lbdFields = department.fields.filter(f => f.name.startsWith('lbd_h'));
  const apFields = department.fields.filter(f => /^ap_h\d$/.test(f.name));
  const bdFields = department.fields.filter(f => /^bd_h\d$/.test(f.name));

  const gridPrefixes = ['fineness_', 'gbm_', 'drop_', 'lbd_h', 'ap_h', 'bd_h'];

  const otherFields = department.fields.filter(f => {
    const isGrid = gridPrefixes.some(p => f.name.startsWith(p));
    if (isGrid) return false;
    if (f.name === 'entry_type' || f.readonly) return false;

    if (department.id === 'kiln') {
      const mode = formData.entry_type || 'Shift';
      const compositeFields = ['ap_composite', 'bd_composite', 'lbd_ap_composite', 'lbd_bd_composite'];
      if (mode === 'Shift') {
        return !compositeFields.includes(f.name);
      } else if (mode === 'Composite') {
        const shiftContextFields = ['shift', 'name', 'campaign_no', 'date', 'note'];
        return shiftContextFields.includes(f.name) || compositeFields.includes(f.name);
      }
    }

    if (department.id === 'dgu') {
      const mode = formData.entry_type || 'Shift';
      const analyticalFields = ['al2o3', 'fe2o3', 'tio2', 'loi'];
      if (mode === 'Shift') {
        return !analyticalFields.includes(f.name);
      } else if (mode === 'Daily') {
        return f.name !== 'shift'; // Hide Shift selection in Daily mode
      }
    }
    return true;
  });

  const activeGrids = [
    {
      fields: finenessFields,
      title: 'Fineness Data',
      labelPrefixes: ['Fineness %'],
      accent: 'bg-emerald-500'
    },
    { fields: gbmFields, title: 'Moisture Data', labelPrefixes: ['GBM ', 'Green Ball Moisture '], accent: 'bg-orange-500' },
    { fields: dropFields, title: 'Drop Test Data', labelPrefixes: ['Drop ', 'Drop Test '], accent: 'bg-orange-600' },
    { fields: lbdFields, title: 'LBD Readings', labelPrefixes: ['LBD '], accent: 'bg-orange-400' },
    { fields: apFields, title: 'AP Measurements', labelPrefixes: ['AP '], accent: 'bg-emerald-600' },
    { fields: bdFields, title: 'BD Measurements', labelPrefixes: ['BD '], accent: 'bg-orange-700' }
  ].filter(grid => {
    if (grid.fields.length === 0) return false;
    const mode = formData.entry_type || 'Shift';

    // Kiln logic
    if (department.id === 'kiln' && mode === 'Composite') return false;

    // DGU logic: Hide Fineness in Daily mode
    if (department.id === 'dgu' && mode === 'Daily' && grid.title === 'Fineness Data') return false;

    return true;
  });

  return (
    <div className="flex flex-col h-full max-h-[92vh] bg-slate-50 rounded-[32px] overflow-hidden shadow-2xl border border-slate-200">
      {/* Refined Header */}
      <div className="px-8 py-6 bg-white border-b border-slate-200 flex items-center justify-between relative">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-100 transition-transform hover:scale-105">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Department Protocol</span>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">{department.name}</h2>
          </div>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-8 space-y-10">
          {/* Protocol Selector for Kiln and DGU */}
          {(department.id === 'kiln' || department.id === 'dgu') && (
            <div className="flex flex-col items-center space-y-4 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {department.id === 'kiln' ? 'Kiln Protocol' : 'DGU Protocol'}
              </span>
              <div className="inline-flex p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
                {(department.id === 'kiln' ? ['Shift', 'Composite'] : ['Shift', 'Daily']).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, entry_type: mode }))}
                    className={cn(
                      "px-8 py-2.5 rounded-xl text-xs font-bold transition-all duration-300",
                      (formData.entry_type || 'Shift') === mode
                        ? "bg-orange-500 text-white shadow-md shadow-orange-100"
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Context Section */}
          <section className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-8">
            <div className="flex items-center space-x-3 pb-2 border-b border-slate-50">
              <Settings className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Configuration</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherFields.map((field) => (
                <div key={field.name} className="space-y-2 group">
                  <label className="text-[11px] font-semibold text-slate-500 ml-1">
                    {field.label}
                  </label>
                  <div className="relative">
                    {field.type === 'select' && field.options && field.options.length > 0 ? (
                      <select
                        name={field.name}
                        value={formData[field.name] || ''}
                        onChange={handleChange}
                        required={['date', 'shift'].includes(field.name)}
                        className="w-full h-11 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5 transition-all outline-none text-sm font-medium text-slate-700 appearance-none"
                      >
                        <option value="">Select...</option>
                        {field.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'time' ? (
                      <div className="flex gap-1 w-full">
                        <select
                          value={((formData[field.name] || '12:00 AM').split(' ')[0] || '12:00').split(':')[0] || '12'}
                          onChange={(e) => {
                            const currentVal = formData[field.name] || '12:00 AM';
                            const ampmStr = currentVal.split(' ')[1] || 'AM';
                            const mStr = (currentVal.split(' ')[0] || '12:00').split(':')[1] || '00';
                            setFormData(prev => ({ ...prev, [field.name]: `${e.target.value}:${mStr} ${ampmStr}` }));
                          }}
                          className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 outline-none text-sm font-medium text-slate-700 appearance-none text-center cursor-pointer"
                        >
                          {Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span className="flex items-center text-slate-300 font-bold">:</span>
                        <select
                          value={((formData[field.name] || '12:00 AM').split(' ')[0] || '12:00').split(':')[1] || '00'}
                          onChange={(e) => {
                            const currentVal = formData[field.name] || '12:00 AM';
                            const ampmStr = currentVal.split(' ')[1] || 'AM';
                            const hStr = (currentVal.split(' ')[0] || '12:00').split(':')[0] || '12';
                            setFormData(prev => ({ ...prev, [field.name]: `${hStr}:${e.target.value} ${ampmStr}` }));
                          }}
                          className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 outline-none text-sm font-medium text-slate-700 appearance-none text-center cursor-pointer"
                        >
                          {Array.from({length: 60}, (_, i) => String(i).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          value={(formData[field.name] || '12:00 AM').split(' ')[1] || 'AM'}
                          onChange={(e) => {
                            const currentTime = (formData[field.name] || '12:00 AM').split(' ')[0] || '12:00';
                            setFormData(prev => ({ ...prev, [field.name]: `${currentTime} ${e.target.value}` }));
                          }}
                          className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 outline-none text-sm font-medium text-slate-700 appearance-none text-center cursor-pointer"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    ) : (
                      <input
                        type={field.type === 'select' ? 'text' : field.type}
                        step={field.type === 'number' ? 'any' : undefined}
                        name={field.name}
                        value={formData[field.name] || ''}
                        onChange={handleChange}
                        required={['date', 'shift'].includes(field.name)}
                        placeholder={field.type === 'number' ? '0.00' : 'Enter value...'}
                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5 transition-all outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300"
                      />
                    )}
                    {field.type === 'select' && (
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none rotate-90" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Analytical Grids */}
          {activeGrids.length > 0 && (
            <div className="space-y-6">
              {activeGrids.map(grid => (
                <section key={grid.title} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                    <div className="flex items-center space-x-3">
                      <div className={cn("w-1.5 h-6 rounded-full", grid.accent)} />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{grid.title}</h4>
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Digital Input Active</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                    {grid.fields.map((field) => (
                      <div key={field.name} className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-slate-400 text-center block">
                          {grid.labelPrefixes.reduce((acc, prefix) => acc.replace(prefix, ''), field.label)}
                        </label>
                        <input
                          type="number"
                          step="any"
                          name={field.name}
                          value={formData[field.name] || ''}
                          onChange={handleChange}
                          placeholder="0.0"
                          className="w-full h-10 px-0 bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:border-orange-500 transition-all outline-none text-sm font-bold text-slate-700 text-center"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Action Area */}
          <div className="flex items-center justify-between pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest"
            >
              Cancel Operation
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="relative px-10 py-3.5 bg-slate-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all shadow-xl shadow-slate-200 group"
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-3">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  <span>Transmitting...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <FileText className="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform" />
                  <span>Submit Records</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
