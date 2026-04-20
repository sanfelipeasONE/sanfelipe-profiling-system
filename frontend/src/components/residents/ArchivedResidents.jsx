import { useEffect, useState } from 'react';
import api from '../../api/api';
import toast, { Toaster } from 'react-hot-toast';
import { RotateCcw, Archive, Loader2, FileX, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function ArchivedResidents() {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; 
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, resident: null });
  const [deletingId, setDeletingId] = useState(null);
  const cleanArchivedName = (name) => (name || "").replace(/_ARC\d+/g, "").trim();

  const fetchArchived = async () => {
    try {
      const res = await api.get('/residents/archived');
      setResidents(res.data); 
    } catch (err) {
      toast.error("System Error: Could not retrieve archival records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchived();
  }, []);

  const handleRestore = async (id) => {
    setRestoringId(id);
    try {
      await api.put(`/residents/${id}/restore`);
      toast.success("Record restored to active registry.");
      setResidents(prev => prev.filter(r => r.id !== id));
      if (currentData.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
    } catch (err) {
      toast.error("Action Failed: Database update error.");
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/residents/${id}/permanent`);
      toast.success("Record permanently deleted.");
      setResidents(prev => prev.filter(r => r.id !== id));
      setDeleteModal({ isOpen: false, resident: null });
    } catch (err) {
      toast.error("Permanent deletion failed.");
    } finally {
      setDeletingId(null);
    }
  };

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(residents.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentData = residents.slice(indexOfFirstItem, indexOfLastItem);

  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 size={40} className="animate-spin text-red-500" strokeWidth={2} />
        <span className="text-xs font-normal uppercase tracking-widest text-slate-400">Retrieving Archival Data...</span>
      </div>
    );
  }

  return (
    <div className="font-sans text-slate-800 animate-in fade-in duration-300">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', borderRadius: '12px', fontSize: '14px' } }} />
      
      {/* --- DELETE MODAL --- */}
      {deleteModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false, resident: null })} />
          <div className="relative z-10 bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
              <FileX size={24} strokeWidth={2} />
            </div>
            <h3 className="text-lg font-medium text-slate-800 tracking-tight">Permanent Deletion</h3>
            <p className="text-sm text-slate-500 mt-2 mb-6 leading-relaxed font-normal">
              You are about to permanently delete the archived record of <span className="font-medium text-slate-700 uppercase">
                {cleanArchivedName(deleteModal.resident?.last_name)}, {cleanArchivedName(deleteModal.resident?.first_name)}
              </span>. This action cannot be undone and will permanently remove all related records.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ isOpen: false, resident: null })} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-normal rounded-xl hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => handlePermanentDelete(deleteModal.resident.id)} disabled={deletingId === deleteModal.resident.id} className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-normal rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                {deletingId === deleteModal.resident.id ? <Loader2 size={16} className="animate-spin" /> : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- ADMINISTRATIVE HEADER --- */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <div className="p-1.5 bg-red-50 rounded-lg border border-red-100/50"><Archive size={16} strokeWidth={2} /></div>
            <span className="text-xs font-normal tracking-widest uppercase">Archival Database</span>
          </div>
          <h1 className="text-3xl font-medium text-slate-800 tracking-tight">Archived Residents</h1>
        </div>
        
        {/* Stat Counter */}
        <div className="bg-white border border-slate-200 px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-3">
          <span className="text-[11px] font-normal text-slate-400 uppercase tracking-wider">Total Inactive</span>
          <span className="text-xl font-medium text-red-600">{residents.length}</span>
        </div>
      </div>

      {/* --- DATA TABLE CONTAINER --- */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex flex-col">
        
        {/* Table Toolbar */}
        <div className="bg-red-50/50 border-b border-red-100/50 px-5 py-3.5 flex items-center justify-between">
           <div className="flex items-center gap-2.5 text-red-500">
             <ShieldAlert size={16} strokeWidth={2} />
             <span className="text-xs font-normal uppercase tracking-wider">Restricted Access • Archival View</span>
           </div>
        </div>

        {residents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-slate-50/50">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-300 mb-4 border border-slate-200 shadow-sm">
              <FileX size={28} strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-medium text-slate-700 tracking-tight">No Records Found</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-xs font-normal">The archival database is currently empty.</p>
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-[11px] font-normal text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4 w-32">Reference ID</th>
                  <th className="px-6 py-4">Resident Name</th>
                  <th className="px-6 py-4">Barangay</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {currentData.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-6 py-4 font-mono text-slate-400 text-xs font-normal">
                      RES-{String(r.id).padStart(4, '0')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-700 uppercase">
                        {cleanArchivedName(r.last_name)}, {cleanArchivedName(r.first_name)} {r.middle_name || ''}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-normal tracking-tight border bg-slate-100 text-slate-500 border-slate-200/50">
                        {r.barangay}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-normal bg-red-50 text-red-600 border border-red-100/50 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                        Archived
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleRestore(r.id)}
                          disabled={restoringId === r.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-normal text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 rounded-lg transition-all disabled:opacity-50"
                          title="Restore Record"
                        >
                          {restoringId === r.id ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <RotateCcw size={14} strokeWidth={2} />}
                          Restore
                        </button>

                        <button
                          onClick={() => setDeleteModal({ isOpen: true, resident: r })}
                          disabled={deletingId === r.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-normal text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-all disabled:opacity-50"
                          title="Permanent Delete"
                        >
                          {deletingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <FileX size={14} strokeWidth={2} />}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- FOOTER PAGINATION --- */}
        {totalPages > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-slate-400 font-normal">
              Showing <span className="font-medium text-slate-600">{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, residents.length)}</span> of <span className="font-medium text-slate-600">{residents.length}</span> records
            </span>
            
            <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm p-1">
              <button onClick={handlePrevPage} disabled={currentPage === 1} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
              
              <div className="px-4 py-1 text-sm font-normal text-slate-600 min-w-[100px] text-center">
                Page {currentPage} of {totalPages}
              </div>

              <button onClick={handleNextPage} disabled={currentPage === totalPages} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <ChevronRight size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}