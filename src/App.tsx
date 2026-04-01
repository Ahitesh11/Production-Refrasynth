import React, { useState, useEffect, useMemo } from 'react';
import Dashboard from './components/Dashboard';
import DepartmentView from './components/DepartmentView';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import RMWorkflowView from './components/RMWorkflowView';
import ProductionStopWorkflowView from './components/ProductionStopWorkflowView';
import InventoryView from './components/InventoryView';
import { DEPARTMENTS, DepartmentId, Entry, User } from './types';
import { format } from 'date-fns';
import { AlertCircle, Database, X } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('erp_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeId, setActiveId] = useState<DepartmentId | 'dashboard'>('dashboard');
  const [entries, setEntries] = useState<Entry[]>(() => {
    const saved = localStorage.getItem('erp_entries');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [compositionData, setCompositionData] = useState<any[]>(() => {
    const saved = localStorage.getItem('erp_composition');
    return saved ? JSON.parse(saved) : [];
  });
  const [masterData, setMasterData] = useState<{ campaigns: string[], products: string[], materials: string[] }>({
    campaigns: [],
    products: [],
    materials: []
  });
  const [inventoryData, setInventoryData] = useState<any[]>(() => {
    const saved = localStorage.getItem('erp_inventory');
    return saved ? JSON.parse(saved) : [];
  });
  const [parameterRanges, setParameterRanges] = useState<Record<string, string>>({});
  const [scriptUrl, setScriptUrl] = useState(localStorage.getItem('erp_script_url') || '');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempUrl, setTempUrl] = useState(scriptUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('erp_sidebar_collapsed');
    return saved === 'true';
  });

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      localStorage.setItem('erp_sidebar_collapsed', String(!prev));
      return !prev;
    });
  };

  const testConnection = async () => {
    if (!tempUrl) {
      alert('Please enter a Script URL first.');
      return;
    }
    setIsTesting(true);
    try {
      const res = await fetch(`/api/proxy?action=getMaster&url=${encodeURIComponent(tempUrl)}`);
      const data = await res.json();
      if (res.ok && !data.error) {
        alert('✅ Connection Successful! Master data found.');
      } else {
        throw new Error(data.error || 'Invalid response from script');
      }
    } catch (err: any) {
      alert(`❌ Connection Failed: ${err.message}\n\nMake sure the script is deployed with "Who has access: Anyone".`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('erp_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('erp_user');
  };

  // Fetch Master data and Entries from Google Sheets via Proxy
  const fetchData = async (force = false) => {
    if (isLoading && !force) return;
    if (force) setIsRefreshing(true);
    else setIsLoading(true);
    
    console.log("[App] Fetching ERP data...");
    try {
      const urlParam = scriptUrl ? `&url=${encodeURIComponent(scriptUrl)}` : '';

      const [masterRes, entriesRes, rangesRes, compositionRes, inventoryRes] = await Promise.all([
        fetch(`/api/proxy?action=getMaster${urlParam}`).catch(e => ({ ok: false, error: e })),
        fetch(`/api/proxy?action=getAllEntries${urlParam}`).catch(e => ({ ok: false, error: e })),
        fetch(`/api/proxy?action=getParameterRanges${urlParam}`).catch(e => ({ ok: false, error: e })),
        fetch(`/api/proxy?action=getComposition${urlParam}`).catch(e => ({ ok: false, error: e })),
        fetch(`/api/proxy?action=getInventory${urlParam}`).catch(e => ({ ok: false, error: e }))
      ]);

      if ('ok' in masterRes && masterRes.ok) {
        const masterDataJson = await (masterRes as Response).json().catch(() => null);
        if (masterDataJson && !masterDataJson.error) {
          setMasterData(masterDataJson);
          setIsLive(true);
        } else {
          setIsLive(false);
        }
      }

      if ('ok' in entriesRes && entriesRes.ok) {
        const entriesData = await (entriesRes as Response).json().catch(() => []);
        if (Array.isArray(entriesData)) {
          const validEntries = entriesData.filter((e: any) => e.timestamp && String(e.timestamp).trim() !== '');
          const mappedEntries = validEntries.map((e: any) => ({
             ...e,
             departmentId: e.departmentId === 'why_production_stop' ? 'production_stop' : e.departmentId
          }));
          setEntries(mappedEntries);
          localStorage.setItem('erp_entries', JSON.stringify(mappedEntries));
        }
      }

      if ('ok' in rangesRes && rangesRes.ok) {
        const rangesData = await (rangesRes as Response).json().catch(() => ({}));
        setParameterRanges(rangesData);
      }

      if ('ok' in compositionRes && compositionRes.ok) {
        const compData = await (compositionRes as Response).json().catch(() => []);
        if (Array.isArray(compData)) {
          setCompositionData(compData);
          localStorage.setItem('erp_composition', JSON.stringify(compData));
        }
      }

      if ('ok' in inventoryRes && inventoryRes.ok) {
        const invData = await (inventoryRes as Response).json().catch(() => []);
        if (Array.isArray(invData)) {
          setInventoryData(invData);
          localStorage.setItem('erp_inventory', JSON.stringify(invData));
        }
      }
    } catch (err: any) {
      console.error('Data Fetch Failed:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('erp_entries', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 60000);
    return () => clearInterval(interval);
  }, [scriptUrl]);

  const handleUpdateUrl = (url: string) => {
    setScriptUrl(url);
    localStorage.setItem('erp_script_url', url);
    window.location.reload();
  };

  const activeDept = DEPARTMENTS.find(d => d.id === activeId);

  // Filter departments based on user permissions
  const allowedDepartments = DEPARTMENTS.filter(dept => {
    if (user?.type === 'Admin') return true;
    if (!user?.permissions) return false;

    // Normalize names for comparison (handle extra spaces)
    const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
    const deptName = normalize(dept.name);

    return Object.entries(user.permissions).some(([name, allowed]) =>
      allowed && normalize(name) === deptName
    );
  });

  // Inject master data into department fields
  const departmentsWithMaster = useMemo(() => {
    return allowedDepartments.map(dept => ({
      ...dept,
      fields: dept.fields.map(field => {
        if (field.name === 'campaign_no' || field.name === 'campaign') return { ...field, options: masterData.campaigns.length > 0 ? masterData.campaigns : field.options };
        if (field.name === 'product_name') return { ...field, options: masterData.products.length > 0 ? masterData.products : field.options };
        if (field.name === 'rm_name' || field.name.startsWith('mat') || field.name.startsWith('rm')) {
          return { ...field, options: masterData.materials.length > 0 ? masterData.materials : field.options };
        }
        return field;
      })
    }));
  }, [allowedDepartments, masterData]);

  const handleAddEntry = (entry: Entry) => {
    setEntries(prev => [entry, ...prev]);
  };

  const handleUpdateEntry = (updatedEntry: Entry) => {
    setEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (isLoading && entries.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 animate-bounce">
          <Database className="w-8 h-8 text-white" />
        </div>
        <p className="text-sm font-bold text-zinc-900 uppercase tracking-widest animate-pulse mb-8">Loading ERP Data...</p>

        {/* Show retry after 10 seconds */}
        <div className="animate-in fade-in duration-1000 delay-10000 fill-mode-forwards opacity-0">
          <button
            onClick={() => fetchData(true)}
            className="px-6 py-3 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-2xl hover:bg-zinc-800 transition-all shadow-lg"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans selection:bg-zinc-900 selection:text-white">
      <Sidebar
        activeId={activeId}
        onSelect={setActiveId}
        departments={departmentsWithMaster}
        user={user}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefresh={() => fetchData(true)}
        isRefreshing={isRefreshing}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      <main className={cn(
        "flex-1 overflow-y-auto relative transition-all duration-300",
        isCollapsed ? "lg:ml-20" : "lg:ml-0"
      )}>

        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-8 py-6 bg-zinc-900 text-white flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">System Config</p>
                  <h2 className="text-xl font-bold tracking-tight text-white">Settings</h2>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Google Apps Script URL</label>
                  <input
                    type="text"
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all outline-none text-xs font-mono"
                  />
                  <p className="text-[9px] text-zinc-400 italic mt-1 leading-relaxed">
                    Enter your deployed Web App URL from Google Apps Script.
                    Leave empty to use the system default.
                  </p>
                  <button
                    onClick={testConnection}
                    disabled={isTesting}
                    className="mt-2 text-[10px] font-bold text-zinc-900 underline underline-offset-4 hover:text-zinc-600 disabled:opacity-50"
                  >
                    {isTesting ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-100">
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-6 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleUpdateUrl(tempUrl);
                      setIsSettingsOpen(false);
                    }}
                    className="px-8 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                  >
                    Save & Reload
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="py-12 px-8">
          {activeId === 'dashboard' ? (
            <Dashboard
              entries={entries}
              compositionData={compositionData}
              onSelect={(dept) => setActiveId(dept.id)}
              masterData={masterData}
              parameterRanges={parameterRanges}
            />
          ) : activeDept && allowedDepartments.some(d => d.id === activeId) ? (
            activeId === 'rm' ? (
              <RMWorkflowView
                department={departmentsWithMaster.find(d => d.id === 'rm')!}
                entries={entries.filter(e => e.departmentId === 'rm')}
                onAddEntry={handleAddEntry}
                onUpdateEntry={handleUpdateEntry}
                scriptUrl={scriptUrl}
              />
            ) : activeId === 'production_stop' ? (
              <ProductionStopWorkflowView
                department={departmentsWithMaster.find(d => d.id === 'production_stop')!}
                entries={entries.filter(e => e.departmentId === 'production_stop')}
                onAddEntry={handleAddEntry}
                onUpdateEntry={handleUpdateEntry}
                scriptUrl={scriptUrl}
              />
            ) : activeId === 'inventory' ? (
              <InventoryView
                inventoryData={inventoryData}
                sb3GroundDepartment={departmentsWithMaster.find(d => d.id === 'sb3_ground')!}
                entries={entries.filter(e => e.departmentId === 'sb3_ground')}
                onSuccess={async (data) => {
                  const timestamp = new Date().toLocaleString();
                  const newEntry: Entry = {
                    id: `sb3_ground_${Date.now()}`,
                    departmentId: 'sb3_ground',
                    timestamp,
                    data
                  };

                  // Construct the values array for Google Sheets
                  const dept = departmentsWithMaster.find(d => d.id === 'sb3_ground')!;
                  const values = [
                    timestamp,
                    ...dept.fields
                      .filter(f => f.name !== 'entry_type' && !f.readonly)
                      .map(f => {
                        let val = data[f.label] || data[f.name] || '';
                        if (f.type === 'date' && val && !/^\d{2}\/\d{2}\/\d{4}/.test(String(val))) {
                          try {
                            val = format(new Date(String(val)), 'MM/dd/yyyy');
                          } catch (e) { }
                        }
                        return val;
                      })
                  ];

                  // POST to Google Sheets
                  try {
                    const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl)}`;
                    const response = await fetch(proxyUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                      body: JSON.stringify({
                        sheetName: 'SB3 Ground',
                        entryId: timestamp,
                        values: values
                      }),
                    });

                    const resData = await response.json().catch(() => ({}));
                    if (response.ok && resData.result === 'success') {
                      alert('✅ Data saved successfully to Google Sheets!');
                      handleAddEntry(newEntry);
                      fetchData(true); // Refresh inventory stats
                    } else {
                      throw new Error(resData.error || 'Failed to sync with Google Sheets');
                    }
                  } catch (error: any) {
                    console.error('Inventory live sync failed:', error);
                    alert(`❌ Sync Failed: ${error.message}\n\nData is saved locally but not in Google Sheets.`);
                    // Still add locally so user doesn't lose it, but they know it failed sync
                    handleAddEntry(newEntry);
                  }
                }}
              />
            ) : (
              <DepartmentView
                department={departmentsWithMaster.find(d => d.id === activeId)!}
                entries={entries.filter(e => e.departmentId === activeId)}
                onAddEntry={handleAddEntry}
                onUpdateEntry={handleUpdateEntry}
                userType={user.type}
                parameterRanges={parameterRanges}
                scriptUrl={scriptUrl}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-400">
              <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">You don't have permission to view this department.</p>
              <button
                onClick={() => setActiveId('dashboard')}
                className="mt-4 text-xs font-bold text-zinc-900 underline underline-offset-4"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
