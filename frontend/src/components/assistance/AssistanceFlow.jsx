import { useState, useEffect, Fragment } from 'react';
import { 
  Search, Loader2, UserSquare2, ScanLine, 
  HeartHandshake, Plus, ShieldAlert, 
  ChevronDown, X, Filter, FileText, CheckCircle2, 
  ChevronUp, Edit, Trash2, ChevronLeft, ChevronRight, Settings2, CheckCircle
} from 'lucide-react';
import api from '../../api/api';
import toast, { Toaster } from 'react-hot-toast';
import { createPortal } from "react-dom";

export default function AssistanceFlow({ userRole }) {
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); 
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Role Definition
  const isSuperAdmin = (userRole || "").toLowerCase() === "super_admin";
  
  // Expanded Row State
  const [expandedRow, setExpandedRow] = useState(null);
  const [expandedData, setExpandedData] = useState(null);
  const [rowLoading, setRowLoading] = useState(false);

  // Modals & Mode States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScanningMode, setIsScanningMode] = useState(false); 
  const [selectedResident, setSelectedResident] = useState(null); 
  
  const [editModal, setEditModal] = useState({ isOpen: false, resident: null, assistance: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, assistance: null, resident: null });
  const [deletePresetModalOpen, setDeletePresetModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form States - Global Template
  const [payoutTemplate, setPayoutTemplate] = useState({
    type_of_assistance: 'Medical Assistance',
    status: 'Claimed', 
    date_processed: new Date().toISOString().split('T')[0],
    date_claimed: new Date().toISOString().split('T')[0],
    amount: '',
    implementing_office: ''
  });
  
  // Stores fetched presets for the dropdown
  const [savedTemplatesList, setSavedTemplatesList] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");

  const [editFormData, setEditFormData] = useState({
    type_of_assistance: '', status: 'Claimed', date_processed: '', date_claimed: '', amount: '', implementing_office: ''
  });

  // Scanner State
  const [scanCode, setScanCode] = useState("");
  const [scanError, setScanError] = useState("");

  // Table & Filters State
  const [trackingList, setTrackingList] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    program_type: 'All Programs', 
    status: 'all', 
    sector: '',
    barangay: ''
  });

  // --- HELPERS ---
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const wasUpdated = (r) => {
    const created = r?.created_at ? new Date(r.created_at) : null;
    const updated = r?.updated_at ? new Date(r.updated_at) : null;
    return created && updated && Math.abs(updated.getTime() - created.getTime()) > 1000;
  };

  const formatSectors = (summary, details) => {
    if (!summary) return "None";
    let text = summary;
    if (summary.toUpperCase().includes("OTHERS") && details) text = summary.replace(/Others/i, details);
    
    if (!isSuperAdmin) {
      const restricted = ["HC", "C", "M"];
      let parts = text.split(",").map(s => s.trim());
      parts = parts.filter(p => !restricted.includes(p.toUpperCase()));
      text = parts.length > 0 ? parts.join(", ") : "None";
    }
    return text;
  };

  // --- FETCHING DATA ---
  useEffect(() => {
    const fetchRefs = async () => {
      try {
        const [secRes, brgyRes] = await Promise.all([api.get('/sectors/'), api.get('/barangays/')]);
        setSectors(secRes.data);
        setBarangays(brgyRes.data);
      } catch (err) {}
    };
    fetchRefs();
  }, []);

  useEffect(() => {
    const fetchTrackingList = async () => {
      setTableLoading(true);
      try {
        const res = await api.get(`/assistance-tracking/list`, {
          params: { sector: filters.sector || "", type_of_assistance: filters.program_type, status: filters.status }
        });
        
        let data = res.data || [];
        
        // HIDE "NO RECORD" IF A SPECIFIC PROGRAM IS SELECTED 
        if (filters.program_type !== 'All Programs' && filters.status !== 'all' && filters.status !== 'unclaimed') {
            data = data.filter(item => item.status !== "No Record");
        }

        if (filters.search) {
          const l = filters.search.toLowerCase();
          data = data.filter(r => r.full_name.toLowerCase().includes(l) || r.resident_code.toLowerCase().includes(l));
        }
        if (filters.barangay) {
          data = data.filter(r => r.barangay?.toUpperCase() === filters.barangay.toUpperCase());
        }

        // DEDUPLICATE RESIDENTS
        const uniqueMap = new Map();
        data.forEach(item => {
          if (filters.program_type !== 'All Programs' && filters.status !== 'all' && filters.status !== 'unclaimed' && item.status === "No Record") {
              return; 
          }
          const existing = uniqueMap.get(item.resident_code);
          if (!existing || (item.status !== "No Record" && existing.status === "No Record")) {
              uniqueMap.set(item.resident_code, item);
          }
        });
        
        setTrackingList(Array.from(uniqueMap.values()));
        setCurrentPage(1);
      } catch (err) {
        setTrackingList([]);
      } finally {
        setTableLoading(false);
      }
    };
    const debounce = setTimeout(fetchTrackingList, 300);
    return () => clearTimeout(debounce);
  }, [filters, refreshTrigger]);

  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });
  const handleTemplateInputChange = (e) => setPayoutTemplate({ ...payoutTemplate, [e.target.name]: e.target.value });
  const handleEditInputChange = (e) => setEditFormData({ ...editFormData, [e.target.name]: e.target.value });

  const toggleRow = async (rowKey, resident_code) => {
    if (expandedRow === rowKey) {
      setExpandedRow(null);
      setExpandedData(null);
      return;
    }
    setExpandedRow(rowKey);
    setExpandedData(null);
    setRowLoading(true);
    try {
      const res = await api.get(`/residents/code/${resident_code}`);
      setExpandedData(res.data);
    } catch (err) {
      toast.error("Failed to load details.");
      setExpandedRow(null);
    } finally {
      setRowLoading(false);
    }
  };

  // ==========================================
  // PAYOUT LOGIC
  // ==========================================

  const handleStartPayoutMode = async () => {
    setLoading(true);
    try {
        const res = await api.get('/payout-events/active');
        if (res.data) {
            setPayoutTemplate(res.data);
            setIsScanningMode(true);
            setIsAddModalOpen(true);
        }
    } catch (err) {
        if (err.response?.status === 404) {
            toast.error("No active template found. Please configure one first.");
            handleConfigureAssistance(); 
        } else {
            toast.error("Failed to connect to database.");
        }
    } finally {
        setLoading(false);
    }
  };

  const handleConfigureAssistance = async () => {
      try {
          const resActive = await api.get('/payout-events/active');
          if (resActive.data) setPayoutTemplate(resActive.data);
      } catch (err) {}
      
      try {
          const resAll = await api.get('/payout-events/all');
          setSavedTemplatesList(resAll.data || []);
      } catch (err) {}
      
      setIsScanningMode(false);
      setIsAddModalOpen(true);
  };

  const handleLoadPreset = (e) => {
    const selectedId = e.target.value;
    setSelectedPresetId(selectedId); // <-- Track the selected ID
    
    if (!selectedId) return;
    
    const selectedTemplate = savedTemplatesList.find(t => t.id.toString() === selectedId);
    if (selectedTemplate) {
      setPayoutTemplate({
        type_of_assistance: selectedTemplate.type_of_assistance,
        status: selectedTemplate.status,
        date_processed: selectedTemplate.date_processed ? selectedTemplate.date_processed.split('T')[0] : '',
        date_claimed: selectedTemplate.date_claimed ? selectedTemplate.date_claimed.split('T')[0] : '',
        amount: selectedTemplate.amount || '',
        implementing_office: selectedTemplate.implementing_office || ''
      });
      toast.success("Preset loaded!");
    }
  };

  const handleDeletePreset = async () => {
    if (!selectedPresetId) return;
    
    setLoading(true);
    try {
      await api.delete(`/payout-events/${selectedPresetId}`);
      toast.success("Preset deleted successfully.");
      
      // Remove it from the dropdown list immediately
      setSavedTemplatesList(prev => prev.filter(t => t.id.toString() !== selectedPresetId));
      
      // Clear the current selection and reset the form
      setSelectedPresetId("");
      setPayoutTemplate({
        type_of_assistance: 'Medical Assistance',
        status: 'Claimed', 
        date_processed: new Date().toISOString().split('T')[0],
        date_claimed: new Date().toISOString().split('T')[0],
        amount: '',
        implementing_office: ''
      });
      
      // Close the new modal
      setDeletePresetModalOpen(false);
      
    } catch (err) {
      toast.error("Failed to delete preset.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGlobalTemplate = async () => {
      setLoading(true);
      try {
          const payload = {
              type_of_assistance: payoutTemplate.type_of_assistance,
              status: payoutTemplate.status,
              date_processed: payoutTemplate.date_processed || null,
              date_claimed: payoutTemplate.status === 'Claimed' ? (payoutTemplate.date_claimed || null) : null,
              amount: payoutTemplate.amount ? parseFloat(payoutTemplate.amount) : null,
              implementing_office: payoutTemplate.implementing_office || null
          };

          const res = await api.post('/payout-events/', payload);
          setPayoutTemplate(res.data); 
          toast.success("Global Template saved successfully.");
          setIsScanningMode(true); 
      } catch (err) {
          toast.error("Failed to save global template.");
      } finally {
          setLoading(false);
      }
  };

  // --- AUTOMATED SCANNER & RECORDING LOGIC ---
  const handleScanSubmit = async (e) => {
    e.preventDefault();
    if (!scanCode.trim()) return;
    
    setLoading(true);
    setScanError("");
    
    try {
      const res = await api.get(`/residents/code/${scanCode}`);
      const resident = res.data;

      const targetType = payoutTemplate.type_of_assistance;
      const targetProcessed = payoutTemplate.date_processed; // YYYY-MM-DD
      const targetClaimed = payoutTemplate.status === 'Claimed' ? payoutTemplate.date_claimed : null;

      const isDuplicate = resident.assistances?.some(record => {
          const recordProcessed = record.date_processed ? record.date_processed.split('T')[0] : null;
          const recordClaimed = record.date_claimed ? record.date_claimed.split('T')[0] : null;

          return (
              record.type_of_assistance === targetType &&
              recordProcessed === targetProcessed &&
              recordClaimed === targetClaimed
          );
      });

      if (isDuplicate) {
          setScanError(`ALREADY CLAIMED: ${resident.last_name} already received this today.`);
          setSelectedResident(resident);
          setScanCode(""); 
          setLoading(false);
          return;
      }

      const payload = {
        type_of_assistance: payoutTemplate.type_of_assistance,
        date_processed: payoutTemplate.date_processed || null,
        date_claimed: payoutTemplate.status === 'Claimed' ? (payoutTemplate.date_claimed || null) : null,
        amount: payoutTemplate.amount ? parseFloat(payoutTemplate.amount) : null,
        implementing_office: payoutTemplate.implementing_office || null
      };
      
      await api.post(`/residents/${resident.id}/assistance`, payload);
      
      toast.success(`Success! Claimed by ${resident.first_name}.`);
      setSelectedResident(resident);
      setScanCode("");
      setRefreshTrigger(prev => prev + 1); 
      
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Error saving record.";
      setScanError(errorMsg);
      setSelectedResident(null);
    } finally {
      setLoading(false);
    }
  };

  // --- EDIT & DELETE ASSISTANCE ---
  useEffect(() => {
    if (editModal.isOpen && editModal.assistance) {
      setEditFormData({
        type_of_assistance: editModal.assistance.type_of_assistance || 'Medical Assistance',
        status: editModal.assistance.date_claimed ? 'Claimed' : 'Unclaimed',
        date_processed: editModal.assistance.date_processed ? new Date(editModal.assistance.date_processed).toISOString().split('T')[0] : '',
        date_claimed: editModal.assistance.date_claimed ? new Date(editModal.assistance.date_claimed).toISOString().split('T')[0] : '',
        amount: editModal.assistance.amount || '',
        implementing_office: editModal.assistance.implementing_office || ''
      });
    }
  }, [editModal.isOpen, editModal.assistance]);

  const handleEditSave = async () => {
    setLoading(true);
    try {
      const payload = {
        type_of_assistance: editFormData.type_of_assistance,
        date_processed: editFormData.date_processed || null,
        date_claimed: editFormData.status === 'Claimed' ? (editFormData.date_claimed || null) : null,
        amount: editFormData.amount ? parseFloat(editFormData.amount) : null,
        implementing_office: editFormData.implementing_office || null
      };
      await api.put(`/assistances/${editModal.assistance.id}`, payload);
      toast.success("Assistance updated successfully.");
      if (expandedData && expandedData.id === editModal.resident.id) {
        try {
          const res = await api.get(`/residents/code/${editModal.resident.resident_code}`);
          setExpandedData(res.data);
        } catch (e) {}
      }
      setEditModal({ isOpen: false, resident: null, assistance: null });
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update assistance.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssistance = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/assistances/${deleteModal.assistance.id}`);
      toast.success("Assistance record deleted.");
      if (expandedData && expandedData.id === deleteModal.resident.id) {
        try {
          const res = await api.get(`/residents/code/${deleteModal.resident.resident_code}`);
          setExpandedData(res.data);
        } catch (e) {}
      }
      setDeleteModal({ isOpen: false, assistance: null, resident: null });
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete assistance.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setIsScanningMode(false); 
    setSelectedResident(null);
    setScanCode("");
    setScanError("");
  };

  // --- EXPANDED DETAILS UI ---
  const renderResidentDetails = (r) => {
    if (!r) return null;
    return (
      <div className="bg-stone-100 p-4 md:p-8 shadow-inner rounded-b-xl border-t-2 border-stone-200 cursor-default" onClick={e => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-3 mb-6 border-b border-stone-300 pb-4">
          <div className="p-2 bg-rose-700 text-white rounded-lg shadow-sm"><FileText size={18} /></div>
          <h3 className="text-lg font-medium text-stone-900 tracking-tight">Information Background</h3>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white border border-stone-300 rounded-xl p-4 md:p-5 shadow-sm">
              <h4 className="text-xs font-medium text-stone-700 uppercase tracking-wider mb-5 flex justify-between items-center border-b border-stone-100 pb-3">
                Personal Information
                {r.photo_url && (
                  <img src={r.photo_url} alt="Resident" className="w-12 h-12 md:w-14 md:h-14 object-cover rounded-full border-2 border-stone-200 shadow-sm" />
                )}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                <div><p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Civil Status</p><p className="text-sm font-normal text-stone-800">{r.civil_status || '-'}</p></div>
                <div><p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Religion</p><p className="text-sm font-normal text-stone-800">{r.religion || '-'}</p></div>
                <div><p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Contact</p><p className="text-sm font-normal text-stone-800 break-words">{r.contact_no || '-'}</p></div>
                <div><p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Precinct ID</p><p className="text-sm font-mono font-normal text-stone-800 bg-stone-100 px-2 py-1 rounded border border-stone-200 inline-block break-all">{r.precinct_no || '-'}</p></div>
              </div>
            </div>
          
            {r.assistances?.length > 0 && (
              <div className="bg-white border border-stone-300 rounded-xl p-4 md:p-5 shadow-sm">
                <h4 className="text-xs font-medium text-stone-700 uppercase tracking-wider mb-4 border-b border-stone-100 pb-3">Assistance Records</h4>
                <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="bg-stone-50 text-stone-600 text-left text-[11px] uppercase tracking-wider border-y border-stone-200">
                        <th className="py-3 px-2 font-medium">Type</th>
                        <th className="py-3 px-2 font-medium">Processed</th>
                        <th className="py-3 px-2 font-medium">Claimed</th>
                        <th className="py-3 px-2 font-medium">Amount</th>
                        <th className="py-3 px-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {r.assistances.map((a) => (
                        <tr key={a.id} className="hover:bg-stone-50 transition-colors">
                          <td className="py-3 px-2 font-medium text-stone-800">{a.type_of_assistance}</td>
                          <td className="py-3 px-2 font-normal text-stone-600">{formatDate(a.date_processed)}</td>
                          <td className="py-3 px-2 font-normal text-stone-600">
                            {a.date_claimed ? formatDate(a.date_claimed) : <span className="text-amber-600 font-medium">Unclaimed</span>}
                          </td>
                          <td className="py-3 px-2 font-medium text-rose-700">{a.amount ? `₱${a.amount.toLocaleString()}` : "-"}</td>
                          <td className="py-3 px-2 text-right">
                             <div className="flex justify-end gap-2">
                               <button onClick={() => setEditModal({ isOpen: true, resident: r, assistance: a })} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-md transition-colors border border-rose-100">
                                 <Edit size={14} />
                               </button>
                               <button onClick={() => setDeleteModal({ isOpen: true, resident: r, assistance: a })} className="p-1.5 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-md transition-colors border border-red-100">
                                 <Trash2 size={14} />
                               </button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-stone-300 rounded-xl p-4 md:p-5 shadow-sm">
              <h4 className="text-xs font-medium text-stone-700 uppercase tracking-wider mb-3 border-b border-stone-100 pb-3">Registered Sector</h4>
              <div className="inline-flex items-center px-4 py-2 bg-stone-100 rounded-lg border border-stone-300 shadow-sm">
                <span className="text-sm font-normal text-stone-800 tracking-tight uppercase">{formatSectors(r.sector_summary, r.other_sector_details)}</span>
              </div>
            </div>

            <div className="bg-white border border-stone-300 rounded-xl p-4 md:p-5 shadow-sm">
              <h4 className="text-xs font-medium text-stone-700 uppercase tracking-wider mb-4 border-b border-stone-100 pb-3">Household Composition</h4>
              {r.family_members?.length > 0 ? (
                <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                  <table className="w-full text-sm min-w-[350px]">
                    <thead>
                      <tr className="bg-stone-50 text-stone-600 text-left text-[11px] uppercase tracking-wider border-y border-stone-200">
                        <th className="py-3 px-3 font-medium">Name</th>
                        <th className="py-3 px-3 font-medium">Relation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {r.family_members.filter(fm => fm.first_name).map((fm, i) => (
                        <tr key={i} className="hover:bg-stone-50 transition-colors">
                          <td className="py-3 px-3 font-medium text-stone-800 uppercase">{fm.last_name}, {fm.first_name} {fm.middle_name || ""}</td>
                          <td className="py-3 px-3 font-normal text-stone-600 italic">{fm.relationship}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-6 text-center border-2 border-dashed border-stone-200 rounded-xl bg-stone-50">
                  <p className="text-sm font-normal text-stone-500">Single Occupant / No listed members.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- PAGINATION ---
  const totalItems = trackingList.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = trackingList.slice(startIndex, endIndex);

  return (
    <div className="font-sans text-stone-900 animate-in fade-in duration-300 px-2 sm:px-4 md:px-0 pb-12 pt-2">

      {createPortal(
      <Toaster
        position="top-right"
        containerStyle={{
          zIndex: 999999,
          filter: 'none',
          isolation: 'isolate',
        }}
        toastOptions={{
          style: {
            background: '#1c1917',
            color: '#fff',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            filter: 'none',
          },
        }}
      />,
      document.body
    )}

      {/* --- HEADER --- */}
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-5">
        <div>
           <div className="flex items-center gap-2 text-rose-700 mb-2">
              <div className="p-1.5 md:p-2 bg-rose-100 rounded-lg border border-rose-200 shadow-sm"><HeartHandshake size={16} strokeWidth={2} /></div>
              <span className="text-[10px] md:text-xs font-medium tracking-widest uppercase">Municipality of San Felipe</span>
           </div>
           <h1 className="text-2xl md:text-3xl font-medium text-stone-900 tracking-tight">Assistance Distribution</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
           <button onClick={handleConfigureAssistance} className="flex-1 md:flex-none justify-center px-4 py-2.5 bg-stone-100 border border-stone-300 hover:bg-stone-200 text-stone-700 font-medium rounded-xl transition-all flex items-center gap-2 text-sm">
             <Settings2 size={16} />
             Configure Assistance
           </button>
           <button onClick={handleStartPayoutMode} disabled={loading} className="flex-1 md:flex-none justify-center px-6 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-medium rounded-xl shadow-md transition-all flex items-center gap-2">
             {loading ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} />}
             Start Scanning
           </button>
        </div>
      </div>

      {/* --- TOOLBAR --- */}
      <div className="bg-stone-50 border border-stone-200 rounded-t-2xl p-4 md:p-5 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between shadow-sm">
         
         <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto flex-wrap flex-1">
            <div className="relative w-full sm:w-72 shrink-0 group">
               <div className="absolute left-3 md:left-4 top-3.5 text-stone-400 group-focus-within:text-rose-600 transition-colors">
                  <Search size={18} strokeWidth={2} />
               </div>
               <input 
                  type="text" 
                  placeholder="SEARCH NAME OR ID..." 
                  value={filters.search} onChange={handleFilterChange} name="search"
                  className="w-full pl-10 md:pl-11 pr-10 py-2.5 bg-white border border-stone-300 rounded-xl text-sm font-normal text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all shadow-sm uppercase"
               />
               {filters.search && (
                 <button onClick={() => setFilters({ ...filters, search: '' })} className="absolute right-3 top-3 text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg p-1 transition-colors">
                   <X size={16} strokeWidth={2} />
                 </button>
               )}
            </div>

            <div className="relative w-full sm:w-auto sm:flex-1 max-w-[200px]">
              <select name="program_type" value={filters.program_type} onChange={handleFilterChange} className="w-full appearance-none pl-3 md:pl-4 pr-9 py-2.5 bg-white border border-stone-300 rounded-xl text-[11px] md:text-sm font-medium text-stone-700 hover:border-stone-400 focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all cursor-pointer shadow-sm uppercase truncate">
                  <option value="All Programs">ALL PROGRAMS</option>
                  <option value="Medical Assistance">MEDICAL ASSISTANCE</option>
                  <option value="Burial Assistance">BURIAL ASSISTANCE</option>
                  <option value="Educational Assistance">EDUCATIONAL ASSISTANCE</option>
                  <option value="Financial Assistance">FINANCIAL ASSISTANCE</option>
                  <option value="Gas Subsidy">GAS SUBSIDY</option>
                  <option value="Food Assistance">FOOD ASSISTANCE</option>
              </select>
              <ChevronDown className="absolute right-3 top-3 text-stone-400 pointer-events-none" size={18} strokeWidth={2} />
            </div>

            <div className="relative w-full sm:w-auto sm:flex-1 max-w-[160px]">
              <select name="status" value={filters.status} onChange={handleFilterChange} className="w-full appearance-none pl-3 md:pl-4 pr-9 py-2.5 bg-white border border-stone-300 rounded-xl text-[11px] md:text-sm font-medium text-stone-700 hover:border-stone-400 focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all cursor-pointer shadow-sm uppercase truncate">
                  <option value="all">ALL STATUS</option>
                  <option value="unclaimed">UNCLAIMED / NO RECORD</option>
                  <option value="claimed">CLAIMED</option>
              </select>
              <ChevronDown className="absolute right-3 top-3 text-stone-400 pointer-events-none" size={18} strokeWidth={2} />
            </div>

            <div className="relative w-full sm:w-auto sm:flex-1 max-w-[160px]">
              <select name="sector" value={filters.sector} onChange={handleFilterChange} className="w-full appearance-none pl-3 md:pl-4 pr-9 py-2.5 bg-white border border-stone-300 rounded-xl text-[11px] md:text-sm font-medium text-stone-700 hover:border-stone-400 focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all cursor-pointer shadow-sm uppercase truncate">
                  <option value="">ALL SECTORS</option>
                  <option value="PWD">PWD</option>
                  <option value="SOLO PARENT">SOLO PARENT</option>
                  {sectors.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-3 text-stone-400 pointer-events-none" size={18} strokeWidth={2} />
            </div>

            <div className="relative w-full sm:w-auto sm:flex-1 max-w-[180px]">
              <select name="barangay" value={filters.barangay} onChange={handleFilterChange} className="w-full appearance-none pl-3 md:pl-4 pr-9 py-2.5 bg-white border border-stone-300 rounded-xl text-[11px] md:text-sm font-medium text-stone-700 hover:border-stone-400 focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all cursor-pointer shadow-sm uppercase truncate">
                  <option value="">ALL BARANGAYS</option>
                  {barangays.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
              <Filter className="absolute right-3 top-3 text-stone-400 pointer-events-none" size={16} strokeWidth={2} />
            </div>
         </div>

         <div className="w-full xl:w-auto flex justify-end shrink-0">
           <div className="flex items-center gap-2 text-[11px] md:text-sm font-normal text-stone-600 bg-white px-3 md:px-4 py-2 rounded-xl border border-stone-300 shadow-sm">
               <span className="uppercase tracking-widest text-[10px]">Show:</span>
               <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-transparent font-medium text-stone-800 outline-none cursor-pointer hover:text-rose-700 transition-colors">
                 <option value={10}>10</option>
                 <option value={20}>20</option>
                 <option value={50}>50</option>
               </select>
           </div>
         </div>
      </div>

      {/* --- TABLE --- */}
      <div className="bg-white border-x border-b border-stone-200 shadow-sm min-h-[400px] md:min-h-[500px] rounded-b-2xl overflow-hidden relative">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-rose-50 text-stone-700 text-[10px] md:text-[11px] uppercase font-bold tracking-widest border-b-2 border-rose-100">
                <th className="py-3 md:py-4 px-3 md:px-5 w-10 md:w-12 text-center">#</th>
                <th className="py-3 md:py-4 px-3 md:px-5">BENEFICIARY IDENTITY</th>
                <th className="py-3 md:py-4 px-3 md:px-5">LOCATION</th>
                <th className="py-3 md:py-4 px-3 md:px-5">CLASS/SECTOR</th>
                <th className="py-3 md:py-4 px-3 md:px-5">STATUS</th>
              </tr>
            </thead>
            <tbody className="text-[13px] md:text-sm">
              {tableLoading ? (
                 <tr>
                   <td colSpan="5" className="py-24 md:py-32 text-center">
                      <div className="flex flex-col items-center gap-3">
                         <Loader2 className="animate-spin text-rose-700" size={32} strokeWidth={2}/>
                         <span className="text-[10px] md:text-xs font-normal text-stone-400 uppercase tracking-widest">Accessing Database...</span>
                      </div>
                   </td>
                 </tr>
              ) : trackingList.length === 0 ? (
                 <tr>
                   <td colSpan="5" className="py-16 md:py-24 text-center">
                     <div className="inline-flex flex-col items-center justify-center text-stone-400">
                       <Search size={32} strokeWidth={1.5} className="mb-3 opacity-30" />
                       <span className="font-medium text-stone-500 text-base md:text-lg">No records found.</span>
                     </div>
                   </td>
                 </tr>
              ) : (
                currentData.map((res, index) => {
                  const rowKey = `${res.resident_code}-${index}`;

                  return (
                    <Fragment key={rowKey}>
                      <tr onClick={() => toggleRow(rowKey, res.resident_code)} className={`border-b border-stone-100 cursor-pointer transition-colors group ${expandedRow === rowKey ? 'bg-rose-50/50' : 'hover:bg-stone-50'}`}>
                        <td className="py-3 md:py-4 px-3 md:px-5 text-center align-middle text-xs text-stone-400 font-medium">
                          <div className={`mx-auto flex items-center justify-center w-6 h-6 rounded-lg transition-all ${expandedRow === rowKey ? 'bg-rose-700 text-white shadow-sm' : 'bg-stone-100 text-stone-400 group-hover:bg-stone-200 group-hover:text-stone-700'}`}>
                             {expandedRow === rowKey ? <ChevronUp size={14} strokeWidth={2}/> : <ChevronDown size={14} strokeWidth={2}/>}
                          </div>
                        </td>
                        <td className="py-3 md:py-4 px-3 md:px-5 align-middle">
                          <div className="flex items-center gap-3 md:gap-4">
                             {res.photo_url ? (
                               <img src={res.photo_url} alt="Profile" className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-stone-200 shadow-sm shrink-0" />
                             ) : (
                               <div className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 border border-stone-200 shadow-sm">
                                  <UserSquare2 size={20} />
                               </div>
                             )}
                             <div className="flex flex-col min-w-0">
                                <span className="font-medium text-stone-800 text-[13px] md:text-[15px] tracking-tight uppercase truncate">
                                   {res.full_name}
                                </span>
                                <div className="flex items-center gap-1.5 md:gap-2 mt-1">
                                   {res.sex && <span className="px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded text-[9px] md:text-[10px] font-medium uppercase tracking-wider border border-stone-200">{res.sex}</span>}
                                   <span className="text-[10px] md:text-[11px] font-mono font-medium text-rose-700 tracking-wide uppercase ml-1">ID: {res.resident_code}</span>
                                </div>
                             </div>
                          </div>
                        </td>
                        <td className="py-3 md:py-4 px-3 md:px-5 align-middle">
                          <span className="block font-medium text-stone-700 uppercase tracking-wide truncate max-w-[150px] md:max-w-[200px]">{res.barangay}</span>
                        </td>
                        <td className="py-3 md:py-4 px-3 md:px-5 align-middle">
                          <span className="inline-flex items-center bg-stone-100 border border-stone-200 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[9px] md:text-[11px] font-normal text-stone-600 tracking-tight uppercase shadow-sm whitespace-normal break-words max-w-[120px] md:max-w-[200px] leading-tight">
                            {formatSectors(res.sector_summary, res.other_sector_details)}
                          </span>
                        </td>
                        <td className="py-3 md:py-4 px-3 md:px-5 align-middle">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold border tracking-wider uppercase ${
                              res.status === 'Claimed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : res.status === 'Unclaimed' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-stone-100 text-stone-500 border-stone-300' 
                            }`}>
                              {res.status}
                            </span>
                            {filters.program_type === 'All Programs' && res.type_of_assistance !== 'None' && (
                              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest truncate max-w-[150px]">{res.type_of_assistance}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* EXPANDED ROW DETAILS */}
                      {expandedRow === rowKey && (
                        <tr>
                          <td colSpan="5" className="p-0">
                            {rowLoading ? <div className="py-12 flex justify-center bg-stone-50 border-t border-stone-200 shadow-inner"><Loader2 className="animate-spin text-rose-700" size={24} /></div> : renderResidentDetails(expandedData)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* --- PAGINATION CONTROLS --- */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-t border-stone-200 sm:px-6">
            <div className="flex justify-between flex-1 sm:hidden">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 disabled:opacity-50">Previous</button>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="relative inline-flex items-center px-4 py-2 ml-3 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 disabled:opacity-50">Next</button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div><p className="text-sm text-stone-500 font-medium">Showing <span className="font-bold text-stone-800">{totalItems === 0 ? 0 : startIndex + 1}</span> to <span className="font-bold text-stone-800">{Math.min(endIndex, totalItems)}</span> of <span className="font-bold text-stone-800">{totalItems}</span> results</p></div>
              <div>
                <nav className="inline-flex -space-x-px rounded-lg shadow-sm isolate" aria-label="Pagination">
                  <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 text-stone-400 bg-white border border-stone-300 rounded-l-lg hover:bg-stone-50 focus:z-20 disabled:opacity-50 transition-colors">
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  </button>
                  
                  {[...Array(totalPages)].map((_, i) => {
                    const page = i + 1;
                    if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                      return (
                        <button key={page} onClick={() => setCurrentPage(page)} className={`relative inline-flex items-center px-4 py-2 text-sm font-bold border focus:z-20 transition-colors ${currentPage === page ? 'z-10 bg-rose-600 border-rose-600 text-white' : 'bg-white border-stone-300 text-stone-600 hover:bg-stone-50'}`}>
                          {page}
                        </button>
                      );
                    }
                    if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300">...</span>;
                    return null;
                  })}

                  <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="relative inline-flex items-center px-2 py-2 text-stone-400 bg-white border border-stone-300 rounded-r-lg hover:bg-stone-50 focus:z-20 disabled:opacity-50 transition-colors">
                    <span className="sr-only">Next</span>
                    <ChevronRight className="w-5 h-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================
          MODAL: TWO-STEP DISTRIBUTION FLOW
          ========================================= */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={handleCloseModal} />
          
          <div className="relative bg-white w-full max-w-[500px] rounded-2xl border border-stone-200 shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            
            <div className="mb-6 flex justify-between items-start border-b border-stone-100 pb-4">
              <div>
                <h2 className="text-[20px] font-medium text-stone-900 leading-tight tracking-tight">
                   {isScanningMode ? "Scanning Mode" : "Payout Configuration"}
                </h2>
                <p className="text-[11px] font-normal text-stone-500 tracking-wide mt-1">
                   {isScanningMode ? "Scan beneficiaries to distribute the saved assistance." : "Step 1: Set the Global Template for all devices."}
                </p>
              </div>
              <button onClick={handleCloseModal} className="text-stone-400 hover:text-stone-600 p-1 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* PHASE 1: SETTING THE PAYOUT DETAILS */}
            {!isScanningMode && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* LOAD PRESET DROPDOWN */}
                <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200 mb-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Load Saved Preset</label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <select value={selectedPresetId} onChange={handleLoadPreset} className="w-full appearance-none pl-3 pr-10 py-2 bg-white border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:border-stone-400 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-50 transition-all cursor-pointer shadow-sm">
                          <option value="">-- Select a Previous Configuration --</option>
                          {savedTemplatesList.map(template => (
                            <option key={template.id} value={template.id}>
                              {template.type_of_assistance} {template.amount ? `(₱${template.amount})` : ''} - {template.implementing_office || 'No Office'}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-2.5 text-stone-400 pointer-events-none" size={16} />
                      </div>
                      
                      {selectedPresetId && (
                        <button 
                          onClick={() => setDeletePresetModalOpen(true)} 
                          disabled={loading}
                          className="p-2 text-rose-500 bg-white hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors border border-stone-300 hover:border-rose-200 shadow-sm"
                          title="Delete this preset"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] md:text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 md:mb-2">Assistance Type</label>
                    <div className="relative">
                      <select name="type_of_assistance" value={payoutTemplate.type_of_assistance} onChange={handleTemplateInputChange} className="w-full appearance-none pl-3 md:pl-4 pr-10 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-normal text-stone-800 hover:border-stone-300 focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all cursor-pointer shadow-sm">
                        <option value="Medical Assistance">Medical Assistance</option>
                        <option value="Burial Assistance">Burial Assistance</option>
                        <option value="Educational Assistance">Educational Assistance</option>
                        <option value="Financial Assistance">Financial Assistance</option>
                        <option value="Gas Subsidy">Gas Subsidy</option>
                        <option value="Food Assistance">Food Assistance</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-3.5 text-stone-400 pointer-events-none" size={16} strokeWidth={2} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] md:text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 md:mb-2">Payout Status</label>
                    <div className="relative">
                      <select name="status" value={payoutTemplate.status} onChange={handleTemplateInputChange} className="w-full appearance-none pl-3 md:pl-4 pr-10 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-800 hover:border-stone-300 focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all cursor-pointer shadow-sm uppercase">
                        <option value="Claimed">Claimed</option>
                        <option value="Unclaimed">Unclaimed</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-3.5 text-stone-400 pointer-events-none" size={16} strokeWidth={2} />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] md:text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 md:mb-2">Date Processed</label>
                    <input type="date" name="date_processed" value={payoutTemplate.date_processed} onChange={handleTemplateInputChange} className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-rose-50 focus:border-rose-400 outline-none transition-all text-sm text-stone-800 uppercase" />
                  </div>
                  <div>
                    <label className={`block text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 md:mb-2 transition-colors ${payoutTemplate.status === 'Unclaimed' ? 'text-stone-300' : 'text-stone-500'}`}>Date Claimed</label>
                    <input 
                      type="date" 
                      name="date_claimed" 
                      value={payoutTemplate.status === 'Unclaimed' ? '' : payoutTemplate.date_claimed} 
                      onChange={handleTemplateInputChange} 
                      disabled={payoutTemplate.status === 'Unclaimed'}
                      className={`w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl outline-none transition-all text-sm text-stone-800 uppercase ${payoutTemplate.status === 'Unclaimed' ? 'opacity-50 cursor-not-allowed bg-stone-50' : 'focus:border-rose-400 focus:ring-4 focus:ring-rose-50'}`} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] md:text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 md:mb-2">Amount (Optional)</label>
                    <input type="number" name="amount" placeholder="0.00" value={payoutTemplate.amount} onChange={handleTemplateInputChange} className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-rose-50 focus:border-rose-400 outline-none transition-all text-sm placeholder:text-stone-400 text-stone-800" />
                  </div>

                  <div>
                    <label className="block text-[10px] md:text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 md:mb-2">Implementing Office</label>
                    <input type="text" name="implementing_office" placeholder="E.G. MSWDO" value={payoutTemplate.implementing_office} onChange={handleTemplateInputChange} className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-rose-50 focus:border-rose-400 outline-none transition-all text-sm placeholder:text-stone-400 text-stone-800 uppercase" />
                  </div>
                </div>

                <hr className="border-stone-100 my-6" />
                
                <div className="flex justify-end">
                   <button onClick={handleSaveGlobalTemplate} disabled={loading} className="w-full px-8 py-3 bg-[#ce5a6b] text-white text-sm font-medium rounded-xl hover:bg-rose-700 transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
                     {loading ? <Loader2 size={16} className="animate-spin" /> : "Save Global Template & Scan"} <ChevronRight size={18}/>
                   </button>
                </div>
              </div>
            )}

            {/* PHASE 2: CONTINUOUS SCANNING MODE */}
            {isScanningMode && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* SAVED TEMPLATE BANNER */}
                  <div className="mb-6 p-4 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
                     <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-0.5">Payout Template</p>
                        <p className="text-sm font-medium text-stone-800 uppercase">
                           {payoutTemplate.type_of_assistance} {payoutTemplate.amount ? `(₱${payoutTemplate.amount})` : ''}
                        </p>
                        <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded text-[9px] font-bold border uppercase tracking-wider ${
                           payoutTemplate.status === 'Claimed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                           Auto-Record as {payoutTemplate.status}
                        </span>
                     </div>
                     <button onClick={handleConfigureAssistance} className="text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg uppercase tracking-wider border border-rose-200 transition-colors flex items-center gap-1">
                        <Settings2 size={14} /> Edit
                     </button>
                  </div>

                  {/* SCANNER INPUT (AUTO-SAVES) */}
                  <div className="mb-6">
                    <form onSubmit={handleScanSubmit} className="flex gap-2">
                      <div className="relative flex-1 group">
                        <div className="absolute left-4 top-3.5 text-stone-400 group-focus-within:text-rose-500 transition-colors">
                          <Search size={18} strokeWidth={2} />
                        </div>
                        <input
                          type="text"
                          value={scanCode}
                          onChange={(e) => setScanCode(e.target.value)}
                          placeholder="AWAITING QR SCAN..."
                          className="w-full pl-11 pr-4 py-3 bg-white border border-rose-400 rounded-xl text-sm font-medium text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100 transition-all uppercase tracking-wide shadow-sm"
                          autoFocus
                        />
                      </div>
                      <button type="submit" disabled={loading || !scanCode} className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[130px]">
                        {loading ? <Loader2 size={18} className="animate-spin" /> : "Scan & Save"}
                      </button>
                    </form>

                    {scanError && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 shadow-sm">
                        <ShieldAlert size={18} />
                        <p className="text-sm font-normal">{scanError}</p>
                      </div>
                    )}
                  </div>

                  {/* PREVIEW LAST SCANNED RESIDENT */}
                  {selectedResident && (
                    <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200 mb-6 shadow-sm animate-in fade-in duration-300">
                      <div className="flex items-center gap-2 text-emerald-700 mb-3 border-b border-emerald-200 pb-2">
                         <CheckCircle size={16} />
                         <span className="text-xs font-bold uppercase tracking-wider">Successfully Recorded</span>
                      </div>
                      <div className="flex flex-col gap-1.5 text-[13px] text-emerald-900">
                        <p className="flex justify-between items-center">
                          <span className="font-semibold uppercase tracking-wider text-[10px] opacity-75">Resident Code</span> 
                          <span className="font-mono font-bold text-emerald-700">{selectedResident.resident_code}</span>
                        </p>
                        <p className="flex justify-between items-center">
                          <span className="font-semibold uppercase tracking-wider text-[10px] opacity-75">Resident Name</span> 
                          <span className="font-bold uppercase text-right text-xs max-w-[200px] truncate">{selectedResident.last_name}, {selectedResident.first_name} {selectedResident.middle_name}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  <hr className="border-stone-100 my-6" />

                  <div className="flex justify-end">
                     <button 
                        onClick={handleCloseModal}
                        className="px-8 py-2.5 text-sm font-medium text-stone-700 bg-stone-50 border border-stone-200 hover:bg-stone-100 rounded-xl transition-colors"
                        disabled={loading}
                     >
                        Close
                     </button>
                  </div>
               </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* =========================================
          MODAL: EDIT ASSISTANCE
          ========================================= */}
      {editModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setEditModal({ isOpen: false, resident: null, assistance: null })} />
          <div className="relative bg-white w-full max-w-[500px] rounded-2xl border border-stone-200 shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            
            <div className="mb-6 flex justify-between items-start border-b border-stone-100 pb-4">
              <div>
                <h2 className="text-[20px] font-medium text-stone-900 leading-tight tracking-tight">Edit Assistance</h2>
                <p className="text-[12px] font-normal text-stone-500 uppercase tracking-wide mt-1">
                  FOR {editModal.resident?.last_name}, {editModal.resident?.first_name}
                </p>
              </div>
              <button onClick={() => setEditModal({ isOpen: false, resident: null, assistance: null })} className="text-stone-400 hover:text-stone-600 p-1 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 md:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] md:text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 md:mb-2">Assistance Type</label>
                  <div className="relative">
                    <select name="type_of_assistance" value={editFormData.type_of_assistance} onChange={handleEditInputChange} className="w-full appearance-none pl-3 md:pl-4 pr-10 py-2.5 md:py-3 bg-white border border-stone-200 rounded-xl text-sm font-normal text-stone-800 hover:border-stone-300 focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all cursor-pointer shadow-sm">
                      <option value="Medical Assistance">Medical Assistance</option>
                      <option value="Burial Assistance">Burial Assistance</option>
                      <option value="Educational Assistance">Educational Assistance</option>
                      <option value="Financial Assistance">Financial Assistance</option>
                      <option value="Gas Subsidy">Gas Subsidy</option>
                      <option value="Food Assistance">Food Assistance</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 md:top-4 text-stone-400 pointer-events-none" size={16} strokeWidth={2} />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] md:text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 md:mb-2">Payout Status</label>
                  <div className="relative">
                    <select name="status" value={editFormData.status} onChange={handleEditInputChange} className="w-full appearance-none pl-3 md:pl-4 pr-10 py-2.5 md:py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-800 hover:border-stone-300 focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all cursor-pointer shadow-sm uppercase">
                      <option value="Claimed">Claimed</option>
                      <option value="Unclaimed">Unclaimed</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 md:top-4 text-stone-400 pointer-events-none" size={16} strokeWidth={2} />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] md:text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 md:mb-2">Date Processed</label>
                  <input type="date" name="date_processed" value={editFormData.date_processed} onChange={handleEditInputChange} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-white border border-stone-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-rose-50 focus:border-rose-400 outline-none transition-all text-sm text-stone-800 uppercase" />
                </div>
                <div>
                  <label className={`block text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 md:mb-2 transition-colors ${editFormData.status === 'Unclaimed' ? 'text-stone-300' : 'text-stone-500'}`}>Date Claimed</label>
                  <input 
                    type="date" 
                    name="date_claimed" 
                    value={editFormData.status === 'Unclaimed' ? '' : editFormData.date_claimed} 
                    onChange={handleEditInputChange} 
                    disabled={editFormData.status === 'Unclaimed'}
                    className={`w-full px-3 md:px-4 py-2.5 md:py-3 bg-white border border-stone-200 rounded-xl outline-none transition-all text-sm text-stone-800 uppercase ${editFormData.status === 'Unclaimed' ? 'opacity-50 cursor-not-allowed bg-stone-50' : 'focus:border-rose-400 focus:ring-4 focus:ring-rose-50'}`} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] md:text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 md:mb-2">Amount (Optional)</label>
                <input type="number" name="amount" placeholder="0.00" value={editFormData.amount} onChange={handleEditInputChange} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-white border border-stone-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-rose-50 focus:border-rose-400 outline-none transition-all text-sm placeholder:text-stone-400 text-stone-800" />
              </div>

              <div>
                <label className="block text-[10px] md:text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 md:mb-2">Implementing Office</label>
                <input type="text" name="implementing_office" placeholder="E.G. MSWDO" value={editFormData.implementing_office} onChange={handleEditInputChange} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-white border border-stone-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-rose-50 focus:border-rose-400 outline-none transition-all text-sm placeholder:text-stone-400 text-stone-800 uppercase" />
              </div>
            </div>

            <hr className="border-stone-100 my-6" />

            <div className="flex flex-col-reverse sm:flex-row justify-end items-center gap-3">
              <button 
                onClick={() => setEditModal({ isOpen: false, resident: null, assistance: null })}
                className="w-full sm:w-auto px-8 py-2.5 text-sm font-medium text-stone-700 bg-stone-50 border border-stone-200 hover:bg-stone-100 rounded-xl transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                onClick={handleEditSave}
                disabled={loading}
                className="w-full sm:w-auto px-8 py-2.5 bg-[#ce5a6b] text-white text-sm font-medium rounded-xl hover:bg-rose-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : "Update"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================
          MODAL: DELETE ASSISTANCE CONFIRMATION
          ========================================= */}
      {deleteModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false, assistance: null, resident: null })} />
          <div className="relative bg-white w-full max-w-[420px] rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-5 border-4 border-red-50">
                <ShieldAlert size={28} className="md:w-8 md:h-8" />
              </div>
              <h3 className="text-lg md:text-xl font-medium text-stone-900 tracking-tight mb-2">Delete Record</h3>
              <p className="text-xs md:text-sm font-normal text-stone-600 leading-relaxed mb-6 md:mb-8">
                You are about to permanently remove this assistance record. <span className="font-medium text-stone-900">This action cannot be undone.</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => setDeleteModal({ isOpen: false, assistance: null, resident: null })} className="flex-1 px-4 py-3 border-2 border-stone-200 text-stone-600 text-sm font-medium rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-colors">
                  Cancel
                </button>
                <button onClick={handleDeleteAssistance} className="flex-1 px-4 py-3 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors shadow-md flex items-center justify-center gap-2" disabled={isDeleting}>
                  {isDeleting ? <Loader2 size={18} className="animate-spin" /> : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    
    {/* =========================================
          MODAL: DELETE PRESET CONFIRMATION
          ========================================= */}
      {deletePresetModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setDeletePresetModalOpen(false)} />
          <div className="relative bg-white w-full max-w-[420px] rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-5 border-4 border-red-50">
                <ShieldAlert size={28} className="md:w-8 md:h-8" />
              </div>
              <h3 className="text-lg md:text-xl font-medium text-stone-900 tracking-tight mb-2">Delete Preset</h3>
              <p className="text-xs md:text-sm font-normal text-stone-600 leading-relaxed mb-6 md:mb-8">
                You are about to permanently remove this configuration template. <span className="font-medium text-stone-900">This action cannot be undone.</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => setDeletePresetModalOpen(false)} 
                  className="flex-1 px-4 py-3 border-2 border-stone-200 text-stone-600 text-sm font-medium rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeletePreset} 
                  className="flex-1 px-4 py-3 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors shadow-md flex items-center justify-center gap-2" 
                  disabled={loading}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : "Delete Preset"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}