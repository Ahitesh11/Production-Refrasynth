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

            return parseDate(valA) - parseDate(valB);
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
        remarks_chemical: 'Remarks'
    };

    const getData = (entry: Entry, name: string) => {
        const label = headerMapping[name] || name;
        const val1 = entry.data[name];
        const val2 = entry.data[label];
        if (val1 !== undefined && val1 !== null && val1 !== '') return val1;
        if (val2 !== undefined && val2 !== null && val2 !== '') return val2;
        return '';
    };

    const handleSync = async (entry: Entry, updatedData: Record<string, any>) => {
        setIsSyncing(true);
        // Optimistic UI Update: Update local state immediately
        const fullUpdatedData = { ...entry.data, ...updatedData };
        onUpdateEntry({ ...entry, data: fullUpdatedData });
        setIsActionModalOpen(false);
        setSelectedEntry(null);

        // Fields in exact order for the sheet (excluding Timestamp)
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
        const isPhysical = activeTab === 'step1';
        const fields = isPhysical
            ? [
                { name: 'ad', label: 'AD', type: 'number' },
                { name: 'bd', label: 'BD', type: 'number' },
                { name: 'fineness', label: 'Fineness', type: 'number' },
                { name: 'loi', label: 'Loi', type: 'number' },
                { name: 'moisture', label: 'Moisture', type: 'number' },
                { name: 'remarks_physical', label: 'Remarks', type: 'text' },
            ]
            : [
                { name: 'al2o3', label: 'Al2O3', type: 'number' },
                { name: 'fe2o3', label: 'Fe2O3', type: 'number' },
                { name: 'sio2', label: 'SiO2', type: 'number' },
                { name: 'mgo', label: 'MgO', type: 'number' },
                { name: 'tio2', label: 'TiO2', type: 'number' },
                { name: 'cao', label: 'CaO', type: 'number' },
                { name: 'remarks_chemical', label: 'Remarks', type: 'text' },
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md text-zinc-900">
                <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-zinc-100">
                    <div className="px-8 py-6 bg-zinc-900 text-white flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-lg", isPhysical ? "bg-emerald-500" : "bg-purple-500")}>
                                {isPhysical ? <Activity className="w-5 h-5 text-white" /> : <Beaker className="w-5 h-5 text-white" />}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold tracking-tight">{isPhysical ? 'Physical Test' : 'Chemical Test'}</h3>
                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{getData(selectedEntry, 'unique_no') || 'Manual Entry'}</p>
                            </div>
                        </div>
                        <button onClick={() => setIsActionModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                        <div className="grid grid-cols-2 gap-4">
                            {fields.map(field => (
                                <div key={field.name} className={cn("space-y-1.5 text-left", field.type === 'text' || field.type === 'date' ? "col-span-2" : "")}>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">{field.label}</label>
                                    <input
                                        name={field.name}
                                        type={field.type}
                                        step="any"
                                        defaultValue={getData(selectedEntry, field.name) || ''}
                                        className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all outline-none text-sm font-medium"
                                        required={!field.name.includes('remarks')}
                                    />
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
                                    isPhysical ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" : "bg-purple-600 hover:bg-purple-700 shadow-purple-100",
                                    isSyncing && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {isSyncing ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                {isSyncing ? 'Syncing...' : 'Update Step Data'}
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
                        <Settings className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">RM Workflow</h1>
                        <p className="text-zinc-500 text-xs font-medium mt-1 uppercase tracking-widest">Multi-Step Material Control</p>
                    </div>
                </div>

                <div className="flex items-center space-x-2 bg-zinc-100 p-1 rounded-2xl border border-zinc-200 shadow-sm">
                    {[
                        { id: 'form', label: '1st Form', icon: ClipboardList },
                        { id: 'step1', label: '2 Physical Test', icon: Activity },
                        { id: 'step2', label: '3 Chemical Test', icon: FlaskConical },
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
                            <h3 className="text-xs font-bold uppercase tracking-widest">Initial Material Intake</h3>
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

                                // Optimistic update
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
                                    await fetch(proxyUrl, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ sheetName: 'RM', entryId: timestamp, values: values })
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
                                    placeholder="Search by unique no or RM name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                                />
                            </div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                {activeTab === 'step1' ? 'Pending Physical' : activeTab === 'step2' ? 'Pending Chemical' : 'Completed Logs'}
                            </p>
                        </div>
                        <div className="overflow-x-auto max-h-[600px] custom-scrollbar relative">
                            <table className="w-full text-left border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-zinc-50">
                                        {activeTab === 'history' ? (
                                            <>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Timestamp</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 left-0 bg-zinc-50 z-30 border-b border-zinc-200">Unique No.</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Party Name</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Truck No.</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Invoice No.</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">RM Name</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Truck Qty</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Chemist</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Testing Date</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Planned (Phy)</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Actual (Phy)</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Delay (Phy)</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">AD</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">BD</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Fineness</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Loi</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Moisture</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Phy Remarks</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Planned (Chem)</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Actual (Chem)</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Delay (Chem)</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Al2O3</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Fe2O3</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">SiO2</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">MgO</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">TiO2</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">CaO</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Chem Remarks</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Status</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 left-0 bg-zinc-50 z-30 border-b border-zinc-200">Unique No.</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Party Name</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Truck No.</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Invoice No.</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">RM Name</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Testing Date</th>
                                                {activeTab === 'step1' ? (
                                                    <>
                                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Planned</th>
                                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Qty</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">AD</th>
                                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">BD</th>
                                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Fineness</th>
                                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Loi</th>
                                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Moisture</th>
                                                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 bg-zinc-50 z-20 border-b border-zinc-200">Planned1</th>
                                                    </>
                                                )}
                                                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest sticky top-0 right-0 bg-zinc-50 z-30 border-b border-zinc-200 text-right">Action</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {sortedEntries
                                        .filter(e => {
                                            const matchesSearch = getData(e, 'unique_no').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                                                getData(e, 'rm_name').toLowerCase().includes(searchTerm.toLowerCase());
                                            if (!matchesSearch) return false;

                                            if (activeTab === 'step1') return getData(e, 'planned') && !getData(e, 'actual');
                                            if (activeTab === 'step2') return getData(e, 'planned1') && !getData(e, 'actual1');
                                            if (activeTab === 'history') return getData(e, 'actual1') || getData(e, 'al2o3') || getData(e, 'remarks_chemical');
                                            return true;
                                        })
                                        .length === 0 ? (
                                        <tr><td colSpan={12} className="px-6 py-12 text-center text-zinc-400 italic">No entries found.</td></tr>
                                    ) : (
                                        sortedEntries
                                            .filter(e => {
                                                const matchesSearch = getData(e, 'unique_no').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                                                    getData(e, 'rm_name').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                                    getData(e, 'party_name').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                                    getData(e, 'truck_no').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                                    getData(e, 'invoice_no').toLowerCase().includes(searchTerm.toLowerCase());
                                                if (!matchesSearch) return false;

                                                if (activeTab === 'step1') return getData(e, 'planned') && !getData(e, 'actual');
                                                if (activeTab === 'step2') return getData(e, 'planned1') && !getData(e, 'actual1');
                                                if (activeTab === 'history') return getData(e, 'actual1') || getData(e, 'al2o3') || getData(e, 'remarks_chemical');
                                                return true;
                                            })
                                            .map((entry) => (
                                                <tr key={entry.id} className="group hover:bg-zinc-50/50 transition-colors">
                                                    {activeTab === 'history' ? (
                                                        <>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{entry.timestamp}</td>
                                                            <td className="px-6 py-4 text-xs font-bold text-zinc-900 sticky left-0 bg-white group-hover:bg-zinc-50 transition-colors z-10">{getData(entry, 'unique_no')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-600">{getData(entry, 'party_name')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-600">{getData(entry, 'truck_no')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-600">{getData(entry, 'invoice_no')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-600 font-medium">{getData(entry, 'rm_name')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'truck_qty')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'chemist_name')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'date_of_testing')}</td>
                                                            <td className="px-6 py-4 text-[10px] text-blue-600 font-bold">{getData(entry, 'planned')}</td>
                                                            <td className="px-6 py-4 text-[10px] text-zinc-500">{getData(entry, 'actual')}</td>
                                                            <td className="px-6 py-4 text-[10px] text-zinc-500">{getData(entry, 'delay')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'ad')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'bd')}</td>
                                                            <td className={cn(
                                                                "px-6 py-4 text-xs font-bold",
                                                                Number(getData(entry, 'fineness')) > 95 ? "text-red-500" : "text-emerald-500"
                                                            )}>{getData(entry, 'fineness')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'loi')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'moisture')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-400 italic max-w-[150px] truncate">{getData(entry, 'remarks_physical')}</td>
                                                            <td className="px-6 py-4 text-[10px] text-purple-600 font-bold">{getData(entry, 'planned1')}</td>
                                                            <td className="px-6 py-4 text-[10px] text-zinc-500">{getData(entry, 'actual1')}</td>
                                                            <td className="px-6 py-4 text-[10px] text-zinc-500">{getData(entry, 'delay1')}</td>
                                                            <td className="px-6 py-4 text-xs font-bold text-zinc-900">{getData(entry, 'al2o3')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'fe2o3')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'sio2')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'mgo')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'tio2')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'cao')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-400 italic max-w-[150px] truncate">{getData(entry, 'remarks_chemical')}</td>
                                                            <td className="px-6 py-4">
                                                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold border border-emerald-100 inline-flex items-center">
                                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                    DONE
                                                                </span>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="px-6 py-4 text-xs font-bold text-zinc-900 sticky left-0 bg-white group-hover:bg-zinc-50 transition-colors z-10">{getData(entry, 'unique_no')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-600">{getData(entry, 'party_name')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-600 font-medium">{getData(entry, 'truck_no')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-600 font-medium">{getData(entry, 'invoice_no')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-600 font-medium">{getData(entry, 'rm_name')}</td>
                                                            <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'date_of_testing')}</td>
                                                            {activeTab === 'step1' ? (
                                                                <>
                                                                    <td className="px-6 py-4">
                                                                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold border border-blue-100 italic">
                                                                            {getData(entry, 'planned')}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-xs text-zinc-600 font-medium">{getData(entry, 'truck_qty')}</td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'ad') || '-'}</td>
                                                                    <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'bd') || '-'}</td>
                                                                    <td className={cn(
                                                                        "px-6 py-4 text-xs font-bold",
                                                                        getData(entry, 'fineness') ? (Number(getData(entry, 'fineness')) > 95 ? "text-red-500" : "text-emerald-500") : "text-zinc-500"
                                                                    )}>{getData(entry, 'fineness') || '-'}</td>
                                                                    <td className="px-6 py-4 text-xs text-zinc-600">{getData(entry, 'loi') || '-'}</td>
                                                                    <td className="px-6 py-4 text-xs text-zinc-500">{getData(entry, 'moisture') || '-'}</td>
                                                                    <td className="px-6 py-4">
                                                                        <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-bold border border-purple-100 italic">
                                                                            {getData(entry, 'planned1')}
                                                                        </span>
                                                                    </td>
                                                                </>
                                                            )}
                                                            <td className="px-6 py-4 text-right sticky right-0 bg-white group-hover:bg-zinc-50 transition-colors border-l border-zinc-100">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedEntry(entry);
                                                                        setIsActionModalOpen(true);
                                                                    }}
                                                                    className="bg-zinc-900 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-zinc-800 transition-all shadow-md active:scale-95 flex items-center ml-auto"
                                                                >
                                                                    {activeTab === 'step1' ? <Activity className="w-3.5 h-3.5 mr-2" /> : <FlaskConical className="w-3.5 h-3.5 mr-2" />}
                                                                    {activeTab === 'step1' ? 'Physical' : 'Chemical'}
                                                                </button>
                                                            </td>
                                                        </>
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
