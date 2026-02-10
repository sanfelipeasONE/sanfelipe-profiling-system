import { useEffect, useState, Fragment } from 'react';
import api from '../api';
import {
  Trash2,
  Edit,
  Search,
  ChevronDown,
  ChevronUp,
  Users,
  MapPin,
  Calendar,
  AlertTriangle
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
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, residentId: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchResidents = async (search = '') => {
    setLoading(true);
    try {
      const query = search ? `?search=${search}` : '';
      const response = await api.get(`/residents/${query}`);
      setResidents(response.data);
    } catch (error) {
      toast.error('Failed to load residents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const response = await api.get('/barangays/');
        setBarangayList(response.data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchBarangays();
    fetchResidents();
  }, []);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    fetchResidents(e.target.value);
  };

  const promptDelete = (id, e) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, residentId: id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.residentId) return;

    setIsDeleting(true);
    try {
      await api.delete(`/residents/${deleteModal.residentId}`);
      toast.success('Resident deleted successfully.');
      setDeleteModal({ isOpen: false, residentId: null });
      fetchResidents(searchTerm);
    } catch {
      toast.error('Failed to delete resident.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="bg-white border border-gray-200 overflow-hidden">
      <Toaster position="top-center" />

      {/* HEADER */}
      <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Resident Database
          </h2>
          <p className="text-sm text-gray-500">
            List of all registered residents.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedBarangay}
            onChange={(e) => setSelectedBarangay(e.target.value)}
            className="border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
          >
            <option value="">All Barangays</option>
            {barangayList.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>

          <ExportButton barangay={selectedBarangay} />

          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={handleSearch}
              className="pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-red-700"
            />
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-10"></th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Birthdate</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Address</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Sector</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-10 text-gray-500">
                  Loading records...
                </td>
              </tr>
            ) : residents.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-10 text-gray-500">
                  No records found.
                </td>
              </tr>
            ) : (
              residents.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => toggleRow(r.id)}
                    className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="pl-4 text-gray-400">
                      {expandedRow === r.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </td>

                    <td className="px-4 py-3 font-medium text-gray-800">
                      {r.last_name}, {r.first_name}
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      <Calendar size={12} className="inline mr-1" />
                      {formatDate(r.birthdate)}
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      <MapPin size={12} className="inline mr-1" />
                      {r.house_no} {r.purok}, {r.barangay}
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {r.sector_summary || 'None'}
                    </td>

                    <td
                      className="px-4 py-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {userRole === 'admin' ? (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => onEdit(r)}
                            className="text-gray-600 hover:text-red-700"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={(e) => promptDelete(r.id, e)}
                            className="text-gray-600 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Read Only</span>
                      )}
                    </td>
                  </tr>

                  {expandedRow === r.id && (
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <td colSpan="6" className="p-6 text-sm text-gray-700">
                        <div className="grid md:grid-cols-2 gap-6">
                          <div>
                            <p><strong>Civil Status:</strong> {r.civil_status}</p>
                            <p><strong>Contact:</strong> {r.contact_no || 'N/A'}</p>
                            <p><strong>Precinct No:</strong> {r.precinct_no || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="font-semibold mb-2 flex items-center gap-2">
                              <Users size={14} /> Family Members
                            </p>
                            {r.family_members?.length > 0 ? (
                              r.family_members.map((fm, idx) => (
                                <div key={idx}>
                                  {fm.first_name} {fm.last_name} ({fm.relationship})
                                </div>
                              ))
                            ) : (
                              <p className="text-gray-500">No family members recorded.</p>
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

      {/* DELETE MODAL */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30">
          <div className="bg-white border border-gray-200 p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-700" />
              <h3 className="font-semibold text-gray-800">
                Confirm Deletion
              </h3>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              This action will permanently delete the selected resident record.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, residentId: null })}
                className="px-4 py-2 border border-gray-300 text-sm"
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-700 text-white text-sm"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}