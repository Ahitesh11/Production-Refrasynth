import React, { useState, useMemo } from 'react';
import { Department, Entry } from '../types';
import {
    Plus,
    Settings,
    Beaker,
    Activity,
    Clock,
    CheckCircle2,
    X,
    ClipboardList,
    FlaskConical,
    History,
    Search,
    AlertCircle,
    ArrowRight
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

export default function RMWorkflowView({ department, entries, onAddEntry, onUpdateEntry, scriptUrl }: Props) {
    const [activeTab, setActiveTab] = useState<'form' | 'step1' | 'step2' | 'history'>('form');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const sortedEntries = useMemo(() => {
        const entriesCopy = [...entries];
        return entriesCopy.sort((a, b) => {
            const valA = a.data['Date Of Testing'] || a.data['date_of_testing'] || a.data['Planned'] || a.data['planned'] || a.data['Planned1'] || a.data['planned1'] || a.timestamp || '';
            const valB = b.data['Date Of Testing'] || b.data['date_of_testing'] || b.data['Planned'] || b.data['planned'] || b.data['Planned1'] || b.data['planned1'] || b.timestamp || '';

            if (!valA && !valB) return 0;
            if (!valA) return 1;
            if (!valB) return -1;

            const parseDate = (d: any) => {
                if (!d) return 0;
                const s = String(d).trim();
                const parsed = new Date(s).getTime();
                return isNaN(parsed) ? 0 : parsed;
            };

            return parseDate(valB) - parseDate(valA);
        });
    }, [entries]);

    const headerMapping: Record<string, string> = {
        unique_no: 'Unique No.',
        party_name: 'Party Name',
        truck_no: 'Truck No.',
        invoice_no: 'Invoice No.',
        rm_name: 'Raw Material Name',
        truck_qty: 'Truck Qty',
        chemist_name: 'Name of Chemist',
        date_of_testing: 'Date Of Testing',
        planned: 'Planned',
        actual: 'Actual',
        delay: 'Delay',
        ad: 'AD',
        bd: 'BD',
        fineness: 'Fineness',
        loi: 'Loi',
        moisture: 'Moisture',
        remarks_physical: 'Remarks',
        planned1: 'Planned1',
        actual1: 'Actual1',
        delay1: 'Delay1',
        al2o3: 'Al2O3',
        fe2o3: 'Fe2O3',
        sio2: 'SiO2',
        mgo: 'MgO',
        tio2: 'TiO2',
        cao: 'CaO',
        remarks_chemical: 'Remarks_1'
    };

    const getData = (entry: Entry, name: string) => {
        const label = headerMapping[name] || name;
        const val1 = entry.data[name];
        const val2 = entry.data[label];
        if (val1 !== undefined && val1 !== null && val1 !== '') return val1;
        if (val2 !== undefined && val2 !== null && val2 !== '') return val2;
        return '';
    };

    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr) return '—';
        try {
            if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) return dateStr;
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return format(date, 'MMM dd, yyyy HH:mm');
            }
            return dateStr;
        } catch (e) {
            return dateStr;
        }
    };

    const visibleEntries = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return sortedEntries.filter(e => {
            const matchesSearch = !term ||
                String(getData(e, 'unique_no')).toLowerCase().includes(term) ||
                String(getData(e, 'rm_name')).toLowerCase().includes(term) ||
                String(getData(e, 'party_name')).toLowerCase().includes(term) ||
                String(getData(e, 'truck_no')).toLowerCase().includes(term);
            if (!matchesSearch) return false;

            if (activeTab === 'step1') return getData(e, 'planned') && !getData(e, 'actual');
            if (activeTab === 'step2') return getData(e, 'planned1') && !getData(e, 'actual1');
            if (activeTab === 'history') return getData(e, 'actual1') || getData(e, 'al2o3');
            return true;
        });
    }, [sortedEntries, searchTerm, activeTab]);

    const handleSync = async (entry: Entry, updatedData: Record<string, any>) => {
        setIsSyncing(true);
        const fullUpdatedData = { ...entry.data, ...updatedData };
        onUpdateEntry({ ...entry, data: fullUpdatedData });
        setIsActionModalOpen(false);
        setSelectedEntry(null);

        const fieldsOrder = [
            'unique_no', 'party_name', 'truck_no', 'invoice_no', 'rm_name',
            'truck_qty', 'chemist_name', 'date_of_testing',
            'planned', 'actual', 'delay', 'ad', 'bd', 'fineness', 'loi', 'moisture',
            'remarks_physical', 'planned1', 'actual1', 'delay1', 'al2o3', 'fe2o3',
            'sio2', 'mgo', 'tio2', 'cao', 'remarks_chemical'
        ];

        const values = [entry.timestamp, ...fieldsOrder.map(f => fullUpdatedData[f] || '')];

        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl)}`;
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sheetName: 'RM',
                    entryId: entry.timestamp,
                    values: values
                })
            });
            const resData = await response.json().catch(() => ({}));
            if (!response.ok || resData.result === 'error') {
                throw new Error(resData.error || 'Failed to sync with Google Sheets');
            }
            alert('✅ Data saved successfully to Google Sheets!');
        } catch (err: any) {
            console.error(`Background sync failed: ${err.message}`);
            alert(`❌ Sync Failed: ${err.message}\n\nData is saved locally but not in Google Sheets.`);
        } finally {
            setIsSyncing(false);
        }
    };

    const renderActionModal = () => {
        if (!selectedEntry) return null;
        const isPhysical = activeTab === 'step1';
        const fields = isPhysical
            ? [
                { name: 'ap', label: 'AP', type: 'number', placeholder: 'Enter AD value' },
                { name: 'bd', label: 'BD', type: 'number', placeholder: 'Enter BD value' },
                { name: 'fineness', label: 'Fineness', type: 'number', placeholder: 'Enter fineness %' },
                { name: 'loi', label: 'LOI', type: 'number', placeholder: 'Enter LOI value' },
                { name: 'moisture', label: 'Moisture', type: 'number', placeholder: 'Enter moisture %' },
                { name: 'remarks_physical', label: 'Remarks', type: 'text', placeholder: 'Add physical test remarks...' },
            ]
            : [
                { name: 'al2o3', label: 'Al₂O₃', type: 'number', placeholder: 'Enter Al₂O₃ value' },
                { name: 'fe2o3', label: 'Fe₂O₃', type: 'number', placeholder: 'Enter Fe₂O₃ value' },
                { name: 'sio2', label: 'SiO₂', type: 'number', placeholder: 'Enter SiO₂ value' },
                { name: 'mgo', label: 'MgO', type: 'number', placeholder: 'Enter MgO value' },
                { name: 'tio2', label: 'TiO₂', type: 'number', placeholder: 'Enter TiO₂ value' },
                { name: 'cao', label: 'CaO', type: 'number', placeholder: 'Enter CaO value' },
                { name: 'remarks_chemical', label: 'Remarks', type: 'text', placeholder: 'Add chemical test remarks...' },
            ];

        const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const data: Record<string, any> = {};
            fields.forEach(f => { data[f.name] = formData.get(f.name); });
            const now = format(new Date(), 'MM/dd/yyyy HH:mm:ss');
            if (isPhysical) data.actual = now;
            else data.actual1 = now;
            handleSync(selectedEntry, data);
        };

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                    <div className="px-8 py-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                                isPhysical ? "bg-emerald-500" : "bg-purple-500"
                            )}>
                                {isPhysical ? <Activity className="w-6 h-6 text-white" /> : <Beaker className="w-6 h-6 text-white" />}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold tracking-tight">
                                    {isPhysical ? 'Physical Test' : 'Chemical Test'}
                                </h3>
                                <p className="text-sm text-slate-300 font-medium">
                                    {getData(selectedEntry, 'unique_no') || 'Manual Entry'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsActionModalOpen(false)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            {fields.map(field => (
                                <div key={field.name} className={cn(
                                    "space-y-1.5",
                                    field.type === 'text' ? "col-span-2" : ""
                                )}>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">
                                        {field.label}
                                    </label>
                                    <input
                                        name={field.name}
                                        type={field.type}
                                        step="any"
                                        defaultValue={getData(selectedEntry, field.name) || ''}
                                        placeholder={field.placeholder}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400"
                                        required={!field.name.includes('remarks')}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setIsActionModalOpen(false)}
                                className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                                disabled={isSyncing}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSyncing}
                                className={cn(
                                    "px-8 py-2.5 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95",
                                    isPhysical
                                        ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                                        : "bg-purple-600 hover:bg-purple-700 shadow-purple-200",
                                    isSyncing && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {isSyncing ? (
                                    <Clock className="w-4 h-4 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4" />
                                )}
                                {isSyncing ? 'Syncing...' : 'Submit Results'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8 font-sans">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex items-center space-x-5">
                    <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center shadow-xl">
                        <Settings className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">RM Workflow</h1>
                        <p className="text-sm text-slate-500 font-medium mt-1">Multi-Step Material Control System</p>
                    </div>
                </div>

                <div className="relative flex items-center bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 shadow-inner">
                    {[
                        { id: 'form', label: 'Entry', icon: ClipboardList, activeColor: 'text-blue-600' },
                        { id: 'step1', label: 'Physical', icon: Activity, activeColor: 'text-emerald-600' },
                        { id: 'step2', label: 'Chemical', icon: FlaskConical, activeColor: 'text-purple-600' },
                        { id: 'history', label: 'History', icon: History, activeColor: 'text-slate-900' }
                    ].map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "relative flex flex-col sm:flex-row items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all duration-300 z-10",
                                isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                            )}
                        >
                            {isActive && (
                                <div className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/80 -z-10 animate-in zoom-in-95 duration-200" />
                            )}
                            <tab.icon className={cn("w-4 h-4 transition-colors", isActive ? tab.activeColor : "text-slate-400")} />
                            {tab.label}
                        </button>
                    )})}
                </div>
            </header>

            {/* Content */}
            {activeTab === 'form' ? (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-8 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="max-w-2xl mx-auto">
                        <div className="mb-6 flex items-center gap-3 text-slate-500">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Plus className="w-4 h-4 text-slate-600" />
                            </div>
                            <h3 className="text-sm font-semibold uppercase tracking-wider">New Material Intake</h3>
                        </div>
                        <DepartmentForm
                            department={{
                                ...department,
                                fields: department.fields.filter(f => ['party_name', 'truck_no', 'invoice_no', 'rm_name', 'truck_qty', 'chemist_name', 'date_of_testing'].includes(f.name))
                            }}
                            onClose={() => { }}
                            onSuccess={async (submittedData) => {
                                const timestamp = format(new Date(), 'MM/dd/yyyy HH:mm:ss');
                                const uniqueNo = `RM-${Date.now()}`;
                                const data = { ...submittedData, unique_no: uniqueNo };
                                const newEntry: Entry = {
                                    id: `RM_${Date.now()}`,
                                    departmentId: 'rm',
                                    timestamp,
                                    data: data
                                };

                                onAddEntry(newEntry);
                                setActiveTab('step1');

                                const fieldsOrder = [
                                    'unique_no', 'party_name', 'truck_no', 'invoice_no', 'rm_name',
                                    'truck_qty', 'chemist_name', 'date_of_testing',
                                    'planned', 'actual', 'delay', 'ad', 'bd', 'fineness', 'loi', 'moisture',
                                    'remarks_physical', 'planned1', 'actual1', 'delay1', 'al2o3', 'fe2o3',
                                    'sio2', 'mgo', 'tio2', 'cao', 'remarks_chemical'
                                ];
                                const values = [timestamp, ...fieldsOrder.map(key => data[key] || '')];

                                try {
                                    const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl)}`;
                                    const response = await fetch(proxyUrl, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ sheetName: 'RM', entryId: timestamp, values: values })
                                    });
                                    const resData = await response.json().catch(() => ({}));
                                    if (!response.ok || resData.result === 'error') {
                                        throw new Error(resData.error || 'Failed to sync with Google Sheets');
                                    }
                                    alert('✅ Data saved successfully to Google Sheets!');
                                } catch (err: any) {
                                    console.error('Background submission failed:', err);
                                    alert(`❌ Sync Failed: ${err.message}\n\nData is saved locally but not in Google Sheets.`);
                                }
                            }}
                        />
                    </div>
                </div>
            ) : (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                        {/* Table Header */}
                        <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="relative w-full sm:max-w-sm">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search by unique no or RM name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-300 transition-all placeholder:text-slate-400"
                                />
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                    {activeTab === 'step1' ? 'Pending Physical Tests' :
                                     activeTab === 'step2' ? 'Pending Chemical Tests' :
                                     'Completed Logs'}
                                </p>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                    {visibleEntries.length} result{visibleEntries.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="premium-table-wrap">
                        <div className="premium-table-scroll">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        {activeTab === 'history' ? (
                                            <>
                                                <th>Timestamp</th>
                                                <th className="col-sticky-left">Unique No.</th>
                                                <th>Party Name</th>
                                                <th>Truck No.</th>
                                                <th>Invoice No.</th>
                                                <th>RM Name</th>
                                                <th>Qty</th>
                                                <th>Chemist</th>
                                                <th>Testing Date</th>
                                                <th>Planned (Phy)</th>
                                                <th>Actual (Phy)</th>
                                                <th>AD</th>
                                                <th>BD</th>
                                                <th>Fineness</th>
                                                <th>LOI</th>
                                                <th>Moisture</th>
                                                <th>Planned (Chem)</th>
                                                <th>Actual (Chem)</th>
                                                <th>Al₂O₃</th>
                                                <th>Fe₂O₃</th>
                                                <th>SiO₂</th>
                                                <th>MgO</th>
                                                <th>TiO₂</th>
                                                <th>CaO</th>
                                                <th>Status</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="col-sticky-left">Unique No.</th>
                                                <th>Party Name</th>
                                                <th>Truck No.</th>
                                                <th>Invoice No.</th>
                                                <th>RM Name</th>
                                                <th>Testing Date</th>
                                                {activeTab === 'step1' ? (
                                                    <>
                                                        <th>Planned</th>
                                                        <th>Qty</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th>AD</th>
                                                        <th>BD</th>
                                                        <th>Fineness</th>
                                                        <th>LOI</th>
                                                        <th>Moisture</th>
                                                        <th>Planned (Chem)</th>
                                                    </>
                                                )}
                                                <th className="col-sticky-right text-right">Action</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleEntries
                                        .map((entry) => (
                                            <tr key={entry.id}>
                                                {activeTab === 'history' ? (
                                                    <>
                                                        <td className="tbl-ts">{entry.timestamp}</td>
                                                        <td className="col-sticky-left font-bold" style={{fontSize:'13px', color:'oklch(0.25 0.04 145)'}}>{getData(entry, 'unique_no')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.35 0.04 240)'}}>{getData(entry, 'party_name')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'truck_no')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'invoice_no')}</td>
                                                        <td style={{fontSize:'13px', fontWeight:600, color:'oklch(0.30 0.05 145)'}}>{getData(entry, 'rm_name')}</td>
                                                        <td className="tbl-num">{getData(entry, 'truck_qty')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'chemist_name')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{formatDisplayDate(getData(entry, 'date_of_testing'))}</td>
                                                        <td><span className="tbl-badge tbl-badge-green">{formatDisplayDate(getData(entry, 'planned'))}</span></td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{formatDisplayDate(getData(entry, 'actual'))}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'ad')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'bd')}</td>
                                                        <td>
                                                          <span className={cn('tbl-pill', Number(getData(entry, 'fineness')) > 95 ? 'tbl-pill-bad' : 'tbl-pill-ok')}>
                                                            {getData(entry, 'fineness')}
                                                          </span>
                                                        </td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'loi')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'moisture')}</td>
                                                        <td><span className="tbl-badge tbl-badge-purple">{formatDisplayDate(getData(entry, 'planned1'))}</span></td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{formatDisplayDate(getData(entry, 'actual1'))}</td>
                                                        <td style={{fontSize:'14px', fontWeight:900, color:'oklch(0.44 0.14 145)'}}>{getData(entry, 'al2o3')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'fe2o3')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'sio2')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'mgo')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'tio2')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'cao')}</td>
                                                        <td>
                                                            <span className="tbl-badge tbl-badge-green">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                COMPLETED
                                                            </span>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="col-sticky-left font-bold" style={{fontSize:'13px', color:'oklch(0.25 0.04 145)'}}>{getData(entry, 'unique_no')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.35 0.04 240)'}}>{getData(entry, 'party_name')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'truck_no')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'invoice_no')}</td>
                                                        <td style={{fontSize:'13px', fontWeight:600, color:'oklch(0.30 0.05 145)'}}>{getData(entry, 'rm_name')}</td>
                                                        <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{formatDisplayDate(getData(entry, 'date_of_testing'))}</td>
                                                        {activeTab === 'step1' ? (
                                                            <>
                                                                <td>
                                                                    <span className="tbl-badge tbl-badge-green">
                                                                        {formatDisplayDate(getData(entry, 'planned'))}
                                                                    </span>
                                                                </td>
                                                                <td className="tbl-num">{getData(entry, 'truck_qty')}</td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'ad') || '—'}</td>
                                                                <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'bd') || '—'}</td>
                                                                <td>
                                                                  <span className={cn('tbl-pill', getData(entry, 'fineness') ? (Number(getData(entry, 'fineness')) > 95 ? 'tbl-pill-bad' : 'tbl-pill-ok') : 'tbl-pill-warn')}>
                                                                    {getData(entry, 'fineness') || '—'}
                                                                  </span>
                                                                </td>
                                                                <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'loi') || '—'}</td>
                                                                <td style={{fontSize:'13px', color:'oklch(0.40 0.03 240)'}}>{getData(entry, 'moisture') || '—'}</td>
                                                                <td>
                                                                    <span className="tbl-badge tbl-badge-purple">
                                                                        {formatDisplayDate(getData(entry, 'planned1'))}
                                                                    </span>
                                                                </td>
                                                            </>
                                                        )}
                                                        <td className="col-sticky-right text-right">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedEntry(entry);
                                                                    setIsActionModalOpen(true);
                                                                }}
                                                                className="tbl-action-btn"
                                                                style={{
                                                                    background: activeTab === 'step1' ? 'oklch(0.44 0.14 145)' : 'oklch(0.40 0.13 290)',
                                                                    boxShadow: activeTab === 'step1' ? '0 2px 8px oklch(0.52 0.155 145 / 0.35)' : '0 2px 8px oklch(0.50 0.14 290 / 0.35)'
                                                                }}
                                                            >
                                                                {activeTab === 'step1' ? (
                                                                    <Activity className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <FlaskConical className="w-3.5 h-3.5" />
                                                                )}
                                                                {activeTab === 'step1' ? 'Physical' : 'Chemical'}
                                                                <ArrowRight className="w-3 h-3" />
                                                            </button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                            {visibleEntries.length === 0 && (
                                <div className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <AlertCircle className="w-10 h-10" style={{color:'oklch(0.78 0.05 145)'}} />
                                        <p style={{fontSize:'13px', fontWeight:500, color:'oklch(0.55 0.03 240)'}}>No entries found for this stage</p>
                                    </div>
                                </div>
                            )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {isActionModalOpen && renderActionModal()}
        </div>
    );
}