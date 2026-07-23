import React, { useMemo, useState } from 'react';
import { Entry, Department } from '../types';
import { BarChart3, CheckCircle2, AlertCircle, FileText, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MISReportProps {
  entries: Entry[];
  departments: Department[];
  parameterRanges: Record<string, string>;
}

export default function MISReport({ entries, departments, parameterRanges }: MISReportProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<string>('All');
  const [selectedName, setSelectedName] = useState<string>('All');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Extract unique campaigns
  const uniqueCampaigns = useMemo(() => {
    const campaigns = new Set<string>();
    entries.forEach(e => {
      const c = e.data['Campaign No.'] || e.data.campaign_no || e.data.campaign || e.data['Campaign'];
      if (c) campaigns.add(String(c).trim());
    });
    return Array.from(campaigns).sort();
  }, [entries]);

  // Extract unique names
  const uniqueNames = useMemo(() => {
    const names = new Set<string>();
    entries.forEach(e => {
      const personName = e.data['Name'] || e.data.name || e.data['Name of Chemist'] || e.data.chemist_name || e.data['Reported By'] || e.data.reported_by;
      if (personName && String(personName).trim() !== '-') names.add(String(personName).trim());
    });
    return Array.from(names).sort();
  }, [entries]);

  // Extract valid departments for MIS
  const uniqueDepartments = useMemo(() => {
    return departments.filter(d => ['kiln', 'dgu', 'balling_disc', 'product_house', 'drop_test'].includes(d.id));
  }, [departments]);

  // Evaluate entries
  const evaluatedEntries = useMemo(() => {
    let filtered = entries.filter(e => {
      if (selectedCampaign !== 'All') {
        const c = e.data['Campaign No.'] || e.data.campaign_no || e.data.campaign || e.data['Campaign'];
        if (!c || String(c).trim() !== selectedCampaign) return false;
      }
      if (selectedName !== 'All') {
        const personName = e.data['Name'] || e.data.name || e.data['Name of Chemist'] || e.data.chemist_name || e.data['Reported By'] || e.data.reported_by;
        if (!personName || String(personName).trim() !== selectedName) return false;
      }
      if (startDate) {
        const entryDate = new Date(e.timestamp);
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (entryDate < sDate) return false;
      }
      if (endDate) {
        const entryDate = new Date(e.timestamp);
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        if (entryDate > eDate) return false;
      }
      if (selectedDepartment !== 'All' && e.departmentId !== selectedDepartment) return false;
      return ['kiln', 'dgu', 'balling_disc', 'product_house', 'drop_test'].includes(e.departmentId);
    });

    return filtered.map(entry => {
      const department = departments.find(d => d.id === entry.departmentId);
      if (!department) return { entry, green: 0, red: 0, total: 0, score: 0 };

      let green = 0;
      let red = 0;
      let total = 0;

      department.fields.forEach(field => {
        let value = entry.data[field.label] || entry.data[field.name];
        if (value === undefined || value === null || value === '') return;

        let hasColored = false;

        // Kiln logic
        if (department.id === 'kiln') {
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
              total++;
              if (numValue >= min && numValue <= max) green++;
              else red++;
            }
          }
        }

        // DGU, Balling Disc, Product House logic
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
            min = parameterRanges[label] ? parseFloat(parameterRanges[label]) : (parameterRanges['Fineness'] ? parseFloat(parameterRanges['Fineness']) : 95);
            max = 1000;
          } else if (label.includes('Drop Test')) {
            min = parameterRanges[label] ? parseFloat(parameterRanges[label]) : (parameterRanges['Drop Test'] ? parseFloat(parameterRanges['Drop Test']) : 2.5);
            max = 1000;
          } else if (label.includes('Moisture') || label.includes('GBM')) {
            max = label.includes('GBM') ? 25 : (parameterRanges[label] ? parseFloat(parameterRanges[label]) : (parameterRanges['Moisture'] ? parseFloat(parameterRanges['Moisture']) : 15));
            reverseLogic = true;
          }

          const numValue = parseFloat(value);
          if (!isNaN(numValue) && (min !== null || max !== null || reverseLogic)) {
            hasColored = true;
            total++;
            if (reverseLogic) {
              if (numValue <= (max || 0)) green++;
              else red++;
            } else if (min !== null && max !== null) {
              if (numValue >= min && numValue <= max) green++;
              else red++;
            }
          }
        }

        // Drop Test logic
        if (!hasColored && department.id === 'drop_test') {
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
                hasColored = true;
                total++;
                if (val >= min && val <= max) green++;
                else red++;
              }
            }
          }
        }
      });

      const personName = entry.data['Name'] || entry.data.name || entry.data['Name of Chemist'] || entry.data.chemist_name || entry.data['Reported By'] || entry.data.reported_by || '-';
      const score = total > 0 ? Math.round((green / total) * 100) : 0;
      return { entry, department, personName, green, red, total, score };
    }).filter(e => e.total > 0).sort((a, b) => new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime());
  }, [entries, departments, parameterRanges, selectedCampaign, selectedName, selectedDepartment, startDate, endDate]);

  const summaryStats = useMemo(() => {
    if (evaluatedEntries.length === 0) return { avgScore: 0, totalEntries: 0, totalGreen: 0, totalRed: 0 };
    
    let totalScore = 0;
    let totalGreen = 0;
    let totalRed = 0;
    
    evaluatedEntries.forEach(e => {
      totalScore += e.score;
      totalGreen += e.green;
      totalRed += e.red;
    });

    return {
      avgScore: Math.round(totalScore / evaluatedEntries.length),
      totalEntries: evaluatedEntries.length,
      totalGreen,
      totalRed
    };
  }, [evaluatedEntries]);

  const { top5, worst5 } = useMemo(() => {
    const userScores: Record<string, { totalScore: number; count: number }> = {};
    evaluatedEntries.forEach(e => {
      const name = e.personName;
      if (name && name !== '-') {
        if (!userScores[name]) userScores[name] = { totalScore: 0, count: 0 };
        userScores[name].totalScore += e.score;
        userScores[name].count += 1;
      }
    });

    const userAvgs = Object.entries(userScores).map(([name, data]) => ({
      name,
      score: Math.round(data.totalScore / data.count)
    }));

    userAvgs.sort((a, b) => b.score - a.score);

    const top = userAvgs.slice(0, 5);
    const worst = [...userAvgs].sort((a, b) => a.score - b.score).slice(0, 5);
    
    return { top5: top, worst5: worst };
  }, [evaluatedEntries]);

  const handleExport = () => {
    const headers = ['Timestamp', 'Name', 'Department', 'Campaign', 'Score (%)', 'Green Params', 'Red Params', 'Total Params'];
    const rows = evaluatedEntries.map(({ entry, department, personName, green, red, total, score }) => {
      const campaign = entry.data['Campaign No.'] || entry.data.campaign_no || entry.data.campaign || entry.data['Campaign'] || '-';
      let formattedDate = entry.timestamp;
      try {
        formattedDate = format(new Date(entry.timestamp), 'dd MMM yyyy, hh:mm a');
      } catch (e) {}
      
      return [
        `"${formattedDate}"`,
        `"${personName}"`,
        `"${department?.name || ''}"`,
        `"${campaign}"`,
        score,
        green,
        red,
        total
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MIS_Report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-brand-900">MIS Report</h2>
          <p className="text-sm text-slate-500 mt-1">Entry-wise performance summary and scoring.</p>
        </div>
        <button
          onClick={handleExport}
          disabled={evaluatedEntries.length === 0}
          className="flex items-center px-4 py-2 bg-brand-800 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Entries</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">{summaryStats.totalEntries}</h3>
          </div>
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center">
            <FileText className="w-7 h-7 text-brand-600" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Average Score</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">{summaryStats.avgScore}%</h3>
          </div>
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
            <BarChart3 className="w-7 h-7 text-blue-600" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Green</p>
            <h3 className="text-3xl font-bold text-emerald-600 mt-2">{summaryStats.totalGreen}</h3>
          </div>
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Red</p>
            <h3 className="text-3xl font-bold text-rose-600 mt-2">{summaryStats.totalRed}</h3>
          </div>
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-rose-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Performers */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-slate-800">Top 5 Best Performers</h3>
          </div>
          {top5.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top5} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} tickFormatter={(val) => val.split(' ')[0]} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {top5.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#10b981" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">No data available</div>
          )}
        </div>

        {/* Worst 5 Performers */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingDown className="w-5 h-5 text-rose-600" />
            <h3 className="text-lg font-bold text-slate-800">Top 5 Worst Performers</h3>
          </div>
          {worst5.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={worst5} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} tickFormatter={(val) => val.split(' ')[0]} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {worst5.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#f43f5e" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">No data available</div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-3 px-4 py-3 border-b border-slate-200/80 bg-slate-50/30">
          <div className="flex items-center gap-3 w-full flex-1">
            {uniqueCampaigns.length > 0 && (
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all shadow-sm cursor-pointer shrink-0"
              >
                <option value="All">All Campaigns</option>
                {uniqueCampaigns.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {uniqueNames.length > 0 && (
              <select
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all shadow-sm cursor-pointer shrink-0"
              >
                <option value="All">All Names</option>
                {uniqueNames.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            )}

            {uniqueDepartments.length > 0 && (
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all shadow-sm cursor-pointer shrink-0"
              >
                <option value="All">All Departments</option>
                {uniqueDepartments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
            
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all shadow-sm"
              />
              <span className="text-slate-400 text-sm">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all shadow-sm"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-600">Timestamp</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Name</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Department</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Campaign / Details</th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-center">Score</th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-center">Parameters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {evaluatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <BarChart3 className="w-12 h-12 text-slate-300 mb-3" />
                      <p className="text-lg font-medium text-slate-600">No evaluated entries found</p>
                      <p className="text-sm mt-1">Adjust filters or wait for more data to be entered.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                evaluatedEntries.map(({ entry, department, personName, green, red, total, score }) => {
                  const campaign = entry.data['Campaign No.'] || entry.data.campaign_no || entry.data.campaign || entry.data['Campaign'] || '-';
                  let formattedDate = entry.timestamp;
                  try {
                    formattedDate = format(new Date(entry.timestamp), 'dd MMM yyyy, hh:mm a');
                  } catch (e) {}

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {formattedDate}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {personName}
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-semibold">
                        {department?.name}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {campaign}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center justify-center font-bold px-3 py-1.5 rounded-lg border-2 w-20 shadow-sm"
                          style={{
                            borderColor: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444',
                            backgroundColor: score >= 80 ? '#ecfdf5' : score >= 50 ? '#fffbeb' : '#fef2f2',
                            color: score >= 80 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626'
                          }}
                        >
                          {score}%
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-4">
                           <div className="flex items-center text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                             <CheckCircle2 className="w-4 h-4 mr-1.5" />
                             {green}
                           </div>
                           <div className="flex items-center text-rose-600 font-bold bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">
                             <AlertCircle className="w-4 h-4 mr-1.5" />
                             {red}
                           </div>
                           <div className="text-slate-400 text-xs font-medium ml-2">
                             (Total {total})
                           </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
