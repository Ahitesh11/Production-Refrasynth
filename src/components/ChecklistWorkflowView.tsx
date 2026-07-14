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
    AlertCircle,
    Repeat,
    Send,
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
    'task_id', 'department', 'name', 'task_description', 'task_start_date', 'freq',
    'planned1', 'actual1', 'delay1', 'status1',
    'planned2', 'actual2', 'delay2', 'status2',
    'task_type'
];

const DEPARTMENT_OPTIONS = ['Dispatch', 'HR & Admin', 'Maintenance', 'Production', 'Quality', 'Safety', 'Stores'];

const headerMapping: Record<string, string> = {
    task_id: 'Task ID',
    department: 'Department',
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
    task_type: 'Task Type',
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
    const [taskType, setTaskType] = useState<'Recurring' | 'One-Time'>('Recurring');
    const [departmentFilter, setDepartmentFilter] = useState<string>('All');
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
            if (!scriptUrl || scriptUrl.includes('AKfycbyQNcs5g-6p4dZ4qhdKL0GYkem_hudT7PUf0ZhSVmK1dZvHjw_fzurvGqWTztk6xNyBFQ')) {
                alert('⚠️ Data synced to DEMO SHEET. Please configure your own Script URL in Settings.');
            }
        } catch (err: any) {
            console.error(`❌ Background sync failed: ${err.message}`);
            alert(`❌ Sync Failed: ${err.message}\n\nData is saved locally but not in Google Sheets.`);
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
                    <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-lg", isStep1 ? "bg-brand-500" : "bg-emerald-500")}>
                                <ListChecks className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold tracking-tight">{isStep1 ? 'Step 1 Check' : 'Step 2 Check'}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{getData(selectedEntry, 'task_id')}</p>
                            </div>
                        </div>
                        <button onClick={() => setIsActionModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>
                    <div className="p-8 space-y-5">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Task</p>
                            <p className="text-sm font-medium text-slate-800">{getData(selectedEntry, 'task_description') || '-'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Planned</p>
                                <p className="text-sm font-bold text-slate-800">{getData(selectedEntry, isStep1 ? 'planned1' : 'planned2') || '-'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Marking Complete At</p>
                                <p className="text-sm font-bold text-slate-800">{format(new Date(), 'MM/dd/yyyy hh:mm a')}</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-end pt-4 border-t border-slate-100 gap-3">
                            <button
                                type="button"
                                onClick={() => setIsActionModalOpen(false)}
                                className="px-6 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
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
            getData(e, 'department').toLowerCase().includes(term) ||
            getData(e, 'task_description').toLowerCase().includes(term);
        if (!matchesSearch) return false;

        if (departmentFilter !== 'All' && getData(e, 'department') !== departmentFilter) return false;

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
            "bg-slate-50 text-slate-400 border-slate-100"
        )}>
            {status || 'Pending'}
        </span>
    );

    const typeBadge = (type: string) => (
        <span className={cn(
            "px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border inline-flex items-center gap-1 whitespace-nowrap",
            type === 'One-Time' ? "bg-purple-50 text-purple-600 border-purple-100" : "bg-brand-50 text-brand-600 border-brand-100"
        )}>
            {type === 'One-Time' ? <Send className="w-2.5 h-2.5" /> : <Repeat className="w-2.5 h-2.5" />}
            {type || 'Recurring'}
        </span>
    );

    // Compute counts for tab badges
    const step1Count = filterEntries(sortedEntries.map(e => e)).filter(e => !getData(e,'actual1')).length;
    const step2Count = sortedEntries.filter(e => !!getData(e,'actual1') && !getData(e,'actual2')).length;
    const historyCount = sortedEntries.filter(e => !!getData(e,'actual2')).length;
    const totalTasks = sortedEntries.length;

    return (
        <div style={{minHeight:'100vh', background:'#f8fafc', paddingBottom:'40px'}}>

        {/* ═══ HEADER ══════════════════════════════════════════════════ */}
        <div style={{
            background:'#ffffff',
            borderBottom:'1px solid #e2e8f0',
            padding:'32px 32px 0',
        }}>
            {/* Title row */}
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'24px', maxWidth:'1400px', margin:'0 auto'}}>
                <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
                    <div style={{
                        width:'50px',height:'50px',
                        background:'#059669', // Emerald 600
                        borderRadius:'14px',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        boxShadow:'0 4px 12px rgba(5, 150, 105, 0.2)'
                    }}>
                        <ClipboardList style={{width:'24px',height:'24px',color:'#fff'}} />
                    </div>
                    <div>
                        <h1 style={{fontSize:'24px',fontWeight:800,color:'#0f172a',letterSpacing:'-0.02em',margin:0}}>
                            Check List &amp; Delegation
                        </h1>
                        <p style={{fontSize:'12px',fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',marginTop:'4px'}}>
                            Recurring Checklists &amp; One-Time Tasks
                        </p>
                    </div>
                </div>

                {/* Mini stats */}
                <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
                    {[
                        {label:'Total', value:totalTasks, color:'#0f172a'},
                        {label:'Step 1', value:step1Count, color:'#b45309'},
                        {label:'Step 2', value:step2Count, color:'#4338ca'},
                        {label:'Done', value:historyCount, color:'#059669'},
                    ].map(s => (
                        <div key={s.label} style={{
                            background:'#f8fafc',
                            border:'1px solid #e2e8f0',
                            borderRadius:'12px',
                            padding:'8px 16px',
                            textAlign:'center',
                            minWidth:'64px'
                        }}>
                            <div style={{fontSize:'20px',fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
                            <div style={{fontSize:'10px',fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',marginTop:'4px'}}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Tab Navigation ── */}
            <div style={{display:'flex',gap:'8px',marginTop:'32px', maxWidth:'1400px', margin:'0 auto'}}>
                {[
                    { id:'form', label:'New Task', icon:Plus, count:null, color:'#059669' },
                    { id:'step1', label:'Step 1', icon:ListChecks, count:step1Count, color:'#059669' },
                    { id:'step2', label:'Step 2', icon:CheckCircle2, count:step2Count, color:'#059669' },
                    { id:'history', label:'History', icon:History, count:historyCount, color:'#059669' },
                ].map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            style={{
                                display:'flex', alignItems:'center', gap:'8px',
                                padding:'12px 20px',
                                border:'none', cursor:'pointer',
                                fontSize:'12px', fontWeight:700,
                                transition:'all 0.2s ease',
                                background: 'transparent',
                                color: isActive ? tab.color : '#64748b',
                                borderBottom: isActive ? '2px solid '+tab.color : '2px solid transparent',
                            }}
                        >
                            <tab.icon style={{width:'14px',height:'14px',color: isActive ? tab.color : '#94a3b8'}} />
                            <span>{tab.label}</span>
                            {tab.count !== null && (
                                <span style={{
                                    background: isActive ? '#d1fae5' : '#f1f5f9',
                                    color: isActive ? '#065f46' : '#64748b',
                                    fontSize:'10px', fontWeight:800,
                                    padding:'2px 8px', borderRadius:'99px',
                                    marginLeft:'4px'
                                }}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>

        {/* ═══ CONTENT AREA ═══════════════════════════════════════════════ */}
        <div style={{padding:'32px', maxWidth:'1400px', margin:'0 auto'}}>

            {activeTab === 'form' ? (
                /* ── FORM SECTION ── */
                <div style={{display:'flex', justifyContent:'center', alignItems:'start'}}>

                    {/* Form container */}
                    <div style={{
                        width: '100%',
                        maxWidth: '800px',
                        background:'#fff',
                        borderRadius:'16px',
                        border:'1px solid #e2e8f0',
                        boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
                        overflow:'hidden'
                    }}>
                        {/* Card header */}
                        <div style={{
                            padding:'20px 24px',
                            borderBottom:'1px solid #f1f5f9',
                            display:'flex', alignItems:'center', gap:'12px'
                        }}>
                            <div style={{width:'32px',height:'32px',background:'#ecfdf5',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                <Plus style={{width:'16px',height:'16px',color:'#059669'}} />
                            </div>
                            <div>
                                <h3 style={{fontSize:'15px',fontWeight:700,color:'#0f172a',margin:0}}>Create New Task</h3>
                                <p style={{fontSize:'12px',color:'#64748b',margin:0,marginTop:'2px'}}>Define task parameters below</p>
                            </div>
                        </div>

                        {/* Task type toggle */}
                        <div style={{padding:'24px 24px 0'}}>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'24px'}}>
                                {(['Recurring', 'One-Time'] as const).map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setTaskType(type)}
                                        style={{
                                            display:'flex', alignItems:'center', gap:'12px',
                                            padding:'16px',
                                            borderRadius:'12px', border:'1px solid',
                                            borderColor: taskType === type ? '#059669' : '#e2e8f0',
                                            background: taskType === type ? '#ecfdf5' : '#fff',
                                            cursor:'pointer',
                                            transition:'all 0.2s ease',
                                        }}
                                    >
                                        <div style={{
                                            width:'40px',height:'40px',borderRadius:'10px',
                                            background: taskType === type ? '#059669' : '#f1f5f9',
                                            display:'flex',alignItems:'center',justifyContent:'center',
                                        }}>
                                            {type === 'Recurring' ? <Repeat style={{width:'20px',height:'20px',color: taskType===type ? '#fff' : '#64748b'}} /> : <Send style={{width:'20px',height:'20px',color: taskType===type ? '#fff' : '#64748b'}} />}
                                        </div>
                                        <div style={{textAlign:'left'}}>
                                            <div style={{fontSize:'14px',fontWeight:700,color: taskType===type ? '#065f46' : '#334155'}}>{type === 'Recurring' ? 'Recurring' : 'One-Time'}</div>
                                            <div style={{fontSize:'11px',color:taskType===type ? '#047857' : '#64748b',fontWeight:500,marginTop:'2px'}}>{type === 'Recurring' ? 'Checklist' : 'Delegation'}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{padding:'0 24px 24px'}}>
                        <DepartmentForm
                            key={taskType}
                            department={{

                                ...department,
                                fields: department.fields.filter(f => {
                                    const base = ['department', 'name', 'task_description', 'task_start_date'];
                                    if (taskType === 'Recurring') base.push('freq');
                                    return base.includes(f.name);
                                })
                            }}
                            onClose={() => { }}
                            onSuccess={async (submittedData) => {
                                if (taskType === 'One-Time') {
                                    const ts = Date.now();
                                    const timestamp = format(new Date(ts), 'MM/dd/yyyy HH:mm:ss');
                                    const plannedDate = submittedData.task_start_date
                                        ? format(new Date(submittedData.task_start_date), 'MM/dd/yyyy')
                                        : format(new Date(), 'MM/dd/yyyy');
                                    const data = {
                                        ...submittedData,
                                        task_id: `DEL-${ts}`,
                                        task_type: 'One-Time',
                                        task_start_date: plannedDate,
                                        planned1: plannedDate,
                                        status1: 'Pending',
                                        status2: 'Pending',
                                    };
                                    const newEntry: Entry = {
                                        id: `CHECKLIST_${ts}`,
                                        departmentId: 'check_list',
                                        timestamp,
                                        data
                                    };
                                    onAddEntry(newEntry);
                                    setActiveTab('step1');
                                    alert('✅ Task delegated successfully.');
                                    const values = [timestamp, ...fieldsOrder.map(key => data[key] || '')];
                                    try {
                                        const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl)}`;
                                        const response = await fetch(proxyUrl, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ sheetName: 'Check List', entryId: timestamp, values })
                                        });
                                        const resData = await response.json().catch(() => ({}));
                                        if (!response.ok || resData.result === 'error') throw new Error(resData.error || 'Failed to sync');
                                        if (!scriptUrl || scriptUrl.includes('AKfycbyQNcs5g-6p4dZ4qhdKL0GYkem_hudT7PUf0ZhSVmK1dZvHjw_fzurvGqWTztk6xNyBFQ')) alert('⚠️ Data synced to DEMO SHEET.');
                                    } catch (err: any) { alert(`❌ Sync Failed: ${err.message}`); }
                                    return;
                                }
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
                                    const data = { ...submittedData, task_id: `CHK-${ts}`, task_type: 'Recurring', task_start_date: plannedDate, planned1: plannedDate, status1: 'Pending', status2: 'Pending' };
                                    newEntries.push({ id: `CHECKLIST_${ts}`, departmentId: 'check_list', timestamp, data });
                                    rows.push([timestamp, ...fieldsOrder.map(key => data[key] || '')]);
                                });
                                newEntries.forEach(onAddEntry);
                                setActiveTab('step1');
                                alert(`✅ Created ${rows.length} recurring task instance${rows.length === 1 ? '' : 's'} for the next 12 months (${freq}).`);
                                try {
                                    const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl)}`;
                                    const response = await fetch(proxyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetName: 'Check List', batchValues: rows }) });
                                    const resData = await response.json().catch(() => ({}));
                                    if (!response.ok || resData.result === 'error') throw new Error(resData.error || 'Failed to sync');
                                    if (!scriptUrl || scriptUrl.includes('AKfycbyQNcs5g-6p4dZ4qhdKL0GYkem_hudT7PUf0ZhSVmK1dZvHjw_fzurvGqWTztk6xNyBFQ')) alert('⚠️ Data synced to DEMO SHEET.');
                                } catch (err: any) { alert(`❌ Sync Failed: ${err.message}`); }
                            }}
                        />
                        </div>
                    </div>
                </div>
            ) : (
                /* ── TABLE SECTION ── */
                <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>

                    {/* Toolbar */}
                    <div style={{
                        background:'#fff',
                        borderRadius:'16px',
                        border:'1px solid #e2e8f0',
                        padding:'16px 24px',
                        display:'flex',alignItems:'center',justifyContent:'space-between',gap:'20px',
                        boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
                        flexWrap:'wrap'
                    }}>
                        {/* Search */}
                        <div style={{position:'relative',flex:'1',maxWidth:'400px'}}>
                            <Search style={{width:'16px',height:'16px',color:'#94a3b8',position:'absolute',left:'14px',top:'50%',transform:'translateY(-50%)'}} />
                            <input
                                type="text"
                                placeholder="Search task ID, name, description..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{
                                    width:'100%',padding:'10px 16px 10px 40px',
                                    border:'1px solid #e2e8f0',
                                    borderRadius:'8px',fontSize:'13px',
                                    outline:'none',background:'#f8fafc',
                                    color:'#0f172a',
                                    transition:'all 0.2s',
                                    boxSizing:'border-box'
                                }}
                                onFocus={e => { e.target.style.borderColor='#059669'; e.target.style.background='#fff'; }}
                                onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.background='#f8fafc'; }}
                            />
                        </div>

                        {/* Department filter pills */}
                        <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                            <span style={{fontSize:'11px',fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',marginRight:'4px'}}>Department:</span>
                            {(['All', ...DEPARTMENT_OPTIONS]).map(dept => (
                                <button
                                    key={dept}
                                    onClick={() => setDepartmentFilter(dept)}
                                    style={{
                                        padding:'6px 14px',
                                        borderRadius:'99px',
                                        border:'1px solid',
                                        borderColor: departmentFilter === dept ? '#059669' : '#e2e8f0',
                                        background: departmentFilter === dept ? '#ecfdf5' : '#fff',
                                        color: departmentFilter === dept ? '#065f46' : '#64748b',
                                        fontSize:'11px',fontWeight:600,
                                        cursor:'pointer',
                                        transition:'all 0.15s ease',
                                    }}
                                >
                                    {dept}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table card */}
                    <div style={{
                        background:'#fff',
                        borderRadius:'16px',
                        border:'1px solid #e2e8f0',
                        boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
                        overflow:'hidden'
                    }}>
                        <div className="premium-table-wrap" style={{borderRadius:0,boxShadow:'none'}}>
                        <div className="premium-table-scroll">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th className="col-sticky-left" style={{minWidth:'90px'}}>Task ID</th>
                                        <th>Type</th>
                                        <th>Department</th>
                                        <th>Name</th>
                                        <th>Task Description</th>
                                        <th>Freq</th>
                                        {activeTab === 'history' ? (
                                            <>
                                                <th>Planned1</th>
                                                <th>Actual1</th>
                                                <th>Delay1</th>
                                                <th>Status1</th>
                                                <th>Planned2</th>
                                                <th>Actual2</th>
                                                <th>Delay2</th>
                                                <th>Status2</th>
                                            </>
                                        ) : activeTab === 'step1' ? (
                                            <>
                                                <th>Planned1</th>
                                                <th>Status1</th>
                                            </>
                                        ) : (
                                            <>
                                                <th>Delay1</th>
                                                <th>Planned2</th>
                                                <th>Status2</th>
                                            </>
                                        )}
                                        {activeTab !== 'history' && (
                                            <th className="col-sticky-right text-right">Action</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleEntries.length === 0 ? (
                                        <tr className="tbl-empty">
                                            <td colSpan={6 + (activeTab === 'history' ? 8 : activeTab === 'step1' ? 3 : 4)}>
                                                <div className="flex flex-col items-center gap-3">
                                                    <AlertCircle className="w-10 h-10" style={{color:'oklch(0.78 0.05 145)'}} />
                                                    <p>No entries found for this stage.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        visibleEntries.map((entry) => (
                                            <tr key={entry.id}>
                                                <td className="col-sticky-left font-bold" style={{fontSize:'12px', color:'oklch(0.25 0.04 145)'}}>{getData(entry, 'task_id')}</td>
                                                <td>{typeBadge(getData(entry, 'task_type'))}</td>
                                                <td style={{fontSize:'12px', color:'oklch(0.35 0.04 240)'}}>{getData(entry, 'department')}</td>
                                                <td style={{fontSize:'12px', fontWeight:600, color:'oklch(0.30 0.05 145)'}}>{getData(entry, 'name')}</td>
                                                <td style={{fontSize:'11px', color:'oklch(0.45 0.03 240)', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{getData(entry, 'task_description')}</td>
                                                <td style={{fontSize:'11px', color:'oklch(0.50 0.03 240)'}}>{getData(entry, 'freq')}</td>
                                                {activeTab === 'history' ? (
                                                    <>
                                                        <td style={{fontSize:'10px', fontWeight:700, color:'oklch(0.44 0.14 145)'}}>{getData(entry, 'planned1')}</td>
                                                        <td style={{fontSize:'10px', color:'oklch(0.45 0.03 240)'}}>{getData(entry, 'actual1')}</td>
                                                        <td style={{fontSize:'10px', color:'oklch(0.45 0.03 240)'}}>{getData(entry, 'delay1')}</td>
                                                        <td>{statusBadge(getData(entry, 'status1'))}</td>
                                                        <td style={{fontSize:'10px', fontWeight:700, color:'oklch(0.44 0.14 145)'}}>{getData(entry, 'planned2')}</td>
                                                        <td style={{fontSize:'10px', color:'oklch(0.45 0.03 240)'}}>{getData(entry, 'actual2')}</td>
                                                        <td style={{fontSize:'10px', color:'oklch(0.45 0.03 240)'}}>{getData(entry, 'delay2')}</td>
                                                        <td>{statusBadge(getData(entry, 'status2'))}</td>
                                                    </>
                                                ) : activeTab === 'step1' ? (
                                                    <>
                                                        <td>
                                                            <span className="tbl-badge tbl-badge-blue">
                                                                {getData(entry, 'planned1')}
                                                            </span>
                                                        </td>
                                                        <td>{statusBadge(getData(entry, 'status1'))}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td style={{fontSize:'12px', color:'oklch(0.45 0.03 240)'}}>{getData(entry, 'delay1') || '—'}</td>
                                                        <td>
                                                            <span className="tbl-badge tbl-badge-green">
                                                                {getData(entry, 'planned2')}
                                                            </span>
                                                        </td>
                                                        <td>{statusBadge(getData(entry, 'status2'))}</td>
                                                    </>
                                                )}
                                                {activeTab !== 'history' && (
                                                    <td className="col-sticky-right text-right">
                                                        <button
                                                            onClick={() => { setSelectedEntry(entry); setIsActionModalOpen(true); }}
                                                            className="tbl-action-btn"
                                                        >
                                                            <ListChecks className="w-3.5 h-3.5" />
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
                </div>
            )}
        </div>
        {isActionModalOpen && renderActionModal()}
    </div>
);
}

