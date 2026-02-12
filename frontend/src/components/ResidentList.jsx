import { useEffect, useState, Fragment, useMemo } from 'react';
import api from '../api';
import {
  Trash2, Edit, Search, ChevronDown, ChevronUp,
  Loader2, Filter, Phone, Fingerprint, Heart, User,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Briefcase
} from 'lucide-react';
import ExportButton from './ExportButton';
import toast, { Toaster } from 'react-hot-toast';
import { createPortal } from "react-dom";


export default function ResidentList({ userRole, onEdit }) {
  const [residents, setResidents] = useState([]);
  const [barangayList, setBarangayList] = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, residentId: null, name: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // --- HELPER: REPLACE "OTHERS" WITH SPECIFIC TEXT ---
  const formatSectors = (summary, details) => {
    if (!summary) return "None";
    // Check if "Others" exists and we have specific details to show
    if (summary.includes("Others") && details) {
      // Replace the word "Others" with the specific detail (e.g., "Student")
      return summary.replace("Others", details);
    }
    // Check capitalization mismatch just in case (e.g. "OTHERS")
    if (summary.toUpperCase().includes("OTHERS") && details) {
      // Regex to replace "Others" case-insensitively
      return summary.replace(/Others/i, details);
    }
    return summary;
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const paginationRange = useMemo(() => {
    const siblingCount = 1;
    const totalPageNumbers = siblingCount + 5;

    if (totalPages <= totalPageNumbers) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

    const firstPageIndex = 1;
    const lastPageIndex = totalPages;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = Array.from({ length: leftItemCount }, (_, idx) => idx + 1);
      return [...leftRange, '...', totalPages];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = Array.from({ length: rightItemCount }, (_, idx) => totalPages - rightItemCount + idx + 1);
      return [firstPageIndex, '...', ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = Array.from({ length: rightSiblingIndex - leftSiblingIndex + 1 }, (_, idx) => leftSiblingIndex + idx);
      return [firstPageIndex, '...', ...middleRange, '...', lastPageIndex];
    }
  }, [totalItems, itemsPerPage, currentPage, totalPages]);

  const fetchResidents = async (search = searchTerm, barangay = selectedBarangay, page = currentPage, limit = itemsPerPage) => {
    setLoading(true);
    const skip = (page - 1) * limit;
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (userRole === 'admin' && barangay) params.append('barangay', barangay);
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
      toast.error("Failed to load residents.");
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
  }, [userRole, currentPage, itemsPerPage, selectedBarangay, searchTerm]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleBarangayFilter = (e) => {
    setSelectedBarangay(e.target.value);
    setCurrentPage(1);
  };

  const handleLimitChange = (e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/residents/${deleteModal.residentId}`);
      toast.success('Resident removed');
      setDeleteModal({ isOpen: false, residentId: null, name: '' });
      fetchResidents();
    } catch (err) {
      toast.error('Error deleting record.');
    } finally {
      setIsDeleting(false);
    }
  };

  // --- DETAILS COMPONENT ---
  const ResidentDetails = ({ r }) => (
    <div className="p-5 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-stone-50/50 border-t border-stone-100 animate-in slide-in-from-top-2 duration-300">

      {/* LEFT COLUMN: Personal & Spouse */}
      <div className="space-y-6">
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
            <User size={14} /> Personal Details
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-stone-400 uppercase font-bold">Civil Status</p>
              <p className="text-sm font-semibold text-stone-700">{r.civil_status || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] text-stone-400 uppercase font-bold">Religion</p>
              <p className="text-sm font-semibold text-stone-700">{r.religion || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] text-stone-400 uppercase font-bold">Contact No.</p>
              <p className="text-sm font-semibold text-stone-700 flex items-center gap-1.5">
                <Phone size={12} /> {r.contact_no || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-stone-400 uppercase font-bold">Precinct No.</p>
              <p className="text-sm font-semibold text-stone-700 flex items-center gap-1.5">
                <Fingerprint size={12} /> {r.precinct_no || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {(r.spouse_first_name || r.spouse_last_name) && (
          <div className="space-y-3 pt-4 border-t border-stone-200">
            <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
              <Heart size={14} className="text-rose-400 fill-rose-400" /> Spouse / Partner
            </h4>
            <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm">
              <p className="text-sm font-bold text-stone-800">
                {r.spouse_last_name}, {r.spouse_first_name} {r.spouse_middle_name || ''} {r.spouse_ext_name || ''}
              </p>
              <p className="text-[10px] text-stone-400 font-medium uppercase mt-0.5">Legal Spouse / Partner</p>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Sectors & Family */}
      <div className="space-y-6">
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
            <Briefcase size={14} /> Sector Affiliation
          </h4>
          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm space-y-2">
            <p className="text-sm font-bold text-stone-800">
              {/* USE HELPER HERE */}
              {formatSectors(r.sector_summary, r.other_sector_details)}
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-stone-200">
          <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
            <User size={14} /> Family Members
          </h4>
          {r.family_members?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {r.family_members.map((fm, i) => (
                <div key={i} className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg shadow-sm text-xs">
                  <span className="font-bold text-stone-800">{fm.first_name} {fm.last_name}</span>
                  <span className="ml-2 text-stone-400 italic">({fm.relationship})</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-400 italic">No additional family members recorded.</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative mt-0 space-y-4 animate-in fade-in duration-500">
      <Toaster position="top-center" />

      {deleteModal.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">

            {/* FULL SCREEN BLUR */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
              onClick={() =>
                setDeleteModal({ isOpen: false, residentId: null, name: '' })
              }
            />

            {/* MODAL CARD */}
            <div className="relative z-10 bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">

              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                <Trash2 size={24} />
              </div>

              <h3 className="text-lg font-bold text-stone-900">
                Delete Record?
              </h3>

              <p className="text-sm text-stone-500 mt-2">
                Are you sure you want to delete{" "}
                <span className="font-bold text-stone-800">
                  {deleteModal.name}
                </span>
                ? This action cannot be undone.
              </p>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() =>
                    setDeleteModal({ isOpen: false, residentId: null, name: '' })
                  }
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-semibold hover:bg-stone-50 transition-colors"
                  disabled={isDeleting}
                >
                  Cancel
                </button>

                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }


      {/* Database Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900">San Felipe Resident Database</h2>
          </div>
          <ExportButton barangay={selectedBarangay} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative group">
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm"
            />
            <Search className="absolute left-3 top-3.5 text-stone-400 group-focus-within:text-rose-500" size={18} />
          </div>

          {userRole === 'admin' && (
            <div className="relative">
              <select
                value={selectedBarangay}
                onChange={handleBarangayFilter}
                className="w-full appearance-none pl-10 pr-10 py-3 bg-stone-50 border border-stone-100 rounded-xl outline-none text-sm focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="">All Barangays</option>
                {barangayList.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
              <Filter className="absolute left-3 top-3.5 text-stone-400" size={16} />
              <ChevronDown className="absolute right-3 top-3.5 text-stone-400" size={14} />
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-50 flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-rose-600 mb-2" size={32} />
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Syncing Records...</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/50 border-b border-stone-100 text-[10px] uppercase font-black text-stone-400 tracking-widest">
                <th className="py-4 px-6 w-12"></th>
                <th className="py-4 px-6">Resident Info</th>
                <th className="py-4 px-6">Address</th>
                <th className="py-4 px-6">Sectors</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {residents.length === 0 && !loading ? (
                <tr><td colSpan="5" className="py-20 text-center text-stone-400 italic">No records found.</td></tr>
              ) : (
                residents.map((r) => (
                  <Fragment key={r.id}>
                    <tr
                      className={`hover:bg-stone-50/40 transition-colors cursor-pointer ${expandedRow === r.id ? 'bg-rose-50/20' : ''}`}
                      onClick={() => toggleRow(r.id)}
                    >
                      <td className="py-4 px-6 text-stone-300">
                        {expandedRow === r.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm font-bold text-stone-800">{r.last_name}, {r.first_name} {r.ext_name}</p>
                        <p className="text-sm font-bold text-rose-500 uppercase">{r.occupation || "N/A"}</p>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm text-stone-600">{r.purok}, {r.barangay}</p>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-[10px] px-2 py-1 rounded-full bg-stone-100 font-bold text-stone-500 uppercase">
                          {/* APPLY HELPER HERE (Main Table Row) */}
                          {formatSectors(r.sector_summary, r.other_sector_details)}
                        </span>
                      </td>
                      <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center gap-2">
                          <button onClick={() => onEdit(r)} className="p-2 text-stone-400 hover:text-rose-600 transition-colors"><Edit size={16} /></button>
                          <button onClick={() => setDeleteModal({ isOpen: true, residentId: r.id, name: `${r.first_name} ${r.last_name}` })} className="p-2 text-stone-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === r.id && (
                      <tr>
                        <td colSpan="5" className="p-0 border-b border-stone-100">
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
      </div>

      {/* Modern Pagination Footer */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-3 bg-white/80 backdrop-blur-md border border-stone-200/60 rounded-3xl shadow-sm">
        
        {/* LEFT SIDE — Metadata & Page Size */}
        <div className="flex items-center gap-4 order-2 md:order-1">
          <div className="flex items-center gap-2 bg-stone-100/50 px-3 py-1.5 rounded-2xl border border-stone-200/40">
            <span className="text-[11px] uppercase tracking-wider font-bold text-stone-400">Rows</span>
            <div className="relative flex items-center">
              <select
                value={itemsPerPage}
                onChange={handleLimitChange}
                className="appearance-none bg-transparent pr-5 text-sm font-bold text-stone-700 outline-none cursor-pointer focus:text-rose-600 transition-colors"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <ChevronDown
                size={12}
                className="absolute right-0 top-1 text-stone-400 pointer-events-none"
              />
            </div>
          </div>
          
          <div className="h-4 w-[1px] bg-stone-200 hidden md:block" />
          
          <span className="text-xs font-medium text-stone-500">
            <span className="text-stone-900 font-bold">{totalItems}</span> total results
          </span>
        </div>

        {/* RIGHT SIDE — Controls */}
        <div className="flex items-center gap-3 order-1 md:order-2">
          
          {/* Page Counter for Mobile/Tablet */}
          <span className="text-xs font-bold text-stone-400 md:mr-2">
            {currentPage} <span className="mx-1 text-stone-300">/</span> {totalPages || 1}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Previous Button */}
            <button
              disabled={currentPage === 1 || loading}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="w-10 h-10 flex items-center justify-center rounded-2xl border border-stone-200 text-stone-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:border-stone-200 transition-all duration-200 active:scale-95"
            >
              <ChevronLeft size={20} />
            </button>

            {/* Page Numbers - Hidden on small mobile to keep it clean */}
            <div className="hidden sm:flex items-center gap-1.5">
              {paginationRange?.map((pageNumber, idx) => {
                if (pageNumber === "...") {
                  return (
                    <span key={idx} className="w-8 text-center text-stone-300 font-black">
                      ···
                    </span>
                  );
                }

                const isActive = pageNumber === currentPage;

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`w-10 h-10 flex items-center justify-center rounded-2xl text-sm font-bold transition-all duration-200 active:scale-95 ${
                      isActive
                        ? "bg-stone-900 text-white shadow-lg shadow-stone-200 scale-105"
                        : "text-stone-500 hover:bg-stone-100 border border-transparent hover:border-stone-200"
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>

            {/* Next Button */}
            <button
              disabled={currentPage === totalPages || loading}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="w-10 h-10 flex items-center justify-center rounded-2xl border border-stone-200 text-stone-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-20 transition-all duration-200 active:scale-95"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}