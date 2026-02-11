import { useEffect, useState, Fragment, useMemo } from 'react';
import api from '../api';
import { 
  Trash2, Edit, Search, ChevronDown, ChevronUp, 
  Loader2, Filter, Phone, Fingerprint, Heart, User, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight 
} from 'lucide-react';
import ExportButton from './ExportButton';
import toast, { Toaster } from 'react-hot-toast';

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

  const ResidentDetails = ({ r }) => (
    <div className="p-5 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-stone-50/50 border-t border-stone-100 animate-in slide-in-from-top-2 duration-300">
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
          <div className="space-y-3 pt-4 border-t border-stone-100">
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

      <div className="space-y-4">
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
  );

  return (
    /* We add "relative" and "mt-0" to ensure the modal stays inside this content box and matches the top */
    <div className="relative mt-0 space-y-4 animate-in fade-in duration-500">
      <Toaster position="top-center" />

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteModal.isOpen && (
        /* Changed "fixed" to "absolute" so it stays within the ResidentList boundaries and doesn't cover the sidebar */
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-stone-900">Delete Record?</h3>
            <p className="text-sm text-stone-500 mt-2">
              Are you sure you want to delete <span className="font-bold text-stone-800">{deleteModal.name}</span>? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteModal({ isOpen: false, residentId: null, name: '' })}
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
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900">Resident Database</h2>
            <p className="text-xs text-stone-500">Manage community records.</p>
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
          /* Loader also changed to absolute to stay inside the table container */
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
                          {r.sector_summary || "None"}
                        </span>
                      </td>
                      <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center gap-2">
                          <button onClick={() => onEdit(r)} className="p-2 text-stone-400 hover:text-rose-600 transition-colors"><Edit size={16}/></button>
                          <button onClick={() => setDeleteModal({ isOpen: true, residentId: r.id, name: `${r.first_name} ${r.last_name}` })} className="p-2 text-stone-400 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
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

      {/* Pagination Footer */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-white border border-stone-100 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 text-xs text-stone-500 order-2 md:order-1">
          <span>Rows per page:</span>
          <div className="relative">
            <select 
              value={itemsPerPage}
              onChange={handleLimitChange}
              className="appearance-none bg-stone-50 border border-stone-200 rounded-lg py-1.5 pl-3 pr-8 font-semibold text-stone-700 outline-none focus:ring-2 focus:ring-rose-500/20"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-2.5 text-stone-400 pointer-events-none"/>
          </div>
          <span className="hidden md:inline border-l border-stone-200 pl-3 ml-1">
            Total {totalItems}
          </span>
        </div>

        <div className="flex items-center gap-1 order-1 md:order-2">
          <button 
            disabled={currentPage === 1 || loading}
            onClick={() => setCurrentPage(1)}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-50 disabled:opacity-30 transition-all"
            title="First Page"
          >
            <ChevronsLeft size={16} />
          </button>
          
          <button 
            disabled={currentPage === 1 || loading}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-50 disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1 px-2">
            {paginationRange?.map((pageNumber, idx) => {
              if (pageNumber === '...') {
                return <span key={idx} className="text-stone-400 px-2 text-xs">...</span>;
              }
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`min-w-[32px] h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${pageNumber === currentPage ? 'bg-rose-500 text-white shadow-md' : 'text-stone-600 hover:bg-stone-100'}`}
                >
                  {pageNumber}
                </button>
              );
            })}
          </div>

          <button 
            disabled={currentPage === totalPages || loading}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-50 disabled:opacity-30 transition-all"
          >
            <ChevronRight size={16} />
          </button>

          <button 
            disabled={currentPage === totalPages || loading}
            onClick={() => setCurrentPage(totalPages)}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-50 disabled:opacity-30 transition-all"
            title="Last Page"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}