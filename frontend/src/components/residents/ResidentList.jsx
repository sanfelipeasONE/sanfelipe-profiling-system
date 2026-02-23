import { useEffect, useState, Fragment, useMemo } from 'react';
import api from '../../api/api';
import {
  Trash2, Edit, Search, ChevronDown, ChevronUp,
  Loader2, Filter, Phone, Fingerprint, Heart, User,
  ChevronLeft, ChevronRight, Briefcase, Calendar, X,
  FileText, Users, AlertCircle
} from 'lucide-react';
import ExportButton from './ExportButton';
import toast, { Toaster } from 'react-hot-toast';
import { createPortal } from "react-dom";
import ImportButton from './ImportButton';
import { Archive } from 'lucide-react';
import { QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ResidentList({ userRole, onEdit }) {
  const [residents, setResidents] = useState([]);
  const [barangayList, setBarangayList] = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, residentId: null, name: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [assistanceModal, setAssistanceModal] = useState({ isOpen: false, resident: null, assistance: null });
  const [deleteAssistanceModal, setDeleteAssistanceModal] = useState({ isOpen: false, assistance: null });
  const navigate = useNavigate();


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
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
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
    return text;
  };

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // --- DATA FETCHING ---
  const fetchResidents = async (
    search = searchTerm,
    barangay = selectedBarangay,
    sector = selectedSector,
    page = currentPage,
    limit = itemsPerPage
  ) => {

    setLoading(true);
    const skip = (page - 1) * limit;
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (userRole === 'admin' && barangay) params.append('barangay', barangay);
      if (sector) params.append('sector', sector);

      params.append('skip', skip);
      params.append('limit', limit);

      const response = await api.get(`/residents/?${params.toString()}`);
      if (response.data.items) {
        setResidents(response.data.items);
        setTotalItems(response.data.total);
      } else {
        setResidents(response.data);
        setTotalItems(response.data.length);
      }
    } catch (error) {
      toast.error("System Error: Unable to retrieve records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const response = await api.get('/barangays/');
        setBarangayList(response.data);
      } catch (err) { console.error(err); }
    };
    fetchBarangays();
  }, []);

  useEffect(() => {
    fetchResidents();
  }, [userRole, currentPage, itemsPerPage, selectedBarangay, selectedSector, searchTerm]);


  // --- HANDLERS ---
  const handleSearchChange = (e) => { setSearchTerm(e.target.value); setCurrentPage(1); };
  const handleBarangayFilter = (e) => { setSelectedBarangay(e.target.value); setCurrentPage(1); };
  const handleSectorFilter = (e) => { setSelectedSector(e.target.value); setCurrentPage(1); };
  const handleLimitChange = (e) => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); };
  const toggleRow = (id) => { setExpandedRow(expandedRow === id ? null : id); };

  const handleImportSuccess = () => {
    setCurrentPage(1);
    setSearchTerm('');
    fetchResidents('', selectedBarangay, 1, itemsPerPage);
  };

  const handleArchive = async (id) => {
    try {
      await api.put(`/residents/${id}/archive`);
      toast.success("Record moved to archive.");
      fetchResidents();
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
      fetchResidents();
    } catch (err) {
      toast.error('Error deleting record.');
    } finally {
      setIsDeleting(false);
    }
  };

  const [promotionModal, setPromotionModal] = useState({
    isOpen: false,
    memberId: null,
    reason: "Deceased"
  });


  const handlePromote = async (memberId, reason) => {
    try {
      await api.put(`/residents/${expandedRow}/promote`, null, {
        params: {
          new_head_member_id: memberId,
          reason: reason
        }
      });

      toast.success("Head of family updated.");
      setPromotionModal({
        isOpen: false,
        memberId: null,
        reason: "Deceased"
      });
      fetchResidents();
    } catch {
      toast.error("Promotion failed.");
    }
  };

  const handleDeleteAssistance = async (id) => {
  try {
    await api.delete(`/assistances/${id}`);
    toast.success("Assistance record deleted.");

    setDeleteAssistanceModal({
      isOpen: false,
      assistance: null
    });

    fetchResidents();

  } catch {
    toast.error("Failed to delete assistance.");
  }
};


  // --- DETAILS SUB-COMPONENT ---
  const ResidentDetails = ({ r }) => (
    <div className="bg-stone-50 border-y border-stone-200 p-6 shadow-inner">
      <div className="flex items-center gap-2 mb-6 border-b border-stone-200 pb-2">
         <FileText size={16} className="text-rose-700"/>
         <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide">Information Background</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          <div className="bg-white border border-stone-300 rounded-sm p-4">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">Personal Information</h4>
            <div className="grid grid-cols-2 gap-y-4 gap-x-2">
              <div>
                <p className="text-[10px] text-stone-500 uppercase">Civil Status</p>
                <p className="text-sm font-bold text-stone-800">{r.civil_status || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-500 uppercase">Religion</p>
                <p className="text-sm font-bold text-stone-800">{r.religion || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-500 uppercase">Contact</p>
                <p className="text-sm font-bold text-stone-800 flex items-center gap-2">
                   {r.contact_no || '-'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-500 uppercase">Precinct ID</p>
                <p className="text-sm font-bold text-stone-800 font-mono">{r.precinct_no || '-'}</p>
              </div>
            </div>
          </div>
          {r.assistances?.length > 0 && (
            <div className="bg-white border border-stone-300 rounded-sm p-4 mt-6">
              <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">
                Assistance Records
              </h4>

              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 text-left">
                    <th className="pb-2 font-normal">Type</th>
                    <th className="pb-2 font-normal">Processed</th>
                    <th className="pb-2 font-normal">Claimed</th>
                    <th className="pb-2 font-normal">Amount</th>
                    <th className="pb-2 font-normal">Office</th>
                    <th className="pb-2 font-normal text-right">Actions</th> {/* ADD THIS */}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {r.assistances.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 font-bold text-stone-700 uppercase">
                        {a.type_of_assistance}
                      </td>

                      <td className="py-2">{a.date_processed || "-"}</td>
                      <td className="py-2">{a.date_claimed || "-"}</td>

                      <td className="py-2">
                        {a.amount ? `₱${a.amount.toLocaleString()}` : "-"}
                      </td>

                      <td className="py-2">{a.implementing_office || "-"}</td>

                      {/* 🔥 ACTIONS COLUMN */}
                      <td className="py-2 text-right">
                        {userRole === "admin" && (
                        <div className="flex justify-end gap-2">

                          {/* EDIT */}
                          <button
                            onClick={() =>
                              setAssistanceModal({
                                isOpen: true,
                                resident: r,
                                assistance: a
                              })
                            }
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            <Edit size={14} />
                          </button>

                          {/* DELETE */}
                          <button
                            onClick={() => handleDeleteAssistance(a.id)}
                            className="text-red-600 hover:text-red-800"
                          >
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
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="bg-white border border-stone-300 rounded-sm p-4">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Registered Sector</h4>
            <div className="inline-block bg-stone-100 border border-stone-200 px-3 py-1.5 rounded-sm">
              <p className="text-sm font-bold text-stone-800">
                {formatSectors(r.sector_summary, r.other_sector_details)}
              </p>
            </div>
          </div>
          {(r.spouse_first_name || r.spouse_last_name) && (
              <div className="bg-white border border-stone-300 rounded-sm p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">
                      Legal Spouse
                    </h4>
                    <p className="text-sm font-bold text-stone-800 uppercase">
                      {r.spouse_last_name}, {r.spouse_first_name} {r.spouse_middle_name || ''}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setPromotionModal({ isOpen: true, memberId: "spouse", reason: "Deceased" })
                    }
                    className="text-[10px] font-bold text-rose-700 hover:underline border border-rose-200 bg-rose-50 px-2 py-1 rounded-sm"
                  >
                    ASSIGN AS HEAD
                  </button>
                </div>
              </div>
            )}

          <div className="bg-white border border-stone-300 rounded-sm p-4">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Household Composition</h4>
            {r.family_members?.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-stone-200 text-stone-500 text-left">
                        <th className="pb-2 font-normal">Name</th>
                        <th className="pb-2 font-normal">Relation</th>
                        <th className="pb-2 font-normal text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {r.family_members.filter(fm => fm.first_name).map((fm, i) => (
                    <tr key={i}>
                      <td className="py-2 font-bold text-stone-700 uppercase">
                        {fm.last_name}, {fm.first_name}
                      </td>
                      <td className="py-2 text-stone-500 italic">{fm.relationship}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPromotionModal({ isOpen: true, memberId: fm.id, reason: "Deceased" });
                          }}
                          className="text-[10px] text-rose-700 hover:text-rose-900 font-bold"
                        >
                          PROMOTE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-stone-400 italic">Single Occupant / No listed members.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="font-sans text-stone-800 animate-in fade-in duration-300">
      <Toaster position="top-right" toastOptions={{ style: { background: '#333', color: '#fff', borderRadius: '4px' } }} />

      {/* --- ASSISTANCE MODAL --- */}
      {assistanceModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setAssistanceModal({ isOpen: false, resident: null })}
          />

          <div className="relative bg-white w-[500px] rounded-sm border shadow-2xl p-6">

            <h3 className="text-sm font-bold uppercase mb-4">
              {assistanceModal.assistance ? "Edit Assistance" : "Add Assistance"} – {assistanceModal.resident?.last_name}
            </h3>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);

                const payload = {
                  type_of_assistance: formData.get("type"),
                  date_processed: formData.get("processed") || null,
                  date_claimed: formData.get("claimed") || null,
                  amount: formData.get("amount") || null,
                  implementing_office: formData.get("office") || null,
                };

                try {

                  if (assistanceModal.assistance) {
                    // ✏ EDIT MODE
                    await api.put(
                      `/assistances/${assistanceModal.assistance.id}`,
                      payload
                    );
                    toast.success("Assistance updated.");
                  } else {
                    // ➕ ADD MODE
                    await api.post(
                      `/residents/${assistanceModal.resident.id}/assistance`,
                      payload
                    );
                    toast.success("Assistance recorded.");
                  }

                  setAssistanceModal({
                    isOpen: false,
                    resident: null,
                    assistance: null
                  });

                  fetchResidents();

                } catch {
                  toast.error("Operation failed.");
                }
              }}
            >

              <select name="type" className="w-full border p-2 mb-3 text-sm" defaultValue={assistanceModal.assistance?.type_of_assistance}>
                <option>Burial Assistance</option>
                <option>Financial</option>
                <option>Educational</option>
                <option>Medical</option>
                <option>Gas Subsidy</option>
                <option>Food Assistance</option>
              </select>
              
              <label className="block text-sm mb-1">Date Processed</label>
              <input type="date" name="processed" className="w-full border p-2 mb-3 text-sm" defaultValue={assistanceModal.assistance?.date_processed} />

              <label className="block text-sm mb-1">Date Claimed</label>
              <input type="date" name="claimed" className="w-full border p-2 mb-3 text-sm" defaultValue={assistanceModal.assistance?.date_claimed} />

              <input type="number" name="amount" placeholder="Amount" className="w-full border p-2 mb-3 text-sm" defaultValue={assistanceModal.assistance?.amount} />
              <input type="text" name="office" placeholder="Implementing Office" className="w-full border p-2 mb-4 text-sm" defaultValue={assistanceModal.assistance?.implementing_office} />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssistanceModal({ isOpen: false, resident: null })}
                  className="px-4 py-2 border text-xs uppercase"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-700 text-white text-xs uppercase"
                >
                  Save
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}
      {deleteAssistanceModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">

          {/* BACKDROP */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteAssistanceModal({ isOpen: false, assistance: null })}
          />

          {/* MODAL */}
          <div className="relative bg-white w-[420px] rounded-sm border shadow-2xl overflow-hidden">

            {/* HEADER */}
            <div className="bg-red-700 text-white px-5 py-4 flex items-center gap-3">
              <Trash2 size={18} />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Delete Assistance Record
              </h3>
            </div>

            {/* BODY */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-stone-700">
                You are about to permanently remove this assistance record:
              </p>

              <p className="text-xs font-bold text-red-700 uppercase">
                {deleteAssistanceModal.assistance?.type_of_assistance}
              </p>

              <p className="text-xs text-stone-500">
                This action cannot be undone.
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() =>
                    setDeleteAssistanceModal({ isOpen: false, assistance: null })
                  }
                  className="px-4 py-2 border border-stone-300 text-xs font-bold uppercase rounded-sm hover:bg-stone-50"
                >
                  Cancel
                </button>

                <button
                  onClick={() =>
                    handleDeleteAssistance(deleteAssistanceModal.assistance.id)
                  }
                  className="px-4 py-2 bg-red-700 text-white text-xs font-bold uppercase rounded-sm hover:bg-red-800"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- MODALS --- */}
      {deleteModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false, residentId: null, name: '' })} />
          <div className="relative z-10 bg-white border border-stone-300 rounded-sm shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-red-700 px-6 py-4 flex items-center gap-3">
               <AlertCircle className="text-white" size={24} />
               <h3 className="text-lg font-bold text-white uppercase tracking-wide">Confirm Deletion</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                You are about to permanently remove the record for <span className="font-bold text-stone-900 uppercase">{deleteModal.name}</span>. 
                This action cannot be undone and will be logged in the system audit trail.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteModal({ isOpen: false, residentId: null, name: '' })} className="px-5 py-2 border border-stone-300 text-stone-700 text-sm font-bold uppercase hover:bg-stone-50 rounded-sm">
                  Cancel
                </button>
                <button onClick={confirmDelete} className="px-5 py-2 bg-red-700 text-white text-sm font-bold uppercase hover:bg-red-800 rounded-sm flex items-center gap-2" disabled={isDeleting}>
                  {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Delete Record"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {promotionModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-sm" onClick={() => setPromotionModal({ isOpen: false, memberId: null, reason: "Deceased" })} />
          <div className="relative z-10 bg-white border border-stone-300 rounded-sm shadow-2xl w-96">
            <div className="bg-stone-800 text-white px-4 py-3 border-b border-stone-700">
                <h3 className="font-bold text-sm uppercase">Update Household Head</h3>
            </div>
            <div className="p-5">
                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Reason for Replacement</label>
                <select
                  className="w-full border border-stone-300 bg-stone-50 p-2 text-sm outline-none focus:border-rose-500 mb-6 rounded-sm"
                  value={promotionModal.reason}
                  onChange={(e) => setPromotionModal({ ...promotionModal, reason: e.target.value })}
                >
                  <option value="Deceased">Principal Deceased</option>
                  <option value="Transferred">Transferred Residence</option>
                  <option value="Inactive">Status Inactive</option>
                </select>

                <div className="flex gap-2">
                  <button onClick={() => handlePromote(promotionModal.memberId, promotionModal.reason)} className="flex-1 bg-rose-700 hover:bg-rose-800 text-white py-2 rounded-sm text-xs font-bold uppercase tracking-wider">
                    Confirm Update
                  </button>
                  <button onClick={() => setPromotionModal({ isOpen: false, memberId: null, reason: "Deceased" })} className="flex-1 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 py-2 rounded-sm text-xs font-bold uppercase">
                    Cancel
                  </button>
                </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- HEADER --- */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <div className="flex items-center gap-2 text-rose-700 mb-1">
              <Users size={20} />
              <span className="text-xs font-bold uppercase tracking-widest">Municipality of San Felipe</span>
           </div>
           <h1 className="text-2xl font-black text-stone-900 uppercase tracking-tight">Registered Residents Database</h1>
        </div>
        <div className="flex items-center gap-2">
           <ImportButton onSuccess={handleImportSuccess} className="bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 rounded-sm" />
           <ExportButton barangay={selectedBarangay} className="bg-stone-800 text-white hover:bg-stone-900 rounded-sm" />
        </div>
      </div>

      {/* --- TOOLBAR --- */}
      <div className="bg-stone-100 border border-stone-300 border-b-0 rounded-t-sm p-3 flex flex-col lg:flex-row gap-3 items-center justify-between">
         <div className="flex flex-1 gap-3 w-full">
            {/* Search */}
            <div className="relative flex-1 max-w-md group">
               <div className="absolute left-3 top-2.5 text-stone-400 group-focus-within:text-rose-700">
                  <Search size={16} />
               </div>
               <input 
                  type="text" 
                  placeholder="SEARCH DATABASE (NAME/ID)..." 
                  value={searchTerm} 
                  onChange={handleSearchChange} 
                  className="w-full pl-9 pr-8 py-2 bg-white border border-stone-300 rounded-sm text-xs font-bold placeholder:font-normal focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600 uppercase"
               />
               {searchTerm && (
                 <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} className="absolute right-2 top-2.5 text-stone-400 hover:text-rose-600">
                   <X size={14} />
                 </button>
               )}
            </div>

            {/* Sector Filter */}
            <div className="relative w-48 hidden md:block">
               <select
                 value={selectedSector}
                 onChange={handleSectorFilter}
                 className="w-full appearance-none pl-3 pr-8 py-2 bg-white border border-stone-300 rounded-sm text-xs font-bold text-stone-700 outline-none focus:border-rose-600 uppercase"
               >
                 <option value="">ALL SECTORS</option>
                 <option value="Fisherman/Banca Owner">FISHERFOLK</option>
                 <option value="Senior Citizen">SENIOR CITIZEN</option>
                 <option value="PWD">PWD</option>
                 <option value="OFW">OFW</option>
                 <option value="Student">STUDENT</option>
                 <option value="SOLO PARENT">SOLO PARENT</option>
                 <option value="Indigenous People">INDIGENOUS PEOPLE</option>
                 <option value="LGU Employee">GOV EMPLOYEE</option>
                 <option value="OTHERS">OTHERS</option>
               </select>
               <ChevronDown className="absolute right-2 top-2.5 text-stone-400 pointer-events-none" size={14} />
            </div>

            {/* Admin Filter */}
            {userRole === 'admin' && (
              <div className="relative w-48 hidden md:block">
                 <select value={selectedBarangay} onChange={handleBarangayFilter} className="w-full appearance-none pl-3 pr-8 py-2 bg-white border border-stone-300 rounded-sm text-xs font-bold text-stone-700 outline-none focus:border-rose-600 uppercase">
                   <option value="">ALL BARANGAYS</option>
                   {barangayList.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                 </select>
                 <Filter className="absolute right-2 top-2.5 text-stone-400 pointer-events-none" size={14} />
              </div>
            )}
         </div>

         {/* Pagination Controls (Top) */}
         <div className="flex items-center gap-2 text-xs font-bold text-stone-600 bg-white px-3 py-1.5 border border-stone-300 rounded-sm">
             <span>SHOWING:</span>
             <select value={itemsPerPage} onChange={handleLimitChange} className="bg-transparent outline-none border-b border-stone-300 text-rose-700 cursor-pointer">
               <option value={10}>10</option>
               <option value={20}>20</option>
               <option value={50}>50</option>
             </select>
         </div>
      </div>

      {/* --- TABLE --- */}
      <div className="bg-white border border-stone-300 border-t-0 shadow-sm overflow-x-auto min-h-[500px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-200 border-b-2 border-stone-300 text-[11px] uppercase font-black text-stone-600 tracking-wider">
              <th className="py-3 px-4 w-10 text-center border-r border-stone-300">#</th>
              <th className="py-3 px-4 border-r border-stone-300 w-1/4">Resident Identity</th>
              <th className="py-3 px-4 border-r border-stone-300">Birthdate</th>
              <th className="py-3 px-4 border-r border-stone-300">Residency</th>
              <th className="py-3 px-4 border-r border-stone-300">Class/Sector</th>
              <th className="py-3 px-4 text-center">Admin</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
               <tr>
                 <td colSpan="6" className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <Loader2 className="animate-spin text-rose-700" size={32}/>
                       <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Accessing Database...</span>
                    </div>
                 </td>
               </tr>
            ) : residents.length === 0 ? (
               <tr><td colSpan="6" className="py-12 text-center text-stone-400 font-bold uppercase italic">No records found matching criteria.</td></tr>
            ) : (
              residents.map((r) => (
                <Fragment key={r.id}>
                  <tr 
                    onClick={() => toggleRow(r.id)}
                    className={`
                      border-b border-stone-200 cursor-pointer transition-colors group
                      ${expandedRow === r.id ? 'bg-stone-100' : 'hover:bg-rose-50/30'}
                    `}
                  >
                    <td className="py-3 px-4 text-center border-r border-stone-200">
                       {expandedRow === r.id ? <ChevronUp size={16} className="text-rose-700"/> : <ChevronDown size={16} className="text-stone-400 group-hover:text-rose-700"/>}
                    </td>

                    {/* IDENTITY */}
                    <td className="py-3 px-4 border-r border-stone-200">
                       <div className="flex flex-col">
                          <span className="font-bold text-stone-800 uppercase text-[13px]">{[
                            r.last_name,
                            r.first_name,
                            r.middle_name
                          ].filter(Boolean).join(", ")} {r.ext_name || ""}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                             <span className="text-[10px] bg-stone-100 border border-stone-200 px-1 rounded text-stone-500 font-mono">{r.sex}</span>
                             <span className="text-[10px] text-rose-700 font-bold uppercase">{r.occupation || "N/A"}</span>
                          </div>
                       </div>
                    </td>

                    {/* BIRTH INFO */}
                    <td className="py-3 px-4 border-r border-stone-200 font-mono text-xs text-stone-600">
                       {formatDate(r.birthdate)}
                       <span className="ml-2 text-stone-400">({calculateAge(r.birthdate)}y)</span>
                    </td>

                    {/* ADDRESS */}
                    <td className="py-3 px-4 border-r border-stone-200 text-xs">
                       <span className="block font-bold text-stone-700 uppercase">{r.barangay}</span>
                       <span className="block text-stone-500">Purok {r.purok} {r.house_no ? `#${r.house_no}` : ''}</span>
                    </td>

                    {/* SECTOR */}
                    <td className="py-3 px-4 border-r border-stone-200">
                       <span className="inline-block border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-bold text-stone-600 uppercase tracking-tight truncate max-w-[150px]">
                          {formatSectors(r.sector_summary, r.other_sector_details)}
                       </span>
                    </td>

                    {/* ACTIONS */}
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                       <div className="flex items-center justify-center gap-1">
                          <button onClick={() => onEdit(r)} className="p-1.5 text-stone-500 hover:text-white hover:bg-stone-700 rounded-sm transition-all" title="Edit Residents">
                             <Edit size={14} />
                          </button>
                          {userRole === "admin" && (
                            <button
                              onClick={() => setAssistanceModal({ isOpen: true, resident: r })}
                              className="p-1.5 text-stone-500 hover:text-white hover:bg-indigo-700 rounded-sm transition-all"
                              title="Add Assistance"
                            >
                              <FileText size={14} />
                            </button>
                          )}
                          {userRole === "admin" && (
                          <button
                            onClick={() => navigate(`/dashboard/residents/${r.resident_code}/qr`)}
                            className="p-1.5 text-stone-500 hover:text-white hover:bg-emerald-700 rounded-sm transition-all"
                            title="Generate QR"
                          >
                            <QrCode size={14} />
                          </button>
                        )}
                          {userRole === "admin" && (
                            <>
                              {/* ARCHIVE */}
                              <button
                                onClick={() => handleArchive(r.id)}
                                className="text-amber-600 hover:text-amber-800" title="Archive Residents"
                              >
                                <Archive size={14} />
                              </button>
                            </>
                          )}
                       </div>
                    </td>
                  </tr>
                  {expandedRow === r.id && (
                    <tr>
                      <td colSpan="6" className="p-0 border-b border-stone-300">
                        <ResidentDetails r={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- PAGINATION FOOTER --- */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
         <p className="text-xs text-stone-500 font-medium">
            Total Registry Count: <span className="font-bold text-stone-900">{totalItems}</span>
         </p>
         
         <div className="flex items-center bg-white border border-stone-300 rounded-sm shadow-sm">
            <button 
               disabled={currentPage === 1} 
               onClick={() => setCurrentPage(prev => prev - 1)}
               className="px-3 py-2 border-r border-stone-300 text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-white"
            >
               <ChevronLeft size={16} />
            </button>
            <div className="px-4 py-2 text-xs font-bold text-stone-700">
               PAGE {currentPage} OF {totalPages || 1}
            </div>
            <button 
               disabled={currentPage === totalPages} 
               onClick={() => setCurrentPage(prev => prev + 1)}
               className="px-3 py-2 border-l border-stone-300 text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-white"
            >
               <ChevronRight size={16} />
            </button>
         </div>
      </div>
    </div>
  );
}