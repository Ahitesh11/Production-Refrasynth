import React, { useState, useMemo } from 'react';
import { Entry } from '../types';
import { startOfDay, isWithinInterval, endOfDay, subDays } from 'date-fns';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  entries: Entry[];
  masterData: any;
}

export default function LabAudit({ entries, masterData }: Props) {
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7d'>('today');
  const [shiftFilter, setShiftFilter] = useState<'All' | 'Shift A' | 'Shift B' | 'Shift C'>('All');
  
  const filteredEntries = useMemo(() => {
    const now = new Date();
    return entries.filter(e => {
      try {
        const dStr = e.data.date_of_production || e.data.date || e.data['Date'] || e.timestamp;
        const eDate = new Date(dStr);
        if (isNaN(eDate.getTime())) return false;
        
        let dateMatch = false;
        if (dateFilter === 'today') {
          dateMatch = isWithinInterval(eDate, { start: startOfDay(now), end: endOfDay(now) });
        } else if (dateFilter === 'yesterday') {
          const yesterday = subDays(now, 1);
          dateMatch = isWithinInterval(eDate, { start: startOfDay(yesterday), end: endOfDay(yesterday) });
        } else if (dateFilter === '7d') {
          dateMatch = isWithinInterval(eDate, { start: startOfDay(subDays(now, 7)), end: endOfDay(now) });
        }
        
        if (!dateMatch) return false;
        
        if (shiftFilter !== 'All') {
          const eShift = e.data.shift || e.data.Shift;
          if (eShift !== shiftFilter) return false;
        }
        
        return true;
      } catch {
        return false;
      }
    });
  }, [entries, dateFilter, shiftFilter]);

  // Helper to check if a specific key has a value
  const hasValue = (val: any) => val !== undefined && val !== null && val !== '';

  const requirements = useMemo(() => {
    // SB3 Drop Test (Twice per shift)
    // SB3 Drop Test (Twice per shift)
    const dropTestEntries = filteredEntries.filter(e => e.departmentId === 'drop_test');
    let dropTestCount = 0;
    dropTestEntries.forEach(e => {
      if (hasValue(e.data.dt1) || hasValue(e.data['Drop Test 1'])) dropTestCount++;
      if (hasValue(e.data.dt2) || hasValue(e.data['Drop Test 2'])) dropTestCount++;
      if (hasValue(e.data.dt3) || hasValue(e.data['Drop Test 3'])) dropTestCount++;
    });
    
    // DGU (Fineness Every hour, Chem Once per shift)
    // DGU (Fineness Every hour, Chem Once per shift)
    const dguEntries = filteredEntries.filter(e => e.departmentId === 'dgu');
    let dguFinenessFields = 0;
    let dguChem = false;
    dguEntries.forEach(e => {
      [1,2,3,4,5,6,7,8].forEach(i => {
        if (hasValue(e.data[`fineness_${i}`]) || hasValue(e.data[`Fineness %${i}`]) || hasValue(e.data[`Fineness ${i}`])) dguFinenessFields++;
      });
      if (hasValue(e.data.al2o3) || hasValue(e.data['Al2O3']) || hasValue(e.data.fe2o3) || hasValue(e.data['Fe2O3']) || hasValue(e.data.tio2) || hasValue(e.data['TiO2'])) {
        dguChem = true;
      }
    });

    // Mixer (Viscosity once per shift, Temp once per shift, Moisture every hour)
    // Mixer (Viscosity once per shift, Temp once per shift, Moisture every hour)
    const mixerEntries = filteredEntries.filter(e => e.departmentId === 'mixer');
    let mixerViscosity = false;
    let mixerTempFields = 0;
    let mixerMoistureFields = 0;
    mixerEntries.forEach(e => {
      if (hasValue(e.data.viscosity) || hasValue(e.data['Viscosity'])) mixerViscosity = true;
      [1,2,3,4,5,6,7,8].forEach(i => {
        if (hasValue(e.data[`temp_h${i}`]) || hasValue(e.data[`Temp H${i}`])) mixerTempFields++;
        if (hasValue(e.data[`moisture_h${i}`]) || hasValue(e.data[`Moisture H${i}`])) mixerMoistureFields++;
      });
    });

    // Balling Disc (Moisture every hour, Drop test every 2 hours, Chem once daily)
    // Balling Disc (Moisture every hour, Drop test every 2 hours, Chem once daily)
    const bdEntries = filteredEntries.filter(e => e.departmentId === 'balling_disc');
    let bdMoistureFields = 0;
    let bdDropTest = 0;
    let bdChem = false;
    bdEntries.forEach(e => {
      [1,2,3,4,5,6,7,8].forEach(i => {
        if (hasValue(e.data[`gbm_h${i}`]) || hasValue(e.data[`GBM H${i}`])) bdMoistureFields++;
      });
      if (hasValue(e.data.drop_test) || hasValue(e.data['Drop Test'])) bdDropTest++;
      if (hasValue(e.data.al2o3) || hasValue(e.data['Al2O3']) || hasValue(e.data.fe2o3) || hasValue(e.data['Fe2O3'])) bdChem = true;
    });

    // Kiln (LBD every hour, Chem every shift - mapped to LBD/AP Composite for now)
    // Kiln (LBD every hour, Chem every shift - mapped to LBD/AP Composite for now)
    const kilnEntries = filteredEntries.filter(e => e.departmentId === 'kiln');
    let kilnLbdFields = 0;
    let kilnChem = false;
    kilnEntries.forEach(e => {
      [1,2,3,4,5,6,7,8].forEach(i => {
        if (hasValue(e.data[`lbd_h${i}`]) || hasValue(e.data[`LBD H${i}`])) kilnLbdFields++;
      });
      if (hasValue(e.data.ap_composite) || hasValue(e.data['AP Composite (24hr)']) || hasValue(e.data.lbd_ap_composite) || hasValue(e.data['LBD AP Composite (24hr)'])) kilnChem = true;
    });

    // Product House (AP, BD, Chem once daily)
    // Product House (AP, BD, Chem once daily)
    const phEntries = filteredEntries.filter(e => e.departmentId === 'product_house');
    let phDaily = false;
    phEntries.forEach(e => {
      if (hasValue(e.data.al2o3) || hasValue(e.data['Al2O3']) || hasValue(e.data.ap) || hasValue(e.data['AP'])) phDaily = true;
    });
    
    // Scale expectations by shift filter
    const shiftMultiplier = shiftFilter === 'All' ? 3 : 1;

    return [
      {
        department: 'SB3 (Raw Material)',
        icon: <CheckCircle2 className="w-5 h-5 text-indigo-500" />,
        color: 'from-indigo-500 to-blue-500',
        bg: 'bg-indigo-50/50',
        rules: [
          { name: 'Drop Test', expectedStr: `${2 * shiftMultiplier} per day/shift`, expectedNum: 2 * shiftMultiplier, actualNum: dropTestCount, status: dropTestCount >= (2 * shiftMultiplier) ? 'pass' : dropTestCount > 0 ? 'partial' : 'fail', detail: `${dropTestCount} tests recorded` }
        ]
      },
      {
        department: 'DGU (Ground Material)',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
        color: 'from-emerald-500 to-teal-500',
        bg: 'bg-emerald-50/50',
        rules: [
          { name: 'Fineness (Every hour)', expectedStr: `${8 * shiftMultiplier} readings`, expectedNum: 8 * shiftMultiplier, actualNum: dguFinenessFields, status: dguFinenessFields >= (8 * shiftMultiplier) ? 'pass' : dguFinenessFields > 0 ? 'partial' : 'fail', detail: `${dguFinenessFields} readings` },
          { name: 'Chemical Analysis', expectedStr: `1 per shift`, expectedNum: 1 * shiftMultiplier, actualNum: dguChem ? 1 * shiftMultiplier : 0, status: (dguChem || shiftFilter === 'All') && dguEntries.length >= shiftMultiplier ? 'pass' : dguChem ? 'partial' : 'fail', detail: dguChem ? 'Completed' : 'Missing' }
        ]
      },
      {
        department: 'Mixer',
        icon: <CheckCircle2 className="w-5 h-5 text-amber-500" />,
        color: 'from-amber-500 to-orange-500',
        bg: 'bg-amber-50/50',
        rules: [
          { name: 'Viscosity of PVA', expectedStr: `1 per shift`, expectedNum: 1, actualNum: mixerViscosity ? 1 : 0, status: mixerViscosity ? 'pass' : 'fail', detail: mixerViscosity ? 'Completed' : 'Missing' },
          { name: 'Glue Water Temp', expectedStr: `1 per shift`, expectedNum: 1 * shiftMultiplier, actualNum: mixerTempFields, status: mixerTempFields >= shiftMultiplier ? 'pass' : 'fail', detail: `${mixerTempFields} readings` },
          { name: 'Moisture of Mixed Material', expectedStr: `${8 * shiftMultiplier} readings`, expectedNum: 8 * shiftMultiplier, actualNum: mixerMoistureFields, status: mixerMoistureFields >= (8 * shiftMultiplier) ? 'pass' : mixerMoistureFields > 0 ? 'partial' : 'fail', detail: `${mixerMoistureFields} readings` }
        ]
      },
      {
        department: 'Balling Disc',
        icon: <CheckCircle2 className="w-5 h-5 text-rose-500" />,
        color: 'from-rose-500 to-pink-500',
        bg: 'bg-rose-50/50',
        rules: [
          { name: 'Green Ball Moisture', expectedStr: `${8 * shiftMultiplier} readings`, expectedNum: 8 * shiftMultiplier, actualNum: bdMoistureFields, status: bdMoistureFields >= (8 * shiftMultiplier) ? 'pass' : bdMoistureFields > 0 ? 'partial' : 'fail', detail: `${bdMoistureFields} readings` },
          { name: 'Green Ball Drop Test', expectedStr: `${4 * shiftMultiplier} readings`, expectedNum: 4 * shiftMultiplier, actualNum: bdDropTest, status: bdDropTest >= (4 * shiftMultiplier) ? 'pass' : bdDropTest > 0 ? 'partial' : 'fail', detail: `${bdDropTest} readings` },
          { name: 'Chemical Analysis', expectedStr: `Once daily`, expectedNum: 1, actualNum: bdChem ? 1 : 0, status: bdChem ? 'pass' : 'fail', detail: bdChem ? 'Completed' : 'Missing' }
        ]
      },
      {
        department: 'Kiln',
        icon: <CheckCircle2 className="w-5 h-5 text-purple-500" />,
        color: 'from-purple-500 to-violet-500',
        bg: 'bg-purple-50/50',
        rules: [
          { name: 'LBD (Every hour)', expectedStr: `${8 * shiftMultiplier} readings`, expectedNum: 8 * shiftMultiplier, actualNum: kilnLbdFields, status: kilnLbdFields >= (8 * shiftMultiplier) ? 'pass' : kilnLbdFields > 0 ? 'partial' : 'fail', detail: `${kilnLbdFields} readings` },
          { name: 'Chemical Analysis', expectedStr: `1 per shift`, expectedNum: 1 * shiftMultiplier, actualNum: kilnChem ? 1 * shiftMultiplier : 0, status: kilnChem ? 'pass' : 'fail', detail: kilnChem ? 'Completed' : 'Missing' }
        ]
      },
      {
        department: 'Product House',
        icon: <CheckCircle2 className="w-5 h-5 text-cyan-500" />,
        color: 'from-cyan-500 to-blue-500',
        bg: 'bg-cyan-50/50',
        rules: [
          { name: 'AP, BD & Chemical Analysis', expectedStr: `Once daily`, expectedNum: 1, actualNum: phDaily ? 1 : 0, status: phDaily ? 'pass' : 'fail', detail: phDaily ? 'Completed' : 'Missing' }
        ]
      }
    ];

  }, [filteredEntries, shiftFilter]);

  const getStatusIcon = (status: string) => {
    if (status === 'pass') return <CheckCircle2 className="w-5 h-5 text-emerald-500 drop-shadow-sm" />;
    if (status === 'partial') return <AlertCircle className="w-5 h-5 text-amber-500 drop-shadow-sm" />;
    return <XCircle className="w-5 h-5 text-rose-500 drop-shadow-sm" />;
  };

  const getStatusClass = (status: string) => {
    if (status === 'pass') return 'bg-emerald-50/50 border-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.1)]';
    if (status === 'partial') return 'bg-amber-50/50 border-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.1)]';
    return 'bg-rose-50/50 border-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.1)]';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xl shadow-brand-500/5">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-black text-brand-900 tracking-tight">Lab Audit & Compliance</h2>
          </div>
          <p className="text-sm font-medium text-slate-500 ml-13">Verify testing completion against the official Lab Testing Plan</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto custom-scrollbar pb-2 md:pb-0">
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50">
            {(['today', 'yesterday', '7d'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                  dateFilter === filter
                    ? "bg-white text-brand-700 shadow-md shadow-slate-200/50 ring-1 ring-slate-900/5"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                {filter === 'today' ? 'Today' : filter === 'yesterday' ? 'Yesterday' : 'Last 7 Days'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50">
            {(['All', 'Shift A', 'Shift B', 'Shift C'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setShiftFilter(filter)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                  shiftFilter === filter
                    ? "bg-white text-brand-700 shadow-md shadow-slate-200/50 ring-1 ring-slate-900/5"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {requirements.map((dept, idx) => (
          <div key={idx} className="group relative bg-white rounded-3xl border border-slate-200/60 shadow-md hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 overflow-hidden flex flex-col">
            <div className={cn("px-6 py-5 border-b border-slate-100 flex items-center gap-4 relative overflow-hidden", dept.bg)}>
              <div className={cn("absolute inset-0 opacity-10 bg-gradient-to-br", dept.color)} />
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-sm ring-1 ring-slate-900/5 z-10")}>
                {dept.icon}
              </div>
              <h3 className="text-xl font-black text-slate-800 z-10 tracking-tight">{dept.department}</h3>
            </div>
            
            <div className="p-6 flex-1 space-y-5">
              {dept.rules.map((rule, ridx) => {
                // Calculate progress percentage
                const progress = rule.expectedNum > 0 ? Math.min(100, Math.round((rule.actualNum / rule.expectedNum) * 100)) : 0;
                
                return (
                  <div key={ridx} className={cn(
                    "relative p-5 rounded-2xl border transition-all duration-300 hover:scale-[1.02]",
                    getStatusClass(rule.status)
                  )}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3.5">
                        <div className="mt-0.5">
                          {getStatusIcon(rule.status)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 tracking-tight leading-tight">{rule.name}</p>
                          <p className="text-xs font-semibold opacity-60 mt-1 uppercase tracking-wider">Target: {rule.expectedStr}</p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase",
                          rule.status === 'pass' ? "bg-emerald-100 text-emerald-700" :
                          rule.status === 'partial' ? "bg-amber-100 text-amber-700" :
                          "bg-rose-100 text-rose-700"
                        )}>
                          {rule.status === 'pass' ? 'Completed' : rule.status === 'partial' ? 'Partial' : 'Missing'}
                        </span>
                        <span className="text-sm font-bold text-slate-600 mt-2">{rule.detail}</span>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-black/5 rounded-full overflow-hidden flex">
                      <div 
                        className={cn(
                          "h-full transition-all duration-1000 ease-out",
                          rule.status === 'pass' ? "bg-emerald-500" :
                          rule.status === 'partial' ? "bg-amber-500" :
                          "bg-rose-500"
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
