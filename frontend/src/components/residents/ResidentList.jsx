import { useEffect, useState, Fragment, useRef } from 'react';
import api from '../../api/api';
import {
  Trash2, Edit, Search, ChevronDown, ChevronUp,
  Loader2, Filter, FileText, Users, AlertCircle,
  ChevronLeft, ChevronRight, X, Archive, QrCode, ShieldAlert, CheckCircle2
} from 'lucide-react';
import ExportButton from './ExportButton';
import ImportButton from './ImportButton';
import toast, { Toaster } from 'react-hot-toast';
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

// Define the standard types so the system knows when to trigger "Others"
const PREDEFINED_ASSISTANCE_TYPES = [
  "Burial Assistance",
  "Financial Assistance",
  "Educational Assistance",
  "Medical Assistance",
  "Gas Subsidy",
  "Food Assistance"
];

export default function ResidentList({ userRole, onEdit }) {
  const [residents, setResidents] = useState([]);
  const [barangayList, setBarangayList] = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, residentId: null, name: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [assistanceModal, setAssistanceModal] = useState({ isOpen: false, resident: null, assistance: null });
  const [deleteAssistanceModal, setDeleteAssistanceModal] = useState({ isOpen: false, assistance: null });
  const [promotionModal, setPromotionModal] = useState({ isOpen: false, memberId: null, reason: "Deceased" });
  
  const navigate = useNavigate();

  const [sortBy, setSortBy] = useState("last_name");
  const [sortOrder, setSortOrder] = useState("asc");

  const role = (userRole || "").toLowerCase();
  const isAdmin = role === "admin";
  const isSuperAdmin = role === "super_admin";
  const isAdminLimited = role === "admin_limited";
  const isAdminLike = isAdmin || isSuperAdmin || isAdminLimited;
  const [sectorList, setSectorList] = useState([]);

  // --- CUSTOM DROPDOWN STATE ---
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false);
  const [sectorSearchTerm, setSectorSearchTerm] = useState("");
  const sectorDropdownRef = useRef(null);

  // --- FORM STATES FOR ASSISTANCE MODAL ---
  const [assistanceFormType, setAssistanceFormType] = useState("Medical Assistance");
  const [customAssistanceType, setCustomAssistanceType] = useState("");

  // Close sector dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (sectorDropdownRef.current && !sectorDropdownRef.current.contains(event.target)) {
        setIsSectorDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When the Assistance Modal opens, check if we are editing an "Others" category
  useEffect(() => {
    if (assistanceModal.isOpen) {
      const currentType = assistanceModal.assistance?.type_of_assistance;
      if (currentType) {
        if (PREDEFINED_ASSISTANCE_TYPES.includes(currentType)) {
          setAssistanceFormType(currentType);
          setCustomAssistanceType("");
        } else {
          setAssistanceFormType("Others");
          setCustomAssistanceType(currentType);
        }
      } else {
        setAssistanceFormType("Medical Assistance"); // Default
        setCustomAssistanceType("");
      }
    }
  }, [assistanceModal.isOpen, assistanceModal.assistance]);

  // --- HELPERS ---
  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const difference = Date.now() - birthDate.getTime();
    const ageDate = new Date(difference);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSectors = (summary, details) => {
    if (!summary) return "None";
    let text = summary;
    
    if (summary.includes("Others") && details) {
      text = summary.replace("Others", details);
    }
    if (summary.toUpperCase().includes("OTHERS") && details) {
      text = summary.replace(/Others/i, details);
    }

    if (!isSuperAdmin) {
      const restricted = ["HC", "C", "M"];
      let parts = text.split(",").map(s => s.trim());
      parts = parts.filter(p => !restricted.includes(p.toUpperCase()));
      text = parts.length > 0 ? parts.join(", ") : "None";
    }

    return text;
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const wasUpdated = (r) => {
    const created = r?.created_at ? new Date(r.created_at) : null;
    const updated = r?.updated_at ? new Date(r.updated_at) : null;

    return created && updated && updated.getTime() >= created.getTime();
  };

  const sitioToPurok = {
  "Sitio Sagpat": 6,
  "Sitio Tektek": 6,
  "Sitio Cabuyao": 7,
  "Bantay Carmen": 4,
  "Sitio Ticub": 7,
  "Sitio Lalec": 7,
  "Sitio Laoag": 8,
};

  const formatPurokDisplay = (p) => {
  if (!p) return "-";

  const raw = String(p).trim().replace(/\s+/g, " ");
  const low = raw.toLowerCase();

  if (low.startsWith("purok") || low.includes("(purok")) {
    return raw.toUpperCase();
  }

  if (low.startsWith("sitio") || low.startsWith("bantay")) {
    const key = raw
      .split(" ")
      .map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
      .join(" ");

    const n = sitioToPurok[key];
    return n ? `${key.toUpperCase()} (PUROK ${n})` : key.toUpperCase();
  }

  if (/^\d{1,2}$/.test(low)) {
    return `PUROK ${raw}`;
  }

  return raw.toUpperCase();
};

  // --- DATA FETCHING ---
  const fetchResidents = async (
    search = searchTerm,
    barangay = selectedBarangay,
    sector = selectedSector,
    status = selectedStatus,
    page = currentPage,
    limit = itemsPerPage,
    currentSortBy = sortBy,        
    currentSortOrder = sortOrder   
  ) => {
    setLoading(true);
    const skip = (page - 1) * limit;
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (isAdminLike && barangay) params.append("barangay", barangay);
      if (sector) params.append('sector', sector);
      if (status && status !== 'ALL') params.append('filter_status', status.toLowerCase());
      params.append('skip', skip);
      params.append('limit', limit);
      params.append('sort_by', currentSortBy);      
      params.append('sort_order', currentSortOrder);

      const response = await api.get(`/residents/?${params.toString()}`);
      const data = response.data;

      if (Array.isArray(data)) {
        setResidents(data);
        setTotalItems(data.length);
      } else if (Array.isArray(data.items)) {
        setResidents(data.items);
        setTotalItems(data.total || data.items.length);
      } else {
        setResidents([]);
        setTotalItems(0);
      }
    } catch (error) {
      toast.error("System Error: Unable to retrieve records.");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    const newOrder = sortBy === field && sortOrder === "asc" ? "desc" : "asc";
    setSortBy(field);
    setSortOrder(newOrder);
    setCurrentPage(1); 
  };

  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await api.get("/barangays/");
        setBarangayList(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch barangays", err);
        setBarangayList([]);
      }
    };
    fetchBarangays();
  }, []);

  useEffect(() => {
  const fetchSectors = async () => {
    try {
      const res = await api.get("/sectors/");
      setSectorList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch sectors", err);
      setSectorList([]);
    }
  };

  fetchSectors();
}, []);

  useEffect(() => {
    fetchResidents(searchTerm, selectedBarangay, selectedSector, selectedStatus, currentPage, itemsPerPage, sortBy, sortOrder);
  }, [userRole, currentPage, itemsPerPage, selectedBarangay, selectedSector, selectedStatus, searchTerm, sortBy, sortOrder]);


  // --- HANDLERS ---
  const handleSearchChange = (e) => { setSearchTerm(e.target.value); setCurrentPage(1); };
  const handleBarangayFilter = (e) => { setSelectedBarangay(e.target.value); setCurrentPage(1); };
  const handleStatusFilter = (e) => { setSelectedStatus(e.target.value); setCurrentPage(1); };
  const handleLimitChange = (e) => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); };
  const toggleRow = (id) => { setExpandedRow(expandedRow === id ? null : id); };

  const handleImportSuccess = () => {
    setCurrentPage(1);
    setSearchTerm('');
    fetchResidents('', selectedBarangay, selectedSector, selectedStatus, 1, itemsPerPage, sortBy, sortOrder);
  };

  const handleArchive = async (id) => {
    try {
      await api.put(`/residents/${id}/archive`);
      toast.success("Record moved to archive.");
      fetchResidents(searchTerm, selectedBarangay, selectedSector, selectedStatus, currentPage, itemsPerPage, sortBy, sortOrder);
    } catch (err) {
      toast.error("Action failed.");
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/residents/${deleteModal.residentId}`);
      toast.success('Record permanently deleted.');
      setDeleteModal({ isOpen: false, residentId: null, name: '' });
      fetchResidents(searchTerm, selectedBarangay, selectedSector, selectedStatus, currentPage, itemsPerPage, sortBy, sortOrder);
    } catch (err) {
      toast.error('Error deleting record.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePromote = async (memberId, reason) => {
    try {
      await api.put(`/residents/${expandedRow}/promote`, null, {
        params: { new_head_member_id: memberId, reason: reason }
      });
      toast.success("Head of family updated.");
      setPromotionModal({ isOpen: false, memberId: null, reason: "Deceased" });
      fetchResidents(searchTerm, selectedBarangay, selectedSector, selectedStatus, currentPage, itemsPerPage, sortBy, sortOrder);
    } catch {
      toast.error("Promotion failed.");
    }
  };

  const handleDeleteAssistance = async (id) => {
    try {
      await api.delete(`/assistances/${id}`);
      toast.success("Assistance record deleted.");
      setDeleteAssistanceModal({ isOpen: false, assistance: null });
      fetchResidents(searchTerm, selectedBarangay, selectedSector, selectedStatus, currentPage, itemsPerPage, sortBy, sortOrder);
    } catch {
      toast.error("Failed to delete assistance.");
    }
  };

  // --- DETAILS SUB-RENDER FUNCTION ---
  const renderResidentDetails = (r) => {
    const created = r.created_at ? new Date(r.created_at) : null;
    const updated = r.updated_at ? new Date(r.updated_at) : null;
    const wasEdited =
    created && updated && Math.abs(updated.getTime() - created.getTime()) > 1000;
    return (
      <div className="bg-stone-100 p-4 md:p-8 shadow-inner rounded-b-xl border-t-2 border-stone-200">
        <div className="flex flex-wrap items-center gap-3 mb-6 border-b border-stone-300 pb-4">
          <div className="p-2 bg-rose-700 text-white rounded-lg shadow-sm"><FileText size={18} /></div>
          <h3 className="text-lg font-medium text-stone-900 tracking-tight">Information Background</h3>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <div className="bg-white border border-stone-300 rounded-xl p-4 md:p-5 shadow-sm">
              <h4 className="text-xs font-medium text-stone-700 uppercase tracking-wider mb-5 flex justify-between items-center border-b border-stone-100 pb-3">
                Personal Information
                {r.photo_url && (
                  <img
                    src={r.photo_url}
                    alt="Resident"
                    className="w-12 h-12 md:w-14 md:h-14 object-cover rounded-full border-2 border-stone-200 shadow-sm"
                  />
                )}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">
                    Civil Status
                  </p>
                  <p className="text-sm font-normal text-stone-800">{r.civil_status || '-'}</p>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">
                    Religion
                  </p>
                  <p className="text-sm font-normal text-stone-800">{r.religion || '-'}</p>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">
                    Contact
                  </p>
                  <p className="text-sm font-normal text-stone-800 break-words">{r.contact_no || '-'}</p>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">
                    Precinct ID
                  </p>
                  <p className="text-sm font-mono font-normal text-stone-800 bg-stone-100 px-2 py-1 rounded border border-stone-200 inline-block break-all">
                    {r.precinct_no || '-'}
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-stone-100 pt-5">
                <h5 className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-4">
                  Emergency Contact
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">
                      Name
                    </p>
                    <p className="text-sm font-normal text-stone-800 uppercase break-words">
                      {r.emergency_name || '-'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">
                      Contact Number
                    </p>
                    <p className="text-sm font-normal text-stone-800 break-words">
                      {r.emergency_contact_no || '-'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">
                      Address
                    </p>
                    <p className="text-sm font-normal text-stone-800 uppercase break-words">
                      {r.emergency_address || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {wasEdited && (
                <div className="mt-6 border-t border-stone-100 pt-5">
                  <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">
                    Last Updated
                  </p>
                  <p className="text-sm font-normal text-stone-800">
                    {formatDateTime(r.updated_at || r.created_at)}
                  </p>
                </div>
              )}
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
                          <td className="py-3 px-2 font-normal text-stone-600">{formatDate(a.date_claimed)}</td>
                          <td className="py-3 px-2 font-medium text-rose-700">
                            {a.amount ? `₱${a.amount.toLocaleString()}` : "-"}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {(isAdmin || isSuperAdmin) && (
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setAssistanceModal({ isOpen: true, resident: r, assistance: a })} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-md transition-colors border border-rose-100">
                                  <Edit size={14} />
                                </button>
                                <button onClick={() => setDeleteAssistanceModal({ isOpen: true, assistance: a })} className="p-1.5 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-md transition-colors border border-red-100">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="bg-white border border-stone-300 rounded-xl p-4 md:p-5 shadow-sm">
              <h4 className="text-xs font-medium text-stone-700 uppercase tracking-wider mb-3 border-b border-stone-100 pb-3">Registered Sector</h4>
              <div className="inline-flex items-center px-4 py-2 bg-stone-100 rounded-lg border border-stone-300 shadow-sm">
                <span className="text-sm font-normal text-stone-800 tracking-tight uppercase">
                  {formatSectors(r.sector_summary, r.other_sector_details)}
                </span>
              </div>
            </div>

            {(r.spouse_first_name || r.spouse_last_name) && (
              <div className="bg-white border border-stone-300 rounded-xl p-4 md:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Legal Spouse</h4>
                  <p className="text-base font-normal text-stone-800 uppercase break-words">
                    {r.spouse_last_name}, {r.spouse_first_name} {r.spouse_middle_name || ''}
                  </p>
                </div>
                <button onClick={() => setPromotionModal({ isOpen: true, memberId: "spouse", reason: "Deceased" })} className="w-full sm:w-auto text-[11px] font-medium text-white bg-rose-700 hover:bg-rose-800 px-4 py-2.5 rounded-lg transition-colors shadow-sm">
                  ASSIGN AS HEAD
                </button>
              </div>
            )}

            <div className="bg-white border border-stone-300 rounded-xl p-4 md:p-5 shadow-sm">
              <h4 className="text-xs font-medium text-stone-700 uppercase tracking-wider mb-4 border-b border-stone-100 pb-3">Household Composition</h4>
              {r.family_members?.length > 0 ? (
                <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                  <table className="w-full text-sm min-w-[350px]">
                    <thead>
                      <tr className="bg-stone-50 text-stone-600 text-left text-[11px] uppercase tracking-wider border-y border-stone-200">
                        <th className="py-3 px-3 font-medium">Name</th>
                        <th className="py-3 px-3 font-medium">Relation</th>
                        <th className="py-3 px-3 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {r.family_members.filter(fm => fm.first_name).map((fm, i) => (
                        <tr key={i} className="hover:bg-stone-50 transition-colors">
                          <td className="py-3 px-3 font-medium text-stone-800 uppercase">{fm.last_name}, {fm.first_name} {fm.middle_name || ""}</td>
                          <td className="py-3 px-3 font-normal text-stone-600 italic">{fm.relationship}</td>
                          <td className="py-3 px-3 text-right">
                            <button onClick={(e) => { e.stopPropagation(); setPromotionModal({ isOpen: true, memberId: fm.id, reason: "Deceased" }); }} className="text-[11px] text-stone-600 font-medium bg-stone-200 hover:bg-rose-700 hover:text-white px-3 py-1.5 rounded-md transition-colors border border-stone-300 hover:border-rose-700 shadow-sm">
                              PROMOTE
                            </button>
                          </td>
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

  return (
    <div className="font-sans text-stone-900 animate-in fade-in duration-300 px-2 sm:px-4 md:px-0 pb-12">
      {createPortal(
        <Toaster position="top-right" containerStyle={{ zIndex: 999999, filter: 'none', isolation: 'isolate' }} toastOptions={{ style: { background: '#1c1917', color: '#fff', borderRadius: '12px', fontSize: '14px', fontWeight: '500' } }} />,
        document.body
      )}

      {/* --- HEADER --- */}
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-5">
        <div>
           <div className="flex items-center gap-2 text-rose-700 mb-2">
              <div className="p-1.5 md:p-2 bg-rose-100 rounded-lg border border-rose-200 shadow-sm"><Users size={16} strokeWidth={2} className="md:w-[18px] md:h-[18px]" /></div>
              <span className="text-[10px] md:text-xs font-medium tracking-widest uppercase">Municipality of San Felipe</span>
           </div>
           <h1 className="text-2xl md:text-3xl font-medium text-stone-900 tracking-tight">Registered Residents</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
          {(isAdmin || isSuperAdmin) && (
           <ImportButton onSuccess={handleImportSuccess} className="flex-1 md:flex-none justify-center bg-white border-2 border-stone-300 text-stone-700 font-medium hover:bg-stone-100 rounded-xl shadow-sm transition-all" />
           )}
           <ExportButton 
              barangay={selectedBarangay} 
              sector={selectedSector}  // Pass the current sector state
              status={selectedStatus}  // Pass the current status state
              className="flex-1 md:flex-none justify-center bg-red-700 text-white font-medium hover:bg-red-800 rounded-xl shadow-md transition-all" 
            />
        </div>
      </div>

      {/* --- TOOLBAR --- */}
      <div className="bg-stone-100 border border-stone-300 rounded-t-2xl p-4 md:p-5 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between shadow-sm">
         <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full lg:flex-1">
            {/* Search */}
            <div className="relative w-full lg:max-w-md group">
               <div className="absolute left-3 md:left-4 top-3.5 text-stone-400 group-focus-within:text-rose-600 transition-colors">
                  <Search size={18} strokeWidth={2} />
               </div>
               <input 
                  type="text" 
                  placeholder="Search name or ID..." 
                  value={searchTerm} 
                  onChange={handleSearchChange} 
                  className="w-full pl-10 md:pl-11 pr-10 py-3 bg-white border border-stone-300 rounded-xl text-sm font-normal text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-rose-600 focus:ring-4 focus:ring-rose-100 transition-all shadow-sm uppercase"
               />
               {searchTerm && (
                 <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} className="absolute right-3 top-3 text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg p-1 transition-colors">
                   <X size={16} strokeWidth={2} />
                 </button>
               )}
            </div>

            {/* Filters Row on Mobile */}
            <div className="flex gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              
              {/* CUSTOM SEARCHABLE SECTOR DROPDOWN WITH DYNAMIC CREATION */}
              <div className="relative w-full sm:w-56 shrink-0" ref={sectorDropdownRef}>
                 <button
                   onClick={() => setIsSectorDropdownOpen(!isSectorDropdownOpen)}
                   className="w-full flex items-center justify-between pl-3 md:pl-4 pr-3 md:pr-4 py-3 bg-white border border-stone-300 rounded-xl text-[11px] md:text-sm font-normal text-stone-700 hover:border-stone-400 focus:outline-none focus:border-rose-600 focus:ring-4 focus:ring-rose-100 transition-all shadow-sm uppercase truncate"
                 >
                   <span className="truncate">{selectedSector || "ALL SECTORS"}</span>
                   <ChevronDown className="text-stone-400 shrink-0" size={18} strokeWidth={2} />
                 </button>

                 {isSectorDropdownOpen && (
                   <div className="absolute z-50 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden flex flex-col">
                     <div className="p-2 border-b border-stone-100 bg-stone-50">
                       <div className="relative">
                         <Search className="absolute left-2.5 top-2.5 text-stone-400" size={14} />
                         <input
                           type="text"
                           placeholder="Search sector..."
                           value={sectorSearchTerm}
                           onChange={(e) => setSectorSearchTerm(e.target.value)}
                           className="w-full pl-8 pr-3 py-2 bg-white border border-stone-200 rounded-lg text-xs outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-50 uppercase"
                           autoFocus
                         />
                       </div>
                     </div>
                     <div className="max-h-60 overflow-y-auto py-1">
                       <div
                         onClick={() => { 
                           setSelectedSector(""); 
                           setCurrentPage(1); 
                           setIsSectorDropdownOpen(false); 
                           setSectorSearchTerm(''); 
                         }}
                         className={`px-4 py-2 text-xs md:text-sm cursor-pointer uppercase hover:bg-rose-50 hover:text-rose-700 transition-colors ${selectedSector === "" ? "bg-rose-50 text-rose-700 font-medium" : "text-stone-700"}`}
                       >
                         ALL SECTORS
                       </div>
                       
                       {/* Standard list matching filter */}
                       {sectorList
                         .filter(s => s.name.toLowerCase().includes(sectorSearchTerm.toLowerCase()))
                         .map(sector => (
                           <div
                             key={sector.id}
                             onClick={() => { 
                               setSelectedSector(sector.name); 
                               setCurrentPage(1); 
                               setIsSectorDropdownOpen(false); 
                               setSectorSearchTerm(''); 
                             }}
                             className={`px-4 py-2 text-xs md:text-sm cursor-pointer uppercase hover:bg-rose-50 hover:text-rose-700 transition-colors ${selectedSector === sector.name ? "bg-rose-50 text-rose-700 font-medium" : "text-stone-700"}`}
                           >
                             {sector.name}
                           </div>
                         ))
                       }
                       
                       {/* If they type something NOT in the predefined list, give them the option to search for it as a custom filter */}
                       {sectorSearchTerm.trim().length > 0 && !sectorList.some(s => s.name.toLowerCase() === sectorSearchTerm.toLowerCase()) && (
                         <div
                           onClick={() => { 
                             setSelectedSector(sectorSearchTerm.toUpperCase()); 
                             setCurrentPage(1); 
                             setIsSectorDropdownOpen(false); 
                             setSectorSearchTerm(''); 
                           }}
                           className="px-4 py-2.5 mt-1 text-xs md:text-sm cursor-pointer uppercase hover:bg-rose-50 hover:text-rose-700 transition-colors text-rose-600 border-t border-stone-100 bg-stone-50"
                         >
                           <span className="font-semibold text-stone-500 mr-1">Search Other:</span> {sectorSearchTerm}
                         </div>
                       )}
                     </div>
                   </div>
                 )}
              </div>

              {/* Status Filter */}
              <div className="relative w-full sm:w-40 shrink-0">
                 <select
                   value={selectedStatus}
                   onChange={handleStatusFilter}
                   className="w-full appearance-none pl-3 md:pl-4 pr-9 md:pr-10 py-3 bg-white border border-stone-300 rounded-xl text-[11px] md:text-sm font-normal text-stone-700 hover:border-stone-400 focus:outline-none focus:border-rose-600 focus:ring-4 focus:ring-rose-100 transition-all cursor-pointer shadow-sm uppercase truncate"
                 >
                   <option value="ALL">ALL RESIDENTS</option>
                   <option value="UPDATED">UPDATED RESIDENTS</option>
                 </select>
                 <ChevronDown className="absolute right-3 top-3.5 text-stone-400 pointer-events-none" size={18} strokeWidth={2} />
              </div>

              {/* Admin Filter */}
              {(isAdmin || isSuperAdmin) && (
                <div className="relative w-full sm:w-48 shrink-0">
                   <select value={selectedBarangay} onChange={handleBarangayFilter} className="w-full appearance-none pl-3 md:pl-4 pr-9 md:pr-10 py-3 bg-white border border-stone-300 rounded-xl text-[11px] md:text-sm font-normal text-stone-700 hover:border-stone-400 focus:outline-none focus:border-rose-600 focus:ring-4 focus:ring-rose-100 transition-all cursor-pointer shadow-sm uppercase truncate">
                     <option value="">ALL BARANGAYS</option>
                     {barangayList.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                   </select>
                   <Filter className="absolute right-3 top-3.5 text-stone-400 pointer-events-none" size={18} strokeWidth={2} />
                </div>
              )}
            </div>
         </div>

         {/* Pagination Controls (Top) */}
         <div className="w-full lg:w-auto flex justify-end">
           <div className="flex items-center gap-2 text-[11px] md:text-sm font-normal text-stone-600 bg-white px-3 md:px-4 py-2 rounded-xl border border-stone-300 shadow-sm">
               <span className="uppercase tracking-widest text-[10px]">Show:</span>
               <select value={itemsPerPage} onChange={handleLimitChange} className="bg-transparent font-medium text-stone-800 outline-none cursor-pointer hover:text-rose-700 transition-colors">
                 <option value={10}>10</option>
                 <option value={20}>20</option>
                 <option value={50}>50</option>
               </select>
           </div>
         </div>
      </div>

      {/* --- TABLE --- */}
      <div className="bg-white border-x border-b border-stone-300 shadow-sm min-h-[400px] md:min-h-[500px] rounded-b-2xl overflow-hidden relative">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-red-50 text-stone-600 text-[10px] md:text-[11px] uppercase font-medium tracking-widest border-b-2 border-red-200">
                <th className="py-3 md:py-4 px-3 md:px-5 w-10 md:w-12 text-center">#</th>
                <th onClick={() => handleSort("last_name")} className="py-3 md:py-4 px-3 md:px-5 w-1/4 cursor-pointer hover:text-red-700 select-none group transition-colors">
                  <div className="flex items-center gap-1 md:gap-2">
                    IDENTITY
                    <div className="p-0.5 md:p-1 rounded bg-red-100 group-hover:bg-red-200 transition-colors text-red-700 group-hover:text-red-900">
                      {sortBy === "last_name" ? (sortOrder === "asc" ? <ChevronUp size={14} strokeWidth={2}/> : <ChevronDown size={14} strokeWidth={2}/>) : <ChevronDown size={14} strokeWidth={2} className="opacity-0 group-hover:opacity-100" />}
                    </div>
                  </div>
                </th>
                <th className="py-3 md:py-4 px-3 md:px-5">BIRTHDATE</th>
                <th className="py-3 md:py-4 px-3 md:px-5">LOCATION</th>
                <th className="py-3 md:py-4 px-3 md:px-5">CLASS/SECTOR</th>
                <th className="py-3 md:py-4 px-3 md:px-5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="text-[13px] md:text-sm">
              {loading ? (
                 <tr>
                   <td colSpan="6" className="py-24 md:py-32 text-center">
                      <div className="flex flex-col items-center gap-3">
                         <Loader2 className="animate-spin text-rose-700" size={32} strokeWidth={2}/>
                         <span className="text-[10px] md:text-xs font-normal text-stone-400 uppercase tracking-widest">Accessing Database...</span>
                      </div>
                   </td>
                 </tr>
              ) : residents.length === 0 ? (
                 <tr>
                   <td colSpan="6" className="py-16 md:py-24 text-center">
                     <div className="inline-flex flex-col items-center justify-center text-stone-400">
                       <Search size={32} strokeWidth={1.5} className="mb-3 opacity-30" />
                       <span className="font-medium text-stone-500 text-base md:text-lg">No records found.</span>
                       <span className="font-normal text-stone-400 text-xs md:text-sm mt-1">Try adjusting your search or filters.</span>
                     </div>
                   </td>
                 </tr>
              ) : (
                residents.map((r, index) => (
                  <Fragment key={r.id}>
                    <tr onClick={() => toggleRow(r.id)} className={`border-b border-stone-200 cursor-pointer transition-colors ${expandedRow === r.id ? 'bg-rose-50/70' : 'hover:bg-stone-50'}`}>
                      <td className="py-3 md:py-4 px-3 md:px-5 text-center align-middle">
                         <div className={`mx-auto flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-lg transition-all ${expandedRow === r.id ? 'bg-rose-700 text-white shadow-sm' : 'bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-700'}`}>
                           {expandedRow === r.id ? <ChevronUp size={14} strokeWidth={2}/> : <ChevronDown size={14} strokeWidth={2}/>}
                         </div>
                      </td>

                      {/* IDENTITY */}
                      <td className="py-3 md:py-4 px-3 md:px-5 align-middle">
                        <div className="flex items-center gap-3 md:gap-4">
                          {r.photo_url ? (
                            <img src={r.photo_url} alt="Resident" className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-stone-200 shadow-sm shrink-0" />
                          ) : (
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-stone-100 border-2 border-stone-200 flex items-center justify-center text-[9px] md:text-[10px] font-normal text-stone-400 uppercase tracking-wider shrink-0">
                              N/A
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-stone-800 text-[13px] md:text-[15px] tracking-tight uppercase truncate">
                              {r.last_name}, {r.first_name} {r.middle_name || ''} {r.ext_name || ''}
                            </span>
                            {wasUpdated(r) && (
                              <CheckCircle2
                                size={14}
                                className="text-emerald-600 shrink-0 inline md:hidden ml-1"
                                title={`Updated: ${formatDateTime(r.updated_at)}`}
                              />
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mt-1">
                              {wasUpdated(r) && (
                                <CheckCircle2
                                  size={14}
                                  className="text-emerald-600 shrink-0 hidden md:inline-block"
                                  title={`Updated: ${formatDateTime(r.updated_at)}`}
                                />
                              )}
                              <span className="px-1 md:px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded text-[9px] md:text-[10px] font-normal uppercase tracking-wider border border-stone-200">
                                {r.sex}
                              </span>
                              <span className="text-[10px] md:text-xs font-normal text-stone-400 uppercase truncate max-w-[80px] md:max-w-[120px]">
                                {r.occupation || "Unspecified"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* BIRTH INFO */}
                      <td className="py-3 md:py-4 px-3 md:px-5 align-middle">
                         <span className="block font-medium text-stone-700 uppercase tracking-wide truncate">{formatDate(r.birthdate)}</span>
                         <span className="text-[10px] md:text-xs font-normal text-stone-400">{calculateAge(r.birthdate)} yrs</span>
                      </td>

                      {/* ADDRESS */}
                      <td className="py-3 md:py-4 px-3 md:px-5 align-middle">
                         <span className="block font-medium text-stone-700 uppercase tracking-wide truncate max-w-[150px] md:max-w-[200px]">{r.barangay}</span>
                         <span className="block text-[10px] md:text-xs font-normal text-stone-400 uppercase truncate max-w-[150px] md:max-w-[200px]">
                            {formatPurokDisplay(r.purok)} {r.house_no ? `#${r.house_no}` : ""}
                         </span>
                      </td>

                      {/* SECTOR */}
                      <td className="py-3 md:py-4 px-3 md:px-5 align-middle">
                         <span className="inline-flex items-center bg-stone-100 border border-stone-200 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[9px] md:text-[11px] font-normal text-stone-600 tracking-tight uppercase shadow-sm whitespace-normal break-words max-w-[120px] md:max-w-[200px] leading-tight">
                            {formatSectors(r.sector_summary, r.other_sector_details)}
                         </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3 md:py-4 px-3 md:px-5 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                         <div className="flex items-center justify-end gap-1.5 md:gap-2">
                            <button onClick={() => onEdit(r)} className="p-2 md:p-2.5 bg-stone-100 text-stone-500 hover:bg-rose-600 hover:text-white rounded-lg transition-all shadow-sm border border-stone-200 hover:border-rose-600 shrink-0" title="Edit Resident">
                                <Edit size={14} className="md:w-4 md:h-4" strokeWidth={2} />
                            </button>
                            {(isAdmin || isSuperAdmin) && (
                              <>
                                <button
                                  onClick={() => setAssistanceModal({ isOpen: true, resident: r })}
                                  className="p-2 md:p-2.5 bg-stone-100 text-stone-500 hover:bg-rose-700 hover:text-white rounded-lg transition-all shadow-sm border border-stone-200 hover:border-rose-700 shrink-0"
                                  title="Add Assistance"
                                >
                                  <FileText size={14} className="md:w-4 md:h-4" strokeWidth={2} />
                                </button>

                                {/* keep these ADMIN ONLY */}
                                {(isAdmin || isSuperAdmin) && (
                                  <>
                                    <button
                                      onClick={() => navigate(`/dashboard/residents/${r.resident_code}/qr`)}
                                      className="p-2 md:p-2.5 bg-stone-100 text-stone-500 hover:bg-stone-800 hover:text-white rounded-lg transition-all shadow-sm border border-stone-200 hover:border-stone-800 shrink-0"
                                      title="Generate QR"
                                    >
                                      <QrCode size={14} className="md:w-4 md:h-4" strokeWidth={2} />
                                    </button>

                                    <button
                                      onClick={() => handleArchive(r.id)}
                                      className="p-2 md:p-2.5 bg-stone-100 text-stone-500 hover:bg-orange-700 hover:text-white rounded-lg transition-all shadow-sm border border-stone-200 hover:border-orange-700 shrink-0"
                                      title="Archive Resident"
                                    >
                                      <Archive size={14} className="md:w-4 md:h-4" strokeWidth={2} />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                         </div>
                      </td>
                    </tr>
                    
                    {/* EXPANDED DETAILS */}
                    {expandedRow === r.id && (
                      <tr>
                        <td colSpan="6" className="p-0">
                          {renderResidentDetails(r)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- PAGINATION FOOTER --- */}
      <div className="mt-6 md:mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
         <p className="text-[11px] md:text-sm font-normal text-stone-500 uppercase tracking-wide">
            Total Valid Records: <span className="font-medium text-stone-800 text-sm md:text-base">{totalItems}</span>
         </p>
         
         <div className="flex items-center bg-white border border-stone-300 rounded-xl shadow-sm p-1 md:p-1.5 w-full sm:w-auto justify-between sm:justify-start">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 md:p-2.5 rounded-lg font-normal text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
               <ChevronLeft size={16} className="md:w-[18px] md:h-[18px]" strokeWidth={2} />
            </button>
            <div className="px-4 md:px-5 py-1.5 text-[11px] md:text-sm font-normal text-stone-700 min-w-[100px] md:min-w-[120px] text-center uppercase tracking-widest">
               Page {currentPage} of {totalPages || 1}
            </div>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 md:p-2.5 rounded-lg font-normal text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
               <ChevronRight size={16} className="md:w-[18px] md:h-[18px]" strokeWidth={2} />
            </button>
         </div>
      </div>

      {/* ASSISTANCE MODAL (ADD & EDIT) */}
      {assistanceModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setAssistanceModal({ isOpen: false, resident: null })} />
          <div className="relative bg-white w-full max-w-[480px] rounded-2xl border border-stone-200 shadow-2xl p-5 md:p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg md:text-xl font-medium tracking-tight text-stone-900 mb-5 md:mb-6 border-b border-stone-200 pb-4">
              {assistanceModal.assistance ? "Edit Assistance" : "Add Assistance"}
              <span className="block text-xs md:text-sm font-normal text-stone-500 mt-1 uppercase tracking-widest">For {assistanceModal.resident?.last_name}, {assistanceModal.resident?.first_name}</span>
            </h3>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              
              // Handle custom assistance type
              const baseType = assistanceFormType;
              const customType = formData.get("custom_type")?.trim();
              const finalType = baseType === 'Others' ? customType : baseType;

              if (baseType === 'Others' && !customType) {
                  toast.error("Please specify the custom assistance type.");
                  return;
              }

              const payload = {
                type_of_assistance: finalType,
                date_processed: formData.get("processed") || null,
                date_claimed: formData.get("claimed") || null,
                amount: formData.get("amount") || null,
                implementing_office: formData.get("office") || null,
              };
              
              try {
                if (assistanceModal.assistance) {
                  await api.put(`/assistances/${assistanceModal.assistance.id}`, payload);
                  toast.success("Assistance updated.");
                } else {
                  await api.post(`/residents/${assistanceModal.resident.id}/assistance`, payload);
                  toast.success("Assistance recorded.");
                }
                setAssistanceModal({ isOpen: false, resident: null, assistance: null });
                fetchResidents(searchTerm, selectedBarangay, selectedSector, selectedStatus, currentPage, itemsPerPage, sortBy, sortOrder);
              } catch (error) {
                // NEW: Show the actual backend error message (e.g. "ALREADY CLAIMED")
                const errorMsg = error.response?.data?.detail || "Operation failed.";
                toast.error(errorMsg);
              }
            }}>
              <div className="space-y-4 md:space-y-5">
                <div>
                  <label className="block text-[10px] md:text-xs font-medium text-stone-600 uppercase tracking-wider mb-1 md:mb-2">Assistance Type</label>
                  <div className="relative">
                    <select 
                      name="type" 
                      value={assistanceFormType}
                      onChange={(e) => setAssistanceFormType(e.target.value)}
                      className="w-full appearance-none border-2 border-stone-200 bg-stone-50 rounded-xl p-2.5 md:p-3 text-sm font-normal text-stone-800 focus:bg-white focus:border-rose-600 outline-none transition-all cursor-pointer"
                    >
                      <option>Medical Assistance</option>
                      <option>Burial Assistance</option>
                      <option>Educational Assistance</option>
                      <option>Financial Assistance</option>
                      <option>Gas Subsidy</option>
                      <option>Food Assistance</option>
                      <option value="Others">Others (Specify)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3 text-stone-400 pointer-events-none" size={18} strokeWidth={2} />
                  </div>
                </div>

                {/* CONDITIONAL TEXT INPUT FOR OTHERS */}
                {assistanceFormType === 'Others' && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="block text-[10px] md:text-xs font-medium text-stone-600 uppercase tracking-wider mb-1 md:mb-2">Specify Type</label>
                    <input 
                      type="text" 
                      name="custom_type" 
                      value={customAssistanceType}
                      onChange={(e) => setCustomAssistanceType(e.target.value)}
                      placeholder="e.g. Wheelchair..." 
                      className="w-full border-2 border-stone-200 bg-stone-50 rounded-xl p-2.5 md:p-3 text-sm font-normal text-stone-800 focus:bg-white focus:border-rose-600 outline-none transition-all uppercase" 
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] md:text-xs font-medium text-stone-600 uppercase tracking-wider mb-1 md:mb-2">Date Processed</label>
                    <input type="date" name="processed" className="w-full border-2 border-stone-200 bg-stone-50 rounded-xl p-2.5 md:p-3 text-sm font-normal text-stone-800 focus:bg-white focus:border-rose-600 outline-none transition-all uppercase" defaultValue={assistanceModal.assistance?.date_processed ? assistanceModal.assistance.date_processed.split('T')[0] : ''} />
                  </div>
                  <div>
                    <label className="block text-[10px] md:text-xs font-medium text-stone-600 uppercase tracking-wider mb-1 md:mb-2">Date Claimed</label>
                    <input type="date" name="claimed" className="w-full border-2 border-stone-200 bg-stone-50 rounded-xl p-2.5 md:p-3 text-sm font-normal text-stone-800 focus:bg-white focus:border-rose-600 outline-none transition-all uppercase" defaultValue={assistanceModal.assistance?.date_claimed ? assistanceModal.assistance.date_claimed.split('T')[0] : ''} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] md:text-xs font-medium text-stone-600 uppercase tracking-wider mb-1 md:mb-2">Amount (Optional)</label>
                  <input type="number" name="amount" placeholder="0.00" className="w-full border-2 border-stone-200 bg-stone-50 rounded-xl p-2.5 md:p-3 text-sm font-normal text-stone-800 focus:bg-white focus:border-rose-600 outline-none transition-all" defaultValue={assistanceModal.assistance?.amount} />
                </div>
                <div>
                  <label className="block text-[10px] md:text-xs font-medium text-stone-600 uppercase tracking-wider mb-1 md:mb-2">Implementing Office</label>
                  <input type="text" name="office" placeholder="e.g. MSWDO" className="w-full border-2 border-stone-200 bg-stone-50 rounded-xl p-2.5 md:p-3 text-sm font-normal text-stone-800 focus:bg-white focus:border-rose-600 outline-none transition-all uppercase" defaultValue={assistanceModal.assistance?.implementing_office} />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 md:mt-8 pt-5 border-t border-stone-200">
                <button type="button" onClick={() => setAssistanceModal({ isOpen: false, resident: null })} className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-stone-700 bg-stone-100 border border-stone-300 hover:bg-stone-200 rounded-xl transition-colors shadow-sm">
                  Cancel
                </button>
                <button type="submit" className="w-full sm:w-auto px-6 py-3 bg-rose-700 text-white text-sm font-medium rounded-xl hover:bg-rose-800 transition-colors shadow-md">
                  Save Assistance
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* DELETE ASSISTANCE & RECORD MODALS */}
      {(deleteModal.isOpen || deleteAssistanceModal.isOpen) && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => { setDeleteModal({ isOpen: false }); setDeleteAssistanceModal({ isOpen: false }); }} />
          <div className="relative bg-white w-full max-w-[420px] rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-5 border-4 border-red-50">
                <ShieldAlert size={28} className="md:w-8 md:h-8" />
              </div>
              <h3 className="text-lg md:text-xl font-medium text-stone-900 tracking-tight mb-2">Confirm Deletion</h3>
              <p className="text-xs md:text-sm font-normal text-stone-600 leading-relaxed mb-6 md:mb-8">
                You are about to permanently remove {deleteModal.isOpen ? `the record for ${deleteModal.name}` : 'this assistance record'}. <span className="font-medium text-stone-900">This action cannot be undone.</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => { setDeleteModal({ isOpen: false }); setDeleteAssistanceModal({ isOpen: false }); }} className="flex-1 px-4 py-3 border-2 border-stone-200 text-stone-600 text-sm font-medium rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-colors">
                  Cancel
                </button>
                <button onClick={() => deleteModal.isOpen ? confirmDelete() : handleDeleteAssistance(deleteAssistanceModal.assistance.id)} className="flex-1 px-4 py-3 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors shadow-md flex items-center justify-center gap-2" disabled={isDeleting}>
                  {isDeleting ? <Loader2 size={18} className="animate-spin" /> : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PROMOTION MODAL */}
      {promotionModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setPromotionModal({ isOpen: false, memberId: null, reason: "Deceased" })} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-[420px] p-6 md:p-8 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 border-b border-stone-200 pb-4">
               <div className="p-3 bg-rose-100 text-rose-800 rounded-xl"><Users size={24} /></div>
               <h3 className="text-lg md:text-xl font-medium text-stone-900 tracking-tight">Update Head of Family</h3>
            </div>
            <label className="block text-[10px] md:text-xs font-medium text-stone-600 uppercase tracking-wider mb-2">Reason for Replacement</label>
            <select className="w-full border-2 border-stone-200 bg-stone-50 rounded-xl p-3 text-sm font-normal text-stone-800 focus:bg-white focus:border-rose-600 outline-none transition-all mb-6 md:mb-8 cursor-pointer" value={promotionModal.reason} onChange={(e) => setPromotionModal({ ...promotionModal, reason: e.target.value })}>
              <option value="Deceased">Principal Deceased</option>
              <option value="Transferred">Transferred Residence</option>
              <option value="Inactive">Status Inactive</option>
            </select>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setPromotionModal({ isOpen: false, memberId: null, reason: "Deceased" })} className="flex-1 px-4 py-3 border-2 border-stone-200 text-stone-600 text-sm font-medium rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-colors">
                Cancel
              </button>
              <button onClick={() => handlePromote(promotionModal.memberId, promotionModal.reason)} className="flex-1 px-4 py-3 bg-rose-700 text-white text-sm font-medium rounded-xl hover:bg-rose-800 transition-colors shadow-md">
                Confirm Update
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}