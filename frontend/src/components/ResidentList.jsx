import { useState, useEffect } from 'react';
import api from '../api';
import { ChevronDown, ChevronRight, Trash2, User, Users } from 'lucide-react';

export default function ResidentList() {
  const [residents, setResidents] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    fetchResidents();
  }, []);

  const fetchResidents = async () => {
    try {
      const response = await api.get('/residents/');
      setResidents(response.data);
    } catch (error) {
      console.error("Error fetching residents:", error);
    }
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this resident?")) {
      try {
        await api.delete(`/residents/${id}`);
        fetchResidents(); 
      } catch (error) {
        alert("Failed to delete.");
      }
    }
  };

  const getAge = (birthdate) => {
    if (!birthdate) return "N/A";
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users size={24} /> Resident Directory
        </h2>
        <span className="bg-blue-500 px-3 py-1 rounded-full text-sm">
          Total: {residents.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700 text-sm uppercase">
              <th className="p-4 w-12"></th>
              <th className="p-4">Name</th>
              <th className="p-4">Address (Purok)</th>
              <th className="p-4">Age / Sex</th>
              <th className="p-4">Sectors</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {residents.map((resident) => (
              <>
                <tr 
                  key={resident.id} 
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleRow(resident.id)}
                >
                  <td className="p-4 text-gray-400">
                    {expandedRow === resident.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </td>
                  <td className="p-4 font-medium text-gray-900">
                    {resident.last_name}, {resident.first_name}
                  </td>
                  <td className="p-4 text-gray-600">
                    {resident.purok}, {resident.barangay}
                  </td>
                  <td className="p-4 text-gray-600">
                    {getAge(resident.birthdate)} / {resident.sex}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1 flex-wrap">
                      {resident.sectors && resident.sectors.length > 0 ? (
                        resident.sectors.map((sector) => (
                          <span 
                            key={sector.id} 
                            className={`text-xs px-2 py-1 rounded border ${
                              sector.name === "Others" 
                                ? "bg-yellow-100 text-yellow-800 border-yellow-200" // Different color for "Others"
                                : "bg-blue-100 text-blue-800 border-blue-200"
                            }`}
                          >
                            {/* SMART DISPLAY LOGIC: */}
                            {sector.name === "Others" && resident.other_sector_details 
                              ? `Others: ${resident.other_sector_details}` 
                              : sector.name
                            }
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 text-xs italic">None</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(resident.id); }}
                      className="text-red-500 hover:text-red-700 p-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>

                {expandedRow === resident.id && (
                  <tr className="bg-blue-50">
                    <td colSpan="6" className="p-4 pl-12">
                      <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                        <User size={16}/> Family Members
                      </h4>
                      {resident.family_members.length > 0 ? (
                        <table className="w-full text-sm bg-white rounded border">
                          <thead>
                            <tr className="text-gray-500 border-b">
                              <th className="p-2 text-left">Name</th>
                              <th className="p-2 text-left">Relationship</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resident.family_members.map((member) => (
                              <tr key={member.id} className="border-b last:border-0">
                                <td className="p-2 font-medium">
                                  {member.last_name}, {member.first_name} {member.middle_name}
                                </td>
                                <td className="p-2 text-gray-600">{member.relationship}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-gray-500 italic text-sm">No family members listed.</p>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}