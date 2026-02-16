import { useEffect, useState } from 'react';
import api from '../../api/api';
import toast, { Toaster } from 'react-hot-toast';
import { RotateCcw, Archive, Loader2, FileX, ChevronLeft, ChevronRight, Search, ShieldAlert } from 'lucide-react';

export default function ArchivedResidents() {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; 

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

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(residents.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentData = residents.slice(indexOfFirstItem, indexOfLastItem);

  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 size={40} className="animate-spin text-rose-600" />
        <span className="text-xs font-bold uppercase tracking-widest text-rose-800">Retrieving Archival Data...</span>
      </div>
    );
  }

  return (
    <div className="font-sans text-stone-800 animate-in fade-in duration-300">
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: { 
            background: '#881337', // Rose-900
            color: '#fff',
            borderRadius: '4px',
            fontSize: '13px'
          }
        }} 
      />

      {/* --- ADMINISTRATIVE HEADER --- */}
      <div className="mb-6 border-b-2 border-stone-200 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-sm">
            <Archive size={24} className="text-rose-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900 uppercase tracking-tight">
              Archived Resident Registry
            </h1>
          </div>
        </div>
        
        {/* Stat Counter */}
        <div className="bg-white border border-stone-200 border-l-4 border-l-rose-600 px-5 py-2 rounded-sm shadow-sm">
          <span className="text-xs font-bold text-stone-400 uppercase mr-3">Total Inactive</span>
          <span className="text-xl font-bold text-rose-700">{residents.length}</span>
        </div>
      </div>

      {/* --- DATA TABLE CONTAINER --- */}
      <div className="bg-white border border-stone-200 shadow-sm rounded-sm overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="bg-rose-50/50 border-b border-rose-100 px-4 py-3 flex items-center justify-between">
           <div className="flex items-center gap-2 text-rose-800">
             <ShieldAlert size={14} />
             <span className="text-xs font-bold uppercase tracking-wider">Restricted Access • Archival View</span>
           </div>
           
           <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-stone-200 rounded-sm">
             <Search size={14} className="text-stone-400"/>
             <span className="text-xs text-stone-400">Filter records...</span>
           </div>
        </div>

        {residents.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-24 text-center bg-stone-50/50">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-stone-300 mb-4 border border-stone-200">
              <FileX size={32} />
            </div>
            <h3 className="text-stone-900 font-bold">No Records Found</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-xs">The archival database is currently empty.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs uppercase tracking-wider text-stone-600 font-bold">
                  <th className="px-6 py-4 w-24">Reference ID</th>
                  <th className="px-6 py-4">Resident Name</th>
                  <th className="px-6 py-4">Barangay</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {currentData.map((r) => (
                  <tr key={r.id} className="hover:bg-rose-50/30 transition-colors group">
                    <td className="px-6 py-4 font-mono text-rose-400 text-xs font-medium">
                      RES-{String(r.id).padStart(4, '0')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-stone-800 group-hover:text-rose-900 transition-colors">
                          {r.last_name}, {r.first_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-200 uppercase tracking-wide">
                        {r.barangay}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex gap-1.5 items-center px-2.5 py-1 rounded-sm text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                        Archived
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRestore(r.id)}
                        disabled={restoringId === r.id}
                        className="
                          relative overflow-hidden inline-flex items-center gap-2 px-4 py-1.5 
                          text-xs font-bold text-rose-700 
                          bg-white border border-rose-200 
                          hover:bg-rose-600 hover:text-white hover:border-rose-600
                          rounded-sm transition-all duration-200
                          disabled:opacity-50 disabled:cursor-not-allowed
                          shadow-sm
                        "
                      >
                        {restoringId === r.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RotateCcw size={12} />
                        )}
                        {restoringId === r.id ? "PROCESSING" : "RESTORE"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- FOOTER PAGINATION --- */}
        {totalPages > 1 && (
          <div className="bg-stone-50 border-t border-stone-200 px-6 py-3 flex items-center justify-between">
            <p className="text-xs font-medium text-stone-500">
              Displaying <span className="font-bold text-stone-700">{indexOfFirstItem + 1}</span> to <span className="font-bold text-stone-700">{Math.min(indexOfLastItem, residents.length)}</span> of {residents.length} records
            </p>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={handlePrevPage} 
                disabled={currentPage === 1}
                className="p-1.5 rounded-sm border border-stone-300 text-stone-600 hover:bg-white hover:border-rose-300 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="px-3 py-1 bg-white border border-stone-300 text-xs font-bold text-rose-900 rounded-sm">
                 Page {currentPage} of {totalPages}
              </div>

              <button 
                onClick={handleNextPage} 
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-sm border border-stone-300 text-stone-600 hover:bg-white hover:border-rose-300 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}