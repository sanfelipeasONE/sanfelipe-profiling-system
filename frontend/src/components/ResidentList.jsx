import { useEffect, useState, Fragment } from 'react';
import api from '../api';
import { Trash2, Edit, Search, ChevronDown, ChevronUp, MapPin, Calendar, AlertCircle, Loader2, Filter, Phone, Fingerprint, Heart, User } from 'lucide-react';
import ExportButton from './ExportButton';
import toast, { Toaster } from 'react-hot-toast';

export default function ResidentList({ userRole, onEdit }) {
  const [residents, setResidents] = useState([]);
  const [barangayList, setBarangayList] = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null); // Tracks which ID is expanded
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, residentId: null, name: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchResidents = async (search = '', barangay = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (barangay) params.append('barangay', barangay);
      const response = await api.get(`/residents/?${params.toString()}`);
      setResidents(response.data);
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
    fetchResidents();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
      fetchResidents(searchTerm, selectedBarangay);
    } catch (err) { toast.error('Error deleting record.'); }
    finally { setIsDeleting(false); }
  };

  // --- RENDER DETAIL COMPONENT ---
  const ResidentDetails = ({ r }) => (
    <div className="p-5 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-stone-50/50 border-t border-stone-100 animate-in slide-in-from-top-2 duration-300">
      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
          <User size={14} /> Personal Details
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-stone-400 uppercase font-bold">Civil Status</p>
            <p className="text-sm font-semibold text-stone-700">{r.civil_status || 'N/A'}</p>
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
      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
          <Heart size={14} /> Family Background
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
          <p className="text-xs text-stone-400 italic">No family members recorded.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <Toaster position="top-center" />

      {/* SEARCH & FILTERS */}
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
              onChange={(e) => { setSearchTerm(e.target.value); fetchResidents(e.target.value, selectedBarangay); }}
              className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm"
            />
            <Search className="absolute left-3 top-3.5 text-stone-400 group-focus-within:text-rose-500" size={18} />
          </div>

          {userRole === 'admin' && (
            <div className="relative">
              <select
                value={selectedBarangay}
                onChange={(e) => { setSelectedBarangay(e.target.value); fetchResidents(searchTerm, e.target.value); }}
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

      {/* MOBILE LIST */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="py-10 text-center text-stone-400"><Loader2 className="animate-spin mx-auto mb-2" /> Loading...</div>
        ) : residents.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
            <div className="p-5 space-y-4" onClick={() => toggleRow(r.id)}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-stone-900">{r.last_name}, {r.first_name}</h3>
                  <p className="text-xs text-rose-600 font-bold uppercase tracking-wide">{r.occupation || "Unemployed"}</p>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onEdit(r)} className="p-2 bg-stone-50 text-stone-500 rounded-lg"><Edit size={16}/></button>
                  <button onClick={() => setDeleteModal({ isOpen: true, residentId: r.id, name: r.first_name })} className="p-2 bg-red-50 text-red-500 rounded-lg"><Trash2 size={16}/></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[11px] text-stone-500 uppercase font-bold tracking-wider">
                <div className="flex items-center gap-2"><MapPin size={14}/> {r.barangay}</div>
                <div className="flex items-center gap-2"><Calendar size={14}/> {formatDate(r.birthdate)}</div>
              </div>
              <div className="flex justify-center text-stone-300">
                {expandedRow === r.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>
            {expandedRow === r.id && <ResidentDetails r={r} />}
          </div>
        ))}
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
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
              {residents.map((r) => (
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
                      <p className="text-[10px] text-rose-500 font-bold uppercase">{r.occupation || "N/A"}</p>
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
                        <button onClick={() => setDeleteModal({ isOpen: true, residentId: r.id, name: r.first_name })} className="p-2 text-stone-400 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODERN DELETE MODAL */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false, residentId: null, name: '' })}></div>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full relative animate-in zoom-in-95 duration-200 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3"><AlertCircle size={32}/></div>
              <h3 className="text-xl font-bold text-stone-900">Delete Record?</h3>
              <p className="text-sm text-stone-500 mt-2 mb-8">Permanently remove <span className="font-bold text-stone-800">{deleteModal.name}</span>?</p>
              <div className="space-y-3">
                <button onClick={confirmDelete} className="w-full py-3.5 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-200">
                  {isDeleting ? "Deleting..." : "Confirm Delete"}
                </button>
                <button onClick={() => setDeleteModal({ isOpen: false, residentId: null, name: '' })} className="w-full py-3.5 text-stone-400 font-bold">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}