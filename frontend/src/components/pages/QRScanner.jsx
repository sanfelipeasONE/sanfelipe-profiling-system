import { useEffect, useRef, useState } from "react";
import api from "../../api/api";

export default function QRScanner() {
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);

  const [scanValue, setScanValue] = useState("");
  const [resident, setResident] = useState(null);
  const [status, setStatus] = useState({ state: "idle", message: "" });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const searchResident = async (code) => {
    if (!code) return;

    setStatus({ state: "loading", message: "VERIFYING RECORD..." });
    setResident(null);

    try {
      const { data } = await api.get(`/residents/code/${code}`);
      setResident(data);
      setStatus({ state: "success", message: "VERIFICATION AUTHORIZED" });
    } catch {
      setStatus({
        state: "error",
        message: "RECORD NOT FOUND OR UNAUTHORIZED",
      });
    }

    setScanValue("");
    inputRef.current?.focus();
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setScanValue(value);

    // Clear previous timer
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    // If no new typing in 200ms → treat as complete scan
    typingTimeout.current = setTimeout(() => {
      searchResident(value.trim());
    }, 200);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-8 font-sans text-gray-900">
      
      {/* Official Header */}
      <div className="text-center mb-6 pb-4 border-b-2 border-red-800">
        <h2 className="text-2xl font-bold uppercase tracking-wide text-gray-900">
          Resident Identification Scanner
        </h2>
        <p className="text-red-800 font-bold text-xs mt-1 uppercase tracking-widest">
          Authorized Personnel Only
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-red-50 p-5 border border-red-200 rounded-sm shadow-sm">
        <label className="block text-xs font-bold text-red-900 uppercase tracking-wide mb-2">
          Scan QR Code / Enter Registry ID
        </label>
        <input
          ref={inputRef}
          type="text"
          value={scanValue}
          onChange={handleChange}
          placeholder="AWAITING INPUT..."
          autoComplete="off"
          className="w-full p-3 border-2 border-red-200 bg-white text-gray-900 text-lg uppercase placeholder:text-gray-400 focus:border-red-800 focus:ring-0 focus:outline-none transition-none rounded-sm"
        />
        
        {/* Status Area */}
        <div className="h-6 mt-3 text-left font-bold tracking-wide">
          {status.state === "loading" && (
            <p className="text-red-700 text-xs flex items-center gap-2">
              <span className="w-2 h-2 bg-red-700 rounded-full animate-pulse"></span>
              {status.message}
            </p>
          )}
          {status.state === "error" && (
            <p className="text-red-700 text-xs bg-red-100 py-1 px-2 border border-red-300 inline-block">
              ⚠ {status.message}
            </p>
          )}
        </div>
      </div>

      {/* Official Resident Data Record */}
      {resident && status.state === "success" && (
        <div className="mt-6 bg-white border-2 border-gray-300 rounded-sm shadow-sm overflow-hidden">
          
          {/* Card Header */}
          <div className="bg-red-800 px-6 py-4 text-white border-b-4 border-red-900">
            <h3 className="text-xl font-bold uppercase tracking-wider">
              {resident.last_name}, {resident.first_name} {resident.middle_name || ""}
            </h3>
            <p className="text-red-100 text-sm font-medium mt-1 uppercase tracking-wide">
              {resident.barangay} – Purok {resident.purok}
            </p>
          </div>

          {/* Data Grid (Table-like format) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 border-b border-gray-200">
            
            <div className="p-4 bg-red-50/50">
              <span className="block text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Birthdate</span>
              <p className="text-sm font-medium text-gray-900">{resident.birthdate || "N/A"}</p>
            </div>

            <div className="p-4 bg-white">
              <span className="block text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Civil Status</span>
              <p className="text-sm font-medium text-gray-900">{resident.civil_status || "N/A"}</p>
            </div>

            <div className="p-4 bg-white sm:border-t border-gray-200">
              <span className="block text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Religion</span>
              <p className="text-sm font-medium text-gray-900">{resident.religion || "N/A"}</p>
            </div>

            <div className="p-4 bg-red-50/50 sm:border-t border-gray-200">
              <span className="block text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Occupation</span>
              <p className="text-sm font-medium text-gray-900">{resident.occupation || "N/A"}</p>
            </div>

            <div className="p-4 bg-red-50/50 border-t border-gray-200">
              <span className="block text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Contact No.</span>
              <p className="text-sm font-medium text-gray-900">{resident.contact_no || "N/A"}</p>
            </div>

            <div className="p-4 bg-white border-t border-gray-200">
              <span className="block text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Precinct No.</span>
              <p className="text-sm font-medium text-gray-900">{resident.precinct_no || "N/A"}</p>
            </div>

          </div>

          {/* Sector Info */}
          {resident.sector_summary && (
            <div className="p-4 bg-red-50 border-b border-gray-200">
              <span className="block text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Designated Sector</span>
              <p className="text-sm font-bold text-gray-900 uppercase">
                {resident.sector_summary}
              </p>
            </div>
          )}

          {/* Household Members Table */}
          {resident.family_members?.length > 0 && (
            <div className="p-0 bg-white">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h4 className="font-bold text-red-800 text-xs uppercase tracking-wider">Registered Household Members</h4>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-red-50 border-b border-gray-200 text-xs text-red-900 uppercase tracking-wider">
                    <th className="py-2 px-4 font-bold border-r border-gray-200 w-2/3">Full Name</th>
                    <th className="py-2 px-4 font-bold">Relationship</th>
                  </tr>
                </thead>
                <tbody>
                  {resident.family_members.map((fm) => (
                    <tr key={fm.id} className="border-b border-gray-100 last:border-none text-sm hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900 border-r border-gray-200 uppercase">
                        {fm.last_name}, {fm.first_name}
                      </td>
                      <td className="py-3 px-4 text-gray-600 uppercase text-xs font-bold">
                        {fm.relationship}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}
    </div>
  );
}