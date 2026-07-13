import React, { useState, useMemo } from 'react';
import { Department, Entry } from '../types';
import {
    Plus,
    ClipboardList,
    ListChecks,
    CheckCircle2,
    Clock,
    History,
    Search,
    X,
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { cn } from '../lib/utils';
import DepartmentForm from './DepartmentForm';

interface Props {
    department: Department;
    entries: Entry[];
    onAddEntry: (entry: Entry) => void;
    onUpdateEntry: (entry: Entry) => void;
    scriptUrl: string;
}

const fieldsOrder = [
    'task_id', 'given_by', 'name', 'task_description', 'task_start_date', 'freq',
    'planned1', 'actual1', 'delay1', 'status1',
    'planned2', 'actual2', 'delay2', 'status2'
];

const headerMapping: Record<string, string> = {
    task_id: 'Task ID',
    given_by: 'Given By',
    name: 'Name',
    task_description: 'Task Description',
    task_start_date: 'Task Start Date',
    freq: 'Freq',
    planned1: 'Planned1',
    actual1: 'Actual1',
    delay1: 'Delay1',
    status1: 'Status1',
    planned2: 'Planned2',
    actual2: 'Actual2',
    delay2: 'Delay2',
    status2: 'Status2',
};

const computeDelay = (plannedStr: string, actualDate: Date): string => {
    if (!plannedStr) return '';
    const planned = new Date(plannedStr);
    if (isNaN(planned.getTime())) return '';
    const plannedDay = new Date(planned.getFullYear(), planned.getMonth(), planned.getDate());
    const actualDay = new Date(actualDate.getFullYear(), actualDate.getMonth(), actualDate.getDate());
    const diffDays = Math.round((actualDay.getTime() - plannedDay.getTime()) / 86400000);
    return diffDays <= 0 ? 'On Time' : `${diffDays}d Late`;
};

// Generates every occurrence date from startDate up to 12 months later, spaced by freq.
const generateOccurrenceDates = (startDate: Date, freq: string): Date[] => {
    const endDate = addMonths(startDate, 12);
    const step = (d: Date): Date => {
        switch (freq) {
            case 'Daily': return addDays(d, 1);
            case 'Weekly': return addWeeks(d, 1);
            case 'Monthly': return addMonths(d, 1);
            case 'Quarterly': return addMonths(d, 3);
            case 'Yearly': return addMonths(d, 12);
            default: return addMonths(d, 1);
        }
    };
    const dates: Date[] = [];
    let cursor = startDate;
    while (cursor < endDate) {
        dates.push(cursor);
        cursor = step(cursor);
    }
    return dates;
};

export default function ChecklistWorkflowView({ department, entries, onAddEntry, onUpdateEntry, scriptUrl }: Props) {
    const [activeTab, setActiveTab] = useState<'form' | 'step1' | 'step2' | 'history'>('form');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const sortedEntries = useMemo(() => {
        const entriesCopy = [...entries];
        return entriesCopy.sort((a, b) => {
            const valA = a.data['Task Start Date'] || a.data['task_start_date'] || a.timestamp || '';
            const valB = b.data['Task Start Date'] || b.data['task_start_date'] || b.timestamp || '';
            const parseDate = (d: any) => {
                if (!d) return 0;
                const parsed = new Date(String(d).trim()).getTime();
                return isNaN(parsed) ? 0 : parsed;
            };
            return parseDate(valA) - parseDate(valB);
        });
    }, [entries]);

    const getData = (entry: Entry, name: string) => {
        const label = headerMapping[name] || name;
        const val1 = entry.data[name];
        const val2 = entry.data[label];
        if (val1 !== undefined && val1 !== null && val1 !== '') return String(val1);
        if (val2 !== undefined && val2 !== null && val2 !== '') return String(val2);
        return '';
    };

    const handleSync = async (entry: Entry, updatedData: Record<string, any>) => {
        setIsSyncing(true);
        const fullUpdatedData = { ...entry.data, ...updatedData };
        onUpdateEntry({ ...entry, data: fullUpdatedData });
        setIsActionModalOpen(false);
        setSelectedEntry(null);

        const values = [entry.timestamp, ...fieldsOrder.map(f => fullUpdatedData[f] ?? fullUpdatedData[headerMapping[f]] ?? '')];

        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl)}`;
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheetName: 'Check List', entryId: entry.timestamp, values })
            });
            const result = await response.json();
            if (result.result !== 'success') throw new Error(result.error || 'Server error');
            console.log('✅ Step synchronized successfully');
        } catch (err: any) {
            console.error(`❌ Background sync failed: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleCompleteStep = () => {
        if (!selectedEntry) return;
        const now = new Date();
        const nowStr = format(now, 'MM/dd/yyyy HH:mm:ss');
        const isStep1 = activeTab === 'step1';

        if (isStep1) {
            const planned1 = getData(selectedEntry, 'planned1');
            const delay1 = computeDelay(planned1, now);
            handleSync(selectedEntry, {
                actual1: nowStr,
                delay1,
                status1: delay1 === 'On Time' ? 'Completed' : 'Delayed',
                planned2: format(now, 'MM/dd/yyyy'),
            });
        } else {
            const planned2 = getData(selectedEntry, 'planned2');
            const delay2 = computeDelay(planned2, now);
            handleSync(selectedEntry, {
                actual2: nowStr,
                delay2,
                status2: delay2 === 'On Time' ? 'Completed' : 'Delayed',
            });
        }
    };

    const renderActionModal = () => {
        if (!selectedEntry) return null;
        const isStep1 = activeTab === 'step1';

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md">
                <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-zinc-100">
                    <div className="px-8 py-6 bg-zinc-900 text-white flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-lg", isStep1 ? "bg-brand-500" : "bg-emerald-500")}>
                                <ListChecks className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold tracking-tight">{isStep1 ? 'Step 1 Check' : 'Step 2 Check'}</h3>
                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{getData(selectedEntry, 'task_id')}</p>
                            </div>
                        </div>
                        <button onClick={() => setIsActionModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>
                    <div className="p-8 space-y-5">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Task</p>
                            <p className="text-sm font-medium text-zinc-800">{getData(selectedEntry, 'task_description') || '-'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Planned</p>
                                <p className="text-sm font-bold text-zinc-800">{getData(selectedEntry, isStep1 ? 'planned1' : 'planned2') || '-'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Marking Complete At</p>
                                <p className="text-sm font-bold text-zinc-800">{format(new Date(), 'MM/dd/yyyy hh:mm a')}</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-end pt-4 border-t border-zinc-100 gap-3">
                            <button
                                type="button"
                                onClick={() => setIsActionModalOpen(false)}
                                className="px-6 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                                disabled={isSyncing}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCompleteStep}
                                disabled={isSyncing}
                                className={cn(
                                    "px-8 py-2.5 text-white rounded-xl text-xs font-bold flex items-center transition-all shadow-lg active:scale-95",
                                    isStep1 ? "bg-brand-600 hover:bg-brand-700 shadow-brand-100" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100",
                                    isSyncing && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {isSyncing ? <Clock className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                {isSyncing ? 'Syncing...' : `Mark Step ${isStep1 ? '1' : '2'} Complete`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const filterEntries = (list: Entry[]) => list.filter(e => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = !term ||
            getData(e, 'task_id').toLowerCase().includes(term) ||
            getData(e, 'name').toLowerCase().includes(term) ||
            getData(e, 'given_by').toLowerCase().includes(term) ||
            getData(e, 'task_description').toLowerCase().includes(term);
        if (!matchesSearch) return false;

        if (activeTab === 'step1') return !getData(e, 'actual1');
        if (activeTab === 'step2') return !!getData(e, 'actual1') && !getData(e, 'actual2');
        if (activeTab === 'history') return !!getData(e, 'actual2');
        return true;
    });

    const visibleEntries = filterEntries(sortedEntries);

    const statusBadge = (status: string) => (
        <span className={cn(
            "px-2.5 py-1 rounded-lg text-[10px] font-bold border inline-flex items-center",
            status === 'Completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
            status === 'Delayed' ? "bg-red-50 text-red-600 border-red-100" :
            "bg-zinc-50 text-zinc-400 border-zinc-100"
        )}>
            {status || 'Pending'}
        </span>
    );

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-12">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center shadow-xl">
                        <ClipboardList className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Check List</h1>
                        <p className="text-zinc-500 text-xs font-medium mt-1 uppercase tracking-widest">Two-Step Task Verification</p>
                    </div>
                </div>

                <div className="flex items-center space-x-2 bg-zinc-100 p-1 rounded-2xl border border-zinc-200 shadow-sm">
                    {[
                        { id: 'form', label: '1 New Task', icon: Plus },
                        { id: 'step1', label: '2 Step 1', icon: ListChecks },
                        { id: 'step2', label: '3 Step 2', icon: CheckCircle2 },
                        { id: 'history', label: '4 History', icon: History }
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
                            <tab.icon className={cn("w-3.5 h-3.5 mr-2", activeTab === tab.id ? "text-brand-500" : "text-zinc-300")} />
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
                            <h3 className="text-xs font-bold uppercase tracking-widest">New Task Entry</h3>
                        </div>
                        <DepartmentForm
                            department={{
                                ...department,
                                fields: department.fields.filter(f => ['given_by', 'name', 'task_description', 'task_start_date', 'freq'].includes(f.name))
                            }}
                            onClose={() => { }}
                            onSuccess={async (submittedData) => {
                                const freq = submittedData.freq || 'Monthly';
                                const startDate = submittedData.task_start_date ? new Date(submittedData.task_start_date) : new Date();
                                const occurrenceDates = generateOccurrenceDates(startDate, freq);
                                const baseTs = Date.now();

                                const rows: any[][] = [];
                                const newEntries: Entry[] = [];

                                occurrenceDates.forEach((occDate, idx) => {
                                    const ts = baseTs + idx;
                                    const timestamp = format(new Date(ts), 'MM/dd/yyyy HH:mm:ss');
                                    const plannedDate = format(occDate, 'MM/dd/yyyy');
                                    const data = {
                                        ...submittedData,
                                        task_id: `CHK-${ts}`,
                                        task_start_date: plannedDate,
                                        planned1: plannedDate,
                                        status1: 'Pending',
                                        status2: 'Pending',
                                    };
                                    newEntries.push({
                                        id: `CHECKLIST_${ts}`,
                                        departmentId: 'check_list',
                                        timestamp,
                                        data
                                    });
                                    rows.push([timestamp, ...fieldsOrder.map(key => data[key] || '')]);
                                });

                                newEntries.forEach(onAddEntry);
                                setActiveTab('step1');
                                alert(`✅ Created ${rows.length} recurring task instance${rows.length === 1 ? '' : 's'} for the next 12 months (${freq}).`);

                                try {
                                    const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl)}`;
                                    await fetch(proxyUrl, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ sheetName: 'Check List', batchValues: rows })
                                    });
                                    console.log(`✅ Background batch submission successful (${rows.length} rows)!`);
                                } catch (err) {
                                    console.error('❌ Background batch submission failed:', err);
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
                                    placeholder="Search by task id, name, or description..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                                />
                            </div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                {activeTab === 'step1' ? 'Pending Step 1' : activeTab === 'step2' ? 'Pending Step 2' : 'Completed Tasks'}
                            </p>
                        </div>
                        <div className="overflow-x-auto max-h-[600px] custom-scrollbar relative">
                            <table className="w-full text-left border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-brand-50">
                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 left-0 bg-brand-50 z-30 border-b border-zinc-200">Task ID</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Given By</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Name</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Task Description</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Freq</th>
                                        {activeTab === 'history' ? (
                                            <>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Planned1</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Actual1</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Delay1</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Status1</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Planned2</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Actual2</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Delay2</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Status2</th>
                                            </>
                                        ) : activeTab === 'step1' ? (
                                            <>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Planned1</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Status1</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Delay1</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Planned2</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-brand-50 z-20 border-b border-zinc-200">Status2</th>
                                            </>
                                        )}
                                        {activeTab !== 'history' && (
                                            <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 right-0 bg-brand-50 z-30 border-b border-zinc-200 text-right">Action</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {visibleEntries.length === 0 ? (
                                        <tr><td colSpan={12} className="px-6 py-12 text-center text-zinc-400 italic">No entries found.</td></tr>
                                    ) : (
                                        visibleEntries.map((entry) => (
                                            <tr key={entry.id} className="group hover:bg-zinc-50/50 transition-colors">
                                                <td className="px-6 py-4 text-xs font-bold text-zinc-900 sticky left-0 bg-white group-hover:bg-zinc-50 transition-colors z-10">{getData(entry, 'task_id')}</td>
                                                <td className="px-6 py-4 text-xs text-zinc-600">{getData(entry, 'given_by')}</td>
                                                <td className="px-6 py-4 text-xs text-zinc-600 font-medium">{getData(entry, 'name')}</td>
                                                <td className="px-6 py-4 text-xs text-zinc-600 max-w-[220px] truncate">{getData(entry, 'task_description')}</td>
                                                <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'freq')}</td>
                                                {activeTab === 'history' ? (
                                                    <>
                                                        <td className="px-6 py-4 text-[10px] text-brand-600 font-bold">{getData(entry, 'planned1')}</td>
                                                        <td className="px-6 py-4 text-[10px] text-zinc-500">{getData(entry, 'actual1')}</td>
                                                        <td className="px-6 py-4 text-[10px] text-zinc-500">{getData(entry, 'delay1')}</td>
                                                        <td className="px-6 py-4">{statusBadge(getData(entry, 'status1'))}</td>
                                                        <td className="px-6 py-4 text-[10px] text-brand-600 font-bold">{getData(entry, 'planned2')}</td>
                                                        <td className="px-6 py-4 text-[10px] text-zinc-500">{getData(entry, 'actual2')}</td>
                                                        <td className="px-6 py-4 text-[10px] text-zinc-500">{getData(entry, 'delay2')}</td>
                                                        <td className="px-6 py-4">{statusBadge(getData(entry, 'status2'))}</td>
                                                    </>
                                                ) : activeTab === 'step1' ? (
                                                    <>
                                                        <td className="px-6 py-4">
                                                            <span className="px-2 py-1 bg-brand-50 text-brand-600 rounded-lg text-[10px] font-bold border border-brand-100 italic">
                                                                {getData(entry, 'planned1')}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">{statusBadge(getData(entry, 'status1'))}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'delay1') || '-'}</td>
                                                        <td className="px-6 py-4">
                                                            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold border border-emerald-100 italic">
                                                                {getData(entry, 'planned2')}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">{statusBadge(getData(entry, 'status2'))}</td>
                                                    </>
                                                )}
                                                {activeTab !== 'history' && (
                                                    <td className="px-6 py-4 text-right sticky right-0 bg-white group-hover:bg-zinc-50 transition-colors border-l border-zinc-100">
                                                        <button
                                                            onClick={() => { setSelectedEntry(entry); setIsActionModalOpen(true); }}
                                                            className="bg-zinc-900 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-zinc-800 transition-all shadow-md active:scale-95 flex items-center ml-auto"
                                                        >
                                                            <ListChecks className="w-3.5 h-3.5 mr-2" />
                                                            {activeTab === 'step1' ? 'Step 1' : 'Step 2'}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
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
