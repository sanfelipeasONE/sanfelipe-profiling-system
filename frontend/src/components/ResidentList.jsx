import { useEffect, useState, Fragment } from 'react'; 
import api from '../api';
import { Trash2, Edit, Search, Filter, ChevronDown, ChevronUp, Users, MapPin, Calendar } from 'lucide-react';
import ExportButton from './ExportButton'; 

export default function ResidentList({ userRole, onEdit }) {
  const [residents, setResidents] = useState([]);
  
  // --- NEW STATES FOR EXPORT ---
  const [barangayList, setBarangayList] = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState(''); // Default is empty (All)
  
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  // 1. Fetch Residents (List View)
  const fetchResidents = async (search = '') => {
    setLoading(true);
    try {
      const query = search ? `?search=${search}` : '';
      const response = await api.get(`/residents/${query}`);
      setResidents(response.data);
    } catch (error) {
      console.error('Error fetching residents:', error);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Barangays for the Dropdown (Runs once on mount)
  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const response = await api.get('/barangays/');
        setBarangayList(response.data);
      } catch (error) {
        console.error('Error fetching barangays:', error);
      }
    };
    
    fetchBarangays();
    fetchResidents(); 
  }, []);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    fetchResidents(e.target.value);
  };

  // 3. Handle Dropdown Change
  const handleBarangayChange = (e) => {
    setSelectedBarangay(e.target.value);
    // Note: This currently only affects the EXPORT button.
    // If you want the TABLE to filter too, you need to update your backend GET /residents endpoint.
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this resident?')) return;
    try {
      await api.delete(`/residents/${id}`);
      fetchResidents(searchTerm);
    } catch (error) {
      alert('Failed to delete.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* HEADER TOOLBAR */}
      <div className="p-6 border-b border-stone-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-stone-50/50">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Resident Database</h2>
          <p className="text-sm text-stone-500 mt-1">Manage and view all registered residents.</p>
        </div>
        
        {/* RIGHT SIDE ACTIONS */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          
          {/* A. BARANGAY DROPDOWN */}
          <div className="relative">
            <select
              value={selectedBarangay}
              onChange={handleBarangayChange}
              className="appearance-none pl-4 pr-10 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-stone-700 cursor-pointer shadow-sm text-sm h-[42px]"
            >
              <option value="">All Barangays</option>
              {barangayList.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3.5 text-stone-400 pointer-events-none" size={14} />
          </div>

          {/* B. EXPORT BUTTON (Passes the selected barangay prop) */}
          <ExportButton barangay={selectedBarangay} />

          {/* C. SEARCH INPUT */}
          <div className="relative w-full md:w-64 group">
            <input 
              type="text" 
              placeholder="Search residents..." 
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all shadow-sm group-hover:shadow-md text-stone-700 placeholder:text-stone-400 h-[42px]"
            />
            <Search className="absolute left-3 top-3 text-stone-400 group-hover:text-rose-500 transition-colors" size={18} />
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-50/80 border-b border-stone-100">
              <th className="w-12 py-4 px-4"></th>
              <th className="py-4 px-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Name / Occupation</th>
              <th className="py-4 px-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Birthdate</th>
              <th className="py-4 px-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Address</th>
              <th className="py-4 px-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Sector Status</th>
              <th className="py-4 px-4 text-center text-xs font-bold text-stone-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr><td colSpan="6" className="text-center py-12 text-stone-400">Loading data...</td></tr>
            ) : residents.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-12 text-stone-400 italic">No residents found.</td></tr>
            ) : (
              residents.map((r) => (
                <Fragment key={r.id}>
                  <tr 
                    onClick={() => toggleRow(r.id)}
                    className={`group hover:bg-rose-50/30 transition-colors cursor-pointer ${expandedRow === r.id ? 'bg-rose-50/40' : ''}`} 
                  >
                    <td className="pl-6 text-stone-400 group-hover:text-rose-500 transition-colors">
                      {expandedRow === r.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-stone-900 text-sm">
                        {r.last_name}, {r.first_name} <span className="text-stone-400 font-normal">{r.ext_name}</span>
                      </div>
                      <div className="text-xs text-rose-600 font-medium mt-0.5 flex items-center gap-1">
                        {r.occupation || "N/A"}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-stone-600 flex items-center gap-1.5">
                          <Calendar size={12} className="text-stone-400"/> {formatDate(r.birthdate)}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-600 w-fit">
                          {r.sex}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-stone-600 flex items-center gap-1.5">
                          <MapPin size={12} className="text-stone-400"/>
                          {r.house_no} {r.purok}
                      </div>
                      <div className="text-xs text-stone-400 ml-4">{r.barangay}</div>
                    </td>
                    <td className="py-4 px-4">
                      {r.sector_summary ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100 shadow-sm shadow-rose-100/50">
                          {r.sector_summary}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center gap-2">
                        {userRole === 'admin' ? (
                          <>
                            <button 
                              onClick={() => onEdit(r)} 
                              className="p-2 text-stone-500 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition-all" 
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(r.id)} 
                              className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-all" 
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide bg-stone-100 px-2 py-1 rounded">Read Only</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* EXPANDED DETAILS */}
                  {expandedRow === r.id && (
                    <tr className="bg-stone-50/30 border-b border-stone-100 animate-in fade-in zoom-in-95 duration-200">
                      <td colSpan="6" className="p-0">
                        <div className="p-6 pl-16 grid grid-cols-1 md:grid-cols-2 gap-8 bg-gradient-to-br from-rose-50/40 to-stone-50/40 border-y border-rose-100/50 shadow-inner">
                          
                          {/* INFO COLUMN */}
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider mb-2 border-b border-rose-200 pb-2">
                              Personal Information
                            </h4>
                            <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm">
                              <div>
                                <p className="text-xs text-stone-500 uppercase">Civil Status</p>
                                <p className="font-medium text-stone-800">{r.civil_status}</p>
                              </div>
                              <div>
                                <p className="text-xs text-stone-500 uppercase">Contact No</p>
                                <p className="font-medium text-stone-800">{r.contact_no || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-stone-500 uppercase">Precinct No</p>
                                <p className="font-medium text-stone-800">{r.precinct_no || 'N/A'}</p>
                              </div>
                            </div>

                            {(r.civil_status === 'Married' || r.civil_status === 'Live-in Partner') && (
                              <div className="mt-3 p-3 bg-white rounded-lg border border-rose-100 shadow-sm">
                                <p className="text-xs text-rose-500 font-bold mb-1">SPOUSE / PARTNER</p>
                                <p className="text-sm font-medium text-stone-800">
                                  {r.spouse_first_name} {r.spouse_middle_name} {r.spouse_last_name} {r.spouse_ext_name}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* FAMILY COLUMN */}
                          <div>
                            <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider mb-2 border-b border-rose-200 pb-2 flex items-center gap-2">
                              <Users size={14}/> Family Background
                            </h4>
                            {r.family_members && r.family_members.length > 0 ? (
                              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                {r.family_members.map((fm, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-stone-100 text-sm shadow-sm hover:border-rose-200 transition-colors">
                                    <span className="font-medium text-stone-700">{fm.first_name} {fm.last_name}</span>
                                    <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full uppercase">
                                      {fm.relationship}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 border-2 border-dashed border-stone-200 rounded-lg text-stone-400 text-sm">
                                No family members recorded
                              </div>
                            )}
                          </div>

                        </div>
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
  );
}