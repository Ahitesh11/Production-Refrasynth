import React, { useState, useMemo } from 'react';
import { Department, Entry } from '../types';
import { Plus, CheckCircle2, AlertCircle, Loader2, Settings, X } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import DepartmentForm from './DepartmentForm';
import { cn } from '../lib/utils';

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

  // Update local ranges when prop changes
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

      const parseDate = (d: any) => {
        if (!d) return 0;
        const s = String(d).trim();
        if (s.includes('/')) {
          const parts = s.split(' ')[0].split('/');
          if (parts.length === 3) {
            const month = parseInt(parts[0], 10);
            const day = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
              return new Date(year, month - 1, day).getTime();
            }
          }
        }
        const parsed = new Date(s).getTime();
        return isNaN(parsed) ? 0 : parsed;
      };

      return parseDate(valA) - parseDate(valB);
    });
  }, [safeEntries, department.fields]);

  const canAdd = userType === 'Entry' || userType === 'Admin';
  const canMarkDone = userType === 'Mark Done' || userType === 'Admin';

  const handleSync = async (entry: Entry) => {
    setSyncingId(entry.id);

    const values = [
      entry.timestamp,
      ...department.fields
        .filter(f => f.name !== 'entry_type')
        .map(f => {
          let val = entry.data[f.label] || entry.data[f.name] || '';
          if (f.type === 'date' && val && !/^\d{2}\/\d{2}\/\d{4}/.test(val)) {
            try {
              val = format(new Date(val), 'MM/dd/yyyy');
            } catch (e) { }
          }
          return val;
        })
    ];

    try {
      if (!scriptUrl) {
        throw new Error('Google Apps Script URL is not configured in Settings.');
      }

      const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl)}`;

      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sheetName: department.name,
          entryId: entry.timestamp,
          values: values
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }

      if (!response.ok || data.result === 'error' || data.status === 'error') {
        throw new Error(data.error || data.message || 'Failed to sync with Google Sheets');
      }

      if (scriptUrl.includes('AKfycbyQNcs5g-6p4dZ4qhdKL0GYkem_hudT7PUf0ZhSVmK1dZvHjw_fzurvGqWTztk6xNyBFQ')) {
        alert('Data synced to DEMO SHEET. Please update the Script URL in Settings to save to YOUR sheet.');
      } else {
        alert('Data saved successfully to Google Sheets!');
      }
    } catch (error: any) {
      console.error('Sync Error:', error);
      alert(`Sync Failed: ${error.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">{department.name}</h2>
          <p className="text-zinc-500 mt-1">Manage and track {department.category.toLowerCase()} entries.</p>
        </div>
        <div className="flex items-center space-x-3">
          {userType === 'Admin' && (department.id === 'dgu' || department.id === 'balling_disc' || department.id === 'product_house') && (
            <button
              onClick={() => setIsAdminLimitOpen(true)}
              className="flex items-center px-4 py-2 bg-white border border-zinc-200 text-zinc-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-zinc-50 transition-all shadow-sm"
            >
              <Settings className="w-4 h-4 mr-2 text-[#03A9F4]" />
              Configure Limits
            </button>
          )}
          {canAdd && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center px-5 py-2.5 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 active:scale-95"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Entry
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-zinc-50">
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky left-0 top-0 bg-zinc-50 z-30 border-b border-zinc-200">Timestamp</th>
                {department.fields.filter(f => f.name !== 'entry_type').map(field => (
                  <th key={field.name} className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={department.fields.filter(f => f.name !== 'entry_type').length + 1} className="px-6 py-12 text-center text-zinc-400 italic">
                    No entries found for this department.
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-mono text-zinc-500 whitespace-nowrap sticky left-0 bg-white group-hover:bg-zinc-50 transition-colors z-10">
                      {formatDisplayDate(entry.timestamp)}
                    </td>
                    {department.fields.filter(f => f.name !== 'entry_type').map(field => {
                      let value = entry.data[field.label] || entry.data[field.name];

                      if (field.type === 'date' && value) {
                        value = formatDisplayDate(value);
                      }

                      const rangeStr = localRanges?.[field.label] || localRanges?.[field.name];
                      const range = parseRange(rangeStr || '');

                      let cellClass = "px-6 py-4 text-sm text-zinc-600 whitespace-nowrap";

                      if (department.id === 'dgu' || department.id === 'balling_disc' || department.id === 'product_house') {
                        const label = field.label.trim();
                        let min: number | null = null;
                        let max: number | null = null;
                        let reverseLogic = false; // If true, above max is red, below is green

                        // Default user requested limits
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
                          max = localRanges[label] ? parseFloat(localRanges[label]) : (localRanges['Fineness'] ? parseFloat(localRanges['Fineness']) : 95);
                          reverseLogic = true;
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
                              // Max+ logic: below green, above red
                              if (numValue <= (max || 0)) {
                                cellClass = cn(cellClass, "text-emerald-600 font-bold bg-emerald-50/50 italic border-l-2 border-emerald-500");
                              } else {
                                cellClass = cn(cellClass, "text-red-600 font-bold bg-red-50/50 animate-pulse border-l-2 border-red-500");
                              }
                            } else if (min !== null && max !== null) {
                              if (numValue >= min && numValue <= max) {
                                cellClass = cn(cellClass, "text-emerald-600 font-bold bg-emerald-50/50 italic border-l-2 border-emerald-500");
                              } else {
                                cellClass = cn(cellClass, "text-red-600 font-bold bg-red-50/50 animate-pulse border-l-2 border-red-500");
                              }
                            }
                          }
                        }
                      } else if (range && value !== undefined && value !== null && value !== '') {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                          if (numValue >= range.min && numValue <= range.max) {
                            cellClass = cn(cellClass, "text-emerald-600 font-bold bg-emerald-50/30");
                          } else {
                            cellClass = cn(cellClass, "text-red-600 font-bold bg-red-50/30");
                          }
                        }
                      }

                      return (
                        <td key={field.name} className={cellClass}>
                          {value || '-'}
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
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
                  const values = [
                    newEntry.timestamp,
                    ...department.fields
                      .filter(f => f.name !== 'entry_type')
                      .map(f => {
                        let val = formattedData[f.name] || '';
                        if (f.type === 'date' && val && !/^\d{2}\/\d{2}\/\d{4}/.test(val)) {
                          try { val = format(new Date(val), 'MM/dd/yyyy'); } catch (e) { }
                        }
                        return val;
                      })
                  ];

                  try {
                    const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl)}`;
                    const response = await fetch(proxyUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                      body: JSON.stringify({
                        sheetName: department.name,
                        entryId: newEntry.timestamp,
                        values: values
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

      {isAdminLimitOpen && (
        <AdminLimitModal
          ranges={localRanges}
          onClose={() => setIsAdminLimitOpen(false)}
          onSave={async (newRanges) => {
            setLocalRanges(newRanges);
            // Sync to Google Sheet (Parameter_Range sheet)
            try {
              const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl || '')}`;
              // We need to update each changed row or the whole set.
              // For simplicity, we'll loop through the keys we care about.
              const keys = ['Al2O3', 'Fe2O3', 'SiO2', 'TiO2', 'CaO', 'MgO', 'Loi', 'Fineness', 'Drop Test 1', 'Drop Test 2', 'Drop Test 3', 'Drop Test', 'Moisture'];
              for (const key of keys) {
                if (newRanges[key]) {
                  await fetch(proxyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sheetName: 'Parameter_Range',
                      uniqueId: key, // Key is the name in Col A
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-zinc-200">
        <div className="px-8 py-6 bg-zinc-900 text-white flex items-center justify-between">
          <div>
            <p className="text-[#03A9F4] text-[10px] font-bold uppercase tracking-widest mb-1">Quality Control</p>
            <h2 className="text-xl font-bold tracking-tight">Limit Configuration</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {keys.map(key => (
              <div key={key} className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">{key}</label>
                <input
                  type="text"
                  value={localRanges[key] || ''}
                  placeholder={['Fineness', 'Drop Test', 'Moisture'].includes(key) ? 'e.g. 95' : 'e.g. 82.5 to 83.5'}
                  onChange={(e) => setLocalRanges({ ...localRanges, [key]: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-transparent outline-none text-sm font-bold text-zinc-700"
                />
                <p className="text-[9px] text-zinc-400 italic ml-1">
                  {['Drop Test', 'Drop Test 1', 'Drop Test 2', 'Drop Test 3'].includes(key) ? 'Value BELOW this will be RED, above will be GREEN.' : ['Moisture', 'Fineness'].includes(key) ? 'Value ABOVE this will be RED, below will be GREEN.' : 'Standard Min to Max format.'}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-zinc-100">
            <button onClick={onClose} className="px-6 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 uppercase">Cancel</button>
            <button
              onClick={async () => {
                setIsSaving(true);
                await onSave(localRanges);
                setIsSaving(false);
                onClose();
              }}
              disabled={isSaving}
              className="px-8 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all flex items-center"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2 text-[#03A9F4]" />}
              Apply & Sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
