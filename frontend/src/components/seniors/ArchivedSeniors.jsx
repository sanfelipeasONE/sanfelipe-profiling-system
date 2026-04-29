import { useEffect, useState, Fragment } from 'react';
import api from '../../api/api';
import {
  Search, ChevronDown, ChevronUp,
  Loader2, Filter, Users,
  ChevronLeft, ChevronRight, X, Trash2, RotateCcw, ShieldAlert, ArchiveRestore
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { createPortal } from "react-dom";

export default function ArchivedSeniors({ userRole }) {
  const [seniors, setSeniors] = useState([]);
  const [barangayList, setBarangayList] = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, name: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const fetchArchivedSeniors = async (search = searchTerm, barangay = selectedBarangay, page = currentPage, limit = itemsPerPage) => {
    setLoading(true);
    const skip = (page - 1) * limit;
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (barangay) params.append("barangay", barangay);
      params.append('skip', skip);
      params.append('limit', limit);

      const response = await api.get(`/osca/seniors/archived?${params.toString()}`);
      if (response.data.items) {
        setSeniors(response.data.items);
        setTotalItems(response.data.total || 0);
      } else {
        setSeniors([]);
        setTotalItems(0);
      }
    } catch (error) {
      toast.error("Unable to retrieve archived records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await api.get("/barangays/");
        setBarangayList(Array.isArray(res.data) ? res.data : []);
      } catch (err) {}
    };
    fetchBarangays();
  }, []);

  useEffect(() => {
    fetchArchivedSeniors();
  }, [currentPage, itemsPerPage, selectedBarangay, searchTerm]);

  const handleRestore = async (id) => {
    try {
      await api.put(`/osca/seniors/${id}/restore`);
      toast.success("Senior record restored successfully.");
      fetchArchivedSeniors();
    } catch (err) {
      toast.error("Failed to restore record.");
    }
  };

  const confirmDelete = async () => {
    setIsProcessing(true);
    try {
      await api.delete(`/osca/seniors/${deleteModal.id}/permanent`);
      toast.success("Record permanently deleted.");
      setDeleteModal({ isOpen: false, id: null, name: '' });
      fetchArchivedSeniors();
    } catch (err) {
      toast.error("Failed to delete record.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="font-sans text-stone-900 animate-in fade-in duration-300 px-2 sm:px-4 md:px-0 pb-12">
      {createPortal(<Toaster position="top-right" toastOptions={{ style: { background: '#1c1917', color: '#fff', borderRadius: '12px', fontSize: '14px' } }} />, document.body)}

      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <div className="flex items-center gap-2 text-red-700 mb-2">
              <div className="p-1.5 md:p-2 bg-red-50 rounded-lg border border-red-100 shadow-sm"><ArchiveRestore size={16} strokeWidth={2} /></div>
              <span className="text-[10px] md:text-xs font-medium tracking-widest uppercase">OSCA Recycle Bin</span>
           </div>
           <h1 className="text-2xl md:text-3xl font-medium text-stone-900 tracking-tight">Archived Seniors</h1>
        </div>
      </div>

      <div className="bg-white border border-stone-300 shadow-sm min-h-[400px] md:min-h-[500px] rounded-2xl overflow-hidden relative">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-red-50/50 text-stone-600 text-[10px] md:text-[11px] uppercase font-medium tracking-widest border-b-2 border-red-700/10">
                <th className="py-3 md:py-4 px-3 md:px-5">IDENTITY</th>
                <th className="py-3 md:py-4 px-3 md:px-5">OSCA DETAILS</th>
                <th className="py-3 md:py-4 px-3 md:px-5">LOCATION</th>
                <th className="py-3 md:py-4 px-3 md:px-5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="text-[13px] md:text-sm">
              {loading ? (
                 <tr>
                   <td colSpan="4" className="py-24 text-center"><Loader2 className="animate-spin text-red-700 mx-auto" size={32} /></td>
                 </tr>
              ) : seniors.length === 0 ? (
                 <tr>
                   <td colSpan="4" className="py-16 text-center text-stone-500 font-medium">Archive is empty.</td>
                 </tr>
              ) : (
                seniors.map((r) => (
                  <tr key={r.id} className="border-b border-stone-200 hover:bg-stone-50 transition-colors">
                    <td className="py-3 md:py-4 px-3 md:px-5 align-middle">
                      <span className="font-medium text-stone-400 line-through tracking-tight uppercase">
                        {r.last_name}, {r.first_name} {r.middle_name || ''} {r.ext_name || ''}
                      </span>
                    </td>
                    <td className="py-3 md:py-4 px-3 md:px-5 align-middle font-mono text-stone-400 line-through">
                      {r.osca_control_no}
                    </td>
                    <td className="py-3 md:py-4 px-3 md:px-5 align-middle text-stone-400">
                      {r.barangay}
                    </td>
                    <td className="py-3 md:py-4 px-3 md:px-5 text-right align-middle">
                      <div className="flex items-center justify-end gap-1.5 md:gap-2">
                        <button onClick={() => handleRestore(r.id)} className="p-2 bg-stone-100 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-all shadow-sm border border-stone-200" title="Restore Record">
                            <RotateCcw size={14} strokeWidth={2} />
                        </button>
                        <button onClick={() => setDeleteModal({ isOpen: true, id: r.id, name: `${r.first_name} ${r.last_name}` })} className="p-2 bg-stone-100 text-red-700 hover:bg-red-700 hover:text-white rounded-lg transition-all shadow-sm border border-stone-200" title="Permanently Delete">
                            <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false })} />
          <div className="relative bg-white w-full max-w-[420px] rounded-2xl shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-100 text-red-700 rounded-full flex items-center justify-center mb-5 border-4 border-red-50">
              <ShieldAlert size={28} />
            </div>
            <h3 className="text-lg md:text-xl font-medium text-stone-900 mb-2">Confirm Permanent Deletion</h3>
            <p className="text-sm text-stone-600 mb-6">You are about to permanently remove {deleteModal.name}. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ isOpen: false })} className="flex-1 px-4 py-3 border-2 border-stone-200 text-stone-600 rounded-xl hover:bg-stone-50">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-3 bg-red-700 text-white rounded-xl hover:bg-red-800 flex items-center justify-center transition-colors" disabled={isProcessing}>
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}