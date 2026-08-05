import React, { useMemo, useState } from 'react';
import { Entry } from '../types';
import { format } from 'date-fns';
import { ClipboardList, Download, Printer, CheckCircle2, Circle } from 'lucide-react';
import { cn, parseGlobalDate, parseRange, exportToCSV } from '../lib/utils';

interface Props {
  entries: Entry[];
  parameterRanges?: Record<string, string>;
}

interface MaterialStat {
  avg: string;
  count: number;
  outOfLimit: number;
  efficiency: string;
}

const SHIFTS = ['Shift A', 'Shift B', 'Shift C'] as const;
type Shift = typeof SHIFTS[number];
const SHIFT_BADGE: Record<Shift, string> = { 'Shift A': 'badge-shift-a', 'Shift B': 'badge-shift-b', 'Shift C': 'badge-shift-c' };

// Reads the first present value among several possible field-name / label keys on an entry.
function getVal(e: Entry | undefined, ...keys: string[]): string {
  if (!e) return '';
  for (const k of keys) {
    const v = e.data[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  return '';
}

function getCampaign(e: Entry): string {
  return getVal(e, 'campaign_no', 'Campaign No.', 'campaign', 'Campaign');
}

// Averages a numeric field across a group of entries (multiple readings logged within the same shift).
function avgVal(list: Entry[], ...keys: string[]): string {
  const nums: number[] = [];
  list.forEach(e => {
    for (const k of keys) {
      const raw = e.data[k];
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
        const n = parseFloat(String(raw));
        if (!isNaN(n)) { nums.push(n); break; }
      }
    }
  });
  if (!nums.length) return '';
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
}

// Averages an hourly-logged field (h1..h8) across a group of entries.
function avgHourly(list: Entry[], nameFmt: (i: number) => string, labelFmt: (i: number) => string): string {
  const nums: number[] = [];
  list.forEach(e => {
    for (let i = 1; i <= 8; i++) {
      const raw = e.data[nameFmt(i)] ?? e.data[labelFmt(i)];
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
        const n = parseFloat(String(raw));
        if (!isNaN(n)) nums.push(n);
      }
    }
  });
  if (!nums.length) return '';
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
}

// Compact "Al X · Fe Y · Ti Z" style chemical summary for a group of entries.
function chemicalSummary(list: Entry[]): string {
  const al = avgVal(list, 'al2o3', 'Al2O3');
  const fe = avgVal(list, 'fe2o3', 'Fe2O3');
  const ti = avgVal(list, 'tio2', 'TiO2');
  const parts: string[] = [];
  if (al) parts.push(`Al ${al}`);
  if (fe) parts.push(`Fe ${fe}`);
  if (ti) parts.push(`Ti ${ti}`);
  return parts.join(' · ');
}

interface Row {
  label: string;
  values: Record<Shift, string>;
}

// Same visual language as the Dashboard's "Average / Eff" cards, broken out per shift so "All Shifts" shows
// Shift A / B / C side by side instead of one blended total.
function AvgEffPanel({ title, items, visibleShifts }: { title: string; items: { label: string; stats: Record<Shift, MaterialStat>; color: string }[]; visibleShifts: Shift[] }) {
  return (
    <div className="mod-section bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
        <h3 className="text-sm font-bold text-brand-900 tracking-tight">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <th className="text-left px-6 py-2.5 w-1/4">Parameter</th>
              {visibleShifts.map(s => (
                <th key={s} className="text-center px-3 py-2.5">
                  <span className={SHIFT_BADGE[s]}>{s.replace('Shift ', '')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-6 py-3 text-xs font-medium text-slate-600">{row.label}</td>
                {visibleShifts.map(s => {
                  const stat = row.stats[s];
                  return (
                    <td key={s} className="px-3 py-3 text-center">
                      <p className={`text-base font-black ${row.color}`}>{stat.avg}%</p>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Section({ title, subtitle, rows, footnote, visibleShifts }: { title: string; subtitle?: string; rows: Row[]; footnote?: string; visibleShifts: Shift[] }) {
  return (
    <div className="mod-section bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
        <h3 className="text-sm font-bold text-brand-900 tracking-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <th className="text-left px-6 py-2.5 w-1/3">Parameter</th>
              {visibleShifts.map(s => (
                <th key={s} className="text-center px-3 py-2.5">
                  <span className={SHIFT_BADGE[s]}>{s.replace('Shift ', '')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-6 py-2.5 text-xs font-medium text-slate-600">{row.label}</td>
                {visibleShifts.map(s => (
                  <td key={s} className="px-3 py-2.5 text-center text-xs font-semibold text-brand-900">
                    {row.values[s] || <span className="text-slate-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && (
        <div className="px-6 py-2.5 border-t border-slate-100 bg-slate-50/40 no-print">
          <p className="text-[10px] italic text-slate-400 leading-relaxed">{footnote}</p>
        </div>
      )}
    </div>
  );
}

export default function DailyMODMeeting({ entries, parameterRanges }: Props) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [shiftFilter, setShiftFilter] = useState<'All' | Shift>('All');
  const [campaignFilter, setCampaignFilter] = useState<string>('All');

  // Entries for the selected date only (campaign + shift filters are layered on top of this).
  const dateEntries = useMemo(() => {
    const target = new Date(selectedDate);
    return entries.filter(e => {
      const raw = e.data.date || e.data['Date'] || e.data.date_of_production || e.data['Date Of Production'] || e.timestamp;
      const t = parseGlobalDate(raw);
      if (!t) return false;
      const d = new Date(t);
      return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth() && d.getDate() === target.getDate();
    });
  }, [entries, selectedDate]);

  const uniqueCampaigns = useMemo(() => {
    const set = new Set<string>();
    dateEntries.forEach(e => {
      const c = getCampaign(e);
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [dateEntries]);

  // Campaign-scoped entries — used for the "data logged today" completeness strip regardless of shift filter.
  const campaignEntries = useMemo(() => {
    if (campaignFilter === 'All') return dateEntries;
    return dateEntries.filter(e => getCampaign(e) === campaignFilter);
  }, [dateEntries, campaignFilter]);

  // Fully scoped entries (date + campaign + shift) — feeds every table and average panel below.
  const scopedEntries = useMemo(() => {
    if (shiftFilter === 'All') return campaignEntries;
    return campaignEntries.filter(e => getVal(e, 'shift', 'Shift') === shiftFilter);
  }, [campaignEntries, shiftFilter]);

  const visibleShifts: Shift[] = shiftFilter === 'All' ? [...SHIFTS] : [shiftFilter];

  const byDept = (deptId: string, filter?: (e: Entry) => boolean) =>
    scopedEntries.filter(e => e.departmentId === deptId && (!filter || filter(e)));

  const hasLoggedToday = (deptId: string, filter?: (e: Entry) => boolean) =>
    campaignEntries.some(e => e.departmentId === deptId && (!filter || filter(e)));

  const byShift = (list: Entry[]) => {
    const grouped: Record<Shift, Entry[]> = { 'Shift A': [], 'Shift B': [], 'Shift C': [] };
    list.forEach(e => {
      const s = (getVal(e, 'shift', 'Shift') || '') as Shift;
      if (grouped[s]) grouped[s].push(e);
    });
    return grouped;
  };

  const buildRows = (
    list: Entry[],
    metrics: { label: string; keys?: string[]; hourly?: boolean; nameFmt?: (i: number) => string; labelFmt?: (i: number) => string; combine?: (shiftList: Entry[]) => string }[]
  ): Row[] => {
    const grouped = byShift(list);
    return metrics.map(m => ({
      label: m.label,
      values: SHIFTS.reduce((acc, s) => {
        if (m.combine) acc[s] = m.combine(grouped[s]);
        else if (m.hourly && m.nameFmt && m.labelFmt) acc[s] = avgHourly(grouped[s], m.nameFmt, m.labelFmt);
        else acc[s] = avgVal(grouped[s], ...(m.keys || []));
        return acc;
      }, {} as Record<Shift, string>)
    }));
  };

  // --- 1) SB3 (Production Flow, Type = SB3) ---
  // Matches Dashboard's productionFlowSb3Avg: legacy rows with no Type recorded default to SB3.
  const sb3Filter = (e: Entry) => {
    const t = getVal(e, 'type', 'Type');
    return t.toUpperCase() === 'SB3' || !t;
  };
  const sb3Entries = byDept('production_flow', sb3Filter);
  const sb3Rows = buildRows(sb3Entries, [
    { label: 'WF - 1', keys: ['wf3', 'WF3'] },
    { label: 'WF - 2', keys: ['wf4', 'WF4'] },
    { label: 'WF - 3', keys: ['wf5', 'WF5'] },
  ]);

  // --- 2) Drop Test ---
  const dropTestEntries = byDept('drop_test');
  const dtRows = buildRows(dropTestEntries, [
    { label: 'W - 1', keys: ['dt1', 'Drop Test 1'] },
    { label: 'W - 2', keys: ['dt2', 'Drop Test 2'] },
    { label: 'W - 3', keys: ['dt3', 'Drop Test 3'] },
  ]);
  // DGU logs two distinct concerns on the same entry — physical fineness and lab chemical composition —
  // so they're split into their own sections rather than one mixed table.
  const dguEntries = byDept('dgu');
  const dguFinenessRows = buildRows(dguEntries, [
    { label: 'Fineness %', hourly: true, nameFmt: i => `fineness_${i}`, labelFmt: i => `Fineness %${i}` },
  ]);
  const dguLabRows = buildRows(dguEntries, [
    { label: 'Al2O3', keys: ['al2o3', 'Al2O3'] },
    { label: 'Fe2O3', keys: ['fe2o3', 'Fe2O3'] },
    { label: 'TiO2', keys: ['tio2', 'TiO2'] },
    { label: 'Loi', keys: ['loi', 'Loi'] },
  ]);

  // --- Drop Test Average / Eff (mirrors the Dashboard "Drop Test Average / Eff" card), split per shift ---
  const dropTestAvg = useMemo(() => {
    const rows = dropTestEntries;
    const groupedByShift = byShift(rows);
    const getRmName = (k1: string, k2: string) => {
      const row = [...rows].reverse().find(e => e.data[k1] || e.data[k2]);
      return row ? String(row.data[k1] || row.data[k2]) : null;
    };
    const getLimitRange = (name: string) => {
      const configured = parameterRanges ? parseRange(parameterRanges[name] || parameterRanges['Drop Test']) : null;
      return configured || { min: 2.5, max: 1000 };
    };
    const makeStat = (list: Entry[], k1: string, k2: string, rmNum: number, name: string): MaterialStat => {
      let entriesWithData = 0;
      let outOfLimit = 0;
      let totalSum = 0;
      list.forEach(e => {
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
      const avgValStr = entriesWithData ? (totalSum / entriesWithData).toFixed(1) : '-';
      const efficiency = entriesWithData ? (((entriesWithData - outOfLimit) / entriesWithData) * 100).toFixed(1) : '0.0';
      return { avg: avgValStr, count: entriesWithData, outOfLimit, efficiency };
    };
    const statsByShift = (k1: string, k2: string, rmNum: number, name: string): Record<Shift, MaterialStat> =>
      SHIFTS.reduce((acc, s) => { acc[s] = makeStat(groupedByShift[s], k1, k2, rmNum, name); return acc; }, {} as Record<Shift, MaterialStat>);
    const rm1Name = getRmName('rm1', 'Rm 1') || 'Rm 1 %';
    const rm2Name = getRmName('rm2', 'Rm 2') || 'Rm 2 %';
    const rm3Name = getRmName('rm3', 'Rm 3') || 'Rm 3 %';
    return {
      rm1Name, rm2Name, rm3Name,
      rm1: statsByShift('rm1_pct', 'Rm 1 %', 1, rm1Name),
      rm2: statsByShift('rm2_pct', 'Rm 2 %', 2, rm2Name),
      rm3: statsByShift('rm3_pct', 'Rm 3 %', 3, rm3Name),
    };
  }, [dropTestEntries, parameterRanges]);

  // --- Production Flow WF SB3 Average / Eff (mirrors the Dashboard "Production Flow (WF SB3)" card), split per shift ---
  const sb3Avg = useMemo(() => {
    const rows = sb3Entries;
    const groupedByShift = byShift(rows);
    const getRmName = (k1: string, k2: string) => {
      const row = [...rows].reverse().find(e => e.data[k1] || e.data[k2]);
      return row ? String(row.data[k1] || row.data[k2]) : null;
    };
    const makeStat = (list: Entry[], key: string, altKey: string, rmName: string): MaterialStat => {
      let entriesWithData = 0;
      let totalPctSum = 0;
      let outOfLimit = 0;
      list.forEach(e => {
        const wf3 = parseFloat(e.data['wf3'] || e.data['WF3']) || 0;
        const wf4 = parseFloat(e.data['wf4'] || e.data['WF4']) || 0;
        const wf5 = parseFloat(e.data['wf5'] || e.data['WF5']) || 0;
        const rowTotal = wf3 + wf4 + wf5;
        const valMT = parseFloat(e.data[key] || e.data[altKey]);
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
      return { avg: avgPct, count: entriesWithData, outOfLimit, efficiency };
    };
    const statsByShift = (key: string, altKey: string, rmName: string): Record<Shift, MaterialStat> =>
      SHIFTS.reduce((acc, s) => { acc[s] = makeStat(groupedByShift[s], key, altKey, rmName); return acc; }, {} as Record<Shift, MaterialStat>);
    const rm1Name = getRmName('rm1', 'RM1') || 'RM1';
    const rm2Name = getRmName('rm2', 'RM2') || 'RM2';
    const rm3Name = getRmName('rm3', 'RM3') || 'RM3';
    return {
      rm1Name, rm2Name, rm3Name,
      wf3: statsByShift('wf3', 'WF3', rm1Name),
      wf4: statsByShift('wf4', 'WF4', rm2Name),
      wf5: statsByShift('wf5', 'WF5', rm3Name),
    };
  }, [sb3Entries, parameterRanges]);

  // --- 3) PPT (Production Flow, Type = PPT) — LIW 1..5 ---
  const pptFilter = (e: Entry) => getVal(e, 'type', 'Type').toUpperCase() === 'PPT';
  const pptEntries = byDept('production_flow', pptFilter);
  const pptRows = buildRows(pptEntries, [1, 2, 3, 4, 5].map(i => ({ label: `Liw - ${i}`, keys: [`liw${i}`, `LIW${i}`] })));
  const pptTotalRow: Row = {
    label: 'Total Avg',
    values: SHIFTS.reduce((acc, s) => {
      const hasData = pptRows.some(r => r.values[s]);
      const sum = pptRows.reduce((t, r) => t + (parseFloat(r.values[s]) || 0), 0);
      acc[s] = hasData ? sum.toFixed(2) : '';
      return acc;
    }, {} as Record<Shift, string>)
  };
  pptRows.push(pptTotalRow);

  // --- 4) Mixer ---
  const mixerEntries = byDept('mixer');
  const mixerRows = buildRows(mixerEntries, [
    { label: 'Moisture', hourly: true, nameFmt: i => `moisture_h${i}`, labelFmt: i => `Moisture H${i}` },
  ]);

  // --- 5) Balling Disc ---
  const bdEntries = byDept('balling_disc');
  const bdRows = buildRows(bdEntries, [
    { label: 'Moisture', hourly: true, nameFmt: i => `gbm_h${i}`, labelFmt: i => `GBM H${i}` },
    { label: 'Drop Test', keys: ['drop_test', 'Drop Test'] },
    { label: 'Chemical', combine: (shiftList) => chemicalSummary(shiftList) },
  ]);

  // --- 6) TG (Traveling Grate) — Parameter dept ---
  const paramEntries = byDept('parameter');
  const tgRows = buildRows(paramEntries, [
    {
      label: 'Feed RPM (Avg)', combine: (shiftList) => {
        const feed = avgVal(shiftList, 'tg_feed', 'TG Feed');
        const rpm = avgVal(shiftList, 'tg_rpm', 'TG RPM');
        const parts: string[] = [];
        if (feed) parts.push(`Feed ${feed}`);
        if (rpm) parts.push(`RPM ${rpm}`);
        return parts.join(' · ');
      }
    },
    { label: 'Bed Height (Avg)', keys: ['tg_avg_bed', 'TG Avg Bed Level'] },
  ]);

  // --- 7) Kiln ---
  const kilnEntries = byDept('kiln');
  const phEntries = byDept('product_house'); // chemical is logged here, not under Kiln itself
  const phByShift = byShift(phEntries);
  const kilnRows = buildRows(kilnEntries, [
    { label: 'Avg AP', keys: ['ap_composite', 'AP Composite (24hr)'] },
    { label: 'BD', keys: ['bd_composite', 'BD Composite (24hr)'] },
    { label: 'LBD', hourly: true, nameFmt: i => `lbd_h${i}`, labelFmt: i => `LBD H${i}` },
  ]);
  const kilnChemicalRow: Row = {
    label: 'Chemical',
    values: SHIFTS.reduce((acc, s) => {
      acc[s] = chemicalSummary(phByShift[s]);
      return acc;
    }, {} as Record<Shift, string>)
  };
  kilnRows.push(kilnChemicalRow);

  // --- 8) Kiln Flow Meter ---
  const kilnFlowRows = buildRows(kilnEntries, [
    { label: 'Flow (KL)', keys: ['flow_meter_kl', 'Flow Meter (KL)'] },
  ]);

  // --- 9) Main Tank / Kiln Day Tank / TG Day Tank — recorded once per day, not per shift, so it's
  // sourced from campaignEntries (date + campaign scoped) rather than scopedEntries (which also filters by shift). ---
  const tankEntries = campaignEntries.filter(e => e.departmentId === 'opening_closing');
  const openingEntry = tankEntries.find(e => getVal(e, 'type', 'Type') === 'Opening');
  const closingEntry = tankEntries.find(e => getVal(e, 'type', 'Type') === 'Closing');
  const tankRows = [
    { label: 'Main Tank', opening: getVal(openingEntry, 'main_tank', 'Main Tank'), closing: getVal(closingEntry, 'main_tank', 'Main Tank') },
    { label: 'Kiln Day Tank', opening: getVal(openingEntry, 'day_tank_kiln', 'Day Tank Kiln'), closing: getVal(closingEntry, 'day_tank_kiln', 'Day Tank Kiln') },
    { label: 'TG Day Tank', opening: getVal(openingEntry, 'day_tank_tg', 'Day Tank TG'), closing: getVal(closingEntry, 'day_tank_tg', 'Day Tank TG') },
  ];

  // --- Data-completeness strip: what's actually been logged today, independent of the shift filter ---
  const completeness = [
    { label: 'SB3', ok: hasLoggedToday('production_flow', sb3Filter) },
    { label: 'Drop Test', ok: hasLoggedToday('drop_test') },
    { label: 'DGU', ok: hasLoggedToday('dgu') },
    { label: 'PPT', ok: hasLoggedToday('production_flow', pptFilter) },
    { label: 'Mixer', ok: hasLoggedToday('mixer') },
    { label: 'Balling Disc', ok: hasLoggedToday('balling_disc') },
    { label: 'TG', ok: hasLoggedToday('parameter') },
    { label: 'Kiln', ok: hasLoggedToday('kiln') },
    { label: 'Product House', ok: hasLoggedToday('product_house') },
    { label: 'Tanks', ok: hasLoggedToday('opening_closing') },
  ];

  const handleExportCSV = () => {
    const rowsOut: Record<string, any>[] = [];
    const pushSection = (section: string, rows: Row[]) => {
      rows.forEach(r => {
        const obj: Record<string, any> = { Section: section, Parameter: r.label };
        visibleShifts.forEach(s => { obj[s] = r.values[s] || ''; });
        rowsOut.push(obj);
      });
    };
    pushSection('1) SB3', sb3Rows);
    pushSection('2) Drop Test', dtRows);
    pushSection('DGU Fineness', dguFinenessRows);
    pushSection('DGU Lab', dguLabRows);
    pushSection('3) PPT', pptRows);
    pushSection('4) Mixer', mixerRows);
    pushSection('5) Balling Disc', bdRows);
    pushSection('6) TG (Traveling Grate)', tgRows);
    pushSection('Kiln', kilnRows);
    pushSection('Kiln Flow Meter', kilnFlowRows);
    tankRows.forEach(r => rowsOut.push({ Section: 'Main Tank / Kiln Day Tank / TG Day Tank', Parameter: r.label, Opening: r.opening || '', Closing: r.closing || '' }));
    [
      { title: 'Production Flow (WF SB3) — Average / Eff', items: [{ label: sb3Avg.rm1Name, stats: sb3Avg.wf3 }, { label: sb3Avg.rm2Name, stats: sb3Avg.wf4 }, { label: sb3Avg.rm3Name, stats: sb3Avg.wf5 }] },
      { title: 'Drop Test Average / Eff', items: [{ label: dropTestAvg.rm1Name, stats: dropTestAvg.rm1 }, { label: dropTestAvg.rm2Name, stats: dropTestAvg.rm2 }, { label: dropTestAvg.rm3Name, stats: dropTestAvg.rm3 }] },
    ].forEach(panel => {
      panel.items.forEach(it => {
        visibleShifts.forEach(s => {
          const stat = it.stats[s];
          rowsOut.push({ Section: panel.title, Parameter: it.label, Shift: s, 'Avg %': stat.avg, Entries: stat.count, 'Outside Limit': stat.outOfLimit, 'Efficiency %': stat.efficiency });
        });
      });
    });
    exportToCSV(rowsOut, `Daily_MOD_Meeting_${selectedDate}${shiftFilter !== 'All' ? `_${shiftFilter.replace(' ', '')}` : ''}`);
  };

  return (
    <div className="print-report max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          .no-print { display: none !important; }
          .mod-section { break-inside: avoid; box-shadow: none !important; border-color: #cbd5e1 !important; }
          /* The app shell scrolls inside a fixed-height <main> (h-screen + overflow-y-auto), so without this
             window.print() only captures the currently visible viewport instead of the full report. */
          html, body { height: auto !important; overflow: visible !important; }
          #root, .overflow-hidden, .overflow-y-auto { height: auto !important; overflow: visible !important; }

          /* Compact sizing so the whole report fits ~2 printed pages instead of a dozen, while staying legible. */
          .print-report { max-width: 100% !important; font-size: 10.5px !important; }
          .print-report > .space-y-6 > * { margin-top: 0 !important; }
          .print-report h1 { font-size: 14px !important; }
          .print-report h3 { font-size: 11px !important; }
          .print-report .mod-section { margin-bottom: 5px !important; }
          .print-report table th, .print-report table td { padding: 2.5px 6px !important; font-size: 9.5px !important; }
          .print-report .p-5, .print-report .px-6, .print-report .py-4, .print-report .px-5 { padding: 5px 8px !important; }
          .print-report .rounded-3xl { border-radius: 6px !important; }
          .print-report .rounded-2xl { border-radius: 4px !important; }
          .print-report .grid.md\\:grid-cols-3 { gap: 5px !important; }
          .print-report .p-5 > div { padding: 5px !important; }
          .print-columns > * { margin-bottom: 5px !important; }
        }
      `}</style>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-800 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-900 tracking-tight">Daily Meeting Report</h1>
            <p className="text-xs text-slate-400">Refractory Shift Checklist — rolled up live from department entries</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-brand-800 focus:border-transparent outline-none"
          />
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-brand-800 focus:border-transparent outline-none"
          >
            <option value="All">All Campaigns</option>
            {uniqueCampaigns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            title="Export this report as CSV"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-brand-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm"
            title="Print or save as PDF"
          >
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </button>
        </div>
      </div>

      {/* Shift filter */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Shift</span>
        {(['All', ...SHIFTS] as const).map(s => (
          <button
            key={s}
            onClick={() => setShiftFilter(s)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all border",
              shiftFilter === s
                ? "bg-brand-800 text-white border-brand-800 shadow-sm"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            {s === 'All' ? 'All Shifts' : s}
          </button>
        ))}
      </div>

      {/* Data-completeness strip */}
      <div className="no-print mod-section bg-white rounded-3xl border border-slate-200/80 shadow-sm px-6 py-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logged Today</span>
        {completeness.map(item => (
          <span key={item.label} className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold", item.ok ? "text-emerald-700" : "text-slate-300")}>
            {item.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
            {item.label}
          </span>
        ))}
      </div>

      <div className="print-columns space-y-6">
      <AvgEffPanel
        title="Production Flow (WF SB3) — Average / Eff"
        visibleShifts={visibleShifts}
        items={[
          { label: sb3Avg.rm1Name, stats: sb3Avg.wf3, color: 'text-red-600' },
          { label: sb3Avg.rm2Name, stats: sb3Avg.wf4, color: 'text-brand-600' },
          { label: sb3Avg.rm3Name, stats: sb3Avg.wf5, color: 'text-yellow-600' },
        ]}
      />

      <AvgEffPanel
        title="Drop Test Average / Eff"
        visibleShifts={visibleShifts}
        items={[
          { label: dropTestAvg.rm1Name, stats: dropTestAvg.rm1, color: 'text-red-600' },
          { label: dropTestAvg.rm2Name, stats: dropTestAvg.rm2, color: 'text-brand-600' },
          { label: dropTestAvg.rm3Name, stats: dropTestAvg.rm3, color: 'text-yellow-600' },
        ]}
      />
      <Section title="DGU Fineness" rows={dguFinenessRows} visibleShifts={visibleShifts} />
      <Section title="DGU Lab" rows={dguLabRows} visibleShifts={visibleShifts} />

      <Section title="3) PPT" rows={pptRows} visibleShifts={visibleShifts} />
      <Section title="4) Mixer" rows={mixerRows} visibleShifts={visibleShifts} />
      <Section title="5) Balling Disc" rows={bdRows} visibleShifts={visibleShifts} />

      <Section
        title="6) TG (Traveling Grate)"
        rows={tgRows}
        visibleShifts={visibleShifts}
        footnote="TG Feed Calculation Formula (reference only, not auto-calculated): l × w × h × (LBD) × (100 ÷ RPM) ÷ [35 × (100 ÷ RPM)] — also expressed as Bed Height × 1.15 (LBD) × 60 min × 8."
      />

      <Section title="Kiln" rows={kilnRows} visibleShifts={visibleShifts} />

      <Section
        title="Kiln Flow Meter"
        rows={kilnFlowRows}
        visibleShifts={visibleShifts}
        footnote="Reference readings noted on the paper checklist: Shift A – 1.2 KL, Shift B – 1.3 KL, Shift C – 1.9 KL."
      />

      <div className="mod-section bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <h3 className="text-sm font-bold text-brand-900 tracking-tight">Main Tank / Kiln Day Tank / TG Day Tank</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Opening vs Closing — recorded once per day, not per shift.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <th className="text-left px-6 py-2.5 w-1/3">Parameter</th>
              <th className="text-center px-3 py-2.5">Opening</th>
              <th className="text-center px-3 py-2.5">Closing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tankRows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-6 py-2.5 text-xs font-medium text-slate-600">{row.label}</td>
                <td className="px-3 py-2.5 text-center text-xs font-semibold text-brand-900">{row.opening || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-center text-xs font-semibold text-brand-900">{row.closing || <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-2.5 border-t border-slate-100 bg-slate-50/40 space-y-1">
          <p className="text-[10px] italic text-slate-400 leading-relaxed">Main Tank level check target (from checklist): 3.9 KL/day.</p>
          <p className="text-[10px] italic text-slate-400 leading-relaxed">Maintain Oil = Kiln Day Tank ÷ TG Day Tank (reference formula, not auto-calculated).</p>
        </div>
      </div>
      </div>
    </div>
  );
}
