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

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress aggressively to fit within Google Sheets 50,000 character limit
          const compressed = canvas.toDataURL('image/jpeg', 0.4);
          if (compressed.length > 45000) {
            // If still too big, scale down further and re-compress
            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = width * 0.5;
            smallCanvas.height = height * 0.5;
            smallCanvas.getContext('2d')?.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
            resolve(smallCanvas.toDataURL('image/jpeg', 0.4));
          } else {
            resolve(compressed);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target;
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const compressedBase64 = await compressImage(file);
        setFormData(prev => ({ ...prev, [name]: compressedBase64 }));
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, [name]: reader.result }));
        };
        reader.readAsDataURL(file);
      }
    }
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

  // Every field must be filled before submitting, except free-text notes/remarks —
  // those are genuinely optional annotations, not core data.
  const OPTIONAL_FIELD_NAMES = ['note', 'remarks_physical', 'remarks_chemical'];
  const isRequiredField = (name: string) => !OPTIONAL_FIELD_NAMES.includes(name);

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
    { fields: gbmFields, title: 'Moisture Data', labelPrefixes: ['GBM ', 'Green Ball Moisture '], accent: 'bg-brand-500' },
    { fields: dropFields, title: 'Drop Test Data', labelPrefixes: ['Drop ', 'Drop Test '], accent: 'bg-brand-600' },
    { fields: lbdFields, title: 'LBD Readings', labelPrefixes: ['LBD '], accent: 'bg-brand-400' },
    { fields: apFields, title: 'AP Measurements', labelPrefixes: ['AP '], accent: 'bg-emerald-600' },
    { fields: bdFields, title: 'BD Measurements', labelPrefixes: ['BD '], accent: 'bg-brand-700' }
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
    <div className="flex flex-col h-full bg-surface">
      {/* Refined Header */}
      <div className="px-6 py-5 border-b border-border flex items-center justify-between relative z-10 rounded-t-2xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 gradient-accent rounded-xl flex items-center justify-center shadow-md">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2 mb-0.5">
              <span className="text-[0.625rem] font-bold uppercase tracking-widest text-accent">Department Protocol</span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary status-dot-connected" />
            </div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">{department.name}</h2>
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

      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Protocol Selector for Kiln and DGU */}
          {(department.id === 'kiln' || department.id === 'dgu') && (
            <div className="flex flex-col items-center space-y-3 pt-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {department.id === 'kiln' ? 'Kiln Protocol' : 'DGU Protocol'}
              </span>
              <div className="inline-flex p-1 bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-sm">
                {(department.id === 'kiln' ? ['Shift', 'Composite'] : ['Shift', 'Daily']).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, entry_type: mode }))}
                    className={cn(
                      "px-6 py-2 rounded-lg text-[11px] font-bold transition-all duration-300",
                      (formData.entry_type || 'Shift') === mode
                        ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25 scale-105"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Context Section */}
          <section className="bg-white/70 backdrop-blur-md rounded-3xl p-6 border border-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-100/40 to-violet-100/40 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100/60 relative z-10">
              <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center">
                <Settings className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.15em]">Configuration</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
              {otherFields.map((field) => (
                <div key={field.name} className="space-y-2 group">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center justify-between">
                    <span>{field.label} {isRequiredField(field.name) && <span className="text-red-500">*</span>}</span>
                  </label>
                  <div className="relative">
                    {field.type === 'select' ? (
                      <select
                        name={field.name}
                        value={formData[field.name] || ''}
                        onChange={handleChange}
                        required={isRequiredField(field.name)}
                        className="form-input appearance-none pl-3 pr-8"
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
                          className="form-input appearance-none text-center cursor-pointer"
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
                          className="form-input appearance-none text-center cursor-pointer"
                        >
                          {Array.from({length: 60}, (_, i) => String(i).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          value={(formData[field.name] || '12:00 AM').split(' ')[1] || 'AM'}
                          onChange={(e) => {
                            const currentTime = (formData[field.name] || '12:00 AM').split(' ')[0] || '12:00';
                            setFormData(prev => ({ ...prev, [field.name]: `${currentTime} ${e.target.value}` }));
                          }}
                          className="form-input appearance-none text-center cursor-pointer"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    ) : field.type === 'file' ? (
                      <input
                        type="file"
                        accept="image/*"
                        name={field.name}
                        onChange={handleFileChange}
                        required={isRequiredField(field.name)}
                        className="w-full block text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-wider file:bg-indigo-50 file:text-indigo-600 file:shadow-sm border border-slate-200/80 rounded-xl bg-white/50 cursor-pointer hover:file:bg-indigo-100 hover:bg-white/80 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all h-10"
                      />
                    ) : (
                      <input
                        type={field.type}
                        step={field.type === 'number' ? 'any' : undefined}
                        name={field.name}
                        value={formData[field.name] || ''}
                        onChange={handleChange}
                        required={isRequiredField(field.name)}
                        placeholder={field.type === 'number' ? '0.00' : 'Enter value...'}
                        className="form-input px-3"
                      />
                    )}
                    {field.type === 'select' && (
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none rotate-90" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Analytical Grids */}
          {activeGrids.length > 0 && (
            <div className="space-y-4">
              {activeGrids.map(grid => (
                <section key={grid.title} className="bg-white/70 backdrop-blur-md rounded-3xl p-6 border border-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-4 hover:shadow-[0_4px_20px_rgb(0,0,0,0.06)] transition-all duration-300">
                  <div className="flex items-center justify-between border-b border-slate-100/60 pb-3">
                    <div className="flex items-center space-x-2">
                      <div className={cn("w-1 h-5 rounded-full shadow-sm", grid.accent.replace('bg-brand-', 'bg-indigo-'))} />
                      <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.15em]">{grid.title}</h4>
                    </div>
                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Digital Input Active</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                    {grid.fields.map((field) => (
                      <div key={field.name} className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center block">
                          {grid.labelPrefixes.reduce((acc, prefix) => acc.replace(prefix, ''), field.label)} {isRequiredField(field.name) && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="number"
                          step="any"
                          name={field.name}
                          value={formData[field.name] || ''}
                          onChange={handleChange}
                          placeholder="0.0"
                          className="form-input px-0 text-center text-sm font-bold"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Action Area */}
          <div className="flex items-center justify-between pt-6 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-[10px] font-black text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-[0.15em] hover:bg-rose-50 rounded-xl"
            >
              Cancel Operation
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary uppercase tracking-widest text-[10px] shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-white/80" />
                  <span>Transmitting...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-indigo-200 group-hover:scale-110 group-hover:text-white transition-all duration-300" />
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
