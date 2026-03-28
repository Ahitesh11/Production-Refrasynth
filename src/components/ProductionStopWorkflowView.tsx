import React, { useState, useMemo } from 'react';
import { Department, Entry } from '../types';
import {
    Plus,
    Wrench,
    Activity,
    Clock,
    CheckCircle2,
    X,
    ClipboardList,
    History,
    Search
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import DepartmentForm from './DepartmentForm';

interface Props {
    department: Department;
    entries: Entry[];
    onAddEntry: (entry: Entry) => void;
    onUpdateEntry: (entry: Entry) => void;
    scriptUrl: string;
}

export default function ProductionStopWorkflowView({ department, entries, onAddEntry, onUpdateEntry, scriptUrl }: Props) {
    const [activeTab, setActiveTab] = useState<'form' | 'step1' | 'history'>('form');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const sortedEntries = useMemo(() => {
        const entriesCopy = [...entries];
        return entriesCopy.sort((a, b) => {
            const valA = a.data['Date'] || a.data['date'] || a.timestamp || '';
            const valB = b.data['Date'] || b.data['date'] || b.timestamp || '';

            if (!valA && !valB) return 0;
            if (!valA) return 1;
            if (!valB) return -1;

            const parseDate = (d: any) => {
                if (!d) return 0;
                const s = String(d).trim();
                const parsed = new Date(s).getTime();
                return isNaN(parsed) ? 0 : parsed;
            };

            return parseDate(valA) - parseDate(valB);
        });
    }, [entries]);

    const headerMapping: Record<string, string> = {
        campaign_no: 'Campaign No.',
        date: 'Date',
        shift: 'Shift',
        time_stop: 'Time Stop',
        department: 'Department',
        problem_description: 'Problem Description',
        machine_name: 'Machine Name',
        reported_by: 'Reported By',
        planned: 'Planned',
        actual: 'Actual',
        delay: 'Delay',
        actual_date: 'Date_1',
        actual_shift: 'Shift_1',
        actual_time: 'Time'
    };

    // ✅ FIXED: Auto-converts ISO timestamps to readable formats
    const getData = (entry: Entry, name: string) => {
        const label = headerMapping[name] || name;
        const val = entry.data[name] || entry.data[label] || '';

        if (val && typeof val === 'string' && val.includes('T') && (val.includes('Z') || val.includes('+'))) {
            // Date fields: ISO → MM/DD/YYYY
            if (name === 'actual_date' || name === 'date') {
                try {
                    return format(new Date(val), 'MM/dd/yyyy');
                } catch { return val; }
            }
            // Time fields: ISO → hh:mm a
            if (name === 'actual_time' || name === 'time_stop') {
                try {
                    return format(new Date(val), 'hh:mm a');
                } catch { return val; }
            }
        }

        return val;
    };

    const formatDuration = (val: any) => {
        if (!val) return '';
        const s = String(val).trim();

        // ✅ Handle ISO strings from Google Sheets durations (offsets from 1899-12-30)
        if (s.includes('T') && (s.includes('Z') || s.includes('+'))) {
            try {
                const date = new Date(s);
                if (!isNaN(date.getTime()) && date.getFullYear() < 1920) {
                    // Google Sheets base date is Dec 30, 1899
                    const baseDate = new Date('1899-12-30T00:00:00Z');
                    const diffMs = date.getTime() - baseDate.getTime();
                    const totalMins = Math.abs(Math.floor(diffMs / 60000));
                    const h = Math.floor(totalMins / 60);
                    const m = totalMins % 60;
                    return h > 0 ? `${h}h ${m}m` : `${m}m`;
                }
            } catch { }
        }

        // Return numbers as Xh
        const num = parseFloat(s);
        if (!isNaN(num) && /^-?\d+(\.\d+)?$/.test(s)) {
            const h = Math.floor(num);
            const m = Math.round((num - h) * 60);
            return m > 0 ? `${h}h ${m}m` : `${h}h`;
        }

        return s;
    };
    const formatTime12h = (timeStr: string) => {
        if (!timeStr) return '-';
        try {
            if (timeStr.includes('T') && (timeStr.includes('Z') || timeStr.includes('+'))) {
                const date = new Date(timeStr);
                if (!isNaN(date.getTime())) {
                    return format(date, 'hh:mm a');
                }
            }

            const s = String(timeStr).trim();

            if (s.toLowerCase().includes('am') || s.toLowerCase().includes('pm')) {
                return s;
            }

            if (s.includes(' ') && s.includes('/')) {
                const parts = s.split(' ');
                if (parts.length >= 2) {
                    const timePart = parts[1];
                    const [h, m] = timePart.split(':').map(Number);
                    if (!isNaN(h) && !isNaN(m)) {
                        const date = new Date();
                        date.setHours(h, m);
                        return format(date, 'hh:mm a');
                    }
                }
            }

            const timeParts = s.split(':');
            if (timeParts.length >= 2) {
                let hours = parseInt(timeParts[0]);
                const minutes = parseInt(timeParts[1]);

                if (!isNaN(hours) && !isNaN(minutes)) {
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    hours = hours % 12 || 12;
                    return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                }
            }

            return s;
        } catch {
            return String(timeStr) || '-';
        }
    };

    const calculateDuration = (startDate: string, startTime: string, endDate: string, endTime: string) => {
        if (!startTime || !endTime || !startDate || !endDate) return '-';

        try {
            const getDateTime = (dateStr: string, timeStr: string): Date | null => {
                try {
                    if (dateStr && dateStr.includes('T') && (dateStr.includes('Z') || dateStr.includes('+'))) {
                        const parsed = new Date(dateStr);
                        if (!isNaN(parsed.getTime())) return parsed;
                    }

                    if (timeStr && timeStr.includes('T') && (timeStr.includes('Z') || timeStr.includes('+'))) {
                        const parsed = new Date(timeStr);
                        if (!isNaN(parsed.getTime())) return parsed;
                    }

                    if (dateStr && timeStr) {
                        const cleanDate = String(dateStr).trim();
                        const cleanTime = String(timeStr).trim();

                        let year = 0, month = 0, day = 0;

                        if (cleanDate.includes('/')) {
                            const parts = cleanDate.split('/');
                            if (parts.length === 3) {
                                if (parts[0].length === 4) {
                                    year = parseInt(parts[0]);
                                    month = parseInt(parts[1]) - 1;
                                    day = parseInt(parts[2]);
                                } else {
                                    month = parseInt(parts[0]) - 1;
                                    day = parseInt(parts[1]);
                                    year = parseInt(parts[2]);
                                }
                            }
                        } else if (cleanDate.includes('-')) {
                            const parts = cleanDate.split('-');
                            if (parts.length === 3) {
                                year = parseInt(parts[0]);
                                month = parseInt(parts[1]) - 1;
                                day = parseInt(parts[2]);
                            }
                        }

                        if (year === 0) {
                            const now = new Date();
                            year = now.getFullYear();
                            month = now.getMonth();
                            day = now.getDate();
                        }

                        let hours = 0, minutes = 0;
                        const timeLower = cleanTime.toLowerCase();

                        if (timeLower.includes('am') || timeLower.includes('pm')) {
                            const match = timeLower.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
                            if (match) {
                                let h = parseInt(match[1]);
                                const m = parseInt(match[2]);
                                const period = match[3].toLowerCase();
                                if (period === 'pm' && h < 12) h += 12;
                                if (period === 'am' && h === 12) h = 0;
                                hours = h;
                                minutes = m;
                            }
                        } else {
                            const timeParts = cleanTime.split(':');
                            if (timeParts.length >= 2) {
                                hours = parseInt(timeParts[0]) || 0;
                                minutes = parseInt(timeParts[1]) || 0;
                            }
                        }

                        return new Date(year, month, day, hours, minutes, 0);
                    }

                    return null;
                } catch (err) {
                    console.error('Error parsing date:', err);
                    return null;
                }
            };

            let startDateTime = getDateTime(startDate, startTime);
            let endDateTime = getDateTime(endDate, endTime);

            if (!startDateTime && startDate && startDate.includes('T')) {
                startDateTime = new Date(startDate);
                if (isNaN(startDateTime.getTime())) startDateTime = null;
            }

            if (!endDateTime && endDate && endDate.includes('T')) {
                endDateTime = new Date(endDate);
                if (isNaN(endDateTime.getTime())) endDateTime = null;
            }

            if (!startDateTime || !endDateTime) {
                console.log('Failed to parse duration:', { startDate, startTime, endDate, endTime });
                return '-';
            }

            let diffMs = endDateTime.getTime() - startDateTime.getTime();

            if (diffMs < 0) {
                diffMs += 24 * 60 * 60 * 1000;
            }

            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 0) return '0h 0m';

            const totalHours = Math.floor(diffMins / 60);
            const minutes = diffMins % 60;
            const days = Math.floor(totalHours / 24);
            const remainingHours = totalHours % 24;

            if (days > 0) {
                if (remainingHours === 0 && minutes === 0) return `${days}d 0h 0m`;
                if (remainingHours === 0) return `${days}d 0h ${minutes}m`;
                if (minutes === 0) return `${days}d ${remainingHours}h 0m`;
                return `${days}d ${remainingHours}h ${minutes}m`;
            }

            if (totalHours === 0 && minutes === 0) return '< 1m';
            if (minutes === 0) return `${totalHours}h 0m`;
            return `${totalHours}h ${minutes}m`;
        } catch (err) {
            console.error('Error calculating duration:', err);
            return '-';
        }
    };

    const handleSync = async (entry: Entry, updatedData: Record<string, any>) => {
        setIsSyncing(true);
        const fullUpdatedData = { ...entry.data, ...updatedData };
        onUpdateEntry({ ...entry, data: fullUpdatedData });
        setIsActionModalOpen(false);
        setSelectedEntry(null);

        const fieldsOrder = [
            'campaign_no', 'date', 'shift', 'time_stop', 'department',
            'problem_description', 'machine_name', 'reported_by',
            'planned', 'actual', 'delay', 'actual_date', 'actual_shift', 'actual_time'
        ];

        const values = [entry.timestamp, ...fieldsOrder.map(f => fullUpdatedData[f] || fullUpdatedData[headerMapping[f]] || '')];

        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl)}`;
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sheetName: 'Why Production Stop',
                    entryId: entry.timestamp,
                    values: values
                })
            });

            const result = await response.json();
            if (result.result !== 'success') {
                throw new Error(result.error || 'Server error');
            }
            console.log("✅ Step synchronized successfully in background");
        } catch (err: any) {
            console.error(`❌ Background sync failed: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const renderActionModal = () => {
        if (!selectedEntry) return null;

        const fields = [
            { name: 'actual_date', label: 'Date', type: 'date' },
            { name: 'actual_shift', label: 'Shift', type: 'select', options: ['Shift A', 'Shift B', 'Shift C'] },
            { name: 'actual_time', label: 'Time', type: 'time' },
        ];

        const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const data: Record<string, any> = {};

            fields.forEach(f => {
                if (f.type === 'time') {
                    const h = formData.get(`${f.name}_hour`) || '12';
                    const m = formData.get(`${f.name}_minute`) || '00';
                    const ampm = formData.get(`${f.name}_ampm`) || 'AM';
                    data[f.name] = `${h}:${m} ${ampm}`;
                } else if (f.type === 'date') {
                    // ✅ FIXED: HTML date input gives YYYY-MM-DD → convert to MM/DD/YYYY
                    const raw = formData.get(f.name) as string;
                    if (raw) {
                        const [y, mo, d] = raw.split('-');
                        data[f.name] = `${mo}/${d}/${y}`;
                    } else {
                        data[f.name] = '';
                    }
                } else {
                    data[f.name] = formData.get(f.name);
                }
            });

            console.log('📋 Saving fix data:', data);

            const now = format(new Date(), 'MM/dd/yyyy HH:mm:ss');
            data.actual = now;
            data.Actual = now;

            handleSync(selectedEntry, data);
        };

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md text-zinc-900">
                <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-zinc-100">
                    <div className="px-8 py-6 bg-zinc-900 text-white flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-emerald-500">
                                <Activity className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold tracking-tight">Fix Issue</h3>
                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                    {getData(selectedEntry, 'machine_name') || 'Machine'} - {getData(selectedEntry, 'department') || 'Dept'}
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setIsActionModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                        <div className="grid grid-cols-2 gap-4">
                            {fields.map(field => (
                                <div key={field.name} className={cn("space-y-1.5 text-left", field.type === 'text' ? "col-span-2" : "")}>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">{field.label}</label>
                                    {field.type === 'select' ? (
                                        <select
                                            name={field.name}
                                            defaultValue={getData(selectedEntry, field.name) || ''}
                                            className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all outline-none text-sm font-medium cursor-pointer"
                                            required
                                        >
                                            <option value="">Select...</option>
                                            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    ) : field.type === 'time' ? (
                                        <div className="flex gap-1 w-full">
                                            <select
                                                name={`${field.name}_hour`}
                                                defaultValue={((getData(selectedEntry, field.name) || '12:00 AM').split(' ')[0] || '12:00').split(':')[0] || '12'}
                                                className="w-full px-2 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none text-sm font-medium appearance-none text-center cursor-pointer"
                                            >
                                                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                            <span className="flex items-center text-zinc-400 font-bold">:</span>
                                            <select
                                                name={`${field.name}_minute`}
                                                defaultValue={((getData(selectedEntry, field.name) || '12:00 AM').split(' ')[0] || '12:00').split(':')[1] || '00'}
                                                className="w-full px-2 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none text-sm font-medium appearance-none text-center cursor-pointer"
                                            >
                                                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                            <select
                                                name={`${field.name}_ampm`}
                                                defaultValue={(getData(selectedEntry, field.name) || '12:00 AM').split(' ')[1] || 'AM'}
                                                className="w-full px-2 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none text-sm font-medium appearance-none text-center cursor-pointer"
                                            >
                                                <option value="AM">AM</option>
                                                <option value="PM">PM</option>
                                            </select>
                                        </div>
                                    ) : (
                                        <input
                                            name={field.name}
                                            type={field.type}
                                            step="any"
                                            defaultValue={getData(selectedEntry, field.name) || ''}
                                            className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all outline-none text-sm font-medium"
                                            required
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-end pt-4 border-t border-zinc-100">
                            <button
                                type="button"
                                onClick={() => setIsActionModalOpen(false)}
                                className="px-6 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                                disabled={isSyncing}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSyncing}
                                className={cn(
                                    "px-8 py-2.5 text-white rounded-xl text-xs font-bold flex items-center transition-all shadow-lg active:scale-95",
                                    "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100",
                                    isSyncing && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {isSyncing ? <Clock className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                {isSyncing ? 'Syncing...' : 'Update Issue Record'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-12">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center shadow-xl">
                        <Wrench className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Production Stop</h1>
                        <p className="text-zinc-500 text-xs font-medium mt-1 uppercase tracking-widest"></p>
                    </div>
                </div>

                <div className="flex items-center space-x-2 bg-zinc-100 p-1 rounded-2xl border border-zinc-200 shadow-sm">
                    {[
                        { id: 'form', label: '1 Logs', icon: ClipboardList },
                        { id: 'step1', label: '2 Action', icon: Activity },
                        { id: 'history', label: '3 History', icon: History }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "flex items-center px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                                activeTab === tab.id
                                    ? "bg-white text-zinc-900 shadow-md border border-zinc-100 scale-[1.02]"
                                    : "text-zinc-400 hover:text-zinc-600"
                            )}
                        >
                            <tab.icon className={cn("w-3.5 h-3.5 mr-2", activeTab === tab.id ? "text-orange-500" : "text-zinc-300")} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {activeTab === 'form' ? (
                <div className="bg-white rounded-[32px] border border-zinc-200 shadow-sm overflow-hidden p-8 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="max-w-2xl mx-auto">
                        <div className="mb-8 flex items-center space-x-3 text-zinc-400">
                            <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center">
                                <Plus className="w-4 h-4" />
                            </div>
                            <h3 className="text-xs font-bold uppercase tracking-widest">Initial Incident Report</h3>
                        </div>
                        <DepartmentForm
                            department={{
                                ...department,
                                fields: department.fields.filter(f =>
                                    !['planned', 'actual', 'delay', 'actual_date', 'actual_shift', 'actual_time'].includes(f.name)
                                )
                            }}
                            onClose={() => { }}
                            onSuccess={async (submittedData) => {
                                const timestamp = format(new Date(), 'MM/dd/yyyy HH:mm:ss');
                                const data = { ...submittedData };
                                const newEntry: Entry = {
                                    id: `PS_${Date.now()}`,
                                    departmentId: 'production_stop',
                                    timestamp,
                                    data: data
                                };

                                onAddEntry(newEntry);
                                setActiveTab('step1');

                                const fieldsOrder = [
                                    'campaign_no', 'date', 'shift', 'time_stop', 'department',
                                    'problem_description', 'machine_name', 'reported_by',
                                    'planned', 'actual', 'delay', 'actual_date', 'actual_shift', 'actual_time'
                                ];
                                const values = [timestamp, ...fieldsOrder.map(key => data[key] || '')];

                                try {
                                    const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl)}`;
                                    await fetch(proxyUrl, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            sheetName: 'Why Production Stop',
                                            entryId: timestamp,
                                            values: values
                                        })
                                    });
                                    console.log('✅ Background submission successful!');
                                } catch (err) {
                                    console.error('❌ Background submission failed:', err);
                                }
                            }}
                        />
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden text-nowrap">
                        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                            <div className="relative max-w-sm w-full">
                                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search entries..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                                />
                            </div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                {activeTab === 'step1' ? 'Pending Action' : 'Resolved Logs'}
                            </p>
                        </div>
                        <div className="overflow-x-auto max-h-[600px] custom-scrollbar relative">
                            <table className="w-full text-left border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-zinc-50">
                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Timestamp</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Date/Shift</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Campaign</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Department</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Machine</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Problem</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Time Stop</th>

                                        {activeTab === 'history' && (
                                            <>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Fix Date/Shift</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Fix Time</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Duration</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Status</th>
                                            </>
                                        )}

                                        {activeTab === 'step1' && (
                                            <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 right-0 bg-zinc-50 z-30 border-b border-zinc-200 text-right">Action</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {(() => {
                                        const filtered = sortedEntries.filter(e => {
                                            const matchesSearch =
                                                getData(e, 'machine_name').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                getData(e, 'department').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                getData(e, 'problem_description').toLowerCase().includes(searchTerm.toLowerCase());
                                            if (!matchesSearch) return false;

                                            const isFixed = getData(e, 'actual') || getData(e, 'actual_date');
                                            if (activeTab === 'step1') return !isFixed;
                                            if (activeTab === 'history') return !!isFixed;
                                            return true;
                                        });

                                        if (filtered.length === 0) {
                                            return (
                                                <tr>
                                                    <td colSpan={12} className="px-6 py-12 text-center text-zinc-400 italic">
                                                        No entries found.
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        return filtered.map((entry) => (
                                            <tr key={entry.id} className="group hover:bg-zinc-50/50 transition-colors">
                                                <td className="px-6 py-4 text-xs text-zinc-500">{entry.timestamp}</td>
                                                <td className="px-6 py-4 text-xs font-bold text-zinc-900">
                                                    {getData(entry, 'date')} / {getData(entry, 'shift')}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-zinc-600 font-mono bg-zinc-100/50 rounded-lg">
                                                    {getData(entry, 'campaign_no')}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-zinc-600 font-medium">
                                                    {getData(entry, 'department')}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-zinc-800 font-bold">
                                                    {getData(entry, 'machine_name')}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-zinc-600 max-w-sm truncate">
                                                    {getData(entry, 'problem_description')}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-zinc-900 font-bold bg-orange-50/50 rounded-lg">
                                                    {formatTime12h(getData(entry, 'time_stop'))}
                                                </td>

                                                {activeTab === 'history' && (
                                                    <>
                                                        {/* ✅ FIXED: actual_date + actual_shift */}
                                                        <td className="px-6 py-4 text-xs font-bold text-emerald-700 bg-emerald-50/50 rounded-lg">
                                                            {getData(entry, 'actual_date')} / {getData(entry, 'actual_shift')}
                                                        </td>
                                                        {/* ✅ FIXED: actual_time */}
                                                        <td className="px-6 py-4 text-xs font-bold text-emerald-700 bg-emerald-50/50 rounded-lg">
                                                            {formatTime12h(getData(entry, 'actual_time'))}
                                                        </td>
                                                        {/* ✅ FIXED: duration first tries 'Duration' from sheet, then fallback to local calculation */}
                                                        <td className="px-6 py-4 text-xs font-black text-rose-600 bg-rose-50/50 rounded-lg">
                                                            {formatDuration(getData(entry, 'Duration')) || calculateDuration(
                                                                getData(entry, 'date'),
                                                                getData(entry, 'time_stop'),
                                                                getData(entry, 'actual_date'),
                                                                getData(entry, 'actual_time')
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold border border-emerald-100 inline-flex items-center">
                                                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                FIXED
                                                            </span>
                                                        </td>
                                                    </>
                                                )}

                                                {activeTab === 'step1' && (
                                                    <td className="px-6 py-4 text-right sticky right-0 bg-white group-hover:bg-zinc-50 transition-colors border-l border-zinc-100">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedEntry(entry);
                                                                setIsActionModalOpen(true);
                                                            }}
                                                            className="bg-zinc-900 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-zinc-800 transition-all shadow-md active:scale-95 flex items-center ml-auto"
                                                        >
                                                            <Wrench className="w-3.5 h-3.5 mr-2" /> Action
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ));
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {isActionModalOpen && renderActionModal()}
        </div>
    );
}