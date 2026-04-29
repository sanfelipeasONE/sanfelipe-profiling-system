import { useEffect, useState, Fragment } from 'react';
import api from '../../api/api';
import {
  Search, ChevronDown, ChevronUp,
  Loader2, Filter, FileBadge, Users,
  ChevronLeft, ChevronRight, X, Archive, Edit, ShieldAlert, IdCard
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { createPortal } from "react-dom";
import ImportSeniorButton from './ImportSeniorButton';
import { useNavigate } from 'react-router-dom';

export default function SeniorList({ userRole, onEdit }) {
  const [seniors, setSeniors] = useState([]);
  const [barangayList, setBarangayList] = useState([]);
  
  // --- FILTERS STATE ---
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedAgeRange, setSelectedAgeRange] = useState(''); // NEW AGE FILTER
  const [searchTerm, setSearchTerm] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Modal States
  const [archiveModal, setArchiveModal] = useState({ isOpen: false, id: null, name: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  const role = (userRole || "").toLowerCase();
  const isAdmin = role === "admin";
  const isSuperAdmin = role === "super_admin";
  const isOscaAdmin = role === "osca_admin";

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
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // --- DATA FETCHING ---
  const fetchSeniors = async (
    search = searchTerm,
    barangay = selectedBarangay,
    ageRange = selectedAgeRange, // ADDED TO FETCH
    page = currentPage,
    limit = itemsPerPage
  ) => {
    setLoading(true);
    const skip = (page - 1) * limit;
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (barangay) params.append("barangay", barangay);
      if (ageRange) params.append("age_range", ageRange); // SEND TO BACKEND
      params.append('skip', skip);
      params.append('limit', limit);

      const response = await api.get(`/osca/seniors/?${params.toString()}`);
      const data = response.data;

      if (data.items) {
        setSeniors(data.items);
        setTotalItems(data.total || 0);
      } else {
        setSeniors([]);
        setTotalItems(0);
      }
    } catch (error) {
      toast.error("System Error: Unable to retrieve OSCA records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await api.get("/barangays/");
        setBarangayList(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setBarangayList([]);
      }
    };
    fetchBarangays();
  }, []);

  // ADDED selectedAgeRange to Dependency Array
  useEffect(() => {
    fetchSeniors(searchTerm, selectedBarangay, selectedAgeRange, currentPage, itemsPerPage);
  }, [currentPage, itemsPerPage, selectedBarangay, selectedAgeRange, searchTerm]);

  // --- HANDLERS ---
  const handleSearchChange = (e) => { setSearchTerm(e.target.value); setCurrentPage(1); };
  const handleBarangayFilter = (e) => { setSelectedBarangay(e.target.value); setCurrentPage(1); };
  const handleAgeFilter = (e) => { setSelectedAgeRange(e.target.value); setCurrentPage(1); }; // NEW HANDLER
  const handleLimitChange = (e) => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); };
  const toggleRow = (id) => { setExpandedRow(expandedRow === id ? null : id); };

  // --- ACTIONS ---
  const confirmArchive = async () => {
    setIsProcessing(true);
    try {
      await api.put(`/osca/seniors/${archiveModal.id}/archive`);
      toast.success("Senior record archived successfully.");
      setArchiveModal({ isOpen: false, id: null, name: '' });
      fetchSeniors(searchTerm, selectedBarangay, selectedAgeRange, currentPage, itemsPerPage);
    } catch (err) {
      toast.error("Failed to archive record.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- DETAILS SUB-RENDER FUNCTION ---
  const renderSeniorDetails = (r) => {
    return (
      <div className="bg-stone-100 p-4 md:p-8 shadow-inner rounded-b-xl border-t-2 border-stone-200">
        <div className="flex flex-wrap items-center gap-3 mb-6 border-b border-stone-300 pb-4">
          <div className="p-2 bg-red-600 text-white rounded-lg shadow-sm"><FileBadge size={18} /></div>
          <h3 className="text-lg font-medium text-stone-900 tracking-tight">OSCA Record Details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-stone-300 rounded-xl p-4 md:p-5 shadow-sm">
            <h4 className="text-xs font-medium text-stone-700 uppercase tracking-wider mb-4 border-b border-stone-100 pb-3 flex justify-between items-center">
              OSCA Information
              {r.photo_url && (
                <img src={r.photo_url} alt="Senior" className="w-12 h-12 md:w-14 md:h-14 object-cover rounded-full border-2 border-stone-200 shadow-sm" />
              )}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Control Number</p>
                <p className="text-sm font-mono font-bold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-100 inline-block break-all">{r.osca_control_no || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Date Issued</p>
                <p className="text-sm font-normal text-stone-800">{formatDate(r.date_issued)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Full Name</p>
                <p className="text-sm font-normal text-stone-800 uppercase">{r.last_name}, {r.first_name} {r.middle_name || ''}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Sex</p>
                <p className="text-sm font-normal text-stone-800 uppercase">{r.sex || 'Unspecified'}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Age</p>
                <p className="text-sm font-normal text-stone-800">{calculateAge(r.birthdate)} Years Old</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Date of Birth</p>
                <p className="text-sm font-normal text-stone-800">{formatDate(r.birthdate)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Civil Status</p>
                <p className="text-sm font-normal text-stone-800 uppercase">{r.civil_status || 'Unspecified'}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Education</p>
                <p className="text-sm font-normal text-stone-800 uppercase">{r.educational_attainment || 'Unspecified'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-stone-300 rounded-xl p-4 md:p-5 shadow-sm">
            <h4 className="text-xs font-medium text-stone-700 uppercase tracking-wider mb-4 border-b border-stone-100 pb-3">Location Details</h4>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4">
              <div>
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Barangay</p>
                <p className="text-sm font-normal text-stone-800 uppercase">{r.barangay || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">Purok / Sitio</p>
                <p className="text-sm font-normal text-stone-800 uppercase">{r.purok || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1">House No / Street</p>
                <p className="text-sm font-normal text-stone-800 uppercase break-words">{r.house_no || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="font-sans text-stone-900 animate-in fade-in duration-300 px-2 sm:px-4 md:px-0 pb-12">
      {createPortal(
        <Toaster position="top-right" toastOptions={{ style: { background: '#1c1917', color: '#fff', borderRadius: '12px', fontSize: '14px' } }} />,
        document.body
      )}

      {/* --- HEADER --- */}
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <div className="flex items-center gap-2 text-red-600 mb-2">
              <div className="p-1.5 md:p-2 bg-red-100 rounded-lg border border-red-200 shadow-sm"><Users size={16} strokeWidth={2} /></div>
              <span className="text-[10px] md:text-xs font-medium tracking-widest uppercase">Office of Senior Citizens Affairs</span>
           </div>
           <h1 className="text-2xl md:text-3xl font-medium text-stone-900 tracking-tight">Senior Citizen Database</h1>
        </div>

        {/* IMPORT BUTTON */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
          {(isAdmin || isSuperAdmin || isOscaAdmin) && (
            <ImportSeniorButton onSuccess={() => fetchSeniors()} />
          )}
        </div>
      </div>

      {/* --- TOOLBAR --- */}
      <div className="bg-stone-100 border border-stone-300 rounded-t-2xl p-4 md:p-5 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between shadow-sm">
         <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full lg:flex-1">
            
            {/* SEARCH BAR */}
            <div className="relative w-full lg:max-w-md group">
               <div className="absolute left-3 md:left-4 top-3.5 text-stone-400 group-focus-within:text-red-600 transition-colors">
                  <Search size={18} strokeWidth={2} />
               </div>
               <input 
                  type="text" 
                  placeholder="Search name or Control No..." 
                  value={searchTerm} 
                  onChange={handleSearchChange} 
                  className="w-full pl-10 md:pl-11 pr-10 py-3 bg-white border border-stone-300 rounded-xl text-sm font-normal text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-red-600 focus:ring-4 focus:ring-red-100 transition-all shadow-sm uppercase"
               />
               {searchTerm && (
                 <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} className="absolute right-3 top-3 text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg p-1 transition-colors">
                   <X size={16} strokeWidth={2} />
                 </button>
               )}
            </div>

            {/* FILTER ROW (Barangay + Age) */}
            <div className="flex flex-row gap-3 w-full sm:w-auto">
                {/* BARANGAY DROPDOWN */}
                <div className="relative w-full sm:w-48 shrink-0 flex-1 sm:flex-none">
                  <select value={selectedBarangay} onChange={handleBarangayFilter} className="w-full appearance-none pl-3 md:pl-4 pr-9 md:pr-10 py-3 bg-white border border-stone-300 rounded-xl text-[11px] md:text-sm font-normal text-stone-700 hover:border-stone-400 focus:outline-none focus:border-red-600 focus:ring-4 focus:ring-red-100 transition-all cursor-pointer shadow-sm uppercase truncate">
                    <option value="">ALL BARANGAYS</option>
                    {barangayList.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                  <Filter className="absolute right-3 top-3.5 text-stone-400 pointer-events-none" size={18} strokeWidth={2} />
                </div>

                {/* NEW AGE FILTER DROPDOWN */}
                <div className="relative w-full sm:w-40 shrink-0 flex-1 sm:flex-none">
                  <select value={selectedAgeRange} onChange={handleAgeFilter} className="w-full appearance-none pl-3 md:pl-4 pr-9 md:pr-10 py-3 bg-white border border-stone-300 rounded-xl text-[11px] md:text-sm font-normal text-stone-700 hover:border-stone-400 focus:outline-none focus:border-red-600 focus:ring-4 focus:ring-red-100 transition-all cursor-pointer shadow-sm uppercase truncate">
                    <option value="">ALL AGES</option>
                    <option value="60-69">60-69 YEARS OLD</option>
                    <option value="70-79">70-79 YEARS OLD</option>
                    <option value="80-89">80-89 YEARS OLD</option>
                    <option value="90-99">90-99 YEARS OLD</option>
                    <option value="100-110">100-110 YEARS OLD</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3.5 text-stone-400 pointer-events-none" size={18} strokeWidth={2} />
                </div>
            </div>
         </div>

         {/* LIMIT FILTER */}
         <div className="w-full lg:w-auto flex justify-end mt-2 lg:mt-0">
           <div className="flex items-center gap-2 text-[11px] md:text-sm font-normal text-stone-600 bg-white px-3 md:px-4 py-2 rounded-xl border border-stone-300 shadow-sm">
               <span className="uppercase tracking-widest text-[10px]">Show:</span>
               <select value={itemsPerPage} onChange={handleLimitChange} className="bg-transparent font-medium text-stone-800 outline-none cursor-pointer hover:text-red-700 transition-colors">
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
                <th className="py-3 md:py-4 px-3 md:px-5">IDENTITY</th>
                <th className="py-3 md:py-4 px-3 md:px-5">OSCA DETAILS</th>
                <th className="py-3 md:py-4 px-3 md:px-5">BARANGAY/PUROK</th>
                <th className="py-3 md:py-4 px-3 md:px-5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="text-[13px] md:text-sm">
              {loading ? (
                 <tr>
                   <td colSpan="5" className="py-24 md:py-32 text-center">
                      <div className="flex flex-col items-center gap-3">
                         <Loader2 className="animate-spin text-red-600" size={32} strokeWidth={2}/>
                         <span className="text-[10px] md:text-xs font-normal text-stone-400 uppercase tracking-widest">Accessing OSCA Database...</span>
                      </div>
                   </td>
                 </tr>
              ) : seniors.length === 0 ? (
                 <tr>
                   <td colSpan="5" className="py-16 md:py-24 text-center">
                     <div className="inline-flex flex-col items-center justify-center text-stone-400">
                       <Search size={32} strokeWidth={1.5} className="mb-3 opacity-30" />
                       <span className="font-medium text-stone-500 text-base md:text-lg">No records found.</span>
                     </div>
                   </td>
                 </tr>
              ) : (
                seniors.map((r) => (
                  <Fragment key={r.id}>
                    <tr onClick={() => toggleRow(r.id)} className={`border-b border-stone-200 cursor-pointer transition-colors ${expandedRow === r.id ? 'bg-red-50/70' : 'hover:bg-stone-50'}`}>
                      <td className="py-3 md:py-4 px-3 md:px-5 text-center align-middle">
                         <div className={`mx-auto flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-lg transition-all ${expandedRow === r.id ? 'bg-red-600 text-white shadow-sm' : 'bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-700'}`}>
                           {expandedRow === r.id ? <ChevronUp size={14} strokeWidth={2}/> : <ChevronDown size={14} strokeWidth={2}/>}
                         </div>
                      </td>

                      {/* IDENTITY */}
                      <td className="py-3 md:py-4 px-3 md:px-5 align-middle">
                        <div className="flex items-center gap-3 md:gap-4">
                          {r.photo_url ? (
                            <img src={r.photo_url} alt="Senior" className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-stone-200 shadow-sm shrink-0" />
                          ) : (
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-stone-100 border-2 border-stone-200 flex items-center justify-center text-[9px] md:text-[10px] font-normal text-stone-400 uppercase tracking-wider shrink-0">
                              N/A
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-stone-800 text-[13px] md:text-[15px] tracking-tight uppercase truncate">
                              {r.last_name}, {r.first_name} {r.middle_name || ''} {r.ext_name || ''}
                            </span>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="px-1 md:px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded text-[9px] md:text-[10px] font-normal uppercase tracking-wider border border-stone-200">
                                {r.sex || 'N/A'}
                              </span>
                              <span className="text-[10px] md:text-xs font-normal text-stone-400 uppercase">
                                Age: {calculateAge(r.birthdate)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* OSCA DETAILS */}
                      <td className="py-3 md:py-4 px-3 md:px-5 align-middle">
                         <span className="block font-medium text-red-700 font-mono uppercase tracking-wide truncate">{r.osca_control_no}</span>
                         <span className="text-[10px] md:text-xs font-normal text-stone-400 uppercase">Issued: {formatDate(r.date_issued)}</span>
                      </td>

                      {/* ADDRESS */}
                      <td className="py-3 md:py-4 px-3 md:px-5 align-middle">
                         <span className="block font-medium text-stone-700 uppercase tracking-wide truncate max-w-[150px] md:max-w-[200px]">{r.barangay}</span>
                         <span className="block text-[10px] md:text-xs font-normal text-stone-400 uppercase truncate max-w-[150px] md:max-w-[200px]">
                            {r.purok} {r.house_no ? `#${r.house_no}` : ""}
                         </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3 md:py-4 px-3 md:px-5 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5 md:gap-2">
                          <button onClick={() => onEdit(r)} className="p-2 md:p-2.5 bg-stone-100 text-stone-500 hover:bg-red-700 hover:text-white rounded-lg transition-all shadow-sm border border-stone-200 hover:border-blue-600 shrink-0" title="Edit Senior">
                              <Edit size={14} className="md:w-4 md:h-4" strokeWidth={2} />
                          </button>
                          <button onClick={() => navigate(`/dashboard/seniors/${r.id}/card`)} className="p-2 md:p-2.5 bg-stone-100 text-stone-500 hover:bg-red-700 hover:text-white rounded-lg transition-all shadow-sm border border-stone-200 hover:border-emerald-600 shrink-0" title="View ID Card">
                              <IdCard size={14} className="md:w-4 md:h-4" strokeWidth={2} />
                          </button>
                          <button onClick={() => setArchiveModal({ isOpen: true, id: r.id, name: `${r.first_name} ${r.last_name}` })} className="p-2 md:p-2.5 bg-stone-100 text-stone-500 hover:bg-red-700 hover:text-white rounded-lg transition-all shadow-sm border border-stone-200 hover:border-orange-700 shrink-0" title="Archive Senior">
                              <Archive size={14} className="md:w-4 md:h-4" strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* EXPANDED DETAILS */}
                    {expandedRow === r.id && (
                      <tr>
                        <td colSpan="5" className="p-0">
                          {renderSeniorDetails(r)}
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
            Total OSCA Records: <span className="font-medium text-stone-800 text-sm md:text-base">{totalItems}</span>
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

      {/* --- ARCHIVE MODAL --- */}
      {archiveModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setArchiveModal({ isOpen: false, id: null, name: '' })} />
          <div className="relative bg-white w-full max-w-[420px] rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-5 border-4 bg-orange-100 text-orange-600 border-orange-50">
                <ShieldAlert size={28} className="md:w-8 md:h-8" />
              </div>
              <h3 className="text-lg md:text-xl font-medium text-stone-900 tracking-tight mb-2">
                Confirm Archive
              </h3>
              <p className="text-xs md:text-sm font-normal text-stone-600 leading-relaxed mb-6 md:mb-8">
                You are about to hide the record for {archiveModal.name} from the active database.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => setArchiveModal({ isOpen: false, id: null, name: '' })} className="flex-1 px-4 py-3 border-2 border-stone-200 text-stone-600 text-sm font-medium rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-colors">
                  Cancel
                </button>
                <button onClick={confirmArchive} className="flex-1 px-4 py-3 text-white text-sm font-medium rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700" disabled={isProcessing}>
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : "Archive Record"}
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